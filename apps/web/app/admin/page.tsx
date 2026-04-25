import Link from "next/link";
import { FileText, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { AdminHeader, AdminShell, Panel } from "./_components/admin-shell";
import { posts, projects } from "../site-data";

const stats = [
  { label: "Published posts", value: posts.length, icon: FileText },
  { label: "Featured projects", value: projects.length, icon: Sparkles },
  { label: "Pending comments", value: 0, icon: MessageSquare },
  { label: "Security checks", value: 4, icon: ShieldCheck }
];

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <AdminHeader title="Publishing dashboard" body="A compact control surface for posts, portfolio projects, media, comments, and site settings." />
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Panel key={stat.label}>
              <Icon className="text-sky-300" size={20} aria-hidden="true" />
              <p className="mt-5 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
            </Panel>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Recent writing</h2>
            <Link href="/admin/posts/new" className="rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-200">New post</Link>
          </div>
          <div className="mt-5 divide-y divide-white/10">
            {posts.map((post) => (
              <Link key={post.slug} href={`/admin/posts/${post.slug}`} className="block py-4 hover:text-sky-300">
                <p className="font-medium text-white">{post.title}</p>
                <p className="mt-1 text-sm text-slate-500">{post.publishedAt} / {post.readingTime}</p>
              </Link>
            ))}
          </div>
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
