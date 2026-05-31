import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";
import { EditProject } from "./edit-project";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AdminShell>
      <AdminHeader title="Edit project" body="Update the case study details, public visibility, and project links." />
      <Panel>
        <EditProject id={id} />
      </Panel>
    </AdminShell>
  );
}
