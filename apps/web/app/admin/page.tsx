import Link from "next/link";
import { AdminHeader, AdminShell, Panel } from "./_components/admin-shell";
import { AdminStats } from "./admin-stats";
import { RecentWriting } from "./recent-writing";
import { projects } from "../site-data";

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <AdminHeader title="Publishing dashboard" body="A compact control surface for posts, portfolio projects, media, comments, and site settings." />
      <AdminStats featuredProjectsCount={projects.length} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Recent writing</h2>
            <Link href="/admin/posts/new" className="rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-200">New post</Link>
          </div>
          <RecentWriting />
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-white">Operational posture</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="rounded-lg border border-white/10 bg-slate-950 p-3">Session cookies</div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-3">Comment moderation</div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-3">Audit logging</div>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-3">Media validation</div>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
