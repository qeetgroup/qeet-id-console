# ADR-0006: Qeet AI tool execution model

**Status:** Accepted

## Context

Qeet AI executes tools client-side under the operator's own token, so backend
RBAC/RLS/audit already apply (no privilege bypass). But several mutating tools
(`assign_role`, `grant_permission`, `set_strict_mfa`, `create_*`,
`create_oauth_client`) were `destructive:false` and ran with **no human
confirmation**; execution wasn't gated by the enabled-tool set; there was no
step-up recovery; and non-secret PII flowed to the model and to localStorage.

## Decision

- **Confirm on presence:** the engine gates on a `confirm` builder being present
  (not on `destructive`). All mutating/privilege/creation/secret-minting tools
  declare a confirm builder; `destructive` now only drives dialog tone.
- **Enabled-set gating:** execution is restricted to tools in
  `enabledTools(can)`; a call outside it is refused (`tool_not_enabled`).
- **Step-up in the AI path:** `ToolContext.stepUp()` + an `awaiting_step_up`
  state; a `step_up_required` pauses, re-verifies, and retries once.
- **Data hygiene:** secrets are diverted to an in-memory store and never sent to
  the model or persisted; PII (emails/IPs) is masked in model-bound results and
  in the persisted conversation; opaque IDs are kept for follow-up calls;
  conversations are cleared on logout.

## Consequences

- An LLM cannot silently escalate privileges, create principals, mint secrets,
  or weaken MFA — a human approves each. Backend remains authoritative.
- The model sees masked PII; the operator's own screen still shows full data.
