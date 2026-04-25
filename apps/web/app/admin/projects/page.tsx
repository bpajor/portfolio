import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { projects } from "../../site-data";

export default function AdminProjectsPage() {
  return (
    <AdminShell>
      <AdminHeader title="Projects" body="Maintain the project case studies shown on the public portfolio." />
      <div className="grid gap-4">
        {projects.map((project) => (
          <Panel key={project.slug}>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <p className="font-mono text-xs uppercase text-sky-300">{project.eyebrow}</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{project.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{project.summary}</p>
              </div>
              <div className="flex flex-wrap content-start gap-2">
                {project.stack.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </AdminShell>
  );
}
