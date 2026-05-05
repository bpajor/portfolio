import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";
import { PostForm } from "../post-form";

export default function NewPostPage() {
  return (
    <AdminShell>
      <AdminHeader title="New post" body="Draft technical writing with metadata, tags, and publication controls." />
      <Panel>
        <PostForm />
      </Panel>
    </AdminShell>
  );
}
