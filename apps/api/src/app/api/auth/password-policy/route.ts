import { getPasswordPolicy } from "@/lib/password-policy";
import { NextResponse } from "next/server";

/**
 * Public-ish endpoint — returns the shape-policy so the password-change
 * form can show requirements live. No secrets, but still gated behind an
 * authenticated session via the proxy middleware config.
 */
export async function GET() {
  const policy = await getPasswordPolicy();
  return NextResponse.json({
    minLength: policy.minLength,
    requireUpper: policy.requireUpper,
    requireLower: policy.requireLower,
    requireNumber: policy.requireNumber,
    requireSymbol: policy.requireSymbol,
  });
}
