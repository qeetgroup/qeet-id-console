## What and why

<!-- What changes, and the reason. Link the Jira issue (QTID-…). -->

## How it was verified

<!-- Tests added or run; manual checks. Changes under src/platform/{api,auth}:
also run `bun run test:e2e` (the browser session suite). -->

## Checklist

- [ ] `bun run typecheck && bun run check && bun run lint:boundaries && bun run test`
- [ ] New behaviour has a test; a bug fix has a regression test
- [ ] No backend `error.message` rendered (use `errorMessage` / `userMessageForCode`)
- [ ] No token in client state, `localStorage`, or a server-function return value
- [ ] Sensitive mutations go through `useSensitiveAction`
- [ ] User-facing text goes through i18n
- [ ] `docs/llm` updated if a convention or contract changed

<!-- Stop and escalate instead of merging if this weakens a security control,
changes a published contract, or needs a change in another repository. -->
