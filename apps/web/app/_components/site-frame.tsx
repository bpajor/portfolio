import Link from "next/link";
import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import { profile } from "../site-data";

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 hero-backdrop opacity-80" />
      <header className="relative z-10 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
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
      <div className="relative z-10">{children}</div>
      <footer className="relative z-10 border-t border-white/10 bg-slate-950 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-slate-500">Blazej Pajor / Software Engineer</p>
          <div className="flex gap-3">
            <a href={`mailto:${profile.email}`} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-300 hover:border-sky-300/40 hover:text-sky-300" aria-label="Email">
              <Mail size={17} />
            </a>
            <a href={profile.github} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-300 hover:border-sky-300/40 hover:text-sky-300" aria-label="GitHub">
              <Github size={17} />
            </a>
            <a href={profile.linkedin} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-300 hover:border-sky-300/40 hover:text-sky-300" aria-label="LinkedIn">
              <Linkedin size={17} />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function PageIntro({
  eyebrow,
  title,
  body
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
      <p className="font-mono text-sm uppercase text-sky-300">{eyebrow}</p>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
        {body}
      </p>
    </section>
  );
}
