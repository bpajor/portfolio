import type { MetadataRoute } from "next";
import { absoluteUrl, publicRoutes } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes().map((route) => {
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
