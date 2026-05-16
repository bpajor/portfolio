# Testing and Verification Lessons

## 2026-05-05/06 - CSRF and production API URL issues escaped early tests

What happened:

- Cloud Shell preview origins caused `csrf_invalid` for admin mutations on staging.
- A production-only `/api/api/...` URL regression reached production-like flow despite staging being fine.

Why it happened:

- Tests were too mocked/local and did not exercise the exact deployed origin, proxy, and environment combinations.
- I trusted local unit/E2E coverage for paths that were actually environment-sensitive.

What I should have done:

- Reproduce failures against the real staging origin before claiming confidence.
- Add live staging E2E checks for Cloud Shell preview origin, admin mutations, and production API prefix behavior.
- Treat URL composition and CSRF origin checks as deployment-surface code, not just frontend helpers.

Working rule:

- If behavior depends on environment, origin, proxy, cookies, browser security, or deployment topology, local mocks are not enough. Add at least one test or manual check at the same boundary where the failure would occur in production.

## 2026-05-16 - Re-check test assumptions after changing execution boundaries

What happened:

- After moving `/blog` toward server-side rendering, the deployed staging E2E test `does not flash static placeholder posts while API posts load` failed twice.
- The test used `page.route("**/api/posts")` to block and replace the posts response, but on deployed staging the server had already fetched real posts before Playwright could intercept browser requests.
- The test then saw real server-rendered content and reported a false regression.

Why it happened:

- I changed the execution boundary from browser-side data loading to server-side data loading, but I did not re-audit which layer the existing test controlled.
- I verified the test locally in a mode where the mock still seemed useful, instead of checking whether the same assumption held in deployed staging.
- I treated a passing local test as proof of the behavior, when the real question was whether the test was still observing and controlling the right part of the system.

What I should have done:

- Whenever a change moves logic between layers, re-check the test design before trusting existing coverage.
- Ask: where does this behavior now execute, what dependency does the test control, and can the test still force the failure mode it claims to cover?
- Keep local mocks for the layer they actually control, and add a separate server/deployed check for behavior that now runs outside the browser.
- Prefer tests that fail for the right reason over tests that merely pass in one environment.

Working rule:

- After any architectural shift across client/server, build/deploy/runtime, CI/VM, proxy/app, or auth/browser boundaries, re-audit affected tests and assumptions before declaring the change safe.

## 2026-05-08 - Test expected an empty Turnstile token after widget integration

What happened:

- E2E expected `turnstileToken: ""`, but with Turnstile loaded it correctly submitted `XXXX.DUMMY.TOKEN.XXXX`.
- The test failed after the implementation became more realistic.

Why it happened:

- The assertion described the old no-widget behavior, not the intended behavior after introducing a test Turnstile key.
- I did not revisit test expectations as part of the feature semantics change.

What I should have done:

- Update E2E expectations to assert payload shape and that the token is a string, with live staging tests covering whether the backend accepts it.

Working rule:

- When behavior changes from placeholder/simulated to integrated/real, revisit old assertions. Tests should encode the current contract and end-to-end acceptance, not historical implementation details.
