import { projects as staticProjects } from "../site-data";
import { serverApiUrl } from "../blog/server-posts";
import { PublicProject, SeoProject, publicProjectToSeoProject, staticProjectToPublicProject } from "./project-model";

const fallbackPublicProjects = staticProjects.map(staticProjectToPublicProject);

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(serverApiUrl(path), {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPublicProjects(options: { fallbackToStatic?: boolean } = {}): Promise<PublicProject[] | null> {
  const apiProjects = await fetchJson<PublicProject[]>("/projects");
  if (apiProjects) {
    return apiProjects;
  }
  return options.fallbackToStatic === false ? null : fallbackPublicProjects;
}

export async function getPublicProject(slug: string): Promise<PublicProject | null> {
  const apiProject = await fetchJson<PublicProject>(`/projects/${slug}`);
  if (apiProject) {
    return apiProject;
  }

  return fallbackPublicProjects.find((project) => project.slug === slug) ?? null;
}

export async function getSeoProjects(): Promise<SeoProject[]> {
  const publicProjects = await getPublicProjects();
  return (publicProjects ?? fallbackPublicProjects).map(publicProjectToSeoProject);
}

export async function getSeoProject(slug: string): Promise<SeoProject | null> {
  const publicProject = await getPublicProject(slug);
  return publicProject ? publicProjectToSeoProject(publicProject) : null;
}
