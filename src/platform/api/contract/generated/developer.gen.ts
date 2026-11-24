// Generated from contract/qeet-id-server/developer.yaml by `bun run contract:sync`. Do not edit:
// `bun run contract:check` fails when this file and the document disagree.
export interface paths {
    "/v1/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create API key
         * @description Creates a long-lived API key for machine access. The plaintext key is returned only once at creation and is never retrievable again, so store it securely. Its name is required (422 apikey.name_required) and at most 200 characters (422 validation_failed on name). Callers present it as `Authorization: ApiKey <key>` and resolve to actor_type `api_key`. A user_id, if sent, must be the caller's own: a key can act only for the person who creates it (403 apikey.user_not_self otherwise). Such a personal key works only while that person's account is active: it is refused while they are suspended and once they are deleted. It also does only what that person may do now: a route needs both one of the key's scopes and the person's permission for it (a vault read, their secret.read), so a key loses what its person loses. Creating and revoking keys is audited. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key. A credential carries only authority its creator holds: every scope must be one the caller holds (a vault scope needs secret.read; a machine caller, a scope of its own), or the request is refused with 403 rbac.grant_exceeds_caller naming the scope.
         */
        post: operations["createApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api-keys/{id}": {
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
         * Revoke API key
         * @description Revokes an API key immediately. Requests still using the key begin failing authentication as soon as this returns.
         */
        delete: operations["revokeApiKey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/credentials/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify credential (public)
         * @description Any relying party can present a JWT-serialized W3C Verifiable Credential issued by this server; the response reports validity (signature, issuer, expiry, and revocation status) plus the credential subject + claims. No session required. A token that is not a verifiable credential, such as an access or ID token this server signed, answers valid false with reason "not a verifiable credential"; a failed signature, issuer or expiry check answers reason "signature or expiry invalid", a credential with no record in this server's registry "unknown credential", and a revoked credential "credential revoked".
         */
        post: operations["verifyCredential"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List agents
         * @description Lists the AI agent identities registered in the organization.
         */
        get: operations["listAgents"];
        put?: never;
        /**
         * Create agent
         * @description Registers a new AI agent identity. It gets short-lived access tokens at the token endpoint (POST /v1/oauth/token, grant_type client_credentials, its id as client_id and its secret as client_secret); agents resolve to actor_type `agent`. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key. A credential carries only authority its creator holds: every scope must be one the caller holds (a vault scope needs secret.read; a machine caller, a scope of its own), or the request is refused with 403 rbac.grant_exceeds_caller naming the scope.
         */
        post: operations["createAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/{id}": {
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
         * Delete agent
         * @description Deletes an agent identity. Prefer decommissioning, which preserves audit history, unless a hard delete is required.
         */
        delete: operations["deleteAgent"];
        options?: never;
        head?: never;
        /**
         * Update agent
         * @description Sets or clears the agent's disabled_at. A disabled agent can no longer mint tokens; existing tokens remain valid until they expire.
         */
        patch: operations["updateAgent"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/{id}/decommission": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Decommission agent
         * @description Permanently retire an agent (terminal). It can no longer mint tokens and is excluded from listings.
         */
        post: operations["decommissionAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/{id}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resume agent
         * @description Move a suspended agent back to `active`.
         */
        post: operations["resumeAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate agent secret
         * @description Gives an agent that is not decommissioned a new secret, returned only now, and keeps the old secret minting tokens for overlap_hours (default 24, at most 168; 0 stops it at once). The new secret carries the agent's scopes, so the caller must hold every one of them, as for creating an agent (403 rbac.grant_exceeds_caller, the secret unchanged). Requires apikey.write. Needs a recent step-up. Audited as agent.secret_rotated.
         */
        post: operations["rotateAgentSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/{id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspend agent
         * @description Move an agent to `suspended` (reversible). Its tokens are denied at authz within one request cycle.
         */
        post: operations["suspendAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/kill-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspend all agents
         * @description Security incident-response control. Sets disabled_at on all of the organization's agents in a single transaction. Returns the number suspended.
         */
        post: operations["suspendAllAgents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/resume-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resume all agents
         * @description Makes every suspended agent of the organization active again in a single transaction, the undoing of suspend-all. Returns the number resumed. Requires apikey.write. Needs a recent step-up. Audited, and sent to webhooks, as agent.resume_all.
         */
        post: operations["resumeAllAgents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/sponsored-by/{userID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List agents sponsored by a user
         * @description What an admin needs to see before offboarding userID — every agent they're the accountable owner of.
         */
        get: operations["listSponsoredAgents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/agents/sponsored-by/{userID}/transfer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transfer sponsorship
         * @description Reassigns every agent userID sponsors to to_user_id in one call — the offboarding operation, so no agent is left with an owner who no longer has access.
         */
        post: operations["transferAgentSponsorship"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List API keys
         * @description Lists the organization's API keys. Only key metadata is returned; the secret value is never included.
         */
        get: operations["listApiKeys"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/api-keys/{id}/rotate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate API key
         * @description Replaces a live API key with a new one of the same name, scopes, person and expiry, whose secret is returned only now, and keeps the old key working for overlap_hours (default 24, at most 168; 0 revokes it at once). The new key names the one it replaced in rotated_from. A key acting for a person is rotated only by that person (403 apikey.user_not_self). The caller must hold every scope of the key (403 rbac.grant_exceeds_caller). Requires apikey.write. Needs a recent step-up. Audited as apikey.rotated.
         */
        post: operations["rotateApiKey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/auth-hooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List auth hooks
         * @description Lists the organization's authentication hooks — custom actions invoked at defined points in auth flows.
         */
        get: operations["listAuthHooks"];
        put?: never;
        /**
         * Create auth hook
         * @description Registers an authentication hook, called on every sign-in to the organization once its first factor is proven, whatever the method: password, passkey, social, SAML, LDAP, magic link, invitation and organization switch. It may deny the sign-in (authhook.denied), and on a sign-in that returns tokens its claims are added to the access token. An organization may have several: every enabled hook is called, one after another, oldest first. The first to deny ends the sign-in and the rest are not called; otherwise the claims of all are added, a later hook's replacing an earlier one's of the same name. Each hook's own fail_open decides what its silence does. A sign-in to no organization asks the account's own. Hooks fail open by default: a hook error does not block authentication.
         */
        post: operations["createAuthHook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/auth-hooks/{id}": {
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
         * Delete auth hook
         * @description Deletes an authentication hook so it no longer runs during auth flows.
         */
        delete: operations["deleteAuthHook"];
        options?: never;
        head?: never;
        /**
         * Update auth hook
         * @description Turns an authentication hook on or off, sets whether it fails open, and changes its URL (checked as on creation, 422 auth_hook.url_invalid) or its signing secret (encrypted at rest; the next call is signed with it, and for 24 hours with the secret it replaced too, shown as previous_secret_expires_at, so the hook's endpoint can move over). Only the fields sent change; the answer is both switches as stored. Audited as auth_hook.updated, saying whether the secret changed.
         */
        patch: operations["updateAuthHook"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/auth-hooks/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test an auth hook
         * @description Calls the hook as a sign-in would, signed with its secret, with "test": true and a placeholder person, and reports its answer: status_code, duration_ms, decision (allow, deny, or none when it gave no answer), message, claims and error. It isn't counted in the hook's figures. Audited as auth_hook.tested.
         */
        post: operations["testAuthHook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/credentials": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List credentials
         * @description Lists the verifiable credentials issued by the organization, each with the person it was issued to when the issuer named one.
         */
        get: operations["listCredentials"];
        put?: never;
        /**
         * Issue credential
         * @description Issues a verifiable credential (W3C VC / JWT-VC) to a subject. A presented credential can later be checked with the public verify endpoint.
         */
        post: operations["issueCredential"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/credentials/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke credential
         * @description Revokes a previously issued credential. Verification of the revoked credential will subsequently fail.
         */
        post: operations["revokeCredential"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/secrets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List secrets
         * @description Lists the organization's secrets: names, scopes and the last four characters, never the values; who last revealed each, and when one with a rotation interval is due to be rotated. Requires secret.read.
         */
        get: operations["listSecrets"];
        put?: never;
        /**
         * Create secret
         * @description Stores a secret for the organization, encrypted at rest. A name the organization already uses is refused, and a rotation interval outside 1 to 3650 days with 422 secret.rotation_interval_out_of_range. Requires secret.write. Needs a recent step-up.
         */
        post: operations["createSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/secrets/{id}": {
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
         * Delete secret
         * @description Deletes one of the organization's secrets. Requires secret.write. Needs a recent step-up.
         */
        delete: operations["deleteSecret"];
        options?: never;
        head?: never;
        /**
         * Rotate secret
         * @description Replaces a secret's value, scope or rotation interval, keeping its name. A field left out is kept; a new value restarts the rotation interval, and a null interval removes the reminder. An interval outside 1 to 3650 days is refused with 422 secret.rotation_interval_out_of_range. Requires secret.write. Needs a recent step-up.
         */
        patch: operations["rotateSecret"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/secrets/{id}/reveal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reveal secret
         * @description Returns a secret's decrypted value. Each reveal is audited and noted on the secret as its last reveal. Requires secret.read. Needs a recent step-up.
         */
        post: operations["revealSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/vault/tokens/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Token Vault providers
         * @description Client secrets are never included in the response.
         */
        get: operations["listTokenVaultProviders"];
        put?: never;
        /**
         * Register a Token Vault OAuth2 provider
         * @description Registers a third-party OAuth provider so the Token Vault can store and transparently refresh users' access tokens for it. provider, client_id and client_secret are required (422 validation_failed, naming each field); authorize_url and token_url must be public http or https URLs (422 tokenvault.provider_authorize_url_invalid and tokenvault.provider_token_url_invalid). Registering an existing provider again updates it, but while anyone is connected through it its authorize_url, token_url and client_id can't change (409 tokenvault.provider_in_use), so their refresh tokens only ever go to the endpoint that issued them; the secret and scopes can. Delete the provider to disconnect everyone first.
         */
        post: operations["registerTokenVaultProvider"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/vault/tokens/providers/{provider}": {
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
         * Delete a Token Vault provider
         * @description Removes a registered Token Vault provider and disconnects everyone connected through it: their vaulted tokens are deleted, so a provider registered again under the same name starts with no connected accounts.
         */
        delete: operations["deleteTokenVaultProvider"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List webhooks
         * @description Lists the organization's webhook subscriptions, without their signing secrets. Requires webhook.read.
         */
        get: operations["listWebhooks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change a webhook
         * @description Changes a webhook's URL, its events, or both, each checked as on creation: a URL that isn't a public https address is refused with 400 webhook.url_not_allowed, events outside the catalogue with webhook.event_unknown. Audited as webhook.subscription_updated with what changed. Needs a recent step-up.
         */
        patch: operations["updateWebhook"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/{id}/deliveries/{deliveryID}/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a delivery's attempts
         * @description Every attempt to send one of the webhook's deliveries, oldest first: when, the status answered, how long it took and what went wrong; recorded from this release.
         */
        get: operations["listWebhookDeliveryAttempts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/{id}/deliveries/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry given-up deliveries
         * @description Sends again, each with a fresh budget of attempts, up to 1,000 of the webhook's given-up deliveries, and says how many. Audited as webhook.deliveries_retried.
         */
        post: operations["retryFailedWebhookDeliveries"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/{id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enable webhook
         * @description Turns a disabled webhook subscription back on, whether an administrator or its failures disabled it, with its failures forgotten, and returns it. Deliveries queued while it was off are then sent. Enabling one already on changes nothing. The organization's plan must include webhooks (402 billing.upgrade_required). Requires webhook.write. Needs a recent step-up.
         */
        post: operations["enableWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate webhook secret
         * @description Replaces the subscription's signing secret and returns the new one, shown only in this answer. The old secret goes on signing deliveries alongside the new one until previous_secret_expires_at (24 hours), so the receiver can switch without missing one; rotating again within that time ends the older secret's at once. Audited as webhook.secret_rotated. Requires webhook.write. Needs a recent step-up.
         */
        post: operations["rotateWebhookSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/webhooks/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List webhook events
         * @description Lists the event catalogue: every event a webhook subscription can name, with what it reports. Requires webhook.read.
         */
        get: operations["listWebhookEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/{name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Vault read by name
         * @description Returns a secret's value to a caller holding a "vault:<name>" (or "vault:read") scope — e.g. an AI agent fetching a credential at runtime without embedding it. Organization comes from the caller's token; every access is audited.
         */
        get: operations["readVaultSecret"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the caller's connected third-party accounts
         * @description Non-secret metadata only (provider, external account id, scope, expiry) for the calling user's own connected accounts.
         */
        get: operations["listMyConnectedAccounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/tokens/{provider}": {
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
         * Disconnect a third-party account
         * @description Disconnects the current user's stored third-party account for a provider, deleting the vaulted tokens.
         */
        delete: operations["disconnectAccount"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/tokens/{provider}/access-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a live access token for a connected account
         * @description Hands a connected account's short-lived access token (never the refresh token) to the person who connected it, signed in to their own session, refreshing it first if it has expired. Requires a vault:<provider> or vault:read scope. API keys, service principals, agents and tokens issued to applications are refused with 403 tokenvault.people_only: they carry a user id they were given, not one they proved. Every access, and every refused attempt, is audited under the caller's own credential.
         */
        get: operations["getConnectedAccountToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/tokens/{provider}/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Begin connecting a third-party account
         * @description Returns the authorize_url to redirect the user's browser to, starting a standard OAuth2 authorization-code ceremony (with PKCE, S256) against the organization's registered provider config. The answer also sets an HttpOnly cookie binding the ceremony to this browser, so call it with credentials included (fetch credentials: 'include') from the browser that will open the link: the callback connects the account only in that browser.
         */
        get: operations["startAccountConnection"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/vault/tokens/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Token Vault OAuth2 redirect target
         * @description The fixed, non-caller-supplied redirect_uri registered with the third-party provider. Completes the code exchange, with the ceremony's PKCE verifier, and renders a minimal HTML confirmation page — never redirects to a caller-supplied URL. Only the browser that began the ceremony (holding the cookie the connect call set) completes it: another browser gets 400 (tokenvault.connect_other_browser) and nothing is exchanged or stored, so a connect link sent to someone else connects nothing.
         */
        get: operations["completeAccountConnection"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create webhook
         * @description Subscribes an endpoint to the organization's events it names. The endpoint must be an allowed outbound destination; the signing secret is shown only in this answer. events must name at least one event (422 webhook.events_required), each from the event catalogue (422 webhook.event_unknown); a repeated name counts once. Requires webhook.write. Needs a recent step-up. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key.
         */
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get webhook
         * @description Fetches a single webhook endpoint's configuration and current status.
         */
        get: operations["getWebhook"];
        put?: never;
        post?: never;
        /**
         * Disable webhook
         * @description Disables one of the organization's webhook subscriptions: no further events are sent to it. Requires webhook.write. Needs a recent step-up.
         */
        delete: operations["disableWebhook"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List deliveries
         * @description Lists recent delivery attempts for a webhook, including status and response codes, for debugging failures. Retry a failed one with the retry-delivery endpoint. While the organization's plan does not include webhooks (one that has lapsed since the webhook was set up), deliveries are dead-lettered unsent, with error "not sent: the organization's plan does not include webhooks"; once paid again they can be retried.
         */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{id}/deliveries/{deliveryID}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry delivery
         * @description Sends one of the organization's webhook deliveries again now. A delivery that had finished, delivered or given up after its 60 attempts, starts a fresh set of attempts; one still retrying keeps its count. The delivery must be one of the webhook's in the path: any other, like one that doesn't exist or is being sent at this moment, is refused with 404 webhook.delivery_not_found and left as it was. An ID that isn't a UUID is refused with 400 webhook.invalid_id. Audited as webhook.delivery_retried.
         */
        post: operations["retryWebhookDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test webhook
         * @description Queues a test.ping event for this subscription alone, whichever events it names, and answers once it is queued. Its data is {subscription_id}. Audited as webhook.test_sent. Requires webhook.write.
         */
        post: operations["testWebhook"];
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
        Agent: {
            /** Format: date-time */
            created_at: string;
            disabled: boolean;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description When the agent was last issued a token, to the minute.
             */
            last_used_at?: string | null;
            name: string;
            /**
             * Format: date-time
             * @description Present while the secret replaced at its last rotation still works, until then.
             */
            previous_secret_expires_at?: string;
            scopes: string[];
            secret?: string;
            /** Format: uuid */
            sponsor_user_id?: string;
            status: string;
            token_ttl_seconds: number;
        };
        AgentStatus: {
            /** @enum {string} */
            status: "active" | "suspended" | "decommissioned";
        };
        ApiKey: {
            /** Format: date-time */
            created_at?: string;
            /**
             * Format: uuid
             * @description The person who created the key, or rotated it into being; null for a key made by a machine or before this was kept.
             */
            created_by?: string | null;
            /** Format: date-time */
            expires_at?: string | null;
            /** Format: uuid */
            id?: string;
            /** Format: date-time */
            last_used_at?: string | null;
            name?: string;
            /** Format: uuid */
            organization_id?: string;
            prefix?: string;
            /** Format: date-time */
            revoked_at?: string | null;
            /**
             * Format: uuid
             * @description The key this one replaced at a rotation.
             */
            rotated_from?: string | null;
            scopes?: string[];
            /** Format: uuid */
            user_id?: string | null;
        };
        ApiKeyCreate: {
            /** Format: date-time */
            expires_at?: string | null;
            name: string;
            /** Format: uuid */
            organization_id: string;
            scopes?: string[] | null;
            /** Format: uuid */
            user_id?: string | null;
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
        GrantMeta: {
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at?: string;
            external_account_id?: string;
            provider: string;
            scope?: string;
            /** Format: date-time */
            updated_at: string;
        };
        Hook: {
            /** @description Sign-in calls since this release; test calls aren't counted. */
            calls?: number;
            /** Format: date-time */
            created_at: string;
            denies?: number;
            enabled: boolean;
            fail_open: boolean;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description Its last call by a sign-in.
             */
            last_called_at?: string | null;
            /**
             * @description How that call ended; skipped when the hook gave no answer.
             * @enum {string|null}
             */
            last_outcome?: "allowed" | "denied" | "skipped" | null;
            last_status_code?: number | null;
            /**
             * Format: date-time
             * @description Until when the secret the last change of secret replaced also signs the hook's calls.
             */
            previous_secret_expires_at?: string | null;
            skips?: number;
            trigger: string;
            url: string;
        };
        IssueResult: {
            /** Format: uuid */
            credential_id: string;
            /** Format: date-time */
            expires_at?: string;
            jwt: string;
        };
        Secret: {
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_revealed_at: string | null;
            /** @description The person who last revealed the secret; null when no one has or a machine credential did. Email is empty once the person no longer exists. */
            last_revealed_by: null | {
                display_name: string;
                email: string;
                /** Format: uuid */
                id: string;
            };
            /** @description The id of the machine credential, such as an API key, that last revealed the secret; left out when a person did. */
            last_revealed_credential?: string;
            last4: string;
            name: string;
            /**
             * Format: date-time
             * @description The rotation interval after the value last changed; null without an interval.
             */
            rotation_due_at: string | null;
            rotation_interval_days: number | null;
            rotation_overdue: boolean;
            scope: string;
            /** Format: date-time */
            updated_at: string;
            /**
             * Format: date-time
             * @description When the value was last set; a scope or interval change leaves it.
             */
            value_changed_at: string;
        };
        SecretUpdateInput: {
            /** @description Left out keeps the interval; null removes it. */
            rotation_interval_days?: number | null;
            scope?: string | null;
            value?: string | null;
        };
        TokenvaultProvider: {
            authorize_url: string;
            client_id: string;
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            provider: string;
            scopes: string;
            token_url: string;
            /** Format: date-time */
            updated_at: string;
        };
        /** @description Present, and true, when the list was cut at its limit (1,000 items unless the operation says otherwise): there are more than were answered. */
        Truncated: boolean;
        VcCredential: {
            /** Format: date-time */
            expires_at?: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            issued_at: string;
            revoked: boolean;
            subject: string;
            type: string;
            /** @description The person the credential was issued to; null when the issuer named no one, or the account was deleted. */
            user: null | {
                display_name: string;
                email: string;
                /** Format: uuid */
                id: string;
            };
        };
        VerifyResult: {
            issuer?: string;
            /** @description Why an invalid credential is refused, in English. Show reason_code's meaning instead. */
            reason?: string;
            /**
             * @description Why an invalid credential is refused: not a JWT-VC, a bad signature or expired, not one this server issued, or revoked.
             * @enum {string}
             */
            reason_code?: "vc.not_credential" | "vc.signature_invalid" | "vc.unknown" | "vc.revoked";
            subject?: string;
            valid: boolean;
            vc?: {
                [key: string]: unknown;
            };
        };
        WebhookAttempt: {
            /** Format: date-time */
            attempted_at?: string;
            duration_ms?: number;
            error?: string | null;
            /** @description Null when the endpoint gave no answer. */
            status_code?: number | null;
        };
        WebhookCreateInput: {
            /** @description Event names from the event catalogue. */
            events: string[];
            /**
             * Format: uuid
             * @description Ignored; the organization is the caller's.
             */
            organization_id?: string | null;
            url: string;
        };
        WebhookDelivery: {
            attempt: number;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            dead_at?: string;
            /** Format: date-time */
            delivered_at?: string;
            error?: string;
            event_type: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            next_attempt_at?: string;
            payload: string;
            response_body?: string;
            status_code?: number;
        };
        WebhookEventType: {
            description: string;
            name: string;
        };
        WebhookSubscription: {
            /** @description Its deliveries not yet tried (held while it is disabled), retrying, and given up. */
            counts?: {
                gave_up?: number;
                pending?: number;
                retrying?: number;
            };
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            disabled_at: string | null;
            /**
             * Format: uuid
             * @description The administrator who disabled it.
             */
            disabled_by?: string;
            /**
             * @description Who disabled it, an administrator (disabled) or its failures (failing).
             * @enum {string|null}
             */
            disabled_reason?: "disabled" | "failing" | null;
            events: string[];
            /**
             * Format: date-time
             * @description When deliveries started failing, with no success since.
             */
            failing_since?: string | null;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description Its latest delivery.
             */
            last_delivered_at?: string | null;
            /** @description The status its endpoint answered last. */
            last_status_code?: number | null;
            /** Format: uuid */
            organization_id: string;
            /**
             * Format: date-time
             * @description Until when the secret replaced by the last rotation also signs deliveries.
             */
            previous_secret_expires_at?: string | null;
            secret?: string;
            url: string;
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
        /** @description Conflicts with the resource's current state, such as a duplicate or an invalid lifecycle transition */
        Conflict: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "error": {
                 *         "code": "conflict",
                 *         "message": "That conflicts with something that already exists.",
                 *         "translation_key": "conflict",
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
        /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
        IdempotencyKey: string;
        /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
        OrganizationID: string;
    };
    requestBodies: never;
    headers: {
        /** @description true when this is the stored answer to an earlier request with the same Idempotency-Key and body, sent again rather than run twice. Absent otherwise. */
        IdempotentReplayed: "true";
        /** @description no-store: the response carries a token, a secret or a sign-in session, so no cache may keep it. */
        NoStoreCacheControl: "no-store";
        /** @description no-cache, the same instruction for HTTP/1.0 caches. */
        NoStorePragma: "no-cache";
        /** @description The request's ID, sent on every response. Quote it when reporting a problem; an error body repeats it as error.request_id. */
        RequestId: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    createApiKey: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                 *       "name": "CI deploy bot",
                 *       "scopes": [
                 *         "users:read",
                 *         "audit:read"
                 *       ],
                 *       "expires_at": "2027-01-01T00:00:00Z"
                 *     }
                 */
                "application/json": components["schemas"]["ApiKeyCreate"];
            };
        };
        responses: {
            /** @description Created; secret shown once */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "api_key": {
                     *         "id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *         "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *         "name": "CI deploy bot",
                     *         "prefix": "qk_7Qx8t",
                     *         "scopes": [
                     *           "users:read",
                     *           "audit:read"
                     *         ],
                     *         "expires_at": "2027-01-01T00:00:00Z",
                     *         "created_at": "2026-09-24T10:15:00Z"
                     *       },
                     *       "secret": "qk_7Qx8t3f0a1b2c3d4e5f6g7h8i9j0k1l2",
                     *       "warning": "The secret is shown only once. Store it now; it cannot be retrieved again."
                     *     }
                     */
                    "application/json": {
                        api_key?: components["schemas"]["ApiKey"];
                        secret?: string;
                        warning?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
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
    revokeApiKey: {
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
            /** @description Revoked */
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
    verifyCredential: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The JWT-VC string. */
                    credential: string;
                };
            };
        };
        responses: {
            /** @description { valid, subject, issuer, vc, ... } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerifyResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAgents: {
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
            /** @description Agents (secrets are write-only, not returned) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Agent"][];
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
    createAgent: {
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
                    name: string;
                    scopes?: string[] | null;
                    /**
                     * Format: uuid
                     * @description The named human owner accountable for this agent. Must be a member of this organization.
                     */
                    sponsor_user_id: string;
                    token_ttl_seconds?: number | null;
                };
            };
        };
        responses: {
            /** @description Agent created (secret returned once) */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Agent"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
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
    deleteAgent: {
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
    updateAgent: {
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
                    disabled: boolean;
                };
            };
        };
        responses: {
            /** @description Updated */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    decommissionAgent: {
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
            /** @description New lifecycle status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentStatus"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resumeAgent: {
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
            /** @description New lifecycle status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentStatus"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    rotateAgentSecret: {
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
        requestBody?: {
            content: {
                "application/json": {
                    /** @description How long the old secret goes on working beside the new one. Defaults to 24; 0 stops it at once. */
                    overlap_hours?: number | null;
                };
            };
        };
        responses: {
            /** @description The new secret, shown once */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id: string;
                        /**
                         * Format: date-time
                         * @description When the old secret stops working.
                         */
                        previous_secret_expires_at: string;
                        secret: string;
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
    suspendAgent: {
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
            /** @description New lifecycle status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgentStatus"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    suspendAllAgents: {
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
            /** @description Agents suspended */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        suspended?: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resumeAllAgents: {
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
            /** @description Agents resumed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        resumed?: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listSponsoredAgents: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                userID: string;
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
                        items: components["schemas"]["Agent"][];
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
    transferAgentSponsorship: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                userID: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: uuid
                     * @description Must be a member of this organization.
                     */
                    to_user_id: string;
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
                    "application/json": {
                        transferred?: number;
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
    listApiKeys: {
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
            /** @description API keys */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["ApiKey"][];
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
    rotateApiKey: {
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
        requestBody?: {
            content: {
                "application/json": {
                    /** @description How long the old key goes on working beside the new one. Defaults to 24; 0 stops it at once. */
                    overlap_hours?: number | null;
                };
            };
        };
        responses: {
            /** @description The new key; its secret shown once */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        api_key?: components["schemas"]["ApiKey"];
                        secret?: string;
                        warning?: string;
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
    listAuthHooks: {
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
            /** @description Configured hooks (secrets are write-only, not returned) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Hook"][];
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
    createAuthHook: {
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
                    /** @description What a sign-in does when the hook gives no answer: it can't be read, its signing secret can't be opened, the call fails or times out, or its answer can't be read. True (the default on create) lets the sign-in proceed; false refuses it as temporarily unavailable. Where the hook can't be read, the setting last read for the organization is followed. Every such skip is recorded (audit auth_hook.skipped with the reason and outcome; metric auth_hook_skipped_total). */
                    fail_open?: boolean | null;
                    secret?: string | null;
                    /** Format: uri */
                    url: string;
                };
            };
        };
        responses: {
            /** @description Hook created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Hook"];
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
    deleteAuthHook: {
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
    updateAuthHook: {
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
                    /** @description What a sign-in does when the hook gives no answer: it can't be read, its signing secret can't be opened, the call fails or times out, or its answer can't be read. True (the default on create) lets the sign-in proceed; false refuses it as temporarily unavailable. Where the hook can't be read, the setting last read for the organization is followed. Every such skip is recorded (audit auth_hook.skipped with the reason and outcome; metric auth_hook_skipped_total). */
                    fail_open?: boolean | null;
                    /** @description A new signing secret; write-only. */
                    secret?: string | null;
                    /** Format: uri */
                    url?: string | null;
                };
            };
        };
        responses: {
            /** @description The hook's settings as stored */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        enabled: boolean;
                        fail_open: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    testAuthHook: {
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
            /** @description How the hook answered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        claims?: {
                            [key: string]: unknown;
                        };
                        /** @enum {string} */
                        decision?: "allow" | "deny" | "none";
                        duration_ms?: number;
                        error?: string;
                        message?: string;
                        status_code?: number;
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
    listCredentials: {
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
            /** @description Issued credentials (registry view) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["VcCredential"][];
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
    issueCredential: {
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
                    claims?: {
                        [key: string]: unknown;
                    } | null;
                    subject: string;
                    ttl_seconds?: number | null;
                    type: string;
                    /**
                     * Format: uuid
                     * @description The person the credential is for, a member of the organization (else 422 vc.user_not_member). Recorded with the credential, not in the signed JWT-VC.
                     */
                    user_id?: string | null;
                };
            };
        };
        responses: {
            /** @description Signed JWT-VC + credential id */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IssueResult"];
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
    revokeCredential: {
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
            /** @description Revoked */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    listSecrets: {
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
                        items: components["schemas"]["Secret"][];
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
    createSecret: {
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
                    name: string;
                    /** @description Days after the value last changed that the secret is due to be rotated; null or left out for no reminder. */
                    rotation_interval_days?: number | null;
                    scope: string;
                    value: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Secret"];
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
    deleteSecret: {
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
    rotateSecret: {
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
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SecretUpdateInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Secret"];
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
    revealSecret: {
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
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        value: string;
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
    listTokenVaultProviders: {
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
                        items: components["schemas"]["TokenvaultProvider"][];
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
    registerTokenVaultProvider: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description Registers (or updates) the OAuth2 endpoints + client credentials for one third-party provider, organization-wide. */
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uri */
                    authorize_url: string;
                    client_id: string;
                    client_secret: string;
                    /** @description A short key naming the third-party service, e.g. "slack", "github", "google", or any custom name. */
                    provider: string;
                    scopes?: string | null;
                    /** Format: uri */
                    token_url: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenvaultProvider"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteTokenVaultProvider: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                provider: string;
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    listWebhooks: {
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
                        items: components["schemas"]["WebhookSubscription"][];
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
    updateWebhook: {
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
                    events?: string[] | null;
                    /** Format: uri */
                    url?: string | null;
                };
            };
        };
        responses: {
            /** @description The changed webhook */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookSubscription"];
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
    listWebhookDeliveryAttempts: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                deliveryID: string;
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attempts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["WebhookAttempt"][];
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
    retryFailedWebhookDeliveries: {
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
            /** @description How many were re-queued */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        requeued?: number;
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
    enableWebhook: {
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
                    "application/json": components["schemas"]["WebhookSubscription"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include webhooks. */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    rotateWebhookSecret: {
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
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        previous_secret_expires_at: string;
                        secret: string;
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
    listWebhookEvents: {
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
                        items: components["schemas"]["WebhookEventType"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    readVaultSecret: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                name: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { name, value } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        name?: string;
                        value?: string;
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
    listMyConnectedAccounts: {
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
                        items: components["schemas"]["GrantMeta"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    disconnectAccount: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
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
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getConnectedAccountToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        access_token?: string;
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
    startAccountConnection: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
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
                        authorize_url?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeAccountConnection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description HTML confirmation page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description HTML error page (invalid/expired state, or the provider returned an error) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "url": "https://hooks.example.com/qeet",
                 *       "events": [
                 *         "user.created",
                 *         "user.updated"
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["WebhookCreateInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "018f2a75-6a7b-7c8d-8e9f-0a1b2c3d4e5f",
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *       "url": "https://hooks.example.com/qeet",
                     *       "events": [
                     *         "user.created",
                     *         "user.updated"
                     *       ],
                     *       "disabled_at": null,
                     *       "disabled_reason": null,
                     *       "failing_since": null,
                     *       "previous_secret_expires_at": null,
                     *       "created_at": "2026-09-24T10:25:00Z",
                     *       "secret": "Zr4nYbW8sLc0hQ2xK9mTpV7aE5uFi1oJd3gGt6yHw0q",
                     *       "last_delivered_at": null,
                     *       "last_status_code": null
                     *     }
                     */
                    "application/json": components["schemas"]["WebhookSubscription"];
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
    getWebhook: {
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
            /** @description Webhook subscription */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookSubscription"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    disableWebhook: {
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
    listWebhookDeliveries: {
        parameters: {
            query?: {
                /** @description The previous page's next_cursor. */
                cursor?: string;
                /** @description Page size, 1 to 200 (default 50). A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                /** @description delivered, pending (not tried yet), retrying or dead (given up). */
                status?: "delivered" | "pending" | "retrying" | "dead";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of deliveries, newest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["WebhookDelivery"][];
                        /** @description Present when there is another page. */
                        next_cursor?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    retryWebhookDelivery: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                deliveryID: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Delivery re-queued */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    testWebhook: {
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
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        queued: boolean;
                        /** Format: uuid */
                        subscription: string;
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
}
