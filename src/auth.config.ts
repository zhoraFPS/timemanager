import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Node.js crypto dependencies (no adapter, no bcrypt)
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.mustChangePassword = (user as { id: string; mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
