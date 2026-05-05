"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../api-url";
import { AdminPost, PostStatus, buildPostPayload } from "./post-model";

type PostFormProps = {
  post?: AdminPost;
};

export function PostForm({ post }: PostFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setSaving] = useState(false);

  async function save(status: PostStatus) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    const endpoint = post ? apiUrl(`/admin/posts/${post.id}`) : apiUrl("/admin/posts");
    const response = await fetch(endpoint, {
      method: post ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPostPayload(new FormData(form), status))
    });

    setSaving(false);
    if (!response.ok) {
      setError("Post could not be saved. Check required fields and try again.");
      return;
    }

    const saved = (await response.json()) as AdminPost;
    setMessage(status === "published" ? "Post published." : "Draft saved.");
    if (!post) {
      router.push(`/admin/posts/${saved.id}`);
    }
    router.refresh();
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("draft");
  }

  return (
    <form ref={formRef} className="grid gap-4" onSubmit={submitDraft}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Title
          <input name="title" required defaultValue={post?.title ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Slug
          <input name="slug" defaultValue={post?.slug ?? ""} placeholder="generated-from-title" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-slate-300">
        Excerpt
        <textarea name="excerpt" defaultValue={post?.excerpt ?? ""} rows={3} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Markdown
        <textarea name="contentMarkdown" defaultValue={post?.contentMarkdown ?? ""} rows={16} className="resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none focus:border-sky-300/50" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          SEO title
          <input name="seoTitle" defaultValue={post?.seoTitle ?? ""} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Tags
          <input name="tags" defaultValue={post?.tags.join(", ") ?? ""} placeholder="GCP, Go, Security" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-slate-300">
        SEO description
        <textarea name="seoDescription" defaultValue={post?.seoDescription ?? ""} rows={2} className="resize-none rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-sky-300/50" />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isSaving} className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">Save draft</button>
        <button type="button" disabled={isSaving} onClick={() => void save("published")} className="h-10 rounded-md border border-emerald-300/30 px-4 text-sm font-medium text-emerald-100 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60">Publish</button>
        {post ? <button type="button" disabled={isSaving} onClick={() => void save("archived")} className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">Archive</button> : null}
      </div>
    </form>
  );
}
