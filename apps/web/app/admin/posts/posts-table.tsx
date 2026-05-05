"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "../../api-url";
import { AdminPost, formatPostDate } from "./post-model";

export function PostsTable() {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/posts"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("posts unavailable");
        }
        return response.json() as Promise<AdminPost[]>;
      })
      .then((nextPosts) => {
        if (!ignore) {
          setPosts(nextPosts);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Posts could not be loaded.");
          setPosts([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (error) {
    return <p className="mt-5 text-sm text-red-300">{error}</p>;
  }

  if (posts === null) {
    return <p className="mt-5 text-sm text-slate-400">Loading posts...</p>;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Published</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {posts.map((post) => (
            <tr key={post.id} className="bg-slate-900/60">
              <td className="px-4 py-4 font-medium text-white">{post.title}</td>
              <td className="px-4 py-4 capitalize text-emerald-300">{post.status}</td>
              <td className="px-4 py-4 text-slate-400">{formatPostDate(post.publishedAt)}</td>
              <td className="px-4 py-4">
                <Link href={`/admin/posts/${post.id}`} className="text-sky-300 hover:text-sky-200">Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
