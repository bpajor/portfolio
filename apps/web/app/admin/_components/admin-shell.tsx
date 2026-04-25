import Link from "next/link";
import type { ReactNode } from "react";
import { FileText, Image, LayoutDashboard, MessageSquare, Settings, ShieldCheck } from "lucide-react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare },
  { href: "/admin/projects", label: "Projects", icon: Settings },
  { href: "/admin/media", label: "Media", icon: Image }
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <span className="font-mono text-sm text-slate-300">Portfolio admin</span>
          </Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-white">Public site</Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 lg:self-start">
          <nav className="grid gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <Icon size={17} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </main>
  );
}

export function AdminHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <p className="font-mono text-xs uppercase text-emerald-300">Owner console</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-xl shadow-black/15 ${className}`}>
      {children}
    </div>
  );
}
