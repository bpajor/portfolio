"use client";

import { useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

type Comment = {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);

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
            <p className="text-sm leading-6 text-slate-400">
              Public comments are read-only for the first production release while bot protection is being finalized.
            </p>
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
    </section>
  );
}
