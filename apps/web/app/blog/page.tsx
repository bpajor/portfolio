import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PageIntro, SiteFrame } from "../_components/site-frame";
import { posts } from "../site-data";
import { JsonLd, breadcrumbJsonLd, pageMetadata } from "../seo";

const title = "Writing";
const description =
  "Technical writing by Blazej Pajor on backend architecture, GCP operations, LLM systems, MCP, and production engineering.";

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/blog"
});

export default function BlogPage() {
  return (
    <SiteFrame>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Writing", path: "/blog" }
        ])}
      />
      <PageIntro
        eyebrow="Writing"
        title="Technical writing as an engineering notebook."
        body="Notes on backend architecture, GCP operations, LLM systems, and the process of building this portfolio as a small but real production platform."
      />

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-2">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-slate-900 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="font-mono text-xs uppercase text-slate-500">
                {post.publishedAt} / {post.readingTime}
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
    </SiteFrame>
  );
}
