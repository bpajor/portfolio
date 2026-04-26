import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteFrame } from "../../_components/site-frame";
import { posts } from "../../site-data";
import { CommentsSection } from "./comments-section";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    notFound();
  }

  return (
    <SiteFrame>
      <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" />
          Writing
        </Link>
        <div className="mt-8 font-mono text-xs uppercase text-slate-500">
          {post.publishedAt} / {post.readingTime}
        </div>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          {post.title}
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-300 md:text-lg md:leading-8">{post.excerpt}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-100">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-10 space-y-8 border-t border-white/10 pt-8">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-white md:text-2xl">{section.heading}</h2>
              <p className="mt-3 text-base leading-7 text-slate-400">{section.body}</p>
            </section>
          ))}
        </div>
        <CommentsSection slug={post.slug} />
      </article>
    </SiteFrame>
  );
}
