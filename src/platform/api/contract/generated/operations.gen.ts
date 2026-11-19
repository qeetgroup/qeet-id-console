// Generated from contract/qeet-id-server/operations.yaml by `bun run contract:sync`. Do not edit:
// `bun run contract:check` fails when this file and the document disagree.
export interface paths {
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness
         * @description Returns 200 whenever the process can answer the request, reporting only that the instance is running rather than that its dependencies are reachable. Requires no authentication and performs no dependency checks, making it the cheapest way to confirm connectivity. Container orchestrators use this signal to decide whether to restart the instance.
         */
        get: operations["checkLiveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Metrics (Prometheus)
         * @description Exposes process and request metrics in Prometheus exposition format for scraping by a metrics collector. The scraper presents METRICS_TOKEN as `Authorization: Bearer <token>`; without the right token the endpoint answers 404, as it does everywhere but development when no METRICS_TOKEN is set, since its counters (sign-in throttles among them) would tell an attacker how close they are to a limit. The payload reflects the instance's current counters and gauges at the time of the call.
         */
        get: operations["getMetrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Readiness
         * @description Runs every registered dependency probe under a short shared timeout and returns 200 only when all pass, otherwise 503 with a per-check breakdown (ok or fail; the cause is logged, never answered). Requires no authentication. Unlike the liveness probe, a failure here indicates the instance is temporarily unable to serve traffic, so orchestrators route requests away without restarting the process.
         */
        get: operations["checkReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/account/delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Delete the authenticated user's account
         * @description Immediately erases the authenticated user's account and revokes all of their sessions, exercising the right to erasure: the account is redacted and everything else it left is deleted, as POST /v1/gdpr/purge describes. When the account has a password, the current password must be supplied in the body to re-prove identity before this irreversible action; password-less accounts are authorized by the session alone. Audit references are retained in redacted form so the hash-chained log stays verifiable, and the client should sign the user out afterward.
         */
        post: operations["deleteMyAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/account/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export the authenticated user's portable account data
         * @description Assembles the authenticated user's own portable data across every organization they belong to and returns it synchronously as a downloadable JSON attachment, supporting the data-portability right. The caller is identified from the session or key, so no user identifier is supplied and no organization scope is required.
         */
        post: operations["exportMyAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Activity history
         * @description Returns a cursor-paginated list of ActivityEvent derived from the organization-scoped audit log, with total, how many match (counted up to 10,000; total_capped says when there are more). Every filter, severity and category included, is applied in the query, so every page but the last is full. An unknown severity or category, or a malformed resource_id or ip, is refused with 400. Organization is derived from the JWT principal only — never from URL or body.
         */
        get: operations["listActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity/{id}/related": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Related activity events
         * @description Returns the anchor event plus events correlated with it by request_id and by the same actor within a symmetric time window. The anchor lookup is organization-scoped — an unknown id or a foreign organization's id both return 404. An event never appears in both correlation lists.
         */
        get: operations["listRelatedActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Live activity stream (SSE)
         * @description Opens a Server-Sent Events stream of ActivityEvent frames for the caller's organization: the audit records themselves, every kind (sign-ins and MFA included), each with its own audit id, so a live event can be opened and related like one from the history. The server follows the audit log every two seconds, or at once when the organization acts. Each frame is `id: <cursor>\nevent: activity\ndata: <json>\n\n`; periodic `: keep-alive` comments prevent proxy timeouts.
         *
         *     When `Last-Event-ID` is supplied (the `id` of the last frame received, an opaque cursor, not the event's UUID) the server replays every audit event newer than it, in chronological order, before switching to the live stream. One connection replays at most 1,000 audit rows: further behind, it sends the cursor of the last row read and a `retry:` frame and ends, and the client's reconnect carries on from there. A frame may carry only an `id` (no event): the cursor of rows the filters passed over, kept as the client's Last-Event-ID. A live frame's id sits ten seconds before its event, to cover records whose transaction committed late; the stream sends each record once, and a reconnect may repeat one, recognisable by its id. Delivery is at least once: a reconnect may repeat an event but doesn't skip one, and a client too slow for the live stream is sent a `retry:` frame and disconnected, to catch up from the audit log on reconnect.
         *
         *     The stream lasts only as long as the access it was opened with. It ends when the access token or API key expires, and within 30 seconds of the reader losing access: their session ended, audit.read no longer theirs (or no longer the key's), the API key revoked, the service principal or agent disabled. It also ends if that check can't be made. A new request is then refused as any other would be.
         *
         *     Server-side filters (`?types`, `?severity`, `?category`) are applied to both the replay and the live stream. The connection organization is derived from the JWT principal only — never from the URL or body.
         *
         *     The write deadline is extended to 1 hour. Set `X-Accel-Buffering: no` is already set by the server (Nginx/Caddy proxy buffering disabled).
         */
        get: operations["streamActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/activity/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Activity summary
         * @description Aggregate counts over the same filters as the history endpoint (types, actor, subject, from/to, q, resource_type, resource_id, ip, category, severity and min_severity), so category and severity together total the events of both; by_severity and by_category then show the spread within what the filters match. Without an explicit `from` the window defaults to the last 24h; it is capped at 366 days, with buckets of up to a week. Organization is derived from the JWT principal only.
         */
        get: operations["getActivitySummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audit/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Verify platform audit chain (public)
         * @description Verifies the platform-level audit hash chains (the rows with no organization, spread over 16 chains so their writers don't queue on one) and returns only whether they are all intact and how many rows were checked. Each chain must have a row, and every platform row must be on one of them. Unauthenticated by design so any external party can independently confirm the platform has not tampered with its audit log; per-organization verification is at /v1/organizations/{organizationID}/audit/verify and requires auth.
         */
        get: operations["verifyPlatformAuditChain"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List plans
         * @description Lists the plans on sale, with their prices.
         */
        get: operations["listPlans"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/razorpay/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify a Razorpay payment-link callback
         * @description Completes a checkout from a Razorpay payment-link redirect using the signed callback parameters posted by the browser. Authenticity is established by the Razorpay signature rather than a session, so the endpoint requires no authentication and is CSRF-exempt. Completion is idempotent, so a later asynchronous webhook for the same payment is a harmless no-op.
         */
        post: operations["verifyRazorpayPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/sandbox/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Render the development-only sandbox checkout page
         * @description Renders a mock hosted-checkout page that stands in for a real payment provider flow during local development. Returns 404 when the sandbox provider is not enabled, so it is inert in production. The success and cancel return URLs are validated to prevent an open redirect.
         */
        get: operations["getSandboxCheckout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/sandbox/pay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete a development-only sandbox checkout
         * @description Completes the referenced checkout along the same path a real payment webhook would take, then redirects the browser to the validated success URL. Returns 404 when the sandbox provider is not enabled. Used only in local development to exercise the redirect-then-success flow without a payment account.
         */
        post: operations["completeSandboxCheckout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/webhooks/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Payment webhook
         * @description Receives provider payment events. Authenticated by the provider's webhook signature (no user session); on a verified successful payment the referenced checkout is completed idempotently. A Stripe event is accepted when any v1 signature in its Stripe-Signature header is right (Stripe sends one per secret while a webhook secret rotates) and its timestamp is within five minutes of now.
         */
        post: operations["receivePaymentWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/gdpr/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request a GDPR data export
         * @description Queues an async export job; poll GET .../gdpr/export/{id} for status and payload. Nobody exports someone who outranks them (403 rbac.target_is_owner for an owner, unless the caller is one, or 403 rbac.target_outranks_caller), as for deleting their account.
         */
        post: operations["createExportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/gdpr/purge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create purge request
         * @description Requests erasure of a person's account, carried out after the grace period unless cancelled. The erasure ends their sessions, redacts the account (email, phone, name, avatar, external ID and metadata) and deletes everything else it left: credentials and second factors, sign-in history, sessions and remembered devices, linked social and single sign-on accounts, application consents and grants, connected accounts and their tokens, personal API keys, role, group and break-glass memberships, application assignments and the persistent identifiers applications know them by, directory profiles, notifications, sign-in links and failed sign-in counters, and the payloads of the person's data exports; verifiable credentials issued to them are revoked and their claims cleared. The audit trail and the request itself are kept; the request goes on naming the account by user_id after the account is deleted for good. Requires gdpr.write. Held to the rule for deleting the account: nobody erases someone who outranks them (403 rbac.target_is_owner for an owner, unless the caller is one, or 403 rbac.target_outranks_caller).
         */
        post: operations["createPurgeRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/gdpr/purge/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Cancel purge request
         * @description Cancels a scheduled erasure that has not run yet. Requires gdpr.write.
         */
        delete: operations["cancelPurgeRequest"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List notifications
         * @description Returns the authenticated user's most recent notifications together with the current unread count. Results are scoped to the calling user, and no organization is required. Pair with the mark-all-read operation to clear the unread state.
         */
        get: operations["listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications/mark-all-read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark all read
         * @description Clears the unread state on all of the authenticated user's notifications in a single call. The notifications themselves are retained; only their read status changes. A subsequent list reports an unread count of zero.
         */
        post: operations["markAllNotificationsRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/activity/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One activity event
         * @description One of the organization's activity events by its id (an audit.events row id), with its metadata, actor name and email, address and browser, as in the history. 404 for an unknown id or another organization's. Needs audit.read.
         */
        get: operations["getActivityEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/analytics/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Organization analytics overview
         * @description Returns the organization's dashboard figures: sign-ins, failures, active users and their trends. Sign-ins and active users are counted from the sign-in log, which outlives the sessions: a person who switched to the organization, created it or accepted an invitation to it is active in it, but only a sign-in that proved a factor counts as one. Requires analytics.read.
         */
        get: operations["getAnalyticsOverview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List audit events
         * @description Returns the organization's audit events in reverse chronological order with cursor-based pagination and optional filters for action, resource type, actor, and a free-text query. The audit log is append-only and hash-chained, so results reflect an immutable record of activity. Events are kept for the plan's audit_retention_days (7, 30, 90 days, or for good), then deleted. Pass the returned cursor to page through history; access is restricted to the organization named in the path.
         */
        get: operations["listAuditEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/anomalies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List audit anomalies
         * @description Flagged deviations from a behavioral baseline built per (organization, actor) over audit.events — a first-time action type, an unusual hour, or a new IP. Scored by a background sweep, not synchronously on write.
         */
        get: operations["listAuditAnomalies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/anomalies/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve an audit anomaly
         * @description Marks the identified anomaly as resolved and records the acting administrator, removing it from the open queue. Returns 404 when no matching open anomaly exists for the organization. This is a review action only and does not alter the underlying audit events that triggered detection.
         */
        post: operations["resolveAuditAnomaly"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/anomalies/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Audit anomaly summary
         * @description Returns aggregate counts of detected anomalies for the organization, including currently open anomalies, those resolved in the last seven days, and the number scored as high severity. Anomalies come from scoring the append-only audit log against a per-actor behavioral baseline. Intended to drive an at-a-glance security dashboard.
         */
        get: operations["getAuditAnomalySummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/anomaly-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get anomaly-detection settings
         * @description Returns the organization's anomaly-detection configuration, including whether scoring is enabled, the score threshold above which an event is flagged, and the minimum number of baseline events required before scoring begins. Platform defaults are reported when the organization has not customized the settings.
         */
        get: operations["getAuditAnomalySettings"];
        /**
         * Update anomaly-detection settings
         * @description Replaces the organization's anomaly-detection configuration. The score threshold must be between 0 and 1 and the minimum baseline count must be non-negative, otherwise the request is rejected as unprocessable. Changes take effect on the next background scoring pass, and the stored settings are returned.
         */
        put: operations["setAuditAnomalySettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/verification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The audit chain's last verification
         * @description How the scheduled audit-chain verification (every six hours, going on from where it left each chain, with a full walk at least weekly) last left the organization's chain, read rather than walked: whether it has reached it yet, when it last verified it and up to which event, whether a break was found and when, and when the latest run finished and its scope. GET /v1/organizations/{organizationID}/audit/verify still walks the whole chain on request. Needs audit.read.
         */
        get: operations["getAuditVerification"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/audit/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Verify audit chain
         * @description Walks the organization's hash chain from the seed and recomputes each row's hash, returning the first broken link (if any). No side effects. Once events older than the plan keeps them (audit_retention_days) have been deleted, the walk starts from the last one deleted, whose hash the first one kept links to.
         */
        get: operations["verifyAuditChain"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start checkout
         * @description Returns a hosted-payment URL to redirect the admin to, or {status:"active"} when the plan is free or no card provider serves the request (direct activation). The provider is chosen by billing country (config-driven; an omitted country falls back to currency-based routing: INR → Razorpay, else the default provider). The provider's webhook later activates the subscription. When invoice tax is configured, it is worked out from the billing profile (or, when the profile names no country, from country) before the payment opens, and the provider charges the total, tax included; the paid invoice shows that charge. A plan activated directly by invoice-only billing gets an open invoice; a free plan a paid zero one. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key.
         */
        post: operations["startCheckout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List invoices
         * @description Lists the organization's invoices, newest first. Each keeps the billing profile it was issued to (billed_to) and the supplier's GSTIN and SAC, and is emailed to that profile's billing email when issued. Requires billing.read.
         */
        get: operations["listInvoices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/invoices/{invoiceID}/pay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pay an open invoice
         * @description Returns a hosted-payment URL for an open invoice, such as a renewal, charging its total. The provider is chosen by the billing profile's country, else the invoice's currency; with none, it answers 422 and the invoice is paid by bank transfer, quoting its number. When the payment completes, the invoice is paid (billing.invoice_paid) and a renewal starts the period it billed. A paid or void invoice answers 409 billing.invoice_not_open. Send an Idempotency-Key header to retry it safely, as for checkout.
         */
        post: operations["payInvoice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/payment-method": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the payment method
         * @description Returns what the organization's most recent completed checkout was paid with, as its provider reported it, or null. No card is kept with the provider: each checkout collects its own, so there is nothing to manage between payments. Razorpay reports a card's network and last four digits but not its expiry. Requires billing.read.
         */
        get: operations["getPaymentMethod"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get organization billing profile
         * @description Returns the organization's billing profile, such as the legal entity, address, and tax identifiers used on invoices. Scoped to the organization named in the path. Populate or amend it with the corresponding update operation before generating tax-compliant invoices.
         */
        get: operations["getBillingProfile"];
        /**
         * Update organization billing profile
         * @description Creates or replaces the organization's billing profile and returns the stored result. Scoped to the organization named in the path. These details feed invoice generation, so keep them accurate for the organization's jurisdiction.
         */
        put: operations["setBillingProfile"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/subscription": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get subscription
         * @description Returns the organization's subscription. A trial grants its plan until trial_end, and a plan marked to cancel until current_period_end. Any other plan renews at current_period_end: a free one starts its next period, and a paid one is billed with an open renewal invoice and turns past_due, keeping its plan for the payment grace (7 days unless configured) while that invoice is paid, through POST /v1/organizations/{organizationID}/billing/invoices/{invoiceID}/pay or by bank transfer. Paid, it is active for the new period; still unpaid after the grace, or ended by a trial or a cancellation, it is canceled, with ended_at, and the organization is on the free plan. Each change is audited as billing.subscription_renewed, billing.subscription_past_due or billing.subscription_ended. Requires billing.read.
         */
        get: operations["getSubscription"];
        /**
         * Subscribe / change plan
         * @description Puts the organization on plan_code, priced in currency; no payment is taken here. A free plan starts a new period with a zero invoice. A paid plan that costs no more than the organization's active subscription in the same currency and billing interval takes over the period already paid for, while it lasts, with no new invoice; the current plan itself changes nothing. Any other paid plan, such as one that costs more, must go through checkout (POST /v1/organizations/{organizationID}/billing/checkout) and is refused with 402 billing.checkout_required, unless invoice-only billing (BILLING_ALLOW_UNPAID_ACTIVATION) is on and no card provider serves the currency, which activates it with an open invoice.
         */
        put: operations["setSubscription"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/subscription/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel at period end
         * @description Cancels the subscription at the end of the current period; it stays active until then. Requires billing.write.
         */
        post: operations["cancelSubscription"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/billing/trial": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start an organization plan trial
         * @description Starts a time-limited trial of the requested plan for the organization and returns the resulting subscription. Scoped to the organization named in the path. When the trial expires the subscription follows the normal billing lifecycle unless a paid plan is selected first.
         */
        post: operations["startTrial"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/{framework}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List compliance evidence runs
         * @description Returns previous evidence runs for the framework, most recent first. Controls are omitted; call GET .../compliance/evidence/{id} for the full report.
         */
        get: operations["listComplianceEvidence"];
        put?: never;
        /**
         * Generate compliance evidence
         * @description Runs all controls for the framework against live organization state (MFA policy, audit log, RBAC, retention, SIEM config, secrets vault, etc.), persists an immutable evidence run, and returns the full per-control report. framework must be 'soc2' or 'iso27001'.
         */
        post: operations["generateComplianceEvidence"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/audits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List external audits
         * @description The external audits and certificates recorded for the organization, latest first, up to 1,000 (truncated when there are more), of one framework when asked. Requires audit.read.
         */
        get: operations["listExternalAudits"];
        put?: never;
        /**
         * Record an external audit or certificate
         * @description Records an audit an external body carried out, or a certificate it issued: framework, kind (audit or certificate), body, scope, reference, issued_on and optional expires_on (YYYY-MM-DD, not before issued_on). Invalid fields are refused with 422 naming each. Audited as compliance.audit_recorded. Requires audit.write.
         */
        post: operations["recordExternalAudit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/audits/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete an external audit
         * @description Removes a recorded external audit or certificate of the organization. Audited as compliance.audit_deleted. Requires audit.write.
         */
        delete: operations["deleteExternalAudit"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/controls/{controlID}/owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set a control's owner
         * @description Makes one of the organization's people (its own, or holding a role there) answer for a control of either framework's catalog; another organization's person is refused with 422, an unknown control with 404. Audited as compliance.control_owner_set. Requires audit.write.
         */
        put: operations["setControlOwner"];
        post?: never;
        /**
         * Remove a control's owner
         * @description Leaves the control without an owner; 404 when it has none. Audited as compliance.control_owner_removed. Requires audit.write.
         */
        delete: operations["removeControlOwner"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/controls/owners": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List control owners
         * @description The person each of the organization's compliance controls is owned by, for the controls that have one; evidence runs name the owner on each control too. Requires audit.read.
         */
        get: operations["listControlOwners"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/compliance/evidence/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get compliance evidence run (full report)
         * @description Returns the full evidence run including per-control results. Carries a Content-Disposition header so browsers treat it as a downloadable JSON evidence report. organization-scoped; 404 when the run belongs to a different organization.
         */
        get: operations["getComplianceEvidence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/critical-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List critical events
         * @description The short list an on-call administrator triages, from a phone or the console: the organization's open anomaly alerts and its critical audit events (suspensions, lockouts, the AI agent kill switch, second factors reset or turned off, roles given, sign-in risk settings changed) of the last hours, newest first, at most 100 (truncated when there are more), with how many of those are high. Read only; the full trail is the audit log. Needs audit.read.
         */
        get: operations["listCriticalEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List templates
         * @description Lists the organization-scoped catalogue and overrides. Capabilities indicate rich-text/localization support and whether a mail transport is configured for test delivery. delivery_scope distinguishes organization invitations/magic links from platform-account security email.
         */
        get: operations["listEmailTemplates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email-templates/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get template
         * @description Returns an email template as the organization sends it: its own version, or the default. Requires branding.write.
         */
        get: operations["getEmailTemplate"];
        /**
         * Override template
         * @description Saves the template and options atomically with its audit event. Organization invitations and magic links use saved overrides; platform-account recovery, verification and MFA remain platform-managed.
         */
        put: operations["setEmailTemplate"];
        post?: never;
        /**
         * Reset to default
         * @description Deletes the organization's version of an email template, so the default is sent again. Requires branding.write.
         */
        delete: operations["resetEmailTemplate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email-templates/{key}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview template
         * @description Renders subject, text and sanitized branded HTML without persisting or sending email. Each expanded content field is limited to 200000 UTF-8 bytes before the branded wrapper is added.
         */
        post: operations["previewEmailTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email-templates/{key}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send the current draft to the operator's verified email
         * @description Requires branding.write, a user principal with a verified active account, and a configured mail transport. The destination is resolved server-side, never accepted from input. Sends inert sample links and codes; limited to one request per organization/user per minute on each server instance. Records an audit event before attempting delivery. An accepted response means the provider accepted the message, not that it reached the inbox.
         */
        post: operations["sendTestEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Email delivery to an address
         * @description Lists the organization's most recent emails to one address with what happened to each (sent, delivered, bounced, complained, suppressed or failed, with the provider's reason), and whether the address is suppressed. Addresses are stored hashed, so the lookup is by exact address. A suppression caused by this organization's mail (own true) carries its id, reason, provider detail and date, since only that organization may clear it; one caused by other mail carries only own false. Records are kept 90 days.
         */
        get: operations["listEmailMessages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email/suppressions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Suppressed addresses
         * @description Lists the addresses no mail goes to because this organization's mail to them hard-bounced or was reported as spam, newest first, each with a masked address. A suppression holds platform-wide: no organization's mail reaches the address until it is cleared.
         */
        get: operations["listEmailSuppressions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/email/suppressions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Clear a suppression
         * @description Lifts a suppression this organization's mail caused, so mail can reach the address again; audited as email.suppression_cleared. Check the address first: mailing a dead address again harms delivery for every organization. A suppression another organization's mail caused is not found here.
         */
        delete: operations["deleteEmailSuppression"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/entitlements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get plan entitlements
         * @description Returns the organization's resolved entitlements: the effective plan code, the boolean feature flags, and the numeric limits (-1 = unlimited). Resolved from the active subscription (falling back to the organization's plan label), so an in-app upgrade is reflected immediately. A subscription grants its plan only until current_period_end (a trial until trial_end): nothing renews it, so after that the organization has the free plan's entitlements until it pays again. Readable by any authenticated member of the organization; scoped to the caller's own organization. audit_retention_days is enforced: once a day, the organization's audit events older than that are deleted (all but the newest, its chain kept verifiable) and the deletion is recorded as audit.events_purged; -1 keeps them all.
         */
        get: operations["getEntitlements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/entitlements/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get organization resource usage against plan limits
         * @description Returns the organization's current consumption for each metered resource, such as seats, applications, and API keys, for display against the plan's limits. seats counts the people holding a role in the organization, directly or through a group that carries one, each once, plus its pending invitations; an account holding no role, such as a customer signing in to the organization's applications, holds no seat. mau counts the people active in the organization so far this calendar month (UTC): each person who signed in to it, or renewed a session in it, at least once, counted once. API keys, service principals and AI agents are not counted. It complements the entitlements endpoint, which resolves the plan's capability set, by running the underlying count queries only when the usage view needs them. Scoped to the organization named in the path.
         */
        get: operations["getEntitlementUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/gdpr/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List GDPR export requests
         * @description Lists the organization's data-export requests and their state. Requires gdpr.write.
         */
        get: operations["listExportRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/gdpr/export/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a GDPR export request (payload once ready)
         * @description Returns status plus the full data payload once status is "ready"; response carries a Content-Disposition download header in that case. The payload is deleted seven days after it was built, or when the person is erased, and the status becomes "expired". Reading an export is held to the rule for asking for one: an export of someone who outranks the caller answers 403 (rbac.target_is_owner or rbac.target_outranks_caller).
         */
        get: operations["getExportRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/gdpr/purge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List purge requests
         * @description Lists the organization's erasure requests and their state. Requires gdpr.write.
         */
        get: operations["listPurgeRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/log-sinks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List log sinks
         * @description Returns the organization's configured log sinks, each describing an external destination that receives forwarded audit events, along with its enabled state, last-forwarded timestamp, and last delivery error. Destination credentials such as tokens are never returned. Use this to review which SIEM integrations are active for the organization.
         */
        get: operations["listLogSinks"];
        put?: never;
        /**
         * Create log sink
         * @description Registers a destination that forwards the organization's audit events to an external SIEM (Splunk HEC, Datadog, or a generic HTTP endpoint). The endpoint must be valid and the sink type recognized, otherwise the request is rejected as unprocessable. Any supplied token is encrypted at rest; forwarding starts from creation time with no backfill of historical events, and delivery is at-least-once. Each event carries its actor, resource, address, user agent, request id and metadata. One instance at a time forwards a sink, in batches until it catches up; a sink that refuses or can't be reached waits longer after each failure (10 seconds, doubling, up to an hour) and shows last_error until a batch is delivered.
         */
        post: operations["createLogSink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/log-sinks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete sink
         * @description Permanently removes the identified log sink and stops any further forwarding to its destination. Returns 404 when the sink does not exist for the organization. Stored credentials for the destination are discarded; already-delivered events are unaffected.
         */
        delete: operations["deleteLogSink"];
        options?: never;
        head?: never;
        /**
         * Enable/disable sink
         * @description Toggles whether the identified log sink actively forwards events, without deleting its configuration or resetting its position. Returns 404 when the sink does not exist for the organization. Re-enabling resumes forwarding from where the sink last left off.
         */
        patch: operations["updateLogSink"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/log-sinks/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test event to a log stream
         * @description Sends one test audit event (action siem.test, metadata.test true; no organization data) to one of the organization's saved destinations and reports how it answered. It changes nothing on the destination: its cursor, last_error and back-off are untouched. Audited as siem.sink_tested. Needs audit.write and a recent step-up.
         */
        post: operations["testLogSink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/log-sinks/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test event to an unsaved log stream
         * @description Sends one test audit event (action siem.test, metadata.test true; no organization data) to the destination in the body, which takes the fields and checks of creating one and isn't saved, and reports how it answered. Audited as siem.sink_tested. Needs audit.write and a recent step-up, as creating one does.
         */
        post: operations["testUnsavedLogSink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/qeetai/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Qeet AI settings
         * @description How long the organization keeps its Qeet AI conversations, and the last change. Requires secret.read.
         */
        get: operations["getQeetAiSettings"];
        /**
         * Set Qeet AI settings
         * @description Sets how many days (1 to 3,650) an untouched conversation is kept, or null to keep them. Every day a job deletes the conversations untouched for longer, with their messages, and audits each organization's deletion as qeetai.conversations_purged. The change is audited as qeetai.settings_updated. Requires secret.write.
         */
        put: operations["setQeetAiSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/qeetai/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Qeet AI usage
         * @description What the organization's Qeet AI used: this UTC month's messages (turns answered) and tokens as its provider reported them, the last use, and the twelve most recent months. Requires secret.read, as the provider configuration does.
         */
        get: operations["getQeetAiUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/rate-limits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get rate limits
         * @description Returns the effective per-bucket limits (organization, user, api_key) — the platform defaults merged with any organization-specific overrides.
         */
        get: operations["getRateLimits"];
        /**
         * Set rate limits
         * @description Stores per-organization overrides for the request rate limits applied to the organization, its users, and its API keys, replacing any previous override. Values are validated before being persisted. Overrides take precedence over the platform defaults; remove them with the reset operation to fall back to those defaults.
         */
        put: operations["setRateLimits"];
        post?: never;
        /**
         * Reset rate limits
         * @description Removes the organization's rate-limit overrides so the platform default limits apply again. Succeeds even when no override is currently set. The change is written to the audit log and propagated to the limiter.
         */
        delete: operations["resetRateLimits"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/retention": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get retention policy
         * @description Returns the organization's data-retention policy. Requires policy.read.
         */
        get: operations["getRetentionPolicy"];
        /**
         * Update retention policy
         * @description Replaces the organization's data-retention policy. Requires policy.write.
         */
        put: operations["setRetentionPolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/retention/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview ripe users
         * @description Reports how many deleted users the retention policy would purge now, without purging them. Requires policy.read.
         */
        post: operations["previewRetention"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/retention/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Run purge now
         * @description Purges the deleted users the retention policy has made ripe, now rather than at the next scheduled run, one at a time: a user whose deletion fails is skipped, left for the next run, and not counted in purged. Requires policy.write.
         */
        post: operations["runRetention"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/service-health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Service health
         * @description The state of each part of the service the organization uses, from its own recent figures, and the incidents operators posted that are open or were resolved in the last 14 days. A component is operational, degraded, outage, maintenance or not_configured (a part the organization doesn't use); an open incident makes it no better than the incident's impact (reason incident). api is an outage while the database is unreachable (api.database_unreachable); sign_in while tokens can't be signed (sign_in.keys_unavailable); email is degraded when the provider refused at least a quarter of the organization's emails of the last hour (email.failing); webhooks while a subscription's deliveries are failing or one was disabled for failing (webhooks.failing); directory while a directory operation of the last day failed and is still open (directory.failing). status is the worst state of the components. Requires organization.read.
         */
        get: operations["getServiceHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/qeetai/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List conversations
         * @description Returns all qeetai conversations for the authenticated user within their organization, ordered by pinned-first then most-recently-updated.
         */
        get: operations["listConversations"];
        put?: never;
        /**
         * Create conversation
         * @description Creates a new qeetai conversation thread for the authenticated user.
         */
        post: operations["createConversation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/qeetai/conversations/{conversationID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get conversation with messages
         * @description Returns a single conversation and its full message history in chronological order.
         */
        get: operations["getConversation"];
        put?: never;
        post?: never;
        /**
         * Delete conversation
         * @description Deletes a conversation and all its messages.
         */
        delete: operations["deleteConversation"];
        options?: never;
        head?: never;
        /**
         * Update conversation
         * @description Rename or pin/unpin a conversation.
         */
        patch: operations["updateConversation"];
        trace?: never;
    };
    "/v1/qeetai/conversations/{conversationID}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a message / continue with tool results (SSE stream)
         * @description Opens a streaming turn of the AI qeetai conversation. The response is a `text/event-stream` of SSE frames (thinking, token, tool_call, tool_result, error, done). Each frame is `event: <type>\ndata: <json>\n\n`.
         *
         *     On `stop_reason=tool_use` the stream ends with `done{reason:"tool_use"}`; the browser executes the tool under its own bearer token and posts `tool_results` to this same endpoint to continue generation. Only the tools the model is offered (read-only in this version) are sent as `tool_call` frames: a call to any other tool is dropped, recorded as `qeetai.tool.refused` and noted in the reply's text.
         *
         *     Requires `QEETAI_PROVIDER` configured server-side; returns `409 qeetai_unconfigured` otherwise.
         *
         *     A conversation answers one turn at a time: a message while its previous turn is still running, on any instance, is refused with `409 qeetai.turn_in_progress` (retryable) and not stored. A turn sends the model only the conversation's latest 40 messages, within 256 KiB, from a message of the user's, so earlier ones are left out; a turn whose own messages are larger ends with an `error` frame of code `history_too_long` (start a new conversation). A reply longer than 64 KiB is cut there and kept, as at the model's own token limit. A turn runs for at most 10 minutes.
         */
        post: operations["sendConversationMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/qeetai/provider-config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get masked organization AI provider configuration
         * @description Returns the organization's bring-your-own-key AI provider configuration with any secret values masked. Absence of a configuration means the deployment's platform fallback, or none, is in effect. Scoped to the caller's organization and restricted to organization administrators.
         */
        get: operations["getAiProviderConfig"];
        /**
         * Store organization AI provider configuration
         * @description Stores the organization's own AI provider credentials so the assistant runs against the organization's key rather than the platform fallback, which unlocks it regardless of plan. Secrets are encrypted at rest and are never returned in full by the read endpoint. Restricted to organization administrators; validate the credentials with the test operation before saving.
         */
        put: operations["setAiProviderConfig"];
        post?: never;
        /**
         * Delete organization AI provider configuration
         * @description Removes the organization's bring-your-own-key AI provider configuration, reverting to the deployment's platform fallback where one is available. Restricted to organization administrators. Once removed, assistant availability again depends on the organization's plan.
         */
        delete: operations["deleteAiProviderConfig"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/qeetai/provider-config/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test organization AI provider credentials
         * @description Validates candidate AI provider credentials with a live call and reports whether they work, without persisting them. Use this before saving a new key to confirm the provider accepts it. A failed test answers 400 naming the reason: qeetai_provider_unreachable, qeetai_provider_key_invalid, qeetai_provider_model_invalid or qeetai_provider_error.
         */
        post: operations["testAiProviderConfig"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/qeetai/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Qeet AI configuration status
         * @description Returns whether the AI qeetai is configured server-side and which provider/model is active. Never returns key material. Used by the console to render the unconfigured setup state.
         */
        get: operations["getQeetAiStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sales/leads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a contact-sales lead
         * @description Records a contact-sales lead for follow-up and, on a best-effort basis, notifies the configured sales inbox; a delivery failure does not fail the request because the lead is already persisted. Available to any authenticated user, including during onboarding before an organization exists, with organization and user recorded when known. Returns 202 to acknowledge the lead was accepted for processing.
         */
        post: operations["submitSalesLead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Universal search
         * @description Organization-scoped, RBAC-enforced fuzzy search that fans out across user, organization, group, role, oidc_client, and audit_event resource types. Each type is gated behind its read permission (user.read, organization.read, group.read, role.read, connection.read, audit.read); types the caller cannot read are silently excluded. Matching uses ILIKE '%q%' (parameterised). Results are scored and returned in descending relevance order. Pagination is cursor-based and opaque.
         */
        get: operations["search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/signup/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start paid-plan checkout before organization creation
         * @description Begins a hosted payment for a plan chosen during signup, before any organization exists. The organization is created only once payment completes, so an abandoned checkout never leaves a dangling organization. Scoped to the authenticated user; the organization name and slug are required and the return URLs must be valid absolute URLs. Returns the details needed to redirect the browser to the payment provider. When invoice tax is configured, the provider charges the total tax included, taxed by the billing country given, and the new organization's paid invoice shows that charge.
         */
        post: operations["startSignUpCheckout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/ses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * SES delivery events
         * @description Receives Amazon SES delivery, bounce, complaint and reject events through Amazon SNS. Each message's SNS signature (SignatureVersion 2, SHA256withRSA; version 1 is refused) is verified against a signing certificate served by sns.<region>.amazonaws.com, a message older than an hour is refused, and only the topics in SES_EVENTS_TOPIC_ARN are accepted (anyone can create an SNS topic); with none configured the endpoint answers 404. A subscription confirmation is completed by visiting its SubscribeURL. A hard bounce or a complaint suppresses the address; a soft bounce is only recorded.
         */
        post: operations["receiveSesEvents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Version
         * @description Answers what is running on this instance: the release version, the commit it was built from and its build date, and the database migration the instance runs on next to the newest migration the build carries. Requires no authentication and reads nothing at request time (the migration is the one found at start). Operators compare it with the deploy record after a deploy or rollback.
         */
        get: operations["getVersion"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description The principal that caused an activity event. */
        ActivityActor: {
            /**
             * Format: uuid
             * @description Actor user UUID (absent for system/agent actors).
             */
            id?: string;
            /** @description Display name when resolvable; omitted otherwise. */
            name?: string;
            /** @description Actor type (e.g. "user", "system", "agent"). */
            type: string;
        };
        /** @description Unified representation of a domain event, derived from either the live NATS outbox stream or the durable audit log. Category and severity are computed from the event type and are never stored in the DB. */
        ActivityEvent: {
            actor?: components["schemas"]["ActivityActor"];
            /**
             * Format: date-time
             * @description Event timestamp (UTC, RFC3339).
             */
            at: string;
            /** @description Browser label parsed from user-agent (optional). */
            browser?: string;
            /**
             * @description Coarse operational category derived from the event type prefix.
             * @enum {string}
             */
            category: "authentication" | "authorization" | "security" | "directory" | "developer" | "system";
            /** @description The city of location, when the proxy names one. */
            city?: string;
            /** @description The ISO 3166-1 alpha-2 country of location. */
            country?: string;
            /** @description Optional extended description. */
            description?: string;
            /**
             * @description The device type the user agent names; omitted when it names none.
             * @enum {string}
             */
            device?: "desktop" | "mobile" | "tablet";
            /**
             * Format: uuid
             * @description For audit-log events this is the stable audit.events row UUID. For live NATS events a fresh UUID is generated per delivery. Reconnect with the stream frame's `id`, not this.
             */
            id: string;
            /** @description Requester IP address (dot-decimal or IPv6). */
            ip?: string;
            /** @description Where the request came from, approximately ("Pune, IN", or the country alone), from what the trusted proxy reported (GEO_COUNTRY_HEADER, GEO_CITY_HEADER), kept in the event's metadata.geo. Omitted when unknown; there is no GeoIP lookup. */
            location?: string;
            /** @description Domain-specific supplementary fields (non-normative). An event about a role, group or ABAC policy carries target_name, its name when the event was recorded, and role_name or group_name beside a role_id or group_id, so one deleted since can still be named. People are named by id only (the audit chain can't be changed, so a name in it would outlive the person's erasure); look the id up for their current name. rebac.tuple_deleted carries the removed tuple's object, relation and subject. */
            metadata?: {
                [key: string]: unknown;
            };
            /** @description The operating system the user agent names (Windows, macOS, iOS, iPadOS, Android, ChromeOS, Linux). */
            os?: string;
            /** @description Correlation ID of the originating request (optional). Shared by all audit events emitted while handling one request; drives the related-events correlation and is copyable in the console. */
            request_id?: string;
            /**
             * @description Derived from the words of the event type. critical — security incident (token reuse, threat detection); error — a failure, lock or refusal (auth.sign_in_failed, auth.account_locked); warning — a destructive or sensitive change (delete, revoke, rotate, reset); success — positive transition (create, enable, sign-in); info — everything else.
             * @enum {string}
             */
            severity: "info" | "success" | "warning" | "error" | "critical";
            /** @description Event source identifier (e.g. service name). */
            source?: string;
            /** @description Application-level status carried in the event (optional). */
            status?: string;
            target?: components["schemas"]["ActivityTarget"];
            /**
             * @description Human-readable title derived from the event type.
             * @example User Created
             */
            title: string;
            /**
             * @description Audit action string (e.g. "user.created", "auth.sign_in_failed"). Dot-namespaced; first segment is the resource type.
             * @example user.created
             */
            type: string;
        };
        ActivityPoint: {
            date: string;
            ldap: number;
            magic_link: number;
            oidc: number;
            passkey: number;
            password: number;
            saml: number;
            social: number;
        };
        /** @description The anchor event plus events correlated with it. by_request_id shares the anchor's request_id; by_actor is the same actor within a symmetric time window. An event never appears in both lists. */
        ActivityRelatedResponse: {
            event: components["schemas"]["ActivityEvent"];
            related: {
                by_actor: components["schemas"]["ActivityEvent"][];
                by_request_id: components["schemas"]["ActivityEvent"][];
            };
        };
        /** @description Paginated activity history response. */
        ActivityResponse: {
            events: components["schemas"]["ActivityEvent"][];
            /** @description Opaque cursor for the next page: the time and ID of the last event returned. Present when more results exist; omitted on the last page. */
            next_cursor?: string;
            /** @description How many events match, up to 10,000. */
            total?: number;
            /** @description More than 10,000 events match. */
            total_capped?: boolean;
        };
        /** @description Aggregate counts over the same filters as the history endpoint. All bucket maps are zero-filled so the console renders a stable legend. */
        ActivitySummaryResponse: {
            /** @description Distinct actors of each kind. API keys, agents and service principals are told apart by the metadata.actor_id their events record, from this release on. */
            actors?: {
                /** Format: int64 */
                agents?: number;
                /** Format: int64 */
                api_keys?: number;
                /** Format: int64 */
                people?: number;
                /** Format: int64 */
                services?: number;
            };
            /**
             * Format: int64
             * @description Width of each series bucket in seconds.
             */
            bucket_seconds: number;
            /** @description Event counts keyed by derived category (all 6 keys present). */
            by_category: {
                [key: string]: number;
            };
            /** @description Event counts keyed by outcome: success, warning, failed, info. */
            by_outcome: {
                [key: string]: number;
            };
            /** @description Event counts keyed by derived severity (all 5 keys present). */
            by_severity: {
                [key: string]: number;
            };
            /**
             * Format: int64
             * @description Count of critical-severity events (threat.* and incidents).
             */
            security_alerts: number;
            /** @description Time-bucketed counts for sparklines (empty buckets omitted). Each bucket carries the total plus per-outcome/severity breakdowns so the console can draw a distinct sparkline per metric card. */
            series: {
                /**
                 * Format: date-time
                 * @description Bucket start (UTC, RFC3339).
                 */
                at: string;
                /**
                 * Format: int64
                 * @description Total events in the bucket.
                 */
                count: number;
                /** Format: int64 */
                critical: number;
                /** Format: int64 */
                failed: number;
                /** Format: int64 */
                info: number;
                /** Format: int64 */
                success: number;
                /** Format: int64 */
                warning: number;
            }[];
            /**
             * Format: int64
             * @description Total events in the window.
             */
            total: number;
            /**
             * Format: int64
             * @description Distinct people who acted in the window (actors.people).
             */
            unique_actors: number;
            /** @description Resolved aggregation window (defaulted/clamped server-side). */
            window: {
                /** Format: date-time */
                from: string;
                /** Format: date-time */
                to: string;
            };
        };
        /** @description The resource the event acted upon. */
        ActivityTarget: {
            /**
             * Format: uuid
             * @description Resource UUID (omitted for un-keyed resources).
             */
            id?: string;
            /** @description Human-readable resource label when available. */
            label?: string;
            /** @description Resource type (e.g. "user", "group", "organization"). */
            type: string;
        };
        AuditAnomaly: {
            action?: string;
            actor_email?: string | null;
            /** Format: uuid */
            actor_user_id?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            event_at?: string;
            /** Format: uuid */
            event_id?: string;
            /** Format: uuid */
            id?: string;
            ip?: string | null;
            /** Format: uuid */
            organization_id?: string;
            reasons?: ("new_action_type" | "unusual_hour" | "new_ip")[];
            /** Format: date-time */
            resolved_at?: string | null;
            /** Format: uuid */
            resolved_by?: string | null;
            resource_type?: string;
            /** @description 0..1 weighted-novelty anomaly score. */
            score?: number;
            /** @enum {string} */
            status?: "open" | "resolved";
        };
        AuditAnomalySettings: {
            enabled?: boolean;
            /** @description Cold-start guard — an actor needs this many historical events before anything is flagged for them. */
            min_baseline_events?: number;
            /** Format: uuid */
            organization_id?: string;
            /** @description 0..1; an event scoring at or above this is flagged. */
            score_threshold?: number;
        };
        AuditVerifyResult: {
            /** Format: uuid */
            broken_at_id?: string;
            /** @description Why the chain is broken at broken_at_id, in English. Show reason_code's meaning instead. */
            broken_reason?: string;
            /** Format: uuid */
            last_verified_id?: string;
            ok: boolean;
            /**
             * @description Set when the chain is broken: the row's link to the one before it is wrong, or its contents no longer match its hash; the row the chain's last verification checkpoint names is gone; or a checkpoint the chain relies on (its last verification's, or where it starts after a purge) doesn't carry the server's signature, as when the chain and its checkpoint were rewritten together.
             * @enum {string}
             */
            reason_code?: "audit.chain_prev_hash_mismatch" | "audit.chain_row_hash_mismatch" | "audit.chain_checkpoint_gone" | "audit.chain_checkpoint_unsigned";
            rows_checked: number;
        };
        BillingProfile: {
            address_line1: string;
            address_line2: string;
            billing_email: string;
            city: string;
            country: string;
            legal_name: string;
            postal_code: string;
            state: string;
            tax_id: string;
            tax_id_type: string;
        };
        CheckoutResult: {
            checkout_url?: string;
            provider?: string;
            status: string;
        };
        /** @description The person the organization has made answer for a control, as it is now. */
        ControlOwner: {
            control_id?: string;
            display_name?: string | null;
            email?: string | null;
            /** Format: date-time */
            updated_at?: string;
            /** Format: uuid */
            user_id?: string;
        };
        CriticalEvent: {
            action: string;
            actor_email?: string;
            /** Format: uuid */
            actor_user_id?: string;
            /**
             * Format: uuid
             * @description The audit event's or the anomaly alert's id.
             */
            id: string;
            ip?: string;
            /** @enum {string} */
            level: "high" | "medium";
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            occurred_at: string;
            /** @description For an anomaly, why it stood out. */
            reasons?: string[];
            /** Format: uuid */
            resource_id?: string;
            resource_type?: string;
            /** @description For an anomaly, how unusual it was, 0 to 1. */
            score?: number;
            /** @enum {string} */
            source: "audit" | "anomaly";
        };
        /** @description Subject and preheader limits count Unicode characters. Text and HTML limits count UTF-8 bytes. Action URL variables must remain in both text and HTML when provided. Variables in URLs are allowed only as standalone action-link href values, never in image sources or within external URLs. An action URL variable (reset_url, magic_url, invite_url) appears in the HTML only as a whole href and in the text only on a line of its own, never in the subject, the preheader or among other words (400 otherwise), so a template's wording can't disguise the one-time link. */
        EmailEditorInput: {
            body: string;
            options?: components["schemas"]["EmailTemplateOptions"];
            subject: string;
        };
        /** @description Subject and preheader limits count Unicode characters. Text and HTML limits count UTF-8 bytes. Action URL variables must remain in both text and HTML when provided. Variables in URLs are allowed only as standalone action-link href values, never in image sources or within external URLs. */
        EmailLocalizedContent: {
            body: string;
            body_html?: string;
            preheader?: string;
            subject: string;
        };
        EmailMessage: {
            /** Format: uuid */
            id?: string;
            /** @description The provider's reason for a bounce, complaint or failure (for example Permanent/General: 550 no such user). */
            reason?: string;
            /** Format: date-time */
            sent_at?: string;
            /** @enum {string} */
            status?: "sent" | "delivered" | "bounced" | "complained" | "suppressed" | "failed";
            /** @description The template the message was sent from (invite, magic_link …). */
            template?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        EmailResolvedTemplate: components["schemas"]["EmailEditorInput"] & {
            custom?: boolean;
            /** @enum {string} */
            delivery_scope?: "organization" | "platform";
            description?: string;
            key?: string;
            name?: string;
            variables?: string[];
        };
        EmailSuppression: {
            /** @description The address masked (first character and domain). */
            address?: string;
            /** Format: date-time */
            created_at?: string;
            detail?: string;
            /** Format: uuid */
            id?: string;
            /** @enum {string} */
            reason?: "bounce" | "complaint";
        };
        EmailTemplateOptions: {
            /**
             * @default center
             * @enum {string}
             */
            alignment: "left" | "center";
            body_html?: string;
            /** @default en */
            default_locale: string;
            preheader?: string;
            /** @default true */
            show_logo: boolean;
            /** @description Non-English BCP-47 language variants; English remains the base content. */
            translations?: {
                [key: string]: components["schemas"]["EmailLocalizedContent"];
            };
        };
        /** @description Canonical error envelope (internal/platform/httpx.WriteError). */
        Error: {
            error: {
                /**
                 * @description Stable machine code
                 * @example unauthorized
                 */
                code: string;
                /** @description Optional human detail */
                detail?: string;
                /** @description Per-field validation errors (typically on 422 responses). */
                fields?: {
                    code?: string;
                    field?: string;
                    message?: string;
                }[];
                /** @example authentication required */
                message: string;
                /** @description Optional structured, error-specific context. */
                metadata?: {
                    [key: string]: unknown;
                };
                /** @description Correlates with the X-Request-Id header */
                request_id?: string;
                /** @description Whether the person can try again, often by starting over (signing in again, asking for a new code, waiting). It is not a promise that resending the same request will succeed: auth.session_revoked is retryable and the session never comes back. Decide whether to resend a request from its status (429, 503 with Retry-After). */
                retryable?: boolean;
                /** @description Optional i18n key the client can use to localize the message. */
                translation_key?: string;
            };
        };
        /** @description Outcome of a single compliance control check against live system state. */
        EvidenceControlResult: {
            category?: string;
            /** @description Framework reference code (e.g. CC6.1, or A.8.5 in ISO/IEC 27001:2022 Annex A). */
            criteria?: string;
            /** @description An ISO control's ISO/IEC 27001:2013 Annex A reference (e.g. A.9.4), for audits still on that revision; absent for SOC 2. */
            criteria_2013?: string;
            /** @description Human-readable explanation of what was found, in English; always populated. */
            detail?: string;
            /** @description What was found as a code, such as password_length.too_short, for a console to word itself with params. */
            detail_code?: string;
            /**
             * Format: date-time
             * @description On a failing control, when it started failing, carried from run to run while it keeps failing.
             */
            failing_since?: string;
            /** @description Unique control identifier within the framework (e.g. CC6.1-MFA). */
            id?: string;
            name?: string;
            owner?: components["schemas"]["ControlOwner"];
            /** @description The values the finding is about, such as {min_length, required}. */
            params?: {
                [key: string]: unknown;
            };
            /** @description On a failing control, what would make it pass, as a code, such as raise_password_min_length. */
            remedy?: string;
            /**
             * @description pass — condition positively confirmed; fail — condition not met; na — data not determinable (never a fabricated pass).
             * @enum {string}
             */
            status?: "pass" | "fail" | "na";
        };
        /** @description Immutable snapshot of one compliance evidence generation pass for a organization+framework pair. Controls are populated on GetRun; omitted on ListRuns. */
        EvidenceRun: {
            /** @description Per-control results; present on GetRun, omitted on ListRuns. */
            controls?: components["schemas"]["EvidenceControlResult"][];
            fail_count?: number;
            /** @enum {string} */
            framework?: "soc2" | "iso27001";
            /** Format: date-time */
            generated_at?: string;
            /**
             * Format: uuid
             * @description Actor user ID; null when generated by a system or API-key actor.
             */
            generated_by?: string | null;
            /** Format: uuid */
            id?: string;
            na_count?: number;
            /** Format: uuid */
            organization_id?: string;
            pass_count?: number;
        };
        ExportInput: {
            /**
             * Format: uuid
             * @description Accepted and ignored; the export is always in the caller's organization.
             */
            organization_id?: string | null;
            /** Format: uuid */
            user_id: string;
        };
        ExportRequest: {
            /** Format: date-time */
            completed_at: string | null;
            /** Format: date-time */
            created_at: string;
            error?: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            organization_id: string;
            /** @description The person's data in the organization, while status is ready: profile (with metadata), sessions, passkeys, roles, mfa_totp_enabled, identities (linked social and single sign-on accounts), otp_factors (destinations masked), app_consents, app_grants, groups, sign_ins (the latest 1000) and generated_at. */
            payload?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            requested_by: string | null;
            /** @description pending, ready, failed, or expired once the payload has been deleted (seven days after it was built, or when the person was erased or their account deleted). */
            status: string;
            /**
             * Format: uuid
             * @description The account exported; kept after the account itself is deleted.
             */
            user_id: string;
        };
        /** @description An audit an external body carried out on the organization, or a certificate it issued. */
        ExternalAudit: {
            /** @description The auditor or certification body. */
            body?: string;
            /** Format: date-time */
            created_at?: string;
            /** Format: uuid */
            created_by?: string | null;
            /** Format: date */
            expires_on?: string | null;
            /** @enum {string} */
            framework?: "soc2" | "iso27001";
            /** Format: uuid */
            id?: string;
            /** Format: date */
            issued_on?: string;
            /** @enum {string} */
            kind?: "audit" | "certificate";
            reference?: string;
            scope?: string;
        };
        GdprCreateInput: {
            /** Format: uuid */
            organization_id: string;
            reason: string;
            /** Format: uuid */
            user_id: string;
        };
        HourlyPoint: {
            attempts: number;
            hour: string;
        };
        Invoice: {
            /** @description The total charged, taxable_amount_minor plus tax_amount_minor; for a checkout, what the payment provider charged. */
            amount_minor: number;
            /** @description The billing profile as it stood when the invoice was issued; null on invoices issued before it was kept. */
            billed_to?: components["schemas"]["BillingProfile"] | null;
            currency: string;
            /**
             * Format: date-time
             * @description When an open invoice falls due; null once it is paid or when nothing was owed.
             */
            due_at?: string | null;
            /**
             * Format: date-time
             * @description When the invoice was emailed to its billing email.
             */
            emailed_at?: string | null;
            /** Format: uuid */
            id: string;
            /** @description The GST invoice number, one series per Indian financial year (April to March), such as 2026-27/000042. Null on an invoice that charges nothing. */
            invoice_number: string | null;
            /** Format: date-time */
            issued_at: string;
            /**
             * @description purchase for a plan bought or changed; renewal for the next period of a plan, billed when its period ends.
             * @enum {string}
             */
            kind?: "purchase" | "renewal";
            /** Format: date-time */
            paid_at?: string | null;
            /** Format: date-time */
            period_end: string;
            /** Format: date-time */
            period_start: string;
            place_of_supply: string;
            plan_code: string;
            /** @description The services accounting code of what was sold; empty when the operator has set none. */
            sac?: string;
            /**
             * @description paid when a payment was captured or nothing is owed; open until it is paid, due at due_at, for a plan granted before payment (invoice-only billing) or a renewal; void for a renewal no longer owed, because the subscription ended or a new plan was bought.
             * @enum {string}
             */
            status: "paid" | "open" | "void";
            /** @description The seller's GSTIN; empty when the operator has set none. */
            supplier_gstin?: string;
            tax_amount_minor: number;
            tax_rate_bps: number;
            tax_type: string;
            taxable_amount_minor: number;
        };
        MethodCount: {
            method: string;
            users: number;
        };
        MethodSlice: {
            method: string;
            value: number;
        };
        Metric: {
            delta_pct: number;
            value: number;
        };
        /** @description Present when there is another page: send it back as cursor to read that page. Absent on the last page. */
        NextCursor: string;
        Notification: {
            /** Format: date-time */
            created_at: string;
            description?: string;
            href?: string;
            /** Format: uuid */
            id: string;
            kind: string;
            /** Format: date-time */
            read_at?: string;
            title: string;
        };
        /** @description Per-bucket rate limits for an organization. On GET these are the effective values (defaults merged with overrides); on PUT, any bucket supplied is upserted as an override. The answer also carries the defaults, the ceiling an override may reach (the defaults themselves: an organization may tighten its limits, never lift them), the lowest rate an override may set, and the built-in limits every organization shares; those are read-only and ignored on PUT. */
        OrganizationRateLimits: {
            api_key?: components["schemas"]["RateLimitBucket"];
            /** @description The platform's fixed limits, the same for every organization. */
            readonly built_in?: {
                /** @description What the limit covers. */
                applies: string;
                /** @description The burst. */
                capacity: number;
                name: string;
                /**
                 * @description Whose requests share a bucket.
                 * @enum {string}
                 */
                per: "ip" | "user" | "address";
                /** @description Requests a second. */
                rate: number;
            }[];
            readonly ceiling?: components["schemas"]["RateLimitBuckets"];
            readonly defaults?: components["schemas"]["RateLimitBuckets"];
            /** @description The lowest rate, in requests a second, an override may set. */
            readonly min_rate?: number;
            organization?: components["schemas"]["RateLimitBucket"];
            user?: components["schemas"]["RateLimitBucket"];
        };
        /** @description The fixed-window KPIs and trends; with from, to or days, also range, the sign-ins day by day over that range. */
        Overview: {
            failed_logins_hourly_24h: components["schemas"]["HourlyPoint"][];
            failed_trend_14d: components["schemas"]["TrendPoint"][];
            /** Format: date-time */
            generated_at: string;
            kpis: {
                avg_sessions_per_user: components["schemas"]["Metric"];
                dau: components["schemas"]["Metric"];
                failed_logins_24h: components["schemas"]["Metric"];
                logins_today: components["schemas"]["Metric"];
                mau: components["schemas"]["Metric"];
                mfa_adoption_pct: components["schemas"]["Metric"];
                stickiness_pct: components["schemas"]["Metric"];
                total_users: components["schemas"]["Metric"];
            };
            login_activity_14d: components["schemas"]["ActivityPoint"][];
            login_methods_mix: components["schemas"]["MethodSlice"][];
            login_trend_14d: components["schemas"]["TrendPoint"][];
            mfa_methods_adoption: components["schemas"]["MethodCount"][];
            mfa_trend_14d: components["schemas"]["TrendPoint"][];
            /** @description The sign-ins day by day (UTC) over the chosen range, without organization switches; present when from, to or days was given. */
            range?: {
                days?: {
                    /** @example 2026-10-29 */
                    date?: string;
                    failed?: number;
                    people?: number;
                    sign_ins?: number;
                }[];
                /** Format: date-time */
                from?: string;
                method?: string;
                /** Format: date-time */
                to?: string;
            };
            user_trend_14d: components["schemas"]["TrendPoint"][];
            weekly_activity_8w: components["schemas"]["WeeklyActivityPoint"][];
        };
        PaymentMethod: {
            /** @description The card network, bank or wallet. */
            brand?: string;
            exp_month?: number;
            exp_year?: number;
            /** Format: date-time */
            last_used_at: string;
            last4?: string;
            /** @description stripe, razorpay or sandbox. */
            provider: string;
            /** @description card, upi, netbanking, wallet, or the provider's own word. */
            type: string;
        };
        Plan: {
            code: string;
            description: string;
            features: string[];
            /** Format: uuid */
            id: string;
            interval: string;
            name: string;
            prices: {
                [key: string]: number;
            };
        };
        /** @description A named qeetai conversation thread (organization + user scoped). */
        QeetAIConversation: {
            /** Format: date-time */
            created_at?: string;
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            organization_id?: string;
            pinned?: boolean;
            title?: string;
            /** Format: date-time */
            updated_at?: string;
            /** Format: uuid */
            user_id?: string;
        };
        /** @description One turn in a qeetai conversation. `content` is an array of Anthropic content blocks (text / tool_use / tool_result) stored verbatim. */
        QeetAIMessage: {
            /** @description Anthropic content-block array. */
            content?: {
                [key: string]: unknown;
            }[];
            /** Format: uuid */
            conversation_id?: string;
            /** Format: date-time */
            created_at?: string;
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            organization_id?: string;
            /** @enum {string} */
            role?: "user" | "assistant" | "tool";
        };
        /** @description AI qeetai configuration state. Never contains key material. */
        QeetAIStatus: {
            /** @description True when QEETAI_PROVIDER and QEETAI_API_KEY are set. */
            configured?: boolean;
            /** @description Model identifier (e.g. "claude-sonnet-5"); empty when not configured. */
            model?: string;
            /** @description Provider name (e.g. "anthropic"); empty when not configured. */
            provider?: string;
        };
        /** @description A single token-bucket limit (rate tokens/sec, burst capacity). */
        RateLimitBucket: {
            /** @description Maximum burst capacity. */
            capacity?: number;
            /** @description Sustained tokens per second. */
            rate?: number;
        };
        RateLimitBuckets: {
            api_key: components["schemas"]["RateLimitBucket"];
            organization: components["schemas"]["RateLimitBucket"];
            user: components["schemas"]["RateLimitBucket"];
        };
        Request: {
            /** Format: date-time */
            completed_at: string | null;
            /** Format: date-time */
            created_at: string;
            /** @description How many days a request waits before the erasure runs. */
            grace_period_days?: number;
            /** Format: date-time */
            grace_until: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            organization_id: string;
            reason: string | null;
            /** Format: uuid */
            requested_by: string | null;
            status: string;
            /** @description The person's email as the request was filed; null once they are erased. */
            subject_email?: string | null;
            /** @description Their display name as the request was filed; null once they are erased. */
            subject_name?: string | null;
            /** @description The erasure ran, so who it was filed for is no longer kept. */
            subject_redacted?: boolean;
            /**
             * Format: uuid
             * @description The account to erase; kept after the account itself is deleted.
             */
            user_id: string;
        };
        RetentionPolicy: {
            deleted_users_days: number;
            deleted_users_enabled: boolean;
            /**
             * Format: date-time
             * @description When the policy was last changed; absent until it is set.
             */
            updated_at?: string;
            /**
             * Format: uuid
             * @description Who last changed it.
             */
            updated_by?: string;
            updated_by_email?: string;
        };
        Row: {
            action: string;
            actor_type: string;
            /** Format: uuid */
            actor_user_id: string | null;
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            ip: string | null;
            /** @description What the event recorded beside its fields; geo is where the request came from. */
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            organization_id: string | null;
            request_id: string | null;
            /** Format: uuid */
            resource_id: string | null;
            resource_type: string;
            user_agent: string | null;
        };
        /** @description Paginated search result envelope. */
        SearchResponse: {
            /** @description Opaque cursor for the next page. Present only when more results exist; omitted (not null) when this is the last page. */
            next_cursor?: string;
            results: components["schemas"]["SearchResult"][];
        };
        /** @description One item returned by the universal search endpoint. */
        SearchResult: {
            /** Format: uuid */
            id: string;
            /** @description Type-specific supplementary fields (non-normative). */
            metadata: {
                [key: string]: unknown;
            };
            /**
             * Format: float
             * @description Relevance score in [0.5, 1.0]: 1.0 = exact match, 0.75 = prefix match, 0.5 = substring match. Results are sorted desc by score.
             */
            score: number;
            /** @description Resource lifecycle status (e.g. "active", "suspended", "recorded"). */
            status: string;
            /** @description Secondary label (e.g. email or slug). */
            subtitle: string;
            /** @description Human-readable primary label (e.g. display name or resource name). */
            title: string;
            /**
             * @description Resource type.
             * @enum {string}
             */
            type: "user" | "organization" | "group" | "role" | "oidc_client" | "audit_event";
            /**
             * Format: date-time
             * @description Last-updated timestamp (uses created_at for immutable resources).
             */
            updated_at: string;
            /** @description Console deep-link for this resource. */
            url: string;
        };
        Sink: {
            /** Format: date-time */
            created_at: string;
            enabled: boolean;
            endpoint: string;
            /** Format: uuid */
            id: string;
            last_error?: string;
            /** Format: date-time */
            last_forwarded_at?: string;
            type: string;
        };
        Subscription: {
            amount_minor: number;
            cancel_at_period_end: boolean;
            currency: string;
            /** Format: date-time */
            current_period_end: string | null;
            /** Format: date-time */
            current_period_start: string | null;
            /**
             * Format: date-time
             * @description When a canceled subscription ended.
             */
            ended_at?: string | null;
            interval: string;
            plan_code: string;
            plan_name: string;
            /** @enum {string} */
            status: "none" | "trialing" | "active" | "past_due" | "canceled";
            /** Format: date-time */
            trial_end: string | null;
        };
        Summary: {
            high_score_open: number;
            open: number;
            resolved_7d: number;
        };
        TrendPoint: {
            date: string;
            value: number;
        };
        /** @description Present, and true, when the list was cut at its limit (1,000 items unless the operation says otherwise): there are more than were answered. */
        Truncated: boolean;
        WeeklyActivityPoint: {
            dau: number;
            wau: number;
            week: string;
        };
    };
    responses: {
        /** @description Malformed request */
        BadRequest: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "bad_request",
                 *         "message": "The request was invalid.",
                 *         "translation_key": "bad_request",
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Authenticated but not permitted. auth.application_token: the access token was issued to an application (it carries client_id) and this route accepts only the user's own tokens; applications may call GET /v1/oauth/userinfo. auth.insufficient_scope: an application's token reached a route open to applications without the scope the route needs (named in the WWW-Authenticate challenge). */
        Forbidden: {
            headers: {
                /** @description With auth.insufficient_scope: `Bearer realm="qeet", error="insufficient_scope", scope="<the scope the route needs>"`. */
                "WWW-Authenticate"?: string;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "forbidden",
                 *         "message": "You don't have permission to do that.",
                 *         "translation_key": "forbidden",
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Resource not found */
        NotFound: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "not_found",
                 *         "message": "We couldn't find what you're looking for.",
                 *         "translation_key": "not_found",
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The server is too busy to check or set a password or code now, so the request was refused and changed nothing (`server.overloaded`, retryable). Try again after the seconds Retry-After gives, also sent as `metadata.retry_after`. */
        Overloaded: {
            headers: {
                /** @description Seconds to wait before trying again (1 to 3). */
                "Retry-After"?: number;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "server.overloaded",
                 *         "message": "The service is busy. Please try again in a moment.",
                 *         "translation_key": "server.overloaded",
                 *         "retryable": true,
                 *         "metadata": {
                 *           "retry_after": 2
                 *         },
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The body is larger than this API accepts (`request_body_too_large`). */
        PayloadTooLarge: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The change needs payment (`billing.checkout_required`); start a checkout to make it. */
        PaymentRequired: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Rate limit exceeded */
        TooManyRequests: {
            headers: {
                /** @description Seconds to wait before trying again, sent when a rate limit refused the request; error.metadata.retry_after gives the same number. */
                "Retry-After"?: number;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "too_many_requests",
                 *         "message": "Too many attempts. Please wait and try again.",
                 *         "translation_key": "too_many_requests",
                 *         "retryable": true,
                 *         "metadata": {
                 *           "retry_after": 30
                 *         },
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Missing or invalid credentials */
        Unauthorized: {
            headers: {
                /** @description Sent when a route that needs a bearer token got none (`Bearer realm="qeet"`), or one that is invalid or expired (`Bearer realm="qeet", error="invalid_token"`). */
                "WWW-Authenticate"?: string;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "unauthorized",
                 *         "message": "Please sign in to continue.",
                 *         "translation_key": "unauthorized",
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Validation failed */
        Unprocessable: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "validation_failed",
                 *         "message": "One or more fields are invalid.",
                 *         "translation_key": "validation_failed",
                 *         "fields": [
                 *           {
                 *             "field": "email",
                 *             "code": "invalid_email",
                 *             "message": "Must be a valid email address."
                 *           }
                 *         ],
                 *         "request_id": "api-1/Kx9fQ2mW7a-000131"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: {
        /** @description Opaque pagination cursor from a prior response's next_cursor. */
        Cursor: string;
        /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
        IdempotencyKey: string;
        /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
        OrganizationID: string;
    };
    requestBodies: never;
    headers: {
        /** @description true when this is the stored answer to an earlier request with the same Idempotency-Key and body, sent again rather than run twice. Absent otherwise. */
        IdempotentReplayed: "true";
        /** @description The request's ID, sent on every response. Quote it when reporting a problem; an error body repeats it as error.request_id. */
        RequestId: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    checkLiveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Alive */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example ok */
                        status?: string;
                    };
                };
            };
        };
    };
    getMetrics: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Prometheus exposition format */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
            /** @description Metrics are not served to this caller: no METRICS_TOKEN is configured outside development, or the request did not send it as `Authorization: Bearer <token>`. The same plain-text answer as an unknown path. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
        };
    };
    checkReadiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ready */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        status?: string;
                    };
                };
            };
            /** @description Not ready (a dependency is down) */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    deleteMyAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description The account password, required when the account has one; a password-less account sends none. */
                    password?: string | null;
                };
            };
        };
        responses: {
            /** @description Account data erased and sessions revoked */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    exportMyAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller's personal data, as a downloadable JSON document. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Applications consented to and the scopes granted. */
                        app_consents: {
                            [key: string]: unknown;
                        }[];
                        /** @description Live application grants. */
                        app_grants: {
                            [key: string]: unknown;
                        }[];
                        /** Format: date-time */
                        generated_at: string;
                        groups: {
                            [key: string]: unknown;
                        }[];
                        /** @description Linked social and single sign-on accounts. */
                        identities: {
                            [key: string]: unknown;
                        }[];
                        mfa_totp_enabled: boolean;
                        /** @description Email and SMS second factors, their destinations masked. */
                        otp_factors: {
                            [key: string]: unknown;
                        }[];
                        passkeys: {
                            [key: string]: unknown;
                        }[];
                        /** @description Email, phone, display name, avatar, metadata, status and verification times. */
                        profile: {
                            [key: string]: unknown;
                        };
                        roles: {
                            [key: string]: unknown;
                        }[];
                        sessions: {
                            [key: string]: unknown;
                        }[];
                        /** @description The latest 1000 sign-ins, made and failed, with address and user agent. */
                        sign_ins: {
                            [key: string]: unknown;
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listActivity: {
        parameters: {
            query?: {
                /** @description Filter by actor user UUID. */
                actor?: string;
                /** @description Comma-separated categories (authentication, authorization, security, directory, developer, system); events of any of them. Derived from the event type prefix. */
                category?: string;
                /** @description Opaque pagination cursor from a previous response next_cursor field. Encodes the time and ID of the last event that page returned. */
                cursor?: string;
                /** @description Inclusive lower bound on event timestamp (RFC3339). */
                from?: string | unknown | unknown;
                /** @description Events from this address. */
                ip?: string | unknown | unknown;
                /** @description Page size, 1 to 200 (default 50). A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                /** @description Events of at least this severity. */
                min_severity?: "info" | "success" | "warning" | "error" | "critical";
                /** @description Finds words of the action, resource type, actor type, user agent, address and metadata, each split into words (auth.login_succeeded is auth, login and succeeded), every plain word as a prefix; or the events of an actor whose name contains it or whose email begins with it. "Quoted phrases", -exclusions and OR are read as websearch_to_tsquery reads them. */
                q?: string;
                /** @description Events about this resource. */
                resource_id?: string;
                /** @description Comma-separated resource types; events about any of them. */
                resource_type?: string;
                /** @description Comma-separated severities (info, success, warning, error, critical); events of any of them. Severity is derived from the event type, not stored. For a minimum, use min_severity. */
                severity?: string;
                /** @description Identity timeline filter. When set, returns every event where the given user UUID is the actor, the target of a 'user' resource event, or the person another resource's event names in metadata.user_id (such as being added to or removed from a group). Omit to return events for all subjects. */
                subject?: string;
                /** @description Inclusive upper bound on event timestamp (RFC3339). */
                to?: string | unknown | unknown;
                /** @description Comma-separated list of exact event types (audit action values, e.g. "user.created,user.deleted"). Omit to return all types. */
                types?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated activity events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityResponse"];
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listRelatedActivity: {
        parameters: {
            query?: {
                /** @description 60 to 3600 (default 300); a larger value is lowered to 3600. */
                window?: number;
            };
            header?: never;
            path: {
                /** @description Anchor event UUID (audit.events row id). */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Anchor event and correlated events */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityRelatedResponse"];
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    streamActivity: {
        parameters: {
            query?: {
                /** @description Exact category to stream; omit for all. */
                category?: "authentication" | "authorization" | "security" | "directory" | "developer" | "system";
                /** @description Minimum severity level to stream. */
                severity?: "info" | "success" | "warning" | "error" | "critical";
                /** @description Comma-separated event type prefixes to match (e.g. "user,auth"). An event matches if its type equals or starts with any listed value. */
                types?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SSE stream of ActivityEvent frames. Event name: "activity". Periodic "`: keep-alive`" comments maintain the connection. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getActivitySummary: {
        parameters: {
            query?: {
                /** @description Filter by actor user UUID. */
                actor?: string;
                /** @description Sparkline bucket width in seconds (60–86400). Omit to auto-size to ~48 buckets across the window. */
                bucket?: number;
                /** @description Comma-separated categories, as for the history. */
                category?: string;
                /** @description Inclusive lower bound (RFC3339); defaults to now-24h. */
                from?: string | unknown | unknown;
                ip?: string | unknown | unknown;
                min_severity?: "info" | "success" | "warning" | "error" | "critical";
                /** @description Search, as for the history. */
                q?: string;
                resource_id?: string;
                resource_type?: string;
                /** @description Comma-separated severities, as for the history. */
                severity?: string;
                /** @description Identity-timeline filter (actor, user-resource target, or the person named in metadata.user_id). */
                subject?: string;
                /** @description Inclusive upper bound (RFC3339); defaults to now. */
                to?: string | unknown | unknown;
                /** @description Comma-separated exact event types (audit action values). */
                types?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Aggregate activity summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivitySummaryResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    verifyPlatformAuditChain: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { chain_valid: bool, rows_checked: int } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        chain_valid: boolean;
                        rows_checked: number;
                    };
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    listPlans: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Plan"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    verifyRazorpayPayment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    razorpay_payment_id: string;
                    razorpay_payment_link_id: string;
                    razorpay_payment_link_reference_id: string;
                    razorpay_payment_link_status: string;
                    razorpay_signature: string;
                };
            };
        };
        responses: {
            /** @description Signed callback accepted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSandboxCheckout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sandbox checkout HTML */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeSandboxCheckout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Redirect to checkout success URL */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            /** @description Form body too large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    receivePaymentWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: "stripe" | "razorpay";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Event acknowledged */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createExportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExportInput"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportRequest"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createPurgeRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["GdprCreateInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Request"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    cancelPurgeRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listNotifications: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Notification inbox */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Notification"][];
                        truncated?: components["schemas"]["Truncated"];
                        unread_count?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    markAllNotificationsRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All notifications marked read */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getActivityEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The event */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActivityEvent"];
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAnalyticsOverview: {
        parameters: {
            query?: {
                /** @description The range as days back from to; 30 by default, at most 366. */
                days?: number;
                /** @description Start of a chosen range (RFC 3339), returned as range. */
                from?: string;
                /** @description Count only sign-ins of this first method (password, passkey, magic_link, social, saml, ...). */
                method?: string;
                /** @description End of the range (RFC 3339); now by default. */
                to?: string;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Overview"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAuditEvents: {
        parameters: {
            query?: {
                /** @description Comma-separated actions; events of any of them. */
                action?: string;
                actor_user_id?: string;
                /** @description The previous page's next_cursor (the id of its last event), for keyset pagination. */
                cursor?: string;
                /** @description Inclusive lower bound (RFC3339). */
                from?: string;
                /** @description Events from this address. */
                ip?: string;
                /** @description Page size, 1 to 200 (default 50). A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                /** @description Finds words of the action, resource type, actor type, user agent, address and metadata, each split into words (auth.login_succeeded is auth, login and succeeded), every plain word as a prefix; or the events of an actor whose name contains it or whose email begins with it. "Quoted phrases", -exclusions and OR are read as websearch_to_tsquery reads them. */
                q?: string;
                resource_id?: string;
                /** @description Comma-separated resource types; events about any of them. */
                resource_type?: string;
                /** @description Inclusive upper bound (RFC3339). */
                to?: string;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { items: AuditEvent[], next_cursor?: string, total, total_capped }; next_cursor is absent on the last page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "id": "018f2a90-1b2c-7d3e-8f40-5a6b7c8d9e01",
                     *           "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *           "action": "user.created",
                     *           "resource_type": "user",
                     *           "resource_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *           "actor_type": "user",
                     *           "actor_user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *           "ip": "203.0.113.10",
                     *           "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)",
                     *           "request_id": "api-1/Kx9fQ2mW7a-000124",
                     *           "created_at": "2026-09-24T10:15:04Z"
                     *         },
                     *         {
                     *           "id": "018f2a90-0a1b-7c2d-8e3f-4a5b6c7d8e00",
                     *           "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *           "action": "organization.created",
                     *           "resource_type": "organization",
                     *           "resource_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *           "actor_type": "user",
                     *           "actor_user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *           "ip": "203.0.113.10",
                     *           "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)",
                     *           "request_id": "api-1/Kx9fQ2mW7a-000123",
                     *           "created_at": "2026-09-24T10:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": "018f2a90-0a1b-7c2d-8e3f-4a5b6c7d8e00",
                     *       "total": 2,
                     *       "total_capped": false
                     *     }
                     */
                    "application/json": {
                        items: components["schemas"]["Row"][];
                        next_cursor?: components["schemas"]["NextCursor"];
                        /** @description How many events match, up to 10,000. */
                        total: number;
                        /** @description More than 10,000 events match. */
                        total_capped: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAuditAnomalies: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 200 (default 50). A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                status?: "open" | "resolved";
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Anomalies */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["AuditAnomaly"][];
                        next_cursor?: components["schemas"]["NextCursor"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resolveAuditAnomaly: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resolved */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAuditAnomalySummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { open: int, resolved_7d: int, high_score_open: int } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Summary"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAuditAnomalySettings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditAnomalySettings"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setAuditAnomalySettings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuditAnomalySettings"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditAnomalySettings"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAuditVerification: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The last verification */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: date-time
                         * @description When a break was found; it stays until resolved.
                         */
                        broken_at: string | null;
                        /** @description No break found; false also while not yet verified. */
                        intact: boolean;
                        /**
                         * Format: date-time
                         * @description When the latest scheduled run finished.
                         */
                        last_run_at: string | null;
                        /** @description all (a full walk) or incremental; empty before any run. */
                        last_run_scope: string;
                        /** Format: date-time */
                        last_verified_at: string | null;
                        /** Format: uuid */
                        last_verified_event_id: string | null;
                        /** @description Whether the scheduled verification has reached the chain. */
                        verified: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    verifyAuditChain: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { ok: bool, rows_checked: int, last_verified_id?: uuid, broken_at_id?: uuid, broken_reason?: string, reason_code?: string } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditVerifyResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startCheckout: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    cancel_url: string;
                    /** @description ISO-3166-1 alpha-2 billing country; selects the payment provider. Omitted → currency-based routing. */
                    country?: string | null;
                    currency: string;
                    plan_code: string;
                    /** Format: uri */
                    success_url: string;
                };
            };
        };
        responses: {
            /** @description Either a checkout URL ({status:"checkout"}) or {status:"active"} */
            200: {
                headers: {
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckoutResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description A request with this Idempotency-Key is still being processed (idempotency.in_progress); retry shortly. Or the first request stopped before answering and may have taken effect (idempotency.outcome_unknown): check, then retry with a new key. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listInvoices: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Invoice"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    payInvoice: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path: {
                invoiceID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    cancel_url: string;
                    /** Format: uri */
                    success_url: string;
                };
            };
        };
        responses: {
            /** @description The hosted checkout ({status:"checkout"}) */
            200: {
                headers: {
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckoutResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The invoice is paid or void (billing.invoice_not_open), or a request with this Idempotency-Key is still being processed. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getPaymentMethod: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        payment_method: components["schemas"]["PaymentMethod"] | null;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getBillingProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Billing profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BillingProfile"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setBillingProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BillingProfile"];
            };
        };
        responses: {
            /** @description Updated billing profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BillingProfile"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSubscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Subscription"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setSubscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    currency: string;
                    plan_code: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Subscription"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            402: components["responses"]["PaymentRequired"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    cancelSubscription: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        cancel_at_period_end: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startTrial: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description ISO 4217 code of a currency the plan is priced in, such as INR; USD when omitted or not a valid code. */
                    currency?: string | null;
                    /** @description The plan to try, starter or pro (or their _year plans); any other plan is refused with billing.trial_not_eligible. */
                    plan_code: string;
                };
            };
        };
        responses: {
            /** @description Trial subscription */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Subscription"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listComplianceEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                framework: "soc2" | "iso27001";
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of evidence runs (controls omitted). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["EvidenceRun"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    generateComplianceEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                framework: "soc2" | "iso27001";
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Evidence run generated; body contains the full control-by-control report. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvidenceRun"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listExternalAudits: {
        parameters: {
            query?: {
                framework?: "soc2" | "iso27001";
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Audits */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["ExternalAudit"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    recordExternalAudit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                    /** Format: date */
                    expires_on?: string | null;
                    /** @enum {string} */
                    framework: "soc2" | "iso27001";
                    /** Format: date */
                    issued_on: string;
                    /** @enum {string} */
                    kind: "audit" | "certificate";
                    reference?: string | null;
                    scope?: string | null;
                };
            };
        };
        responses: {
            /** @description Recorded */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExternalAudit"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteExternalAudit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setControlOwner: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                controlID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description Owner set */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    removeControlOwner: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                controlID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owner removed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listControlOwners: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Owners */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["ControlOwner"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getComplianceEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Full evidence run with per-control results. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvidenceRun"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listCriticalEvents: {
        parameters: {
            query?: {
                /** @description How far back, 1 to 168 hours (24 by default). */
                hours?: number;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        events: components["schemas"]["CriticalEvent"][];
                        high: number;
                        hours: number;
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listEmailTemplates: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        capabilities?: {
                            localization?: boolean;
                            rich_text?: boolean;
                            test_email?: boolean;
                        };
                        items?: components["schemas"]["EmailResolvedTemplate"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getEmailTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailResolvedTemplate"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setEmailTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description Subject, plain-text alternative, and optional rich HTML, preheader, design and language variants. HTML is sanitized. Only catalogue variables are accepted. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailEditorInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailResolvedTemplate"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resetEmailTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Built-in default after removing the override and its options */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailResolvedTemplate"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    previewEmailTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description Omit draft to preview saved content; include it to preview unsaved edits. */
        requestBody?: {
            content: {
                "application/json": {
                    draft?: components["schemas"]["EmailEditorInput"];
                    locale?: string | null;
                    /** @description Each value is limited to 4096 UTF-8 bytes. */
                    vars?: {
                        [key: string]: string;
                    } | null;
                };
            };
        };
        responses: {
            /** @description Rendered preview */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        body?: string;
                        html?: string;
                        locale?: string;
                        subject?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    sendTestEmail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                key: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    draft: components["schemas"]["EmailEditorInput"];
                    locale?: string | null;
                };
            };
        };
        responses: {
            /** @description Mail transport accepted the test */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "accepted";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listEmailMessages: {
        parameters: {
            query: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 100 (default 50). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
                to: string;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The messages, newest first, and the address's suppression (null when none) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["EmailMessage"][];
                        next_cursor?: components["schemas"]["NextCursor"];
                        suppression?: {
                            /** Format: date-time */
                            created_at?: string;
                            detail?: string;
                            /** Format: uuid */
                            id?: string;
                            /** @description This organization's mail caused the suppression; the other fields are present only then. */
                            own?: boolean;
                            /** @enum {string} */
                            reason?: "bounce" | "complaint";
                        } | null;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listEmailSuppressions: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 100 (default 50). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The suppressions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["EmailSuppression"][];
                        next_cursor?: components["schemas"]["NextCursor"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteEmailSuppression: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cleared */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getEntitlements: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Boolean feature flags keyed by feature name.
                         * @example {
                         *       "passkeys": true,
                         *       "password": true,
                         *       "magic_links": true,
                         *       "social": true,
                         *       "totp": true,
                         *       "email_otp": true,
                         *       "hosted_login": true,
                         *       "sms_mfa": false,
                         *       "custom_branding": false,
                         *       "custom_domain": false,
                         *       "sso": false,
                         *       "scim": false,
                         *       "ldap": false,
                         *       "webhooks": false,
                         *       "audit_export": false,
                         *       "ai_qeetai": false,
                         *       "abac": false
                         *     }
                         */
                        features: {
                            [key: string]: boolean;
                        };
                        /**
                         * @description Numeric resource caps keyed by resource name; -1 means unlimited.
                         * @example {
                         *       "seats": 5,
                         *       "apps": 3,
                         *       "api_keys": 2,
                         *       "custom_roles": 0,
                         *       "webhooks": 0,
                         *       "orgs": 1,
                         *       "mau": 10000,
                         *       "audit_retention_days": 7
                         *     }
                         */
                        limits: {
                            [key: string]: number;
                        };
                        /**
                         * @description Effective plan tier (annual "_year" variants folded to the base tier).
                         * @enum {string}
                         */
                        plan: "free" | "starter" | "pro" | "enterprise";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getEntitlementUsage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resource usage by limit key */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        usage: {
                            [key: string]: number;
                        };
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listExportRequests: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["ExportRequest"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getExportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExportRequest"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listPurgeRequests: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Request"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listLogSinks: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Configured sinks (tokens are write-only, not returned) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Sink"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createLogSink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    endpoint: string;
                    token?: string | null;
                    /** @enum {string} */
                    type: "splunk_hec" | "datadog" | "http";
                };
            };
        };
        responses: {
            /** @description Sink created (streams new audit events from now) */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sink"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteLogSink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    updateLogSink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    enabled?: boolean | null;
                };
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    testLogSink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description How the destination answered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Whether the destination accepted the event (a 2xx answer). */
                        delivered: boolean;
                        duration_ms: number;
                        /** @description Why it wasn't delivered. */
                        error?: string;
                        /** @description The destination's HTTP status; absent when it gave no answer. */
                        status?: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    testUnsavedLogSink: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    endpoint: string;
                    token?: string | null;
                    /** @enum {string} */
                    type: "splunk_hec" | "datadog" | "http";
                };
            };
        };
        responses: {
            /** @description How the destination answered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Whether the destination accepted the event (a 2xx answer). */
                        delivered: boolean;
                        duration_ms: number;
                        /** @description Why it wasn't delivered. */
                        error?: string;
                        /** @description The destination's HTTP status; absent when it gave no answer. */
                        status?: number;
                    };
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getQeetAiSettings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Days an untouched conversation is kept, with its messages; null keeps them. */
                        conversation_retention_days?: number | null;
                        /** Format: date-time */
                        updated_at?: string;
                        /** Format: uuid */
                        updated_by?: string;
                        updated_by_email?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setQeetAiSettings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    conversation_retention_days?: number | null;
                };
            };
        };
        responses: {
            /** @description The settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Days an untouched conversation is kept, with its messages; null keeps them. */
                        conversation_retention_days?: number | null;
                        /** Format: date-time */
                        updated_at?: string;
                        /** Format: uuid */
                        updated_by?: string;
                        updated_by_email?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getQeetAiUsage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Usage */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        last_used_at?: string | null;
                        months?: {
                            /** Format: int64 */
                            input_tokens?: number;
                            /** Format: date-time */
                            last_used_at?: string;
                            messages?: number;
                            /** @example 2026-10 */
                            month?: string;
                            /** Format: int64 */
                            output_tokens?: number;
                        }[];
                        this_month?: {
                            /** Format: int64 */
                            input_tokens?: number;
                            /** Format: date-time */
                            last_used_at?: string;
                            messages?: number;
                            /** @example 2026-10 */
                            month?: string;
                            /** Format: int64 */
                            output_tokens?: number;
                        };
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getRateLimits: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Effective limits */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationRateLimits"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setRateLimits: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrganizationRateLimits"];
            };
        };
        responses: {
            /** @description Updated effective limits */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationRateLimits"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resetRateLimits: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Overrides cleared */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getRetentionPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetentionPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setRetentionPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["RetentionPolicy"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetentionPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    previewRetention: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        deleted_users_days: number;
                        ripe_deleted_users: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    runRetention: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        purged: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getServiceHealth: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        checked_at: string;
                        components: {
                            /** @description The counts its state was judged by: email sent_last_hour and failed_last_hour; webhooks active, failing and disabled_failing; directory ldap_connections, scim_tokens and open_failures. */
                            figures?: {
                                [key: string]: number;
                            };
                            /** @enum {string} */
                            name: "api" | "sign_in" | "email" | "webhooks" | "directory";
                            /** @description Why it isn't operational. */
                            reason?: string;
                            /** @enum {string} */
                            state: "operational" | "maintenance" | "degraded" | "outage" | "not_configured";
                        }[];
                        incidents: {
                            /** @enum {string} */
                            component: "api" | "sign_in" | "email" | "webhooks" | "directory";
                            detail?: string;
                            /** Format: uuid */
                            id: string;
                            /** @enum {string} */
                            impact: "maintenance" | "degraded" | "outage";
                            /** Format: date-time */
                            resolved_at: string | null;
                            /** Format: date-time */
                            started_at: string;
                            title: string;
                        }[];
                        /** @enum {string} */
                        status: "operational" | "maintenance" | "degraded" | "outage";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listConversations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conversation list */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["QeetAIConversation"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createConversation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Optional title; defaults to "New conversation". */
                    title?: string | null;
                };
            };
        };
        responses: {
            /** @description Created conversation */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QeetAIConversation"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            402: components["responses"]["PaymentRequired"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conversation with messages */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        conversation?: components["schemas"]["QeetAIConversation"];
                        messages?: components["schemas"]["QeetAIMessage"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    updateConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationID: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    pinned?: boolean | null;
                    title?: string | null;
                };
            };
        };
        responses: {
            /** @description Updated conversation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QeetAIConversation"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    sendConversationMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversationID: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Console context for grounding (current route, selection). Treated as untrusted; never used for authorization. */
                    context?: {
                        [key: string]: unknown;
                    } | null;
                    /** @description User text input for this turn (mutually exclusive with tool_results). */
                    message?: string | null;
                    /** @description Tool execution results from the previous turn (continuation after client-side tool execution). Mutually exclusive with message. */
                    tool_results?: {
                        error?: {
                            code?: string;
                            message?: string;
                        };
                        name?: string;
                        output?: {
                            [key: string]: unknown;
                        };
                        tool_call_id?: string;
                    }[] | null;
                };
            };
        };
        responses: {
            /** @description SSE stream of StreamEvent frames. Event types: thinking, token, tool_call, tool_result, error, done. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            402: components["responses"]["PaymentRequired"];
            404: components["responses"]["NotFound"];
            /** @description Qeet AI not configured (QEETAI_PROVIDER/QEETAI_API_KEY unset, `qeetai_unconfigured`), or the conversation's previous turn is still running (`qeetai.turn_in_progress`, retryable) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAiProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The organization's effective provider configuration, its key masked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The organization's own endpoint; empty for the Qeet-managed provider, whose endpoint is not shown. */
                        base_url: string;
                        /** @description The key's last four characters. */
                        last4: string;
                        max_tokens: number;
                        model: string;
                        /** @description Whether the deployment has a key to fall back on. */
                        platform_fallback: boolean;
                        provider: string;
                        /**
                         * @description Whose key answers: the organization's own, the deployment's, or none.
                         * @enum {string}
                         */
                        source: "organization" | "platform" | "none";
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setAiProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    api_key: string;
                    /** @description Required for azure; must be an allowed outbound destination. */
                    base_url?: string | null;
                    /**
                     * Format: int64
                     * @description Defaults to 4096 for 0 or less; a larger value than 200000 is lowered to it.
                     */
                    max_tokens?: number | null;
                    model: string;
                    /** @enum {string} */
                    provider: "anthropic" | "openai" | "azure";
                };
            };
        };
        responses: {
            /** @description The organization's effective provider configuration, its key masked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The organization's own endpoint; empty for the Qeet-managed provider, whose endpoint is not shown. */
                        base_url: string;
                        /** @description The key's last four characters. */
                        last4: string;
                        max_tokens: number;
                        model: string;
                        /** @description Whether the deployment has a key to fall back on. */
                        platform_fallback: boolean;
                        provider: string;
                        /**
                         * @description Whose key answers: the organization's own, the deployment's, or none.
                         * @enum {string}
                         */
                        source: "organization" | "platform" | "none";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteAiProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Provider configuration deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    testAiProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    api_key: string;
                    /** @description Required for azure; must be an allowed outbound destination. */
                    base_url?: string | null;
                    /**
                     * Format: int64
                     * @description Defaults to 4096 for 0 or less; a larger value than 200000 is lowered to it.
                     */
                    max_tokens?: number | null;
                    model: string;
                    /** @enum {string} */
                    provider: "anthropic" | "openai" | "azure";
                };
            };
        };
        responses: {
            /** @description The provider accepted the credentials. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getQeetAiStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Qeet AI status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QeetAIStatus"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    submitSalesLead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    company?: string | null;
                    /** @description The work email the sales team replies to. */
                    email: string;
                    message?: string | null;
                    name?: string | null;
                    source?: string | null;
                    team_size?: string | null;
                };
            };
        };
        responses: {
            /** @description Lead accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    search: {
        parameters: {
            query: {
                /** @description Opaque pagination cursor from a previous response's next_cursor field. */
                cursor?: string;
                /** @description Page size, 1 to 50 (default 20). A larger value is lowered to 50; a smaller or malformed one gets the default. */
                limit?: number;
                /** @description Search query (1+ characters after trimming). */
                q: string;
                /** @description Comma-separated list of resource types to search. Allowed values: user, organization, group, role, oidc_client, audit_event. Omit to search all permitted types. */
                types?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Search results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResponse"];
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startSignUpCheckout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: uri
                     * @description An absolute http or https URL, where the browser returns if the payment is abandoned.
                     */
                    cancel_url: string;
                    /** @description An ISO 3166-1 alpha-2 code, such as IN. */
                    country?: string | null;
                    /** @description An ISO 4217 code, such as INR or USD. */
                    currency: string;
                    org_name: string;
                    org_slug: string;
                    plan_code: string;
                    region?: string | null;
                    /**
                     * Format: uri
                     * @description An absolute http or https URL, where the browser returns after paying.
                     */
                    success_url: string;
                };
            };
        };
        responses: {
            /** @description Hosted checkout information */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckoutResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    receiveSesEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
                "text/plain": string;
            };
        };
        responses: {
            /** @description Accepted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getVersion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The running build and its schema */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        commit?: string;
                        date?: string;
                        go_version?: string;
                        schema?: {
                            /** @description The newest migration this build carries. */
                            latest?: number;
                            /** @description The migration the database is at. */
                            migration?: number;
                        };
                        /** @example v2027.1.0 */
                        version?: string;
                    };
                };
            };
        };
    };
}
