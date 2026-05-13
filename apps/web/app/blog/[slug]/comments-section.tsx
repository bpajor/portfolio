"use client";

import { useEffect, useState, type FormEvent } from "react";

import { apiUrl } from "../../api-url";
import { canSubmitComment, normalizeCommentDraft } from "./comment-form-model";

type Comment = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  const draft = { displayName, body };
  const canSubmit = canSubmitComment(draft) && status !== "submitting";

  useEffect(() => {
    let isMounted = true;
    fetch(apiUrl(`/posts/${slug}/comments`))
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

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitComment(draft)) {
      return;
    }

    setStatus("submitting");
    const normalized = normalizeCommentDraft(draft);

    try {
      const response = await fetch(apiUrl(`/posts/${slug}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...normalized, turnstileToken: "" })
      });
      if (!response.ok) {
        throw new Error("comment rejected");
      }
      setDisplayName("");
      setBody("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
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
        {comments.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-sm leading-6 text-slate-400">No approved comments yet.</p>
          </div>
        ) : null}

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

      <form onSubmit={submitComment} className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <div>
          <label htmlFor="comment-display-name" className="text-sm font-medium text-white">
            Display name
          </label>
          <input
            id="comment-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-sky-300"
          />
        </div>
        <div>
          <label htmlFor="comment-body" className="text-sm font-medium text-white">
            Comment
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="mt-2 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-sky-300"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Submitting..." : "Submit comment"}
          </button>
          {status === "sent" ? <p className="text-sm text-emerald-300">Comment sent for moderation.</p> : null}
          {status === "error" ? <p className="text-sm text-red-200">Comment could not be sent. Try again later.</p> : null}
        </div>
      </form>
    </section>
  );
}
