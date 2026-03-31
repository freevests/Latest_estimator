import { NextRequest, NextResponse } from "next/server";
import { getGraphClient } from "@/lib/onedrive";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { itemId, fileName, projectId, mode, filePath: cloudPath } = body;

  if (!projectId || (!itemId && !fileName)) {
    return NextResponse.json(
      { error: "projectId and itemId/fileName required" },
      { status: 400 }
    );
  }

  // Link mode
  if (mode === "link") {
    const file = await prisma.file.create({
      data: {
        projectId,
        filename: randomUUID(),
        originalName: fileName || "unknown",
        mimeType: guessMimeType(fileName || ""),
        size: BigInt(0),
        source: "onedrive",
        storageType: "linked",
        cloudPath: cloudPath || itemId,
        status: "linked",
      },
    });
    return NextResponse.json(file, { status: 201 });
  }

  // Download mode
  const client = await getGraphClient();
  if (!client) {
    return NextResponse.json(
      { error: "OneDrive not connected" },
      { status: 401 }
    );
  }

  try {
    // Get download URL
    const driveItem = await client
      .api(`/me/drive/items/${itemId}`)
      .select("id,name,size,@microsoft.graph.downloadUrl")
      .get();

    const downloadUrl = driveItem["@microsoft.graph.downloadUrl"];
    const name = driveItem.name || fileName || "download";
    const size = driveItem.size || 0;

    // Stream download to disk
    const response = await fetch(downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error("Failed to download file");
    }

    const ext = path.extname(name);
    const localFilename = `${randomUUID()}${ext}`;
    const localPath = path.join(uploadDir, localFilename);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    const file = await prisma.file.create({
      data: {
        projectId,
        filename: localFilename,
        originalName: name,
        mimeType: guessMimeType(name),
        size: BigInt(size),
        source: "onedrive",
        storageType: "local",
        storagePath: localPath,
        cloudPath: cloudPath || itemId,
        status: "uploaded",
      },
    });

    // Auto-parse Excel files
    const lowerName = name.toLowerCase();
    if (
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xlsm") ||
      lowerName.endsWith(".csv")
    ) {
      try {
        const { parseExcelFile } = await import("@/lib/excel-parser");
        await prisma.file.update({
          where: { id: file.id },
          data: { status: "parsing" },
        });
        const parsed = await parseExcelFile(localPath);
        await prisma.file.update({
          where: { id: file.id },
          data: { status: "parsed", parsedData: JSON.stringify(parsed) },
        });
      } catch {
        await prisma.file.update({
          where: { id: file.id },
          data: { status: "error" },
        });
      }
    }

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    console.error("OneDrive download error:", error);
    return NextResponse.json(
      { error: "Failed to download from OneDrive" },
      { status: 500 }
    );
  }
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    ".csv": "text/csv",
    ".dwg": "application/acad",
    ".dxf": "application/dxf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
