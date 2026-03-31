import { NextResponse } from "next/server";
import { getDropboxAuth } from "@/lib/dropbox";

export async function GET() {
  const appKey = process.env.DROPBOX_APP_KEY;
  if (!appKey) {
    return NextResponse.json(
      { error: "Dropbox not configured. Set DROPBOX_APP_KEY in .env" },
      { status: 500 }
    );
  }

  const auth = getDropboxAuth();
  const redirectUri = process.env.DROPBOX_REDIRECT_URI!;

  const authUrl = await auth.getAuthenticationUrl(
    redirectUri,
    undefined, // state
    "code",
    "offline", // token_access_type for refresh token
    undefined,
    "none",
    false
  );

  return NextResponse.json({ url: authUrl.toString() });
}
