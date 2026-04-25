# PRD: Portfolio, Blog, and MCP Platform

## Overview

Build a dark, technical personal website for Blazej Pajor. The site presents portfolio projects, professional profile, and technical writing. It includes a Go backend, PostgreSQL database, admin panel, anonymous moderated comments, MCP server for AI agents, and GCP deployment under 50 PLN/month.

## User Profile

Blazej Pajor is a Software Engineer working at the intersection of backend development, cloud infrastructure, and AI-driven systems. He works with Go, PHP, GCP, Kubernetes, reliability, performance optimization, and large-scale cloud infrastructure. He is expanding into LLM-based systems and Agentic AI.

## Goals

- Present professional identity clearly in English.
- Showcase Go, GCP, backend, infrastructure, and AI-agent capabilities through the platform itself.
- Allow publishing blog posts from a browser-based admin panel.
- Allow anonymous comments while protecting against spam and abuse.
- Provide a secure MCP interface for AI agents.
- Optimize content for SEO and GEO.
- Keep monthly hosting costs under 50 PLN.

## Non-Goals for V1

- Multi-user public accounts.
- Paid newsletter.
- Cloud SQL.
- Complex CMS workflows.
- Public arbitrary MCP tools.
- E-commerce.

## Functional Requirements

### Public Website

- Display a landing page with profile photo, short bio, focus areas, projects, latest posts, and contact links.
- Display project list and project detail pages.
- Display blog list and blog detail pages.
- Display approved comments on blog posts.
- Allow anonymous comment submission.
- Display contact details and contact form.

### Admin Panel

- Admin can log in.
- Admin can create, edit, publish, unpublish, and delete blog posts.
- Admin can manage project entries.
- Admin can upload media.
- Admin can approve, reject, mark spam, or delete comments.
- Admin can review contact messages.

### Go API

- Serve public content APIs.
- Serve admin APIs.
- Validate inputs.
- Enforce auth and rate limits.
- Store data in PostgreSQL.

### MCP Server

- Expose read-only tools for profile, projects, blog posts, and site context.
- Expose admin-only tools for draft creation and comment moderation.
- Require authorization.
- Log all admin tool calls.

### SEO/GEO

- Generate sitemap, robots, RSS, canonical URLs, and OpenGraph metadata.
- Add JSON-LD structured data.
- Provide clear textual content in HTML.
- Optionally expose `llms.txt` and `ai-context.json`.

## Security Requirements

- HTTPS only.
- Cloudflare proxy in front of origin.
- PostgreSQL not publicly exposed.
- Admin auth with secure cookies.
- Rate limit login, comments, contact, and MCP.
- Turnstile for comments/contact.
- CSRF protection for admin mutations.
- CSP and security headers.
- Daily backups.
- GCP budget alerts.
- No MCP shell/file execution tools.

## Success Criteria

- Site is live behind a custom domain.
- Monthly cloud cost remains under 50 PLN excluding domain purchase.
- Admin can publish a blog post without direct database access.
- Anonymous users can submit comments that enter moderation.
- AI agent can query site context through authorized MCP tools.
- Public pages pass basic SEO checks and render structured data.
- Backup and restore process is documented and tested.
