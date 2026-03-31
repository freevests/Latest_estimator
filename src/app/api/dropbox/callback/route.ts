import { NextRequest, NextResponse } from "next/server";
import { getDropboxAuth } from "@/lib/dropbox";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/projects?error=dropbox_no_code", req.url));
  }

  try {
    const auth = getDropboxAuth();
    const redirectUri = process.env.DROPBOX_REDIRECT_URI!;

    const tokenResponse = await auth.getAccessTokenFromCode(redirectUri, code);
    const result = tokenResponse.result as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    await prisma.cloudToken.upsert({
      where: { provider: "dropbox" },
      create: {
        provider: "dropbox",
        accessToken: result.access_token,
        refreshToken: result.refresh_token || null,
        expiresAt: result.expires_in
          ? new Date(Date.now() + result.expires_in * 1000)
          : null,
      },
      update: {
        accessToken: result.access_token,
        refreshToken: result.refresh_token || null,
        expiresAt: result.expires_in
          ? new Date(Date.now() + result.expires_in * 1000)
          : null,
      },
    });

    return NextResponse.redirect(new URL("/projects?dropbox=connected", req.url));
  } catch (error) {
    console.error("Dropbox OAuth error:", error);
    return NextResponse.redirect(
      new URL("/projects?error=dropbox_auth_failed", req.url)
    );
  }
}
