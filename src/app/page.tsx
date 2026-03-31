import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProjectCard } from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const projects = await prisma.project.findMany({
    include: { files: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Your recent HVAC estimation projects
          </p>
        </div>
        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No projects yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first project to start uploading plans and doing takeoff.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={{
                ...project,
                fileCount: project.files.length,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
