"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../../api-url";
import { AdminProject } from "../project-model";
import { ProjectForm } from "../project-form";

export function EditProject({ id }: { id: string }) {
  const [project, setProject] = useState<AdminProject | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl(`/admin/projects/${id}`), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("project unavailable");
        }
        return response.json() as Promise<AdminProject>;
      })
      .then((nextProject) => {
        if (!ignore) {
          setProject(nextProject);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Project could not be loaded.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!project) {
    return <p className="text-sm text-slate-400">Loading project...</p>;
  }

  return <ProjectForm project={project} />;
}
