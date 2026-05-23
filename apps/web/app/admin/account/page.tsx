import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { ChangePasswordForm } from "./change-password-form";

export default function AdminAccountPage() {
  return (
    <AdminShell>
      <AdminHeader title="Account" body="Manage owner access and active admin sessions." />
      <Panel>
        <h2 className="text-lg font-semibold text-white">Change password</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Changing the password signs out existing admin sessions.
        </p>
        <div className="mt-5">
          <ChangePasswordForm />
        </div>
      </Panel>
    </AdminShell>
  );
}
