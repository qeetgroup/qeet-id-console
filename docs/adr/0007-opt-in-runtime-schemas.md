# ADR-0007: Opt-in runtime schemas at the API boundary

**Status:** Accepted

## Context

TypeScript types are erased at runtime; the console trusted that the backend
always returned the declared shape. For an IAM console this is risky — e.g. a
malformed effective-permissions payload would silently become a garbage
capability set. Rewriting all ~48 data-clients to validate was not justified.

## Decision

Add an **opt-in** `schema?: ZodType<T>` to `api(path, opts)`. When present, the
response is parsed and the inferred type returned; a mismatch throws an
`ApiError` (`client.schema_mismatch`) so it fails closed and surfaces like any
other error. When absent, behaviour is byte-for-byte unchanged.

Adopt security-sensitive endpoints first — effective-permissions is done; refresh,
MFA, signing-keys, and OAuth-client responses are the next candidates. Infer
domain types from schemas (`z.infer`) going forward instead of duplicating
interfaces.

## Consequences

- Incremental, zero-churn adoption; no mass rewrite.
- Validated endpoints fail closed on backend contract drift.
