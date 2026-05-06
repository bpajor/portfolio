const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080/api";

export function apiUrl(path: string) {
  const base = apiBaseUrl.replace(/\/+$/, "");
  let suffix = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && (suffix === "/api" || suffix.startsWith("/api/") || suffix.startsWith("/api?"))) {
    suffix = suffix.slice(4);
  }
  return `${base}${suffix}`;
}
