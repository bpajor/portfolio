import { posts as staticPosts } from "../site-data";
import { PublicPost, SeoBlogPost, blogPostToPublicPost, publicPostToBlogPost, staticPostToPublicPost } from "./blog-model";

const fallbackPublicPosts = staticPosts.map(staticPostToPublicPost);
const fallbackSeoPosts = fallbackPublicPosts.map(publicPostToBlogPost);

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function serverApiUrl(path: string) {
  const rawBase =
    process.env.API_INTERNAL_BASE_URL ??
    process.env.SERVER_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8080/api";
  const base =
    rawBase.startsWith("http://") || rawBase.startsWith("https://")
      ? rawBase
      : process.env.NODE_ENV === "production"
        ? "http://api:8080/api"
        : new URL(rawBase, process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").toString();

  return `${base.replace(/\/+$/, "")}/${trimSlashes(path)}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(serverApiUrl(path), {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPublishedPublicPosts(options: { fallbackToStatic?: boolean } = {}): Promise<PublicPost[] | null> {
  const apiPosts = await fetchJson<PublicPost[]>("/posts");
  if (apiPosts) {
    return apiPosts;
  }
  return options.fallbackToStatic === false ? null : fallbackPublicPosts;
}

export async function getPublishedSeoPosts(): Promise<SeoBlogPost[]> {
  const publicPosts = await getPublishedPublicPosts();
  return (publicPosts ?? fallbackPublicPosts).map(publicPostToBlogPost);
}

export async function getPublishedPublicPost(slug: string): Promise<PublicPost | null> {
  const apiPost = await fetchJson<PublicPost>(`/posts/${slug}`);
  if (apiPost) {
    return apiPost;
  }

  return fallbackPublicPosts.find((post) => post.slug === slug) ?? null;
}

export async function getPublishedSeoPost(slug: string): Promise<SeoBlogPost | null> {
  const publicPost = await getPublishedPublicPost(slug);
  return publicPost ? publicPostToBlogPost(publicPost) : null;
}

export function seoPostToPublicPost(post: SeoBlogPost): PublicPost {
  return blogPostToPublicPost(post);
}
