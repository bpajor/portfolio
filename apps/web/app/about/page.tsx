import Image from "next/image";
import { Cloud, ServerCog, Terminal } from "lucide-react";
import { PageIntro, SiteFrame } from "../_components/site-frame";
import { profile } from "../site-data";

const focusAreas = [
  {
    title: "Backend systems",
    body: "Service boundaries, API contracts, SQL-backed workflows, and internals that remain maintainable after shipping.",
    icon: ServerCog,
    color: "text-sky-300"
  },
  {
    title: "Cloud operations",
    body: "GCP, Kubernetes, reliability work, observability, and cost-aware infrastructure decisions.",
    icon: Cloud,
    color: "text-emerald-300"
  },
  {
    title: "Agentic AI",
    body: "LLM workflows, MCP interfaces, and automation that gives agents useful context with explicit safety boundaries.",
    icon: Terminal,
    color: "text-amber-200"
  }
];

export default function AboutPage() {
  return (
    <SiteFrame>
      <PageIntro
        eyebrow="About"
        title="I work where backend reliability meets cloud operations."
        body="My work sits close to production systems: APIs, infrastructure, performance, and the operational details that decide whether software stays understandable under pressure."
      />

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-16 lg:grid-cols-[320px_1fr]">
        <aside className="self-start rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl shadow-black/25">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
            <Image src={profile.image} alt="Blazej Pajor" width={420} height={420} className="aspect-square w-full object-cover" priority />
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-semibold text-white">{profile.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{profile.role}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.focus.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          <article className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 md:p-6">
            <p className="font-mono text-xs uppercase text-emerald-300">Profile</p>
            <p className="mt-4 text-base leading-7 text-slate-300">
              At WP Engine, I design, build, and maintain scalable systems using Go, PHP, Google Cloud Platform, and Kubernetes. I care about reliability, performance optimization, clean architecture, and ownership of the system after it reaches production.
            </p>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Recently I have been expanding into LLM-based systems and Agentic AI, with a strong focus on GCP and MCP-style interfaces that make agent workflows useful without losing control over security.
            </p>
          </article>

          <div className="grid gap-4 md:grid-cols-3">
            {focusAreas.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.title} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                  <Icon className={area.color} size={23} aria-hidden="true" />
                  <h3 className="mt-4 text-base font-semibold text-white">{area.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{area.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
