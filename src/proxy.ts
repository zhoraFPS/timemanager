import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Proxy ALL /api/* to API container — including /api/auth/* so the
  // credentials login flow reaches the API's NextAuth handlers.
  if (pathname.startsWith("/api/")) {
    const apiUrl = process.env.API_URL ?? "http://localhost:3001";
    const target = new URL(pathname + req.nextUrl.search, apiUrl);
    return NextResponse.rewrite(target);
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";
  const isPasswordChangePage = pathname === "/passwort-aendern";

  if (!isLoggedIn && !isLoginPage && !isPasswordChangePage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)).*)",
  ],
};
