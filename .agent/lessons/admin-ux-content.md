# Admin, UX, and Public Content Lessons

## 2026-05-05 - Admin UI actions had misleading feedback

What happened:

- Archiving a post worked functionally, but the UI displayed "Draft saved".
- Dashboard counts showed stale or misleading published post numbers.

Why it happened:

- The UI reused save feedback for a different action.
- Tests covered that an API request happened, but not that the user-facing message matched the action.

What I should have done:

- Add tests for user-visible feedback and count semantics before fixing the implementation.
- Treat admin UI copy as part of behavior, especially where it confirms destructive or state-changing actions.

Working rule:

- For user-facing state changes, verify the full contract: backend state, visible feedback, counts/lists, and follow-up navigation. A correct API call is not enough if the UI tells the user the wrong thing.

## 2026-05-05 - Blog page flashed static placeholder posts before API data loaded

What happened:

- The public writing page briefly displayed static placeholder posts before API posts loaded.
- The final state was correct, but the half-second flash looked unprofessional.

Why it happened:

- The component used static fallback data as initial UI state instead of reserving fallback for true API failure.
- Existing tests checked final rendered state, not the initial loading state.

What I should have done:

- Reproduce the visual issue and add a test that placeholder posts are not visible while API data is still pending.
- Distinguish loading, success, and fallback/error states explicitly.

Working rule:

- For asynchronous UI, test every visible phase that users can observe: initial, loading, success, empty, error, and fallback. Bugs often live in the transition, not the final state.

## 2026-05-05 - Public route E2E was brittle against real content changes

What happened:

- A public E2E expected the static "low-cost production portfolio" blog link.
- Once API-backed/admin-published posts changed the visible content, the test failed even though the route itself was healthy.

Why it happened:

- The test asserted a specific seed/static post instead of the page contract.
- The public site had moved toward dynamic content, but the test still assumed static content as canonical.

What I should have done:

- Assert stable page structure and separately test API-published content with seeded/controlled test data.
- Avoid coupling route smoke tests to mutable editorial content.

Working rule:

- Keep smoke tests about stable contracts and dedicated content tests about controlled content. Do not let mutable editorial data decide whether basic navigation is healthy.

## 2026-05-27 - Post media was treated as two separate bugs instead of one content contract

What happened:

- A selected post image persisted enough to appear in the admin dropdown flow, but it was not rendered in the public article and was easy to lose when the media list loaded asynchronously.
- I initially focused on the edit dropdown symptom before immediately treating public rendering as an integral part of the same feature.

Why it happened:

- I reasoned from individual UI symptoms instead of first naming the full lifecycle contract: upload media, select it on a post, save it, reload the editor, render it publicly, and expose it to SEO/GEO metadata.
- The tests I reached for were too narrow at first, so they risked proving only that one screen behaved better while the user-facing feature stayed incomplete.

What I should have done:

- Start by writing the end-to-end contract in one sentence before changing code.
- Add tests at every user-visible boundary touched by the contract: admin form state, saved post data, public article rendering, and metadata when relevant.
- Treat missing public display as part of the original feature, not as a follow-up polish task.

Working rule:

- When a feature moves data from admin input to public content, verify the whole content lifecycle before implementing: authoring state, persisted value, edit reload, public render, and machine-readable metadata. Do not split those into separate fixes unless the user explicitly narrows the scope.
