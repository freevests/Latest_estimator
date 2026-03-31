import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CloudPicker } from "@/components/CloudPicker";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return notFound();

  // Check cloud connection status
  const tokens = await prisma.cloudToken.findMany();
  const dropboxConnected = tokens.some((t) => t.provider === "dropbox");
  const onedriveConnected = tokens.some((t) => t.provider === "onedrive");

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/projects" className="hover:text-blue-600">
          Projects
        </Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-blue-600">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Upload</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Upload / Import Files
      </h1>

      <CloudPicker
        projectId={id}
        dropboxConnected={dropboxConnected}
        onedriveConnected={onedriveConnected}
      />
    </div>
  );
}
