import NextAuth from "next-auth";

export const entraEnabled = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
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
