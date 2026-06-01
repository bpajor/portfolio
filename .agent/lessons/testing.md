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

## 2026-05-20 - Live E2E asserted the remembered login status instead of the API contract

What happened:

- The live staging admin login test expected `204`, but the real backend returns `200` with the admin identity payload.
- The deployed staging E2E failed even though the login flow itself worked.

Why it happened:

- I carried over an assumption from a simpler local/mocked login check instead of re-reading the API handler before asserting the live contract.
- I treated "successful login" as a generic outcome and did not verify the exact status/body semantics that the deployed test should encode.

What I should have done:

- Before adding or changing live E2E assertions, inspect the authoritative server handler or API contract for status codes and response bodies.
- Assert the meaningful contract, not just a success code. In this case that means `200`, matching admin email, and `role: admin`.

Working rule:

- Live tests should encode the real API contract. If the assertion involves status codes, response body shape, cookies, redirects, or auth state, confirm it against the backend implementation or contract before pushing.

## 2026-05-26 - Live E2E mixed HTTPS staging behavior with an HTTP localhost tunnel

What happened:

- The deployed login endpoint returned `200` and a session cookie, but the browser stayed on `/admin/login` in CI.
- CI was reaching staging through `http://127.0.0.1:3000`, while the deployed API correctly marked the admin session cookie as `Secure`.

Why it happened:

- I treated the local tunnel URL as equivalent to the real HTTPS staging origin.
- The test expected browser auth state to work over a transport where Secure cookies cannot be stored.

What I should have done:

- Separate the API login contract from browser cookie persistence when the test target is an HTTP tunnel.
- Keep the HTTPS behavior covered for real preview origins, but avoid weakening runtime cookie security to satisfy a tunnel-specific assertion.
- Avoid asserting `Set-Cookie` from a browser page response; browser-facing response APIs may not expose that header. Use API-level checks for header details, and page-level checks for browser-visible effects.

Working rule:

- Live E2E through tunnels must model browser security rules for the tunnel origin. If the tunnel is HTTP but production/staging uses Secure cookies, assert the API contract separately from browser navigation, or run that browser-auth assertion against HTTPS.

## 2026-05-31 - Rich editor migration left old E2E selectors behind

What happened:

- Replacing the Markdown textarea with a Tiptap editor passed the targeted local publish test, but staging failed because a live E2E still waited for `getByLabel("Markdown")`.
- The local helper also typed too quickly through a toolbar-driven state change and intermittently dropped the first character of the heading.

Why it happened:

- I updated the test closest to the changed form, but did not audit every admin/live test that still depended on the old authoring widget.
- I treated a passing targeted test as enough confidence even though the UI control had changed across the broader admin surface.
- The typing helper depended on focus timing after a toolbar click instead of using a stable editor interaction path.

What I should have done:

- Search all E2E suites for the removed label or old widget contract before pushing.
- Run the full relevant admin E2E suite after replacing a central form control.
- Prefer deterministic editor helpers, such as keyboard shortcuts plus sequential typing, when testing rich text behavior.

Working rule:

- When replacing an input widget, audit all tests and live flows that name or operate on the old widget. A targeted test is not enough; run the full affected surface and make rich editor helpers resilient to focus and timing.

## 2026-06-01 - Rich editor image insertion raced React state in CI

What happened:

- The inline image E2E passed locally, but CI submitted HTML without the `<img>` and with later field text appended to the editor content.
- The test selected an inline image and immediately clicked `Insert image`; in CI the click could run before React had committed the selected image state.

Why it happened:

- I treated `selectOption` as proof that the component's derived React state was already ready for the next click.
- The test asserted only the final submitted payload, so the failure surfaced late and made it harder to tell whether selection, insertion, or form submission was wrong.

What I should have done:

- Make the component action read the current control value, not only delayed derived state, when the next action depends on the same control.
- Have the E2E wait for the button to be enabled and for the inline image to appear in the editor before moving to later form fields.

Working rule:

- For rich editor controls that combine selection plus action, synchronize on visible UI state before continuing. Component handlers should not rely solely on recently updated React state when the current DOM control value is the source of truth.
