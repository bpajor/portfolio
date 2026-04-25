import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Cloud,
  Github,
  Linkedin,
  Mail,
  MapPin,
  ServerCog,
  Sparkles,
  Terminal
} from "lucide-react";

const projects = [
  {
    slug: "pay-management-system",
    title: "Pay Management System",
    eyebrow: "Business operations",
    description: "A system for monitoring employee payouts and keeping payroll-related workflows visible to internal users.",
    problem: "Payroll visibility usually breaks down when calculations, approvals, and operational status live in separate places.",
    built: "Designed an application surface for tracking payout state, business rules, and operational review paths.",
    signals: ["Domain modeling", "Workflow state", "Admin-facing UX"],
    stack: ["Backend", "Business logic", "Internal tooling"],
    href: "/projects/pay-management-system"
  },
  {
    slug: "pol-elections-2023-rest-api",
    title: "PolElections2023 REST API",
    eyebrow: "Public data API",
    description: "A REST API exposing Polish parliamentary election results from 2023 through structured endpoints.",
    problem: "Election data is useful only when it can be queried predictably by district, committee, candidate, and result scope.",
    built: "Implemented an authenticated API layer for exploring election results and related entities through clear REST contracts.",
    signals: ["API design", "JWT auth", "Structured public data"],
    stack: ["Nest.js", "TypeScript", "Mongoose", "JWT"],
    href: "/projects/pol-elections-2023-rest-api"
  }
];

const focusAreas = [
  {
    title: "Production backend",
    body: "APIs, service boundaries, data workflows, maintainable internals, and practical reliability work.",
    icon: ServerCog,
    color: "text-sky-300"
  },
  {
    title: "Cloud operations",
    body: "GCP, Kubernetes, observability, performance tuning, and infrastructure shaped by cost and security constraints.",
    icon: Cloud,
    color: "text-emerald-300"
  },
  {
    title: "Agentic AI",
    body: "LLM-based workflows, MCP interfaces, and automation that gives agents useful context without exposing unsafe tools.",
    icon: Terminal,
    color: "text-amber-200"
  }
];

const principles = [
  "Clean boundaries over clever abstractions",
  "Operational clarity before feature volume",
  "Security and cost treated as design inputs",
  "Automation that remains explainable"
];

