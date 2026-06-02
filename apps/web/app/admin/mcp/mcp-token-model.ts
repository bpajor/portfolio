export type MCPTokenScope = "read" | "admin";

export type AdminMCPToken = {
  id: string;
  name: string;
  scope: MCPTokenScope;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  token?: string;
};

export function validateMCPTokenName(value: FormDataEntryValue | null) {
  const name = String(value ?? "").trim();
  if (name.length < 2) {
    return "Token name must be at least 2 characters.";
  }
  if (name.length > 80) {
    return "Token name must be 80 characters or fewer.";
  }
  return "";
}

export function parseMCPTokenScope(value: FormDataEntryValue | null): MCPTokenScope {
  return value === "admin" ? "admin" : "read";
}

export function formatMCPTokenDate(value: string | null) {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
