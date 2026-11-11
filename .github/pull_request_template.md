<!-- Title: type(scope): summary, for example "fix(sign-in): keep the return address". The title sets the release
version: "feat!: …" is a major, "feat: …" a minor, anything else (fix, docs, chore, ci, refactor) a patch.
A fix found in testing goes into release; everything else into develop. -->

## What and why

<!-- What changes, and the reason. "Fixes #123" closes the issue when it reaches main. -->

## Checked

- [ ] `bun run typecheck && bun run check && bun run lint:boundaries && bun run test && bun run build && bun run size`
- [ ] `bun run test:e2e` after touching `src/platform/{api,auth}`, a page or the Content-Security-Policy
- [ ] No token reaches the browser; backend calls go through the API client; no backend `error.message` is rendered
