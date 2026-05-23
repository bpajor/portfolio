"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { apiUrl } from "../../api-url";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);

  async function signOut() {
    setSubmitting(true);
    await fetch(apiUrl("/admin/auth/logout"), {
      method: "POST",
      credentials: "include"
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isSubmitting}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      title="Sign out"
    >
      <LogOut size={16} aria-hidden="true" />
      {isSubmitting ? "Signing out..." : "Sign out"}
    </button>
  );
}
