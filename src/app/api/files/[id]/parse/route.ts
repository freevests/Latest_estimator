import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseExcelFile } from "@/lib/excel-parser";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (file.storageType !== "local" || !file.storagePath) {
    return NextResponse.json(
      { error: "Can only parse locally stored files" },
      { status: 400 }
    );
  }

  const ext = file.originalName.toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xlsm") && !ext.endsWith(".csv")) {
    return NextResponse.json(
      { error: "File is not an Excel/CSV file" },
      { status: 400 }
    );
  }

  try {
    await prisma.file.update({
      where: { id },
      data: { status: "parsing" },
    });

    const parsed = await parseExcelFile(file.storagePath);

    await prisma.file.update({
      where: { id },
      data: {
        status: "parsed",
        parsedData: JSON.stringify(parsed),
      },
    });

    return NextResponse.json(parsed);
  } catch (error) {
    await prisma.file.update({
      where: { id },
      data: { status: "error" },
    });

    return NextResponse.json(
      { error: `Failed to parse: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!file.parsedData) {
    return NextResponse.json({ error: "File not parsed yet" }, { status: 400 });
  }

  return NextResponse.json(JSON.parse(file.parsedData));
}
