"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiUrl } from "../api-url";
import { posts as staticPosts } from "../site-data";
import { PublicPost, formatPublishedDate, readingTime, staticPostToPublicPost } from "./blog-model";

const fallbackPosts = staticPosts.map(staticPostToPublicPost);

export function BlogList() {
  const [posts, setPosts] = useState<PublicPost[]>(fallbackPosts);

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/posts"))
      .then((response) => (response.ok ? response.json() : fallbackPosts))
      .then((nextPosts: PublicPost[]) => {
        if (!ignore && nextPosts.length > 0) {
          setPosts(nextPosts);
        }
      })
      .catch(() => {
        if (!ignore) {
          setPosts(fallbackPosts);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-2">
      {posts.map((post) => (
        <Link key={post.slug} href={`/blog/${post.slug}`} className="group rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-slate-900 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="font-mono text-xs uppercase text-slate-500">
              {formatPublishedDate(post.publishedAt)} / {readingTime(post.contentMarkdown ?? post.excerpt)}
            </div>
            <ArrowUpRight className="text-slate-500 transition group-hover:text-sky-300" size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-white md:text-2xl">{post.title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400 md:text-base md:leading-7">{post.excerpt}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-100">
                {tag}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </section>
  );
}
