import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "./seo";
import { getPublishedSeoPosts } from "./blog/server-posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const writingPosts = await getPublishedSeoPosts();

  return publicRoutes(writingPosts).map((route) => {
    const lastModified =
      "lastModified" in route && typeof route.lastModified === "string"
        ? route.lastModified
        : new Date().toISOString();

    return {
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority
    };
  });
}
