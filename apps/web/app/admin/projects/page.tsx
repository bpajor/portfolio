import Link from "next/link";
import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { ProjectsTable } from "./projects-table";

export default function AdminProjectsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Projects" body="Create, edit, feature, and archive the case studies shown on the public portfolio." />
      <Panel>
        <div className="flex justify-end">
          <Link href="/admin/projects/new" className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-200">New project</Link>
        </div>
        <ProjectsTable />
      </Panel>
    </AdminShell>
  );
}
