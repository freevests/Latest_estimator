import { NextRequest, NextResponse } from "next/server";
import { getMsalClient } from "@/lib/onedrive";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/projects?error=onedrive_no_code", req.url)
    );
  }

  try {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByCode({
      code,
      redirectUri: process.env.ONEDRIVE_REDIRECT_URI!,
      scopes: ["Files.Read", "Files.Read.All", "User.Read"],
    });

    await prisma.cloudToken.upsert({
      where: { provider: "onedrive" },
      create: {
        provider: "onedrive",
        accessToken: result.accessToken,
        refreshToken: (result as unknown as { refreshToken?: string }).refreshToken || null,
        expiresAt: result.expiresOn || null,
      },
      update: {
        accessToken: result.accessToken,
        refreshToken: (result as unknown as { refreshToken?: string }).refreshToken || null,
        expiresAt: result.expiresOn || null,
      },
    });

    return NextResponse.redirect(
      new URL("/projects?onedrive=connected", req.url)
    );
  } catch (error) {
    console.error("OneDrive OAuth error:", error);
    return NextResponse.redirect(
      new URL("/projects?error=onedrive_auth_failed", req.url)
    );
  }
}
