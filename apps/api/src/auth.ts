import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  getLockoutStatus,
  recordFailedLogin,
  resetFailedLogins,
} from "@/lib/login-rate-limit";
import { getPasswordPolicy, isPasswordExpired } from "@/lib/password-policy";

export const entraEnabled = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        employeeNumber: { label: "Mitarbeiternummer", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.employeeNumber || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { employeeNumber: credentials.employeeNumber as string },
        });

        if (!user || !user.isActive || !user.passwordHash) return null;

        const lockedUntil = await getLockoutStatus(user.id);
        if (lockedUntil) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) {
          await recordFailedLogin(user.id);
          return null;
        }

        await resetFailedLogins(user.id);

        // Expiry-enforcement: if the password is older than the configured
        // max, flip `mustChangePassword` so the next request redirects to
        // the change-password page. We don't block login — users that are
        // forced to change mid-shift still need to see their schedule.
        let mustChange = user.mustChangePassword;
        if (!mustChange) {
          try {
            const policy = await getPasswordPolicy();
            if (isPasswordExpired(user.passwordChangedAt, policy)) {
              await db.user.update({
                where: { id: user.id },
                data: { mustChangePassword: true },
              });
              mustChange = true;
            }
          } catch {
            /* never block login on policy-load failure */
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          mustChangePassword: mustChange,
        };
      },
    }),
    ...(entraEnabled
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    // Gatekeeper: reject Entra sign-ins for users that don't already exist in our DB.
    // Auto-provisioning is intentionally not supported — HR creates users first.
    async signIn({ user, account }) {
      if (account?.provider === "microsoft-entra-id") {
        if (!user.email) return false;
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true, isActive: true, employeeNumber: true },
        });
        if (!dbUser || !dbUser.isActive || !dbUser.employeeNumber) {
          return "/login?error=NotAuthorized";
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true, mustChangePassword: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.mustChangePassword = dbUser.mustChangePassword;
        }
      }
      if (user || trigger === "update" || !token.permissions) {
        const userId = (token.id ?? user?.id) as string;
        if (userId) {
          const userRoles = await db.userRole.findMany({
            where: { userId },
            include: { role: { include: { permissions: true } } },
          });
          const perms = userRoles.flatMap((ur) =>
            ur.role.permissions.map((p) => `${p.resource}:${p.action}:${p.scope}`)
          );
          token.permissions = [...new Set(perms)];
          token.roleNames = userRoles.map((ur) => ur.role.name);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      session.user.permissions = (token.permissions as string[]) ?? [];
      session.user.roleNames = (token.roleNames as string[]) ?? [];
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
