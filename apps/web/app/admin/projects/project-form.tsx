"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../api-url";
import { AdminProject, buildProjectPayload } from "./project-model";

type ProjectFormProps = {
  project?: AdminProject;
};

export function ProjectForm({ project }: ProjectFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setSaving] = useState(false);

  async function save(isFeatured?: boolean) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    const payload = buildProjectPayload(new FormData(form));
    if (typeof isFeatured === "boolean") {
      payload.isFeatured = isFeatured;
    }

    const response = await fetch(project ? apiUrl(`/admin/projects/${project.id}`) : apiUrl("/admin/projects"), {
      method: project ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setSaving(false);
    if (!response.ok) {
      setError("Project could not be saved. Check required fields and try again.");
      return;
    }

    const saved = (await response.json()) as AdminProject;
    setMessage(isFeatured === false ? "Project archived." : "Project saved.");
    if (!project) {
      router.push(`/admin/projects/${saved.id}`);
      return;
    }
    router.refresh();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  return (
    <form ref={formRef} className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Title
          <input name="title" required defaultValue={project?.title ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Slug
          <input name="slug" defaultValue={project?.slug ?? ""} placeholder="generated-from-title" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Eyebrow
          <input name="eyebrow" defaultValue={project?.eyebrow ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Sort order
          <input name="sortOrder" type="number" defaultValue={project?.sortOrder ?? 0} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-slate-300">
        Summary
        <textarea name="summary" required defaultValue={project?.summary ?? ""} rows={3} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Description
        <textarea name="description" defaultValue={project?.description ?? ""} rows={4} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Problem
          <textarea name="problem" defaultValue={project?.problem ?? ""} rows={4} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Built
          <textarea name="built" defaultValue={project?.built ?? ""} rows={4} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Signals
          <input name="signals" defaultValue={project?.signals.join(", ") ?? ""} placeholder="Admin, CRUD" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Stack
          <input name="stack" defaultValue={project?.stack.join(", ") ?? ""} placeholder="Go, Next.js" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Repository URL
          <input name="repoUrl" required defaultValue={project?.repoUrl ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Demo URL
          <input name="demoUrl" defaultValue={project?.demoUrl ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input name="isFeatured" type="checkbox" defaultChecked={project?.isFeatured ?? false} className="h-4 w-4 rounded border-white/20 bg-slate-950 text-sky-300" />
        Featured
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isSaving} className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">Save project</button>
        {project ? <button type="button" disabled={isSaving} onClick={() => void save(false)} className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Archive</button> : null}
      </div>
    </form>
  );
}
