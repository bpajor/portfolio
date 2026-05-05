"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "../api-url";
import { AdminPost, formatPostDate } from "./posts/post-model";

export function RecentWriting() {
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
          setPosts(nextPosts.slice(0, 4));
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Recent writing could not be loaded.");
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
    return <p className="mt-5 text-sm text-slate-400">Loading recent writing...</p>;
  }

  if (posts.length === 0) {
    return <p className="mt-5 text-sm text-slate-400">No posts have been created yet.</p>;
  }

  return (
    <div className="mt-5 divide-y divide-white/10">
      {posts.map((post) => (
        <Link key={post.id} href={`/admin/posts/${post.id}`} className="block py-4 hover:text-sky-300">
          <p className="font-medium text-white">{post.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {formatPostDate(post.publishedAt)} / {post.status}
          </p>
        </Link>
      ))}
    </div>
  );
}
