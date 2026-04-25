import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";

const queue = [
  {
    author: "Anonymous reader",
    post: "MCP as a portfolio interface for AI agents",
    body: "Great direction. I would like to see how the MCP authorization boundary is implemented."
  }
];

export default function AdminCommentsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Comments" body="Moderate anonymous comments before they become visible below blog posts." />
      <div className="grid gap-4">
        {queue.map((comment) => (
          <Panel key={comment.body}>
            <p className="font-mono text-xs uppercase text-slate-500">{comment.post}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{comment.author}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{comment.body}</p>
            <div className="mt-5 flex gap-3">
              <button className="h-10 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200">Approve</button>
              <button className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5">Mark spam</button>
            </div>
          </Panel>
        ))}
      </div>
    </AdminShell>
  );
}
