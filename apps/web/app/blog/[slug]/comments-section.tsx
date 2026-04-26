"use client";

import { FormEvent, useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

type Comment = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch(`${apiBaseUrl}/api/posts/${slug}/comments`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Comment[]) => {
        if (isMounted) {
          setComments(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setComments([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`${apiBaseUrl}/api/posts/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        body: form.get("body"),
        website: form.get("website"),
        turnstileToken: ""
      })
    });

    setSubmitting(false);
    if (!response.ok) {
      setMessage("Comment could not be submitted.");
      return;
    }

    event.currentTarget.reset();
    setMessage("Comment is waiting for moderation.");
  }

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase text-sky-300">Comments</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Discussion</h2>
        </div>
        <p className="font-mono text-xs text-slate-500">{comments.length} approved</p>
      </div>

      <div className="mt-5 grid gap-3">
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{comment.displayName}</h3>
              <time className="font-mono text-xs text-slate-500" dateTime={comment.createdAt}>
                {new Date(comment.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.body}</p>
          </article>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-5">
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <label className="grid gap-2 text-sm text-slate-300">
            Name
            <input name="displayName" required maxLength={80} className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Comment
            <textarea name="body" required maxLength={3000} rows={4} className="resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-slate-100 outline-none ring-sky-300/30 focus:border-sky-300/50 focus:ring-4" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSubmitting} className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Submitting..." : "Submit comment"}
          </button>
          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
        </div>
      </form>
    </section>
  );
}
