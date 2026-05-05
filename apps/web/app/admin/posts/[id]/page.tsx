import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";
import { EditPost } from "./edit-post";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminShell>
      <AdminHeader title="Edit post" body="Review content, search metadata, publication status, and article body." />
      <Panel>
        <EditPost id={id} />
      </Panel>
    </AdminShell>
  );
}
