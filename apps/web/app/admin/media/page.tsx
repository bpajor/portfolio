import { Upload } from "lucide-react";
import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";

export default function AdminMediaPage() {
  return (
    <AdminShell>
      <AdminHeader title="Media" body="Upload and manage profile images, Open Graph assets, and article media." />
      <Panel>
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 bg-slate-950 px-5 py-14 text-center">
          <Upload className="text-sky-300" size={28} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-white">Media upload foundation</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Files will be validated by MIME type, size, and ownership before being stored for public use.</p>
          <button className="mt-5 h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200">Select file</button>
        </div>
      </Panel>
    </AdminShell>
  );
}
