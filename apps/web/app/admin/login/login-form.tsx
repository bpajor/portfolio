"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiUrl } from "../../api-url";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isReady, setReady] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch(apiUrl("/admin/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    setSubmitting(false);
    if (!response.ok) {
      setError("Email or password is invalid.");
      return;
    }

    router.push(searchParams.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm text-slate-300">
        Email
        <input name="email" type="email" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Password
        <input name="password" type="password" required className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" disabled={!isReady || isSubmitting} className="mt-2 h-11 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
