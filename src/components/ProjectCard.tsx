import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    fileCount: number;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{project.fileCount} file{project.fileCount !== 1 ? "s" : ""}</span>
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
