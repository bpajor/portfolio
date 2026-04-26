"use client";

import { useEffect, useState } from "react";
import { Panel } from "../_components/admin-shell";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

type AdminComment = {
  id: string;
  postTitle: string;
  postSlug: string;
  displayName: string;
  body: string;
  status: string;
  createdAt: string;
};

const filters = ["pending", "approved", "spam", "deleted"];

export function CommentsModeration() {
  const [status, setStatus] = useState("pending");
  const [comments, setComments] = useState<AdminComment[] | null>(null);

  async function fetchComments(nextStatus: string) {
    const response = await fetch(`${apiBaseUrl}/api/admin/comments?status=${nextStatus}`, {
      credentials: "include"
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as AdminComment[];
  }

  useEffect(() => {
    let ignore = false;

    void fetchComments(status).then((nextComments) => {
      if (!ignore) {
        setComments(nextComments);
      }
    });

    return () => {
      ignore = true;
    };
  }, [status]);

  async function moderate(commentId: string, nextStatus: string) {
    const response = await fetch(`${apiBaseUrl}/api/admin/comments/${commentId}/moderate`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    if (response.ok) {
      setComments(await fetchComments(status));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`h-9 rounded-md border px-3 text-sm capitalize ${
              status === item
                ? "border-sky-300/50 bg-sky-300 text-slate-950"
                : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {comments === null ? (
          <Panel>
            <p className="text-sm text-slate-400">Loading comments...</p>
          </Panel>
        ) : comments.length === 0 ? (
          <Panel>
            <p className="text-sm text-slate-400">No comments in this queue.</p>
          </Panel>
        ) : (
          comments.map((comment) => (
            <Panel key={comment.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase text-slate-500">{comment.postTitle}</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">{comment.displayName}</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs capitalize text-slate-300">
                  {comment.status}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{comment.body}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => moderate(comment.id, "approved")} className="h-10 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
                  Approve
                </button>
                <button onClick={() => moderate(comment.id, "spam")} className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/5">
                  Mark spam
                </button>
                <button onClick={() => moderate(comment.id, "deleted")} className="h-10 rounded-md border border-red-300/30 px-4 text-sm font-medium text-red-200 hover:bg-red-950/30">
                  Delete
                </button>
              </div>
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}
