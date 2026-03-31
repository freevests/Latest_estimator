import { NextRequest, NextResponse } from "next/server";
import { getDropboxClient, mapDropboxEntries } from "@/lib/dropbox";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folderPath = searchParams.get("path") || "";

  const dbx = await getDropboxClient();
  if (!dbx) {
    return NextResponse.json(
      { error: "Dropbox not connected" },
      { status: 401 }
    );
  }

  try {
    const response = await dbx.filesListFolder({ path: folderPath });
    const files = mapDropboxEntries(
      response.result.entries as Array<{
        ".tag": string;
        name: string;
        path_lower?: string;
        path_display?: string;
        size?: number;
        server_modified?: string;
        id?: string;
      }>
    );

    return NextResponse.json({
      files,
      hasMore: response.result.has_more,
      cursor: response.result.cursor,
    });
  } catch (error) {
    console.error("Dropbox list error:", error);
    return NextResponse.json(
      { error: "Failed to list Dropbox files" },
      { status: 500 }
    );
  }
}
