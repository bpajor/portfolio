"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "../../api-url";
import { AdminProject } from "./project-model";

export function ProjectsTable() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/projects"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("projects unavailable");
        }
        return response.json() as Promise<AdminProject[]>;
      })
      .then((nextProjects) => {
        if (!ignore) {
          setProjects(nextProjects);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Projects could not be loaded.");
          setProjects([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (error) {
    return <p className="mt-5 text-sm text-red-300">{error}</p>;
  }

  if (projects === null) {
    return <p className="mt-5 text-sm text-slate-400">Loading projects...</p>;
  }

  if (projects.length === 0) {
    return <p className="mt-5 text-sm text-slate-400">No projects yet.</p>;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Visibility</th>
            <th className="px-4 py-3">Sort</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {projects.map((project) => (
            <tr key={project.id} className="bg-slate-900/60">
              <td className="px-4 py-4">
                <p className="font-medium text-white">{project.title}</p>
                <p className="mt-1 text-xs text-slate-500">{project.slug}</p>
              </td>
              <td className="px-4 py-4 text-emerald-300">{project.isFeatured ? "Featured" : "Archived"}</td>
              <td className="px-4 py-4 text-slate-400">{project.sortOrder}</td>
              <td className="px-4 py-4">
                <Link href={`/admin/projects/${project.id}`} className="text-sky-300 hover:text-sky-200">Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
