# Follow-Up Tasks

This backlog captures non-blocking work discovered during the first production release. These tasks should be turned into GitHub issues or PRs when the release path is stable.

## 1. Optimize Deploy Builds by Changed Surface

Problem:

- The deploy workflow currently builds web, API, and MCP images for every deployment.
- A backend-only change should not rebuild the frontend image if the web dependency surface did not change.
- This wastes GitHub Actions time and makes production deploy feedback slower.

Goal:

- Build and transfer only the images affected by a change.
- Preserve the current prebuilt-image deployment strategy so the `e2-micro` VM remains a runtime target, not a build worker.

Suggested approach:

- Define path groups for `web`, `api`, `mcp`, shared packages, migrations, and deployment files.
- Use changed-file detection in `deploy.yml` to decide which images need rebuilding.
- Reuse the currently deployed image tags for unchanged services, or move to immutable image tags plus a small manifest that Compose can consume.
- Keep a full rebuild fallback for dependency, Dockerfile, compose, lockfile, or shared package changes.

Acceptance criteria:

- API-only changes do not trigger a web image build.
- MCP-only changes do not trigger web or API image builds unless shared dependencies changed.
- Shared package, lockfile, Dockerfile, or compose changes still trigger the required dependent image builds.
- Staging and production deploys remain reproducible and rollback-friendly.

## 2. Improve Discoverability for "Blazej Pajor" / "Błażej Pajor"

Problem:

- Searching Google for the author's name does not reliably surface the site.
- Existing SEO/GEO assets exist, but the production launch needs real-world indexing and identity validation work.

Goal:

- Improve search visibility for queries such as `Blazej Pajor`, `Blazej Pajor portfolio`, and the Polish spelling `Błażej Pajor`.
- Improve both classic SEO and GEO, meaning the site should be easy for search engines and AI systems to understand, cite, and summarize.

Suggested approach:

- Verify Google Search Console ownership for `bpajor.dev`.
- Submit `https://bpajor.dev/sitemap.xml`.
- Inspect whether `robots.txt`, sitemap, canonical URLs, metadata, JSON-LD, and Open Graph data are correct in production.
- Add or improve person/profile structured data for the homepage.
- Add clear internal links and text signals that associate the domain with the author's full name.
- Check indexing status after deployment and request indexing for the homepage and key public pages.
- Consider external identity signals later, such as GitHub profile link, LinkedIn link, and consistent profile metadata.

Acceptance criteria:

- Google Search Console shows the homepage and sitemap as discovered and indexable.
- The homepage has valid structured data for the author/person and website.
- Searching for the name begins surfacing the domain or Search Console indicates no technical blocker remains.
- GEO assets remain aligned with real page content and do not rely on hidden text or misleading keyword stuffing.
