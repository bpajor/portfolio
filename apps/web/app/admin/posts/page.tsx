import Link from "next/link";
import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { posts } from "../../site-data";

export default function AdminPostsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Posts" body="Create, edit, publish, and archive technical writing for the public blog." />
      <Panel>
        <div className="flex justify-end">
          <Link href="/admin/posts/new" className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-200">New post</Link>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {posts.map((post) => (
                <tr key={post.slug} className="bg-slate-900/60">
                  <td className="px-4 py-4 font-medium text-white">{post.title}</td>
                  <td className="px-4 py-4 text-emerald-300">Published</td>
                  <td className="px-4 py-4 text-slate-400">{post.publishedAt}</td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/posts/${post.slug}`} className="text-sky-300 hover:text-sky-200">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}
