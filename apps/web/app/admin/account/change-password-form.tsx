"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiUrl } from "../../api-url";
import { validateAdminPassword } from "./password-rules";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    const passwordError = validateAdminPassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    const response = await fetch(apiUrl("/admin/auth/password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    setSubmitting(false);

    if (!response.ok) {
      setError(response.status === 401 ? "Current password is invalid." : "Password could not be changed.");
      return;
    }

    setMessage("Password changed. Sign in again.");
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <form className="grid max-w-2xl gap-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm text-slate-300">
        Current password
        <input name="currentPassword" type="password" autoComplete="current-password" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        New password
        <input name="newPassword" type="password" autoComplete="new-password" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Confirm new password
        <input name="confirmPassword" type="password" autoComplete="new-password" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      <button type="submit" disabled={isSubmitting} className="h-11 w-fit rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
