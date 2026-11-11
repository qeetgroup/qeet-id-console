<!-- Title: type(scope): summary, for example "fix(sign-in): keep the return address".
Changes go into develop. A fix found in testing is made on develop first, then copied to the release/YEAR.MONTH.0
branch; an urgent fix after a release is a hotfix/YEAR.MONTH.N branch into main. -->

## What and why

<!-- What changes, and the reason. "Fixes #123" closes the issue when it reaches main. -->

## Checked

- [ ] `bun run typecheck && bun run check && bun run lint:boundaries && bun run test && bun run build && bun run size`
- [ ] `bun run test:e2e` after touching `src/platform/{api,auth}`, a page or the Content-Security-Policy
- [ ] No token reaches the browser; backend calls go through the API client; no backend `error.message` is rendered
