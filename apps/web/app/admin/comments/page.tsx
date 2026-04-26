import { AdminHeader, AdminShell } from "../_components/admin-shell";
import { CommentsModeration } from "./comments-moderation";

export default function AdminCommentsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Comments" body="Moderate anonymous comments before they become visible below blog posts." />
      <CommentsModeration />
    </AdminShell>
  );
}
