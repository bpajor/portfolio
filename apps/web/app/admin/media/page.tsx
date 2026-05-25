import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { MediaManager } from "./media-manager";

export default function AdminMediaPage() {
  return (
    <AdminShell>
      <AdminHeader title="Media" body="Upload and manage profile images, Open Graph assets, and article media." />
      <Panel>
        <MediaManager />
      </Panel>
    </AdminShell>
  );
}