const writingTopics = [
  {
    title: "Go backend architecture",
    body: "API design, service boundaries, SQL workflows, and production-grade implementation details."
  },
  {
    title: "GCP and Kubernetes operations",
    body: "Reliability, observability, performance, and cost-aware cloud infrastructure."
  },
  {
    title: "LLM systems and MCP",
    body: "Agent interfaces, safe tools, and AI workflows that fit real engineering constraints."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 hero-backdrop opacity-80" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-sky-400/40 bg-sky-400/10 font-mono text-xs font-semibold text-sky-300">
              BP
            </span>
            <span className="font-mono text-sm text-slate-300">Blazej Pajor</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 sm:flex">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/projects" className="hover:text-white">Projects</Link>
            <Link href="/blog" className="hover:text-white">Writing</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-10 md:py-16 lg:grid-cols-3 lg:items-center">
        <div className="lg:col-span-2">
          <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-200 shadow-lg shadow-emerald-950/20">
            <Sparkles size={15} aria-hidden="true" />
            <span>Backend engineer focused on GCP and AI systems</span>
          </div>

          <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Building reliable backend platforms for cloud and AI workflows.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg md:leading-8">
            I am Blazej Pajor, a Software Engineer working across Go, PHP,
            Google Cloud, Kubernetes, and LLM-based automation. I care about
            clean architecture, ownership, and systems that stay understandable
            after they reach production.
          </p>

          <div className="mt-6 grid max-w-2xl grid-cols-3 gap-3 border-l border-sky-300/30 pl-4 text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">
            <div>
              <p className="font-mono text-xs uppercase text-sky-300">Current</p>
              <p>WP Engine</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-sky-300">Focus</p>
              <p>GCP / AI</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-sky-300">Mode</p>
              <p>Production</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="https://github.com/bpajor/"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-950/30 transition hover:bg-sky-200 sm:h-11"
            >
              <Github size={18} aria-hidden="true" />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/[0.07] sm:h-11"
            >
              <Linkedin size={18} aria-hidden="true" />
              LinkedIn
            </a>
            <a
              href="mailto:blazej122@vp.pl"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/[0.07] sm:h-11"
            >
              <Mail size={18} aria-hidden="true" />
              Email
            </a>
          </div>
        </div>

        <aside className="mx-auto hidden w-52 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl shadow-black/30 backdrop-blur md:block">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
            <Image
              src="/images/profile.jpg"
              alt="Blazej Pajor"
              width={208}
              height={208}
              priority
              className="aspect-square w-full object-cover"
            />
          </div>
          <div className="mt-4 md:mt-5">
            <h2 className="text-base font-semibold text-white md:text-xl">Blazej Pajor</h2>
            <p className="mt-1 text-sm text-slate-400">Software Engineer</p>
          </div>
          <div className="mt-3 rounded-lg border border-white/10 bg-slate-950 p-3 md:mt-4">
            <p className="font-mono text-xs uppercase text-sky-300">Current focus</p>
            <p className="mt-1 text-xs leading-5 text-slate-300 md:text-sm md:leading-6">Go, GCP, Kubernetes, LLM systems</p>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1 text-xs text-slate-400">
            <MapPin size={13} aria-hidden="true" />
            <span>Poland / Remote</span>
          </div>
        </aside>
      </section>

      <section id="about" className="relative z-10 border-y border-white/10 bg-slate-900 px-5 py-14 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="font-mono text-sm uppercase text-sky-300">Engineering profile</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              I work where backend reliability meets cloud operations.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
              At WP Engine, I design, build, and maintain scalable systems with
              Go, PHP, Google Cloud Platform, and Kubernetes. My work sits close
              to reliability, performance optimization, and operating cloud
              infrastructure that has to keep behaving under real production
              pressure.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 p-5">
              <p className="font-mono text-xs uppercase text-emerald-300">Working principles</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {principles.map((principle) => (
                  <div key={principle} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                    {principle}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {focusAreas.map((area) => {
              const Icon = area.icon;
              return (
                <article key={area.title} className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
                  <div className="flex gap-4">
                    <Icon className={area.color} size={24} aria-hidden="true" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{area.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{area.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="projects" className="relative z-10 mx-auto max-w-6xl px-5 py-12 md:py-20">
        <div className="mb-8 grid gap-4 md:grid-cols-2 md:items-end">
          <div className="max-w-2xl">
          <p className="font-mono text-sm uppercase text-emerald-300">Selected projects</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Practical systems, APIs, and internal tooling.
          </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-400 md:justify-self-end">
            Short case studies focused on the engineering context, technical
            decisions, and what each implementation demonstrates.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <a
              key={project.title}
              href={project.href}
              className="group flex min-h-full flex-col rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-slate-900 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase text-sky-300">{project.eyebrow}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">{project.title}</h3>
                </div>
                <ArrowUpRight className="text-slate-500 transition group-hover:text-sky-300" size={22} aria-hidden="true" />
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base md:leading-7">{project.description}</p>

              <div className="mt-5 grid gap-4 border-y border-white/10 py-4 md:mt-6 md:py-5 lg:grid-cols-2">
                <div>
                  <p className="font-mono text-xs uppercase text-slate-500">Problem</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{project.problem}</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase text-slate-500">Built</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{project.built}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="font-mono text-xs uppercase text-slate-500">Signals</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.signals.map((item) => (
                    <span key={item} className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {project.stack.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-6 font-mono text-xs text-sky-300">
                View case study
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="writing" className="relative z-10 border-t border-white/10 bg-slate-900 px-5 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-sm uppercase text-sky-300">Writing</p>
          <div className="mt-3 grid gap-8 md:grid-cols-[1fr_420px] md:items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
                Technical writing as an engineering notebook.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
                I want the blog to document how systems are designed, shipped,
                operated, and improved. Posts will be written for engineers
                first, while still being structured enough for search engines
                and AI agents to understand the context precisely.
              </p>
              <div className="mt-6 grid gap-3">
                {writingTopics.map((topic) => (
                  <article key={topic.title} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <h3 className="text-base font-semibold text-white">{topic.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{topic.body}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 font-mono text-sm text-slate-300 shadow-xl shadow-black/20">
              <p className="text-emerald-300">content pipeline</p>
              <div className="mt-4 space-y-3">
                <p><span className="text-slate-500">01</span> admin panel publishing</p>
                <p><span className="text-slate-500">02</span> PostgreSQL-backed posts</p>
                <p><span className="text-slate-500">03</span> RSS, sitemap and JSON-LD</p>
                <p><span className="text-slate-500">04</span> MCP-readable site context</p>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-6 text-slate-500">
                Built to be readable by humans, crawlers, and authorized agents
                without hiding content or relying on SEO tricks.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-slate-950 px-5 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono text-sm uppercase text-emerald-300">Contact</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Let&apos;s talk about backend, cloud, and AI systems.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              The fastest way to reach me is email. You can also find my work and
              professional profile through GitHub and LinkedIn.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:blazej122@vp.pl"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-200"
            >
              <Mail size={17} aria-hidden="true" />
              Email
            </a>
            <a
              href="https://github.com/bpajor/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              <Github size={17} aria-hidden="true" />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              <Linkedin size={17} aria-hidden="true" />
              LinkedIn
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t border-white/10 pt-5 font-mono text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Blazej Pajor / Software Engineer</p>
          <p>Built with Next.js, Go planned, PostgreSQL planned, MCP planned.</p>
        </div>
      </footer>
    </main>
  );
}
