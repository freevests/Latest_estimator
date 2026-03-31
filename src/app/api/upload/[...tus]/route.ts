import { NextRequest, NextResponse } from "next/server";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { prisma } from "@/lib/db";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const tusServer = new Server({
  path: "/api/upload",
  datastore: new FileStore({ directory: uploadDir }),
  respectForwardedHeaders: true,
  allowedHeaders: ["Authorization", "Upload-Metadata", "Content-Type"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUploadFinish: async (_req: any, upload: any) => {
    const metadata = upload.metadata;
    const projectId = metadata?.projectId;
    const originalName = metadata?.filename || upload.id;
    const mimeType = metadata?.filetype || "application/octet-stream";

    if (projectId) {
      const storagePath = path.join(uploadDir, upload.id);

      await prisma.file.create({
        data: {
          projectId,
          filename: upload.id,
          originalName,
          mimeType,
          size: BigInt(upload.size || upload.offset || 0),
          source: "upload",
          storageType: "local",
          storagePath,
          status: "uploaded",
        },
      });

      // Auto-parse Excel files
      const ext = originalName.toLowerCase();
      if (ext.endsWith(".xlsx") || ext.endsWith(".xlsm") || ext.endsWith(".csv")) {
        const file = await prisma.file.findFirst({
          where: { filename: upload.id },
        });
        if (file) {
          try {
            const { parseExcelFile } = await import("@/lib/excel-parser");
            await prisma.file.update({
              where: { id: file.id },
              data: { status: "parsing" },
            });
            const parsed = await parseExcelFile(storagePath);
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
      }
    }

    return {};
  },
});

function convertNextRequestToNode(req: NextRequest) {
  const url = new URL(req.url);
  return {
    method: req.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    body: req.body,
  };
}

async function handler(req: NextRequest) {
  try {
    const nodeReq = convertNextRequestToNode(req);

    let statusCode = 200;
    const headers: Record<string, string> = {};
    let body = "";

    const mockRes = {
      setHeader(name: string, value: string) {
        headers[name] = value;
        return this;
      },
      getHeader(name: string) {
        return headers[name];
      },
      writeHead(code: number, hdrs?: Record<string, string>) {
        statusCode = code;
        if (hdrs) Object.assign(headers, hdrs);
        return this;
      },
      write(chunk: string) {
        body += chunk;
        return true;
      },
      end(chunk?: string) {
        if (chunk) body += chunk;
      },
      hasHeader(name: string) {
        return name in headers;
      },
      removeHeader(name: string) {
        delete headers[name];
      },
    };

    await tusServer.handle(nodeReq as never, mockRes as never);

    return new NextResponse(body || null, {
      status: statusCode,
      headers,
    });
  } catch (error) {
    console.error("TUS error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

export const POST = handler;
export const PATCH = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;
