# SEO and GEO

The public site exposes both human-readable pages and machine-readable context for search engines, feed readers, and AI systems.

## Public Metadata

Every public page has a canonical URL, title, description, Open Graph metadata, and Twitter card metadata.

Dynamic routes generate metadata from `apps/web/app/site-data.ts`:

- `/projects/[slug]`
- `/blog/[slug]`

## Structured Data

JSON-LD is rendered on public pages for:

- `Person`
- `WebSite`
- `ProfilePage`
- `BreadcrumbList`
- `SoftwareSourceCode`
- `BlogPosting`

Structured data is generated from the same visible content used by the page UI.

## Machine-Readable Endpoints

- `/sitemap.xml`
- `/robots.txt`
- `/rss.xml`
- `/llms.txt`
- `/ai-context.json`

`robots.txt` allows public pages and disallows `/admin` and `/api`.

## GEO Notes

GEO means Generative Engine Optimization. This project supports it by:

- keeping claims aligned with visible content,
- exposing compact factual context in `ai-context.json`,
- exposing an LLM-oriented summary in `llms.txt`,
- using JSON-LD for entity and page relationships,
- keeping MCP behind bearer authentication.
