import { NextResponse } from "next/server";
import { getMsalClient, getAuthUrl } from "@/lib/onedrive";

export async function GET() {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "OneDrive not configured. Set ONEDRIVE_CLIENT_ID in .env" },
      { status: 500 }
    );
  }

  try {
    const msalClient = getMsalClient();
    const url = await getAuthUrl(msalClient);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("OneDrive auth URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate OneDrive auth URL" },
      { status: 500 }
    );
  }
}
