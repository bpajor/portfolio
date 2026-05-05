import Link from "next/link";
import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { PostsTable } from "./posts-table";

export default function AdminPostsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Posts" body="Create, edit, publish, and archive technical writing for the public blog." />
      <Panel>
        <div className="flex justify-end">
          <Link href="/admin/posts/new" className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-200">New post</Link>
        </div>
        <PostsTable />
      </Panel>
    </AdminShell>
  );
}
