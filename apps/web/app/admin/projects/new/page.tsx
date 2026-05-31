import { AdminHeader, AdminShell, Panel } from "../../_components/admin-shell";
import { ProjectForm } from "../project-form";

export default function NewProjectPage() {
  return (
    <AdminShell>
      <AdminHeader title="New project" body="Draft a portfolio case study with public summary, stack, and visibility controls." />
      <Panel>
        <ProjectForm />
      </Panel>
    </AdminShell>
  );
}
