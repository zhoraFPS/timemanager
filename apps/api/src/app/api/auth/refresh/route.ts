import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/refresh-tokens";

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json();
  if (!refreshToken) {
    return NextResponse.json(
      { error: "Refresh token erforderlich" },
      { status: 400 }
    );
  }

  const result = await rotateRefreshToken(refreshToken);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}
