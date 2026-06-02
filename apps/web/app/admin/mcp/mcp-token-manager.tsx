"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { apiUrl } from "../../api-url";
import { AdminMCPToken, formatMCPTokenDate, parseMCPTokenScope, validateMCPTokenName } from "./mcp-token-model";

export function MCPTokenManager() {
  const [tokens, setTokens] = useState<AdminMCPToken[] | null>(null);
  const [createdToken, setCreatedToken] = useState<AdminMCPToken | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isCreating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/mcp/tokens"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("mcp tokens unavailable");
        }
        return response.json() as Promise<AdminMCPToken[]>;
      })
      .then((items) => {
        if (!ignore) {
          setTokens(items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setTokens([]);
          setError("MCP tokens could not be loaded.");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const nameError = validateMCPTokenName(data.get("name"));
    if (nameError) {
      setError(nameError);
      setMessage("");
      return;
    }

    setCreating(true);
    setError("");
    setMessage("");
    const response = await fetch(apiUrl("/admin/mcp/tokens"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        scope: parseMCPTokenScope(data.get("scope"))
      })
    });
    setCreating(false);

    if (!response.ok) {
      setError("MCP token could not be created.");
      return;
    }

    const token = (await response.json()) as AdminMCPToken;
    setCreatedToken(token);
    setTokens((items) => [token, ...(items ?? [])]);
    form.reset();
    setMessage("MCP token created.");
  }

  async function revokeToken(token: AdminMCPToken) {
    setBusyId(token.id);
    setError("");
    setMessage("");
    const response = await fetch(apiUrl(`/admin/mcp/tokens/${token.id}`), {
      method: "DELETE",
      credentials: "include"
    });
    setBusyId("");

    if (!response.ok) {
      setError("MCP token could not be revoked.");
      return;
    }

    const revoked = (await response.json()) as AdminMCPToken;
    setTokens((items) => (items ?? []).map((item) => (item.id === revoked.id ? revoked : item)));
    if (createdToken?.id === revoked.id) {
      setCreatedToken(null);
    }
    setMessage("MCP token revoked.");
  }

  async function copyToken() {
    if (!createdToken?.token) {
      return;
    }
    await navigator.clipboard.writeText(createdToken.token);
    setMessage("Token copied.");
  }

  return (
    <div className="grid gap-6">
      <form className="grid gap-4 rounded-xl border border-white/10 bg-slate-950 p-4" onSubmit={createToken}>
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_auto] lg:items-end">
          <label className="grid gap-2 text-sm text-slate-300">
            Token name
            <input name="name" placeholder="Claude Desktop read token" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Scope
            <select name="scope" defaultValue="read" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50">
              <option value="read">Read</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" disabled={isCreating} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">
            <Plus size={17} aria-hidden="true" />
            Create token
          </button>
        </div>
      </form>

      {createdToken?.token ? (
        <section className="grid gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-emerald-100">Copy this token now</h2>
              <p className="mt-1 text-sm text-emerald-100/70">It will not be shown again after this page state changes.</p>
            </div>
            <button type="button" onClick={() => void copyToken()} className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200/40 px-3 text-sm text-emerald-50 hover:bg-emerald-200/10">
              <Copy size={16} aria-hidden="true" />
              Copy
            </button>
          </div>
          <input readOnly value={createdToken.token} className="h-11 rounded-md border border-emerald-200/30 bg-slate-950 px-3 font-mono text-xs text-emerald-50 outline-none" />
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      {tokens === null ? <p className="text-sm text-slate-400">Loading MCP tokens...</p> : null}
      {tokens?.length === 0 ? <p className="rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-400">No MCP tokens created yet.</p> : null}

      {tokens && tokens.length > 0 ? (
        <div className="grid gap-3">
          {tokens.map((token) => {
            const revoked = Boolean(token.revokedAt);
            return (
              <article key={token.id} className="grid gap-4 rounded-xl border border-white/10 bg-slate-950 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <KeyRound size={16} className={revoked ? "text-slate-500" : "text-sky-300"} aria-hidden="true" />
                    <h2 className="font-medium text-white">{token.name}</h2>
                    <span className="rounded-md border border-white/10 px-2 py-0.5 text-xs uppercase text-slate-300">{token.scope}</span>
                    {revoked ? <span className="rounded-md border border-red-300/30 px-2 py-0.5 text-xs uppercase text-red-200">Revoked</span> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Created {formatMCPTokenDate(token.createdAt)} / Last used {formatMCPTokenDate(token.lastUsedAt)}
                  </p>
                </div>
                <button type="button" disabled={revoked || busyId === token.id} onClick={() => void revokeToken(token)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-300/30 px-3 text-sm text-red-100 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={16} aria-hidden="true" />
                  Revoke
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
