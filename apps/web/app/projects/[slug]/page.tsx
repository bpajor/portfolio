import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Github } from "lucide-react";
import { SiteFrame } from "../../_components/site-frame";
import { JsonLd, breadcrumbJsonLd, pageMetadata, projectJsonLd } from "../../seo";
import { getPublicProject, getSeoProject, getSeoProjects } from "../server-projects";

export async function generateStaticParams() {
  const projects = await getSeoProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getSeoProject(slug);
  if (!project) {
    return {};
  }
  return pageMetadata({
    title: project.title,
    description: project.summary,
    path: `/projects/${project.slug}`
  });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) {
    notFound();
  }
  const seoProject = {
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

  return (
    <SiteFrame>
      <JsonLd
        data={[
          projectJsonLd(seoProject),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Projects", path: "/projects" },
            { name: project.title, path: `/projects/${project.slug}` }
          ])
        ]}
      />
      <article className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" />
          Projects
        </Link>
        <p className="mt-8 font-mono text-sm uppercase text-sky-300">{project.eyebrow}</p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
              {project.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg md:leading-8">
              {project.description}
            </p>
          </div>
          <aside className="rounded-2xl border border-white/10 bg-slate-900/85 p-5">
            <p className="font-mono text-xs uppercase text-emerald-300">Stack</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.stack.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {item}
                </span>
              ))}
            </div>
            <a href={project.repoUrl} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200">
              <Github size={17} aria-hidden="true" />
              Repository
            </a>
            {project.demoUrl ? (
              <a href={project.demoUrl} className="mt-3 inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5">
                Demo
              </a>
            ) : null}
          </aside>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 md:p-6">
            <p className="font-mono text-xs uppercase text-slate-500">Problem</p>
            <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base md:leading-7">{project.problem}</p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 md:p-6">
            <p className="font-mono text-xs uppercase text-slate-500">Built</p>
            <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base md:leading-7">{project.built}</p>
          </section>
        </div>
      </article>
    </SiteFrame>
  );
}
