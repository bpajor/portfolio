import { AdminHeader, AdminShell, Panel } from "../_components/admin-shell";
import { MCPTokenManager } from "./mcp-token-manager";

export default function AdminMCPPage() {
  return (
    <AdminShell>
      <AdminHeader title="MCP tokens" body="Create and revoke bearer tokens for portfolio MCP clients." />
      <Panel>
        <MCPTokenManager />
      </Panel>
    </AdminShell>
  );
}
