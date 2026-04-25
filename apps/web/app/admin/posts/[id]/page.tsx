import { notFound } from "next/navigation";
import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";
import { posts } from "../../../site-data";

export function generateStaticParams() {
  return posts.map((post) => ({ id: post.slug }));
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = posts.find((item) => item.slug === id);
  if (!post) {
    notFound();
  }

  return (
    <AdminShell>
      <AdminHeader title="Edit post" body="Review content, search metadata, publication status, and article body." />
      <Panel>
        <form className="grid gap-4">
          <label className="grid gap-2 text-sm text-slate-300">
            Title
            <input name="title" defaultValue={post.title} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Excerpt
            <textarea name="excerpt" defaultValue={post.excerpt} rows={3} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Markdown
            <textarea name="content" defaultValue={post.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n")} rows={16} className="resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none focus:border-sky-300/50" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200">Save changes</button>
            <button type="button" className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5">Archive</button>
          </div>
        </form>
      </Panel>
    </AdminShell>
  );
}
