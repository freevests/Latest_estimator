import { NextRequest, NextResponse } from "next/server";
import { getDropboxClient } from "@/lib/dropbox";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dropboxPath, projectId, mode } = body;

  if (!dropboxPath || !projectId) {
    return NextResponse.json(
      { error: "dropboxPath and projectId required" },
      { status: 400 }
    );
  }

  // Link mode - just create a reference, no download
  if (mode === "link") {
    const filename = path.basename(dropboxPath);
    const file = await prisma.file.create({
      data: {
        projectId,
        filename: randomUUID(),
        originalName: filename,
        mimeType: guessMimeType(filename),
        size: BigInt(0),
        source: "dropbox",
        storageType: "linked",
        cloudPath: dropboxPath,
        cloudUrl: `https://www.dropbox.com/home${dropboxPath}`,
        status: "linked",
      },
    });
    return NextResponse.json(file, { status: 201 });
  }

  // Download mode
  const dbx = await getDropboxClient();
  if (!dbx) {
    return NextResponse.json(
      { error: "Dropbox not connected" },
      { status: 401 }
    );
  }

  try {
    const response = await dbx.filesDownload({ path: dropboxPath });
    const result = response.result as typeof response.result & {
      fileBinary: Buffer;
    };

    const ext = path.extname(result.name);
    const localFilename = `${randomUUID()}${ext}`;
    const localPath = path.join(uploadDir, localFilename);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(localPath, result.fileBinary);

    const file = await prisma.file.create({
      data: {
        projectId,
        filename: localFilename,
        originalName: result.name,
        mimeType: guessMimeType(result.name),
        size: BigInt(result.size),
        source: "dropbox",
        storageType: "local",
        storagePath: localPath,
        cloudPath: dropboxPath,
        status: "uploaded",
      },
    });

    // Auto-parse Excel files
    const lowerName = result.name.toLowerCase();
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
    console.error("Dropbox download error:", error);
    return NextResponse.json(
      { error: "Failed to download from Dropbox" },
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
