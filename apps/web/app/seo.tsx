import type { Metadata } from "next";
import { posts, profile, projects, type BlogPost, type Project } from "./site-data";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const siteName = "Blazej Pajor";
export const defaultDescription =
  "Software Engineer focused on backend systems, GCP, Kubernetes, reliability, and AI-driven workflows.";

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  tags
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  tags?: string[];
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      type,
      publishedTime,
      tags,
      images: [{ url: absoluteUrl(profile.image), width: 1200, height: 630, alt: profile.name }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(profile.image)]
    }
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c")
      }}
    />
  );
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": absoluteUrl("/#person"),
    name: profile.name,
    jobTitle: profile.role,
    description: profile.headline,
    url: absoluteUrl("/"),
    image: absoluteUrl(profile.image),
    email: profile.email,
    worksFor: {
      "@type": "Organization",
      name: profile.company
    },
    sameAs: [profile.github, profile.linkedin],
    knowsAbout: profile.focus
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: siteName,
    url: absoluteUrl("/"),
    description: defaultDescription,
    publisher: {
      "@id": absoluteUrl("/#person")
    },
    inLanguage: "en"
  };
}

export function profilePageJsonLd(path: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": absoluteUrl(`${path}#profile-page`),
    url: absoluteUrl(path),
    name: title,
    description,
    about: {
      "@id": absoluteUrl("/#person")
    },
    isPartOf: {
      "@id": absoluteUrl("/#website")
    },
    inLanguage: "en"
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function projectJsonLd(project: Project) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    "@id": absoluteUrl(`/projects/${project.slug}#project`),
    name: project.title,
    description: project.description,
    url: absoluteUrl(`/projects/${project.slug}`),
    codeRepository: project.href,
    programmingLanguage: project.stack,
    creator: {
      "@id": absoluteUrl("/#person")
    },
    keywords: [...project.signals, ...project.stack].join(", ")
  };
}

export function blogPostJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": absoluteUrl(`/blog/${post.slug}#blog-post`),
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: absoluteUrl(`/blog/${post.slug}`),
    image: absoluteUrl(profile.image),
    author: {
      "@id": absoluteUrl("/#person")
    },
    publisher: {
      "@id": absoluteUrl("/#person")
    },
    keywords: post.tags.join(", "),
    articleBody: post.sections.map((section) => `${section.heading}. ${section.body}`).join("\n\n"),
    inLanguage: "en"
  };
}

export function publicRoutes() {
  return [
    { path: "/", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/projects", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.6 },
    ...projects.map((project) => ({
      path: `/projects/${project.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7
    })),
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
      lastModified: post.publishedAt
    }))
  ];
}
