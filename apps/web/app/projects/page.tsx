import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PageIntro, SiteFrame } from "../_components/site-frame";
import { projects } from "../site-data";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "../seo";

const title = "Projects";
const description =
  "Selected backend, API, cloud, and internal tooling projects by Blazej Pajor.";

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/projects"
});

export default function ProjectsPage() {
  return (
    <SiteFrame>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Projects", path: "/projects" }
        ])}
      />
      <PageIntro
        eyebrow="Projects"
        title="Practical systems, APIs, and internal tooling."
        body="Selected work presented as compact engineering case studies: the problem shape, what was built, and the signals each project gives about backend and systems thinking."
      />

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-2">
        {projects.map((project) => (
          <Link key={project.slug} href={`/projects/${project.slug}`} className="group flex min-h-full flex-col rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-slate-900 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase text-sky-300">{project.eyebrow}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">{project.title}</h2>
              </div>
              <ArrowUpRight className="text-slate-500 transition group-hover:text-sky-300" size={22} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base md:leading-7">{project.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {project.signals.map((item) => (
                <span key={item} className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-100">
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-auto pt-6 font-mono text-xs text-sky-300">Open case study</p>
          </Link>
        ))}
      </section>
    </SiteFrame>
  );
}
