import { Project as StaticProject } from "../site-data";

export type PublicProject = {
  id?: string;
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  problem: string;
  built: string;
  signals: string[];
  stack: string[];
  repoUrl: string;
  demoUrl?: string;
  sortOrder?: number;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SeoProject = StaticProject;

export function publicProjectToSeoProject(project: PublicProject): SeoProject {
  return {
    slug: project.slug,
    title: project.title,
    eyebrow: project.eyebrow,
    summary: project.summary,
    description: project.description,
    problem: project.problem,
    built: project.built,
    signals: project.signals,
    stack: project.stack,
    href: project.repoUrl
  };
}

export function staticProjectToPublicProject(project: StaticProject): PublicProject {
  return {
    slug: project.slug,
    title: project.title,
    eyebrow: project.eyebrow,
    summary: project.summary,
    description: project.description,
    problem: project.problem,
    built: project.built,
    signals: project.signals,
    stack: project.stack,
    repoUrl: project.href
  };
}
