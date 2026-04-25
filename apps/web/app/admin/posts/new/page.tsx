import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";

export default function NewPostPage() {
  return (
    <AdminShell>
      <AdminHeader title="New post" body="Draft technical writing with metadata, tags, and publication controls." />
      <Panel>
        <PostForm title="" excerpt="" body="" />
      </Panel>
    </AdminShell>
  );
}

function PostForm({ title, excerpt, body }: { title: string; excerpt: string; body: string }) {
  return (
    <form className="grid gap-4">
      <label className="grid gap-2 text-sm text-slate-300">
        Title
        <input name="title" defaultValue={title} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Excerpt
        <textarea name="excerpt" defaultValue={excerpt} rows={3} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Markdown
        <textarea name="content" defaultValue={body} rows={14} className="resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none focus:border-sky-300/50" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200">Save draft</button>
        <button type="button" className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5">Publish</button>
      </div>
    </form>
  );
}
