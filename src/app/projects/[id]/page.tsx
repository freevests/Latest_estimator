import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileList } from "@/components/FileList";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      files: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) return notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/projects" className="hover:text-blue-600">
              Projects
            </Link>
            <span>/</span>
            <span className="text-gray-900">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 mt-1">{project.description}</p>
          )}
        </div>
        <Link
          href={`/projects/${project.id}/upload`}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Upload / Import Files
        </Link>
      </div>

      <FileList
        files={project.files.map((f) => ({
          ...f,
          size: Number(f.size),
        }))}
        projectId={project.id}
      />
    </div>
  );
}
