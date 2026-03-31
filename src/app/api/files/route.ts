import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "File id required" }, { status: 400 });
  }

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Delete local file if exists
  if (file.storageType === "local" && file.storagePath) {
    try {
      await fs.unlink(file.storagePath);
    } catch {
      // File may already be deleted
    }
  }

  await prisma.file.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
