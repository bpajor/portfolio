import { Suspense } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { AdminLoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/85 p-6 shadow-2xl shadow-black/30">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-sky-400/40 bg-sky-400/10 font-mono text-xs font-semibold text-sky-300">
            BP
          </span>
          <span className="font-mono text-sm text-slate-300">Blazej Pajor</span>
        </Link>
        <div className="mt-8">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white">Admin login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Owner-only access for publishing, moderation, and portfolio management.</p>
        </div>

        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </section>
    </main>
  );
}
