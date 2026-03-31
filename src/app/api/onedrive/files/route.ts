import { NextRequest, NextResponse } from "next/server";
import { getGraphClient, mapOneDriveEntries } from "@/lib/onedrive";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  const client = await getGraphClient();
  if (!client) {
    return NextResponse.json(
      { error: "OneDrive not connected" },
      { status: 401 }
    );
  }

  try {
    let response;
    if (itemId) {
      response = await client
        .api(`/me/drive/items/${itemId}/children`)
        .select("id,name,folder,file,size,lastModifiedDateTime,parentReference")
        .get();
    } else {
      response = await client
        .api("/me/drive/root/children")
        .select("id,name,folder,file,size,lastModifiedDateTime,parentReference")
        .get();
    }

    const files = mapOneDriveEntries(response.value);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("OneDrive list error:", error);
    return NextResponse.json(
      { error: "Failed to list OneDrive files" },
      { status: 500 }
    );
  }
}
