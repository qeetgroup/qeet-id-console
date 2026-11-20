// Generated from contract/qeet-id-server/access.yaml by `bun run contract:sync`. Do not edit:
// `bun run contract:check` fails when this file and the document disagree.
export interface paths {
    "/v1/auth/forgot-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Forgot password
         * @description Sends a password-reset link to the supplied email when it belongs to an account. It always returns a neutral confirmation regardless of whether the address exists, so it cannot be used to enumerate accounts, and it is rate limited. The link is stored and emailed after the answer, so the answer is the same for any address, takes the same minimum time, and does not depend on whether the email could be delivered. Complete the flow with the reset-password call using the token from the emailed link. The link goes to the address as the account stores it, not as typed, and ends the account's earlier reset links. An address may ask three times, then once every five minutes (429 too_many_requests past that, whether or not it has an account). A completed reset, a password change or set, an email change and anything else that ends the person's sign-ins also ends their unused reset and magic links. A request for an account is recorded in its organization's audit trail as auth.password_reset_requested (at most ten per account, then one a minute). On a domain whose organization requires single sign-on, the request is refused with 403 auth.sso_required once counted against the per-address bound, before any account is looked up, and no link is sent (see the SSORequired response).
         */
        post: operations["requestPasswordReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in
         * @description Authenticates a user by email and password and, on success, returns an access and refresh token pair. If the account has a second factor enrolled, tokens are withheld and a short-lived mfa_token with the available methods is returned instead; exchange it for tokens at the complete-MFA call. Passwordless accounts authenticate through passkey login rather than this endpoint, and a registered passkey satisfies MFA on its own. Requests are rate limited to slow credential stuffing. Failed sign-ins are counted per account and source network, per account across networks, and per source network across accounts (see the sign-in lockout on the create-SSO-session call); a locked account answers 429 auth.account_locked whatever the password, a throttled source 429 too_many_requests, and an address with no account answers exactly like a wrong password. A suspended or otherwise inactive account also answers a wrong password with 401 auth.invalid_credentials, counted like any wrong password; only the right password is refused with 403 auth.account_inactive. When the account's own organization has switched password sign-in off, a correct password is refused with 403 auth.method_disabled. Every sign-in is assessed for risk (bot-like clients, and impossible travel and new devices where the organization turns them on), and its country and device are kept 90 days for later sign-ins to be compared against. A risky sign-in by someone with no second factor answers an mfa_token challenge met by a code sent to their verified email address (methods [email], the factor named by the challenge's own id), or 403 auth.risk_verification_unavailable when they have no verified address. While the organization's address rules are on, a sign-in from an address they refuse is refused with 403 auth.address_not_allowed before any session is issued; the same holds on every other way of signing in to the organization (passkey, magic link, social, SAML, LDAP, invitation, organization switch, application authorization and the device flow). Each failed attempt is recorded in the audit trail of the organization the sign-in was for (or the account's own) as auth.sign_in_failed: the account, or no one for an address with no account, the reason (wrong_password, unknown_account, account_locked or source_throttled) and the source, never what was submitted. The records are bounded per source network and per organization (sign_in_failures_unrecorded_total counts the rest). A lock a failure sets is recorded as auth.account_locked with locked_until, when it lifts; a source throttle as auth.source_throttled. On a domain whose organization requires single sign-on, the sign-in is refused with 403 auth.sso_required before any account is looked up or password checked, and nothing is counted against the lockout (see the SSORequired response).
         */
        post: operations["signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout
         * @description Signs the caller out and revokes the session behind the presented credential. The associated refresh token stops working as soon as this returns, so any subsequent authenticated call must start a fresh sign-in. Other active sessions for the same user are unaffected; remove those individually with the session-revocation call, or all at once with the revoke-other-sessions call.
         */
        post: operations["signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/magic-link/consume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Magic link consume
         * @description Completes passwordless email sign-in by redeeming the single-use token delivered by the magic-link start call. On success it returns an access and refresh token pair; the token is invalidated once consumed and cannot be replayed. Tokens are short-lived, so an expired or already-used link must be re-requested from the start call. A link to an account whose organization has since switched magic links off is refused with 403 auth.method_disabled and stays unused. A link that proves the account's address for the first time marks it verified, ends every earlier session and removes everything set up on the account before it, its password included (recorded as email.verified and auth.credentials_removed), so whoever registered the address first keeps no way in. The link proves the first factor only: when the account holds a second factor, or must have one, the answer is an MFA challenge instead of tokens, completed at POST /v1/auth/mfa (the session then records the method magic_link_mfa). The link is spent either way, so an abandoned or failed challenge leaves no tokens and no link to use again; an expired or used link is refused before any challenge is raised. A link to an address that must now sign in with single sign-on is refused with 403 auth.sso_required and stays unused (see the SSORequired response).
         */
        post: operations["consumeMagicLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/magic-link/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Magic link — send a new one
         * @description Sends a new sign-in link in place of the one a token names — used, expired or not — to the same address, opening in the same place and continuing the same journey, so the user need not type the address again. Answers the same whatever the token names, and is bounded like the start call (429). As there, the link is stored and emailed after the answer, so whether the email could be delivered does not change it. On a domain whose organization requires single sign-on, the resend is refused with 403 auth.sso_required and no link is sent (see the SSORequired response).
         */
        post: operations["resendMagicLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/magic-link/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Magic link — hosted-login session
         * @description Exchanges a magic link issued for the hosted login (app hosted_login) for the hosted-login session cookie, and returns where the sign-in journey continues (return_to, empty for none). The link works once: used, expired or unknown links, and console links, are refused (recovery.link_used, recovery.link_expired, recovery.magic_link_invalid), and so are links to an account whose organization has since switched magic links off. A link that proves the account's address for the first time marks it verified, ends every earlier session and removes everything set up on the account before it, its password included (recorded as email.verified and auth.credentials_removed), so whoever registered the address first keeps no way in. When the account holds a second factor, or must have one, no cookie is set: the answer is an MFA challenge (with return_to) completed at POST /v1/auth/session/mfa — on the same terms as the hosted password sign-in, including a trusted device (qe_td) skipping it where the organization allows. The link is spent either way. A link for an organization whose address rules refuse the browser's address answers 403 auth.address_not_allowed and opens no session. It is protected against cross-site requests as POST /v1/auth/session is (an allowed Origin, and the qe_csrf token echoed in X-CSRF-Token), and a body not sent as JSON is refused (415 unsupported_media_type). A link to an address that must now sign in with single sign-on is refused with 403 auth.sso_required and stays unused (see the SSORequired response).
         */
        post: operations["createMagicLinkSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/magic-link/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Magic link start
         * @description Begins passwordless email sign-in by emailing a single-use link to the account holding the address. It answers the same whether or not the address has an account, takes the same minimum time, and sends nothing when it has none. The link is stored and emailed after the answer, so whether the email could be delivered does not change the answer either. An empty email is refused with 422 auth.email_required. Asked for from an organization's sign-in page (organization_id), it is refused with 403 auth.method_disabled when that organization has magic links off. Whichever organization asks, the account's own organization decides: nothing is sent when it has magic links off, a link lives for its magic_link_ttl_minutes, and a link stops working once it switches them off. A link works once; it goes to the address as the account stores it, and ends the earlier links to that address. With app hosted_login the link opens the hosted login's magic page and, once exchanged at the magic-link session call, continues the sign-in journey at return_to (kept only if it is this service's authorize endpoint); otherwise it opens the console's, exchanged at the consume call. Requests are bounded to three per address (then one every five minutes) and ten per caller (then one a minute), counted whether or not the address has an account: 429 past either. A link sent is recorded as auth.magic_link_requested in the audit trail of the account's own organization, and of the one that asked only if the account belongs to it, which alone brands the email; for anyone else it is the console's link. On a domain whose organization requires single sign-on, the request is refused with 403 auth.sso_required once counted against the bounds, before any account is looked up, and no link is sent (see the SSORequired response).
         */
        post: operations["sendMagicLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Me
         * @description Returns the principal resolved from the presented credential, including the user, organization, and session identifiers, the actor type, and granted scopes. Use it to confirm who the current credential authenticates as and which organization it is scoped to. An organization-less principal reports a null organization until one is selected with the switch-organization call. Also accepts the hosted-login session cookie (qe_ls) in place of a bearer token, so a browser app signed in through the hosted login can tell who is signed in.
         */
        get: operations["getCurrentPrincipal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/mfa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete MFA login
         * @description Exchanges the mfa_token from /v1/auth/login, plus exactly one proof from the factors the challenge listed, for a token pair: a code, a passkey assertion, or an approved push. An enrolment challenge is completed instead by a code from the authenticator app set up for it (POST /v1/auth/mfa/enroll) — the response then carries the account's new recovery codes, shown once — or skipped while its grace period runs. A wrong proof counts against the challenge's and the account's attempt budgets. A wrong proof is recorded in the organization's audit trail as auth.sign_in_failed (method mfa, reason code_invalid, with the proof kind and the attempts left). Fifty wrong proofs in a row, however far apart, lock the person's second-factor sign-in: that answer and every later one is 403 mfa.locked, even with the right proof, the lock is audited as auth.mfa_locked and the person is emailed. A right proof ends a shorter run; a password reset, a password change or set, or an administrator's reset of their factors lifts the lock.
         */
        post: operations["completeSignInMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/mfa/enroll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Set up an authenticator app to sign in
         * @description For an enrolment challenge — the account must have a second factor and holds none — starts an authenticator app and returns its secret and otpauth:// provisioning URL. A code from the app then completes the challenge (POST /v1/auth/mfa or /v1/auth/session/mfa). Calling again replaces the app not yet confirmed. Refused (400) for a challenge that is not an enrolment one; answers mfa challenge expired once the account holds a factor. Used by both sign-in flows.
         */
        post: operations["enrollSignInTotp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/mfa/passkey/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Begin a passkey second factor
         * @description Starts a passkey assertion for the challenged person's own passkeys; only an assertion from this ceremony completes the challenge. Used by both sign-in flows.
         */
        post: operations["beginSignInMfaPasskey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/mfa/push": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a push approval request
         * @description Sends a sign-in approval request to the challenged person's push devices; only its approval completes the challenge, and only once. Complete with push: true. Used by both sign-in flows. Each phone is sent a high-priority push that lives as long as the request can be answered (two minutes); a phone the push service reports as no longer having the app is retired. When the request reaches none of the person's phones it is closed and the call answers 502 mfa.push_delivery_failed, so the person can use another way to verify. The answer carries a two-digit number to show on the sign-in screen: the phone must send it back to approve. A person is sent at most five requests in ten minutes, and none for the rest of an hour in which they denied three; past that the call answers 429 mfa.push_limited.
         */
        post: operations["sendSignInMfaPush"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/mfa/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a sign-in code
         * @description Sends a code to one of the challenged person's email or SMS factors (factor_id, from the challenge's factors), to complete the challenge with. At most five per challenge (429). Used by both sign-in flows. For a risky sign-in by someone with no second factor, the challenge's one factor is their verified email address, named by the challenge's own id: send its code here with factor_id set to the mfa_token, then submit it to complete the challenge. A code to one factor can be sent at most every 30 seconds, ten an hour to one person and five an hour to one address or number over every account; past that the call answers 429 mfa.code_send_limited with retry_after (seconds). A new code makes the factor's earlier unused code stop working. A code sent here only completes a sign-in, never a step-up. An SMS code needs an organization whose plan includes SMS (403 upgrade_required). Each code sent is audited as mfa.otp_sent.
         */
        post: operations["sendSignInMfaCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Password status
         * @description Reports whether the caller has a password set, so the account UI can offer "set a password" (social/passkey accounts) vs "change password".
         */
        get: operations["getMyPasswordStatus"];
        put?: never;
        /**
         * Change or set my password
         * @description Rotates (or sets) the signed-in user's password. current_password is required only when one is already set; a social/passkey account may set one by omitting it. It needs a step-up while the caller holds a second factor (403 step_up_required), and otherwise a recent sign-in (403 recent_sign_in_required). Other sessions are revoked. The new password must meet the rules of the organization the account belongs to (not the session's organization; the platform baseline of 8 characters for an account with no organization), the offline strength baseline and, when enabled, the breached-password check; a refusal is a 422 naming the rule that failed. Self-service. Every hosted sign-in (browser) session of the person ends too, so one opened with the old password can no longer start an application's sign-in or enrol a passkey; the audit record counts them (revoked_login_sessions). The session the change is made from is kept. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["setMyPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh
         * @description Exchanges a valid refresh token for a new access and refresh token pair. The presented refresh token is rotated and invalidated, so each token may be redeemed only once; persist the returned refresh token for the next rotation. A revoked token is rejected and forces a fresh sign-in. A token presented again within the reuse grace of its rotation (REFRESH_TOKEN_REUSE_GRACE, 30 seconds by default, at most one minute), while the token that replaced it is still unused, gets the very pair its rotation returned, so two instances of a client renewing at once, or a client that lost the answer, keep the session; each such retry is audited as auth.refresh_token_retried. Any other reuse of a rotated token is treated as theft: the session ends (401 auth.session_revoked), audited as auth.token_reuse_detected. A session ends by itself at its maximum age however active it is, and once it goes longer than its idle timeout without a renewal; each renewal restarts the idle timeout, and the response says when the session ends either way (session_expires_at, idle_expires_at). A renewal after either is refused with 401 auth.session_timed_out and the session ends, recorded as an expiry and announced to session.revoked subscribers with the reason expired. A renewal from an address the organization's address rules refuse answers 403 auth.address_not_allowed; the session stays, and renews again from an allowed address. A session in a organization that has since been suspended or deleted is refused (403 auth.organization_inactive).
         */
        post: operations["refreshTokens"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register (hosted, B2C)
         * @description Creates a new end-user in the client's organization and sets the SSO cookie
         *     (qe_ls) so they continue into the OAuth authorize flow. Where the organization
         *     requires MFA, no cookie is set: the response is an enrolment challenge
         *     (with user_id) to complete at POST /v1/auth/session/mfa once an
         *     authenticator app is set up. Gated by the
         *     organization's self_registration_enabled policy (403 when disabled). The
         *     password must meet that organization's password rules (422 naming the rule
         *     that failed). An address that already has an account is refused with
         *     the neutral 422 unprocessable of POST /v1/auth/signup, which does not
         *     name the reason, and every attempt takes at least the same minimum time.
         *     So is an address on a domain another organization has verified: only
         *     that organization creates accounts there.
         *
         *     An address the organization's address rules refuse answers 403
         *     auth.address_not_allowed, and no account is created.
         *     A body not sent as JSON is refused (415 unsupported_media_type).
         *     Where the organization has password sign-in switched off, it is refused with 403 auth.method_disabled (the answer password sign-in gives) and nothing is created.
         *
         *     On a domain whose organization requires single sign-on, the registration
         *     is refused with 403 auth.sso_required before anything else is checked,
         *     and nothing is created: the identity provider creates the account (see
         *     the SSORequired response).
         */
        post: operations["signUpInOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset password
         * @description Completes the password-reset flow started by the forgot-password call by consuming the emailed token and setting the new password. The token is single-use and time-limited, so an expired or already-redeemed token is rejected. The new password is checked against the rules of the organization the account belongs to (the platform baseline of 8 characters for an account with no organization), the offline strength baseline and, when enabled, the breached-password check; a refusal is a 422 naming the rule that failed and leaves the password and the token unchanged. On success the password is updated and the user can sign in with the new credentials. Every hosted sign-in (browser) session of the person ends too, so one opened with the old password can no longer start an application's sign-in or enrol a passkey; the audit record counts them (revoked_login_sessions). The completed reset is recorded in the account's organization's audit trail as auth.password_reset_confirmed. A reset that proves the account's address for the first time marks it verified and removes everything set up on the account before it but the new password (passkeys, second factors, linked accounts, pending verifications and sign-in codes, and personal API keys), so whoever registered the address first keeps no way in; recorded as email.verified and auth.credentials_removed. A link for an address that must now sign in with single sign-on is refused with 403 auth.sso_required; the password and the link stay as they were (see the SSORequired response). The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["resetPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create SSO session
         * @description Establishes a hosted-login SSO session and sets the HttpOnly qe_ls cookie so the browser can continue into the OAuth authorize and consent flow. When the account has a second factor enrolled, no cookie is set yet and a short-lived mfa_token is returned; complete it at the session-MFA call before the cookie is issued. Because this is a cookie session, later state-changing calls made with it are subject to CSRF protection. End the session with the corresponding destroy-session call.
         *
         *     Sign-in lockout: failed password sign-ins are counted per account and source network (the client IP behind the trusted proxies; an IPv4 address or an IPv6 /64). Reaching the threshold within the window locks the account for that network for the lock duration, so a stranger on another network cannot lock the owner out. The threshold, window and duration are those of the organization of the OAuth client named by `client_id` (its authentication policy), or the platform defaults when no client is named. Failures from any mix of networks also lock the account everywhere at a looser cap (4 times the platform threshold), and a source network that fails against too many distinct accounts (30 within 15 minutes) is refused password sign-in for 15 minutes. An address with no account is counted and answered exactly like a wrong password, and so is a wrong password for a suspended or otherwise inactive account (401 auth.invalid_credentials); only the right password is refused with 403 auth.account_inactive. When the counters cannot be read or written the sign-in is refused with 503 auth.sign_in_unavailable (fail closed). When the organization of the named client_id has switched password sign-in off, the request is refused with 403 auth.method_disabled before any password is checked (the same answer for any account or none); without a client_id, the account's own organization decides once the password is verified. While the address rules of that client's organization are on, an address they refuse is answered 403 auth.address_not_allowed before any password is checked, and no cookie is set; the account's own organization's address rules then apply as well, whichever application asked, since the session reaches the account's self-service routes. A body not sent as JSON is refused (415 unsupported_media_type). Failed attempts are recorded as for POST /v1/auth/login. On a domain whose organization requires single sign-on, the sign-in is refused with 403 auth.sso_required before any account is looked up or password checked, and nothing is counted against the lockout (see the SSORequired response).
         */
        post: operations["createSsoSession"];
        /**
         * Destroy SSO session (logout)
         * @description Signs the browser out of the hosted login: ends the hosted-login SSO session behind the qe_ls cookie and what it started — the refresh grants applications received through it are revoked and its unredeemed authorization codes can no longer be redeemed — then clears the cookie. The sign-out is recorded in the audit log (auth.signed_out). Other browsers, bearer-token API sessions and grants started elsewhere are unaffected; sign API sessions out with the logout call, or everything with sign out everywhere. Without a session cookie nothing is ended and the response is the same. If the sign-out cannot be completed an error is returned and the cookie kept, so it can be retried. Access tokens already issued stay valid until they expire.
         */
        delete: operations["deleteSsoSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/session/mfa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete SSO session MFA
         * @description Exchanges the mfa_token from POST /v1/auth/session, plus exactly one proof from the factors the challenge listed (a code, a passkey assertion, or an approved push — as for POST /v1/auth/mfa), for the SSO cookie (qe_ls). An enrolment challenge is completed by a code from the authenticator app set up for it, or skipped while its grace period runs, as for POST /v1/auth/mfa; a skipped setup never remembers the device. A body not sent as JSON is refused (415 unsupported_media_type). A wrong proof is recorded in the organization's audit trail as auth.sign_in_failed (method mfa, reason code_invalid, with the proof kind and the attempts left). Fifty wrong proofs in a row, however far apart, lock the person's second-factor sign-in: that answer and every later one is 403 mfa.locked, even with the right proof, the lock is audited as auth.mfa_locked and the person is emailed. A right proof ends a shorter run; a password reset, a password change or set, or an administrator's reset of their factors lifts the lock.
         */
        post: operations["completeSsoSessionMfa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List sessions
         * @description Lists the caller's own active sessions, each with its device, address, and timestamp metadata, for review in account security settings. Results are cursor-paginated: pass the returned next_cursor to fetch the following page until has_more is false. Terminate any listed session individually with the session-revocation call, or every session except the current one with the revoke-other-sessions call.
         */
        get: operations["listMySessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sessions/{id}": {
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
         * Revoke session
         * @description Revokes a single session belonging to the caller by its identifier. The session's refresh token stops working as soon as this returns, forcing that device to sign in again, while the caller's other sessions are left intact. Enumerate session identifiers first with the list-sessions call.
         */
        delete: operations["revokeMySession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sessions/revoke-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign out everywhere
         * @description Signs the caller out everywhere in a single all-or-nothing step and reports how many sign-ins ended. It ends every one of the caller's sessions, including the one behind the presented access token; every hosted-login (browser) session, so the next authorization asks the person to sign in again; and every refresh grant held by applications the person signed in to. The response also clears the hosted-login cookie for a browser that calls directly. The request takes no body. Refresh tokens, application grants and the access tokens of the caller's own sessions stop working on this API as soon as this returns; access tokens held by applications, and any a service verifies offline, last until they expire (minutes). The presented access token must belong to one of the caller's own sessions (an application's access token is refused with 401). Repeating the call succeeds with every count at 0 and changes nothing. If anything cannot be ended the call fails and nothing is ended. To keep the current session, use the revoke-other-sessions call instead.
         */
        post: operations["signOutEverywhere"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sessions/revoke-others": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke all other sessions
         * @description Ends every one of the caller's sessions except the one they are using, in a single all-or-nothing step, and returns how many were ended. The session that is kept is the one behind the presented access token; the request takes no body and no session identifiers. The refresh and access tokens of the ended sessions stop working on this API as soon as this returns; a service that verifies access tokens offline, without introspection, accepts them until they expire (minutes). Succeeds with `revoked: 0` when there is no other session. If any session cannot be ended the call fails and none are ended. Returns 401 `auth.session_revoked` when the caller's own session has already ended. Sessions in hosted login and tokens held by applications are not affected; the sign-out-everywhere call ends those too.
         */
        post: operations["revokeMyOtherSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/sign-in-methods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My ways to sign in
         * @description How many ways the caller's account can sign in: its password, each passkey, and each linked identity that can still sign in (a SAML or directory link, a social provider its organization has switched on, or a social account connected to the console account). Resetting a password by email is recovery and is not counted. Removing the last way — a passkey, a connected account, or an administrator unlinking an identity — is refused with 409 auth.last_sign_in_method and recorded (auth.sign_in_method_removal_refused); use total to disable or explain that action first.
         */
        get: operations["listMySignInMethods"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign up
         * @description Registers a new user from an email and password and returns a token pair alongside the created user record. The password must meet the platform baseline (8 characters), the offline strength baseline and, when enabled, the breached-password check (422 naming the rule that failed). The new user is organization-less: no organization is created here, so the returned token carries no organization scope. Create an organization through the Identity Management API before any organization-scoped call, after which the creator becomes the organization owner. An address that already has an account is refused with a neutral 422 unprocessable that does not name the reason (it suggests signing in or resetting the password), every attempt takes at least the same minimum time, and the endpoint is rate limited. An address on a domain an organization has verified gets the same answer and no account: that organization creates its people's accounts. On a domain whose organization requires single sign-on, the sign-up is refused with 403 auth.sso_required before anything else is checked, and nothing is created: the identity provider creates the account (see the SSORequired response).
         */
        post: operations["signUp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/switch-organization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Switch organization
         * @description Replaces the caller's session with one scoped to another organization they belong to (their own, or one where they hold a role) and returns its token pair. The new access token carries the claims the target organization's authentication hook adds, and renewals keep them; the hook may also refuse the switch. The session the presented access token belongs to ends: its refresh and access tokens are refused from now on, and the organization's session.revoked subscribers are notified with reason organization_switch. Use the returned pair from now on. The caller's session list shows the one sign-in, not one entry per switch. Refused, with nothing changed: an organization the caller does not belong to (403), a refusal by the organization's hook, an address the organization's address rules refuse (403 auth.address_not_allowed), an organization that requires single sign-on on the caller's domain (403 auth.sso_required: its identity provider signs its people in there directly, so no other session is switched into it; break-glass members are exempt), or an access token whose session has already ended (401). An organization that requires a second factor of the caller (its security policy, or administrators-only for its administrators) is entered only by a session whose sign-in met one, or that holds a fresh step-up; otherwise 403 step_up_required (step up, then try again) or 403 mfa.enrollment_required (set a factor up first), unless the organization's grace period still lets the caller put the setup off. The new session carries the factor on. Confirm the active scope afterward with the current-principal call.
         */
        post: operations["switchOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/trusted-devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List my remembered devices
         * @description Lists the caller's own remembered devices, in every organization, newest first: each device skips the second factor at sign-in until it expires or is forgotten. A device is remembered for its organization's remember_device_days after the sign-in that remembered it, and is forgotten when its owner changes their password, signs out everywhere, or has their factors reset.
         */
        get: operations["listMyTrustedDevices"];
        put?: never;
        post?: never;
        /**
         * Forget all my remembered devices
         * @description Forgets every device the caller has remembered, so each is asked for the second factor at its next sign-in. Each is audited as auth.trusted_device_revoked.
         */
        delete: operations["forgetAllMyTrustedDevices"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/trusted-devices/{id}": {
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
         * Forget one of my remembered devices
         * @description Forgets one of the caller's remembered devices, so it is asked for the second factor at its next sign-in. 404 for a device that is not the caller's. Audited as auth.trusted_device_revoked.
         */
        delete: operations["forgetMyTrustedDevice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/trusted-devices/count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Count trusted devices
         * @description Number of live trusted devices in the caller's organization, as used by the Authentication overview. Counts devices, not users, and excludes expired rows — an expired device is no longer trusted. Organization scope comes from the principal, never a parameter. Returns 0 for organizations that have not enabled adaptive MFA (`remember_device_enabled`), since nothing writes a trusted device until then.
         */
        get: operations["countMyTrustedDevices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Permission check
         * @description Evaluates whether a user may use a permission in an organization, composing every model: an ABAC deny policy (resource type and action read from the key, so doc:write is resource doc, action write) refuses and stops; otherwise a role granting the permission, or an ABAC allow policy, permits; otherwise it is refused. An engine error refuses. The response names the deciding model and rule in decided_by; the ABAC policy is named only to a caller holding policy.read. Pass explain=true to add the role grant paths, a reason on denial and the step-by-step trace. This is a read-only decision and changes no state.
         */
        get: operations["checkPermission"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List my access requests
         * @description The signed-in person's requests for a role in the organization they're signed in to, newest first (up to 100), with their answers.
         */
        get: operations["listMyAccessRequests"];
        put?: never;
        /**
         * Ask for a role
         * @description Asks the organization for one of its roles, for duration_hours (1 to 2160, 90 days) or, without it, for good, with a reason the people who can grant roles see. They're told in the app and on their linked phones. Any role but the owner role can be asked for (404 otherwise). A role held directly is refused with 409 access_request.role_held, and a second request for a role already asked for with 409 access_request.pending. A request nobody answers lapses after 14 days.
         */
        post: operations["createAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/access-requests/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel my access request
         * @description Withdraws the signed-in person's own request while it's waiting. One already answered, cancelled or lapsed answers 409 access_request.closed.
         */
        post: operations["cancelMyAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/access-requests/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List roles I can ask for
         * @description The organization's roles the signed-in person can ask for (every role but the owner role), marking the ones they already hold directly.
         */
        get: operations["listRequestableRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * My effective permissions
         * @description The permission keys the signed-in person holds in the organization their token is for, from the roles assigned to them and those their groups hold, with every grant behind them, as GET /v1/users/{userID}/organizations/{organizationID}/permissions answers for anyone. It needs no permission, so someone holding none (the built-in member role grants none) reads empty lists and an application can show them what they may use. Another person's permissions still need role.read. A token for no organization is refused with 401.
         */
        get: operations["listMyEffectivePermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/otp/factors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List OTP factors
         * @description Lists the caller's SMS and email factors.
         */
        get: operations["listOtpFactors"];
        put?: never;
        /**
         * Add OTP factor
         * @description Adds an email or SMS factor (or returns the one already held for that address, untouched) and sends a code to confirm it at /v1/mfa/otp/factors/{id}/confirm. A person may hold five email and SMS factors (409 mfa.factor_limit). A code to one factor can be sent at most every 30 seconds, ten an hour to one person and five an hour to one address or number over every account; past that the call answers 429 mfa.code_send_limited with retry_after (seconds). A new code makes the factor's earlier unused code stop working. A code sent here only confirms the new factor. An SMS code needs an organization whose plan includes SMS (403 upgrade_required). Each code sent is audited as mfa.otp_sent.
         */
        post: operations["addOtpFactor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/otp/factors/{id}": {
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
         * Delete OTP factor
         * @description Removes one of the caller's SMS or email factors. Needs a recent step-up. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        delete: operations["deleteOtpFactor"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/otp/factors/{id}/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Challenge OTP factor
         * @description Sends a step-up code to one of the caller's confirmed email or SMS factors, to verify at /v1/mfa/otp/verify. A code to one factor can be sent at most every 30 seconds, ten an hour to one person and five an hour to one address or number over every account; past that the call answers 429 mfa.code_send_limited with retry_after (seconds). A new code makes the factor's earlier unused code stop working. A step-up code works only for a step-up, and a code sent for a sign-in or to confirm a new factor never counts here; its message says what it is for. An SMS code needs an organization whose plan includes SMS (403 upgrade_required). Each code sent is audited as mfa.otp_sent.
         */
        post: operations["challengeOtpFactor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/otp/factors/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm OTP factor
         * @description Completes adding an SMS or email factor with the code sent to it. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["confirmOtpFactor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/otp/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify OTP
         * @description Verifies a code sent to one of the caller's SMS or email factors, stepping up the session.
         */
        post: operations["verifyOtp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/challenges/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Poll a push-MFA challenge
         * @description Returns the current status of a push-MFA challenge, letting the sign-in surface poll while it waits for the user to approve or deny on their device. It is unauthenticated because it is called before the second factor is satisfied. A request past its expiry (two minutes after it was sent) reads as expired, and can no longer be answered. The enrolled device answers the challenge through the challenge-respond call.
         */
        get: operations["getPushChallenge"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/challenges/{id}/respond": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve or deny a push-MFA challenge
         * @description Records the user's approval or denial of a push-MFA challenge, called by the enrolled device rather than the browser. It is authenticated by the device_token issued at registration together with the matching user_id, not a session credential, which is why no bearer token is required. Once recorded, the polling sign-in surface observes the outcome through the challenge-status call and proceeds or fails accordingly. An approval must carry the number shown where the request was asked for (the sign-in screen, or the step-up prompt); with another number the request is denied and the call answers 403 mfa.push_number_mismatch.
         */
        post: operations["respondToPushChallenge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List registered push-MFA devices
         * @description Lists the caller's registered push-approval devices used as a second factor, each with its label and platform, for management in account security settings. It never returns the secret device token, which is shown only once at registration. Add or rotate a device with the register-device call and remove one with the revoke-device call.
         */
        get: operations["listMyPushDevices"];
        put?: never;
        /**
         * Register or rotate a push-MFA device
         * @description Registers a mobile device for push-based MFA, or rotates the credential of an existing one, from its platform push token. The resulting device token is returned only in this response and cannot be retrieved later, so the device must persist it to answer future challenges. That token is required when responding to a challenge; revoke the device with the corresponding delete call. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["registerPushDevice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/devices/{id}": {
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
         * Revoke a push-MFA device
         * @description Revokes a registered push-MFA device by its identifier so it can no longer approve challenges. Its device token is invalidated immediately and any pending challenge to it can no longer be answered. Re-enroll the device with the register-device call if push approval is needed again. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        delete: operations["revokeMyPushDevice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/devices/{id}/pending": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * List the sign-in requests waiting on this phone
         * @description Called by the mobile app when it comes to the foreground, so a request whose push was late, lost or never sent (its push service has no credentials on this server) can still be answered. Lists the account's pending, unexpired requests, newest first, at most ten. The app proves it is that device with the device_token it was given when linked, which must not have expired; it is sent in the body, never in the URL (the app holds no signed-in session). Each request is answered with the respond call, carrying the number shown where it was asked for. 401 mfa.push_unauthorized when the device or credential does not match or has expired.
         */
        post: operations["listPendingPushRequests"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/devices/{id}/push-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Replace this phone's push token
         * @description Called by the mobile app when its platform rotates the push token (APNs or FCM), so sign-in requests keep reaching the phone. The app proves it is that device with the device_token it was given when linked, which must not have expired (the app holds no signed-in session). The link's expiry and the platform are unchanged; another link of the same account already holding the new token is removed, so each request reaches the phone once. 401 mfa.push_unauthorized when the device or credential does not match or has expired.
         */
        post: operations["replacePushDeviceToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/devices/{id}/unlink": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Unlink this phone
         * @description Called by the mobile app to remove the phone it runs on from the account, proving it is that device with the device_token it was given when linked (the app holds no signed-in session). Works with a credential past its expiry, since removing itself grants nothing. 401 mfa.push_unauthorized when the device or credential does not match. Audited as mfa.push_device_unlinked. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["unlinkPushDevice"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/pairing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask for a code to link a phone
         * @description Issues a pairing code that links a phone running the mobile app to the caller's own account, so nobody copies an access token. The code is returned only in this response, shown grouped for reading (ABCDE-FGHJK); it links one phone, once, within five minutes, and asking for a new one stops the caller's earlier unused codes working. Needs a recent step-up when the caller already holds a second factor (403 step_up_required), and otherwise a recent sign-in (403 recent_sign_in_required). At most ten an hour (429 with retry_after). Audited as mfa.push_pairing_created. The phone exchanges the code with the claim call; the status call tells the screen showing it when it has been used.
         */
        post: operations["createPairingCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/pairing/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check a pairing code
         * @description Reports one of the caller's pairing codes: pending (it can still link a phone), linked (it did; device_id names the phone) or expired (it timed out, was replaced by a newer code, or was withdrawn). Someone else's code reads as not found.
         */
        get: operations["getPairingCode"];
        put?: never;
        post?: never;
        /**
         * Withdraw a pairing code
         * @description Stops one of the caller's unused pairing codes working, as when the screen showing it is closed. A code that already linked a phone is left as it is: remove the phone instead. Someone else's code reads as not found.
         */
        delete: operations["withdrawPairingCode"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/pairing/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Link this phone with a pairing code
         * @description Called by the mobile app, which holds no signed-in session, to link the phone it runs on to the account that asked for the pairing code. The code is read as typed or scanned: case, spaces and hyphens do not matter, and O, I and L read as 0, 1 and 1. Like registering a device, it returns the account's user_id, the device and its device_token, which is shown only here. A wrong, used or expired code, or one whose account is no longer active, answers 401 mfa.pairing_code_invalid, all alike. Throttled per address (429). Audited as mfa.push_device_linked. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["claimPairingCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/step-up": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Step up with a linked phone
         * @description Sends a step-up request for the calling session to every phone the caller has linked, and answers 202 with its challenge_id, expires_at and the number to show for the phone to send back when approving. Once the request is approved on a phone, complete the step-up with the complete call. A caller with no linked phone gets 404 mfa.push_device_not_found; a principal without a session (an API key, agent) cannot step up. Requests are bounded as at sign-in (429 mfa.push_limited).
         */
        post: operations["startPushStepUp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/push/step-up/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete a phone step-up
         * @description Records the calling session's step-up (method push) once its request has been approved on a linked phone, and spends the request. 409 mfa.push_pending while it awaits an answer (retry); 409 mfa.push_challenge_invalid for a denied or spent request, or one raised for another session; 410 mfa.push_challenge_expired for one left unanswered past its expiry.
         */
        post: operations["completePushStepUp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Recovery codes status
         * @description Reports how many of the caller's recovery codes are left.
         */
        get: operations["getRecoveryCodesStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/recovery-codes/regenerate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Regenerate recovery codes (step-up)
         * @description Replaces the caller's recovery codes; the new ones are shown only in this answer and the old ones stop working. Needs a recent step-up. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["regenerateRecoveryCodes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/step-up/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Step-up status
         * @description Reports whether the calling session is stepped up: it met a second factor of a type its organization counts within the organization's step-up window. A step-up belongs to the session that earned it, so a factor proved in another session, or by an API key or agent, never counts.
         *
         *     These need a step-up, and answer 403 step_up_required without one (with window_seconds and, when the organization limits them, allowed_methods): adding or removing the caller's own factors and sign-in methods, setting or changing their password, starting a change of their email address and deleting their account, while they hold a factor their organization counts; switching the authenticator app off or replacing recovery codes; creating, changing or revoking API keys, service principals, agents, OAuth clients and their secrets, SCIM tokens, credentials, webhooks and auth hooks; creating, changing, revealing or deleting secrets, vault providers and the AI provider configuration; changing the security policy, sign-in methods, risk, bot, IP and rate-limit settings, a user's MFA requirement, factors or password; configuring SAML, LDAP, social providers, domains, directory mappings and administrator portal links; editing email templates; changing retention, anomaly settings and log streaming; granting or revoking a role's permissions, assigning or removing user and group roles, creating invitations, and writing relationship tuples and attribute policies; reactivating or restoring a user; and updating or deleting the organization, or deleting or purging a user. A caller holding no such factor has nothing to step up with, so the changes to their own account need a sign-in within the organization's step-up window instead, and answer 403 recent_sign_in_required (with window_seconds) otherwise: sign in again, then retry. A session opened by switching to, joining or creating an organization continues the sign-in it came from. An API key, service principal or agent holds no session, so it cannot perform these. The hosted login's own sign-in counts as a step-up for the organization's window after it happens, when that sign-in proved a second factor itself (a met challenge or a passkey). A linked phone counts as a factor held, and steps a session up through the push step-up calls.
         */
        get: operations["getStepUpStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/totp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * TOTP status
         * @description Reports whether the principal has a confirmed TOTP factor, so the account UI can show an active state instead of re-offering enrollment.
         */
        get: operations["getTotpStatus"];
        put?: never;
        post?: never;
        /**
         * Disable TOTP
         * @description Removes the caller's authenticator app and recovery codes. Needs a recent step-up. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        delete: operations["disableTotp"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/totp/enroll/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm TOTP enrollment
         * @description Completes adding an authenticator app with a code from it, and returns the recovery codes. The account holder is emailed that it happened, with what to do if it wasn't them.
         */
        post: operations["confirmTotpEnrollment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/totp/enroll/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start TOTP enrollment
         * @description Starts setting up an authenticator app and returns its secret. While the account holds a confirmed app, this needs a step-up of the calling session (403 step_up_required otherwise), and the new app waits beside the confirmed one: the confirmed app keeps working until a code from the new one confirms it at /v1/mfa/totp/enroll/confirm, and a setup not confirmed within 30 minutes is ignored. A first setup needs no step-up.
         */
        post: operations["startTotpEnrollment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/totp/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify TOTP
         * @description Verifies a code from the caller's authenticator app, or a recovery code, stepping up the session.
         */
        post: operations["verifyTotp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/webauthn/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * WebAuthn 2FA challenge
         * @description Starts a WebAuthn assertion ceremony over the authenticated user's existing passkey credentials, used as a second factor (no token is issued).
         */
        post: operations["challengeWebauthnFactor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/mfa/webauthn/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * WebAuthn 2FA verify
         * @description Verifies a WebAuthn assertion against the user's registered credentials and records a step-up verification on success.
         */
        post: operations["verifyWebauthnFactor"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/abac/evaluate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Evaluate ABAC policies
         * @description Runs the deny-wins ABAC evaluation algorithm against all enabled policies
         *     that match the supplied resource type and action. Returns the decision and,
         *     when ?explain=true, a trace of every policy evaluated.
         *     A deny policy whose condition compares an attribute the request doesn't
         *     supply applies (fail closed); an allow policy doesn't match. Supply the
         *     resource's attributes (such as created_by) for policies that compare them.
         *     The platform's own decisions (the route guard, the permission and
         *     relationship checks, AuthZEN) supply what it knows of the user, which a
         *     caller can't override: subject.id, subject.type, subject.organization_id,
         *     subject.groups and subject.roles (names in the organization; roles held
         *     directly or through a group), resource.type and resource.id. The route
         *     guard, deciding on the person's own call, also supplies context.ip (the
         *     client address) and context.mfa: true when the session's sign-in met a
         *     second factor as the organization's MFA requirement counts one (a
         *     challenge, a passkey or a remembered device) or the session holds a step-up
         *     still inside its window, false otherwise, and left out, so unknown, for an
         *     application's token, whose session the platform doesn't hold.
         *     With a draft, the unsaved policy is evaluated among the stored ones, new or
         *     in place of the stored policy it replaces, and nothing is saved; an invalid
         *     draft is refused with 422 as a save would be.
         */
        post: operations["evaluateAbacPolicies"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/abac/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List ABAC policies
         * @description Returns all ABAC policies for the organization, ordered by priority desc then name.
         */
        get: operations["listAbacPolicies"];
        put?: never;
        /**
         * Create ABAC policy
         * @description Creates a new ABAC policy for the organization. An enabled deny for policy writes (resource type policy or *, action write or *) that would refuse its own author, judged on the attributes the route guard sees for the author's call now (their groups, roles, address and whether their session met a second factor), is refused with abac.policy_locks_out, as nobody could then remove it.
         */
        post: operations["createAbacPolicy"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/abac/policies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get ABAC policy
         * @description Returns a single ABAC policy by its identifier, including its conditions, effect, and priority. Use it to inspect a policy before editing or removing it. Modify it with the update-policy call or remove it with the delete-policy call.
         */
        get: operations["getAbacPolicy"];
        put?: never;
        post?: never;
        /**
         * Delete ABAC policy
         * @description Permanently removes an ABAC policy from the organization. Once deleted, the policy no longer participates in the deny-wins evaluation, which can change access decisions immediately, so confirm its impact first with the ABAC evaluate call. Retrieve the policy beforehand with the get-policy call if a record is needed.
         */
        delete: operations["deleteAbacPolicy"];
        options?: never;
        head?: never;
        /**
         * Update ABAC policy
         * @description Replaces all mutable fields of a policy. Send the full desired state. A deny that would refuse its author policy writes is refused with abac.policy_locks_out, as on create.
         */
        patch: operations["updateAbacPolicy"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/abac/policies/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List ABAC policy versions
         * @description Returns the policy's saves, newest first (the last 1,000; truncated when there are more): each whole, as it left the policy, with who made it (saved_by, null for a machine caller) and when. A policy from before versions were kept starts with its state then as version 1. Restore one with the restore call. Requires policy.read.
         */
        get: operations["listAbacPolicyVersions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/abac/policies/{id}/versions/{version}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore an ABAC policy version
         * @description Saves one of the policy's earlier versions as its next one, checked as any change is: a version whose name another policy has taken answers 409 abac.policy_name_exists, and one that would lock the caller out 422 abac.policy_locks_out. Returns the policy. Audited as abac_policy.restored, naming the version restored; webhooks receive abac_policy.updated. Requires policy.write. Needs a recent step-up.
         */
        post: operations["restoreAbacPolicyVersion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List an organization's access requests
         * @description The organization's requests for a role, newest first, optionally of one status, with how many are waiting. Needs role.read.
         */
        get: operations["listAccessRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access-requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an access request
         * @description One of the organization's requests: who asked, for which role and how long, why, and its answer. Needs role.read.
         */
        get: operations["getAccessRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access-requests/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve an access request
         * @description Gives the requester the role, for the duration they asked (access_ends_at; it's taken back then) or for good, with an optional note they see. Needs role.write and a recent step-up, and is held to the rule for giving the role directly (403 rbac.grant_exceeds_caller or rbac.owner_only); a first role takes a seat (402 billing.plan_limit). Nobody answers their own request (403 access_request.own). A request no longer waiting answers 409 access_request.closed. A role the requester meanwhile holds directly is left as it is, and never taken back by the request.
         */
        post: operations["approveAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access-requests/{id}/deny": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deny an access request
         * @description Refuses the request with a note the requester sees (required: 422 access_request.note_required without it). Needs role.write. Nobody answers their own request (403 access_request.own); one no longer waiting answers 409 access_request.closed.
         */
        post: operations["denyAccessRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access/v1/evaluation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AuthZEN evaluation
         * @description OpenID AuthZEN core PDP evaluation request, answered by the same composed decision as the permission and relation checks (an ABAC deny refuses; then roles, relationships and ABAC allow policies are a union). When resource.type is "permission", action.name is the permission key; otherwise resource becomes "type:id" and action.name the relation. The response context always carries decided_by. ABAC policies see the request's properties, subject.properties as subject.*, resource.properties as resource.*, action.properties as action.*, and context (but for explain) as context.*. What the platform knows of the subject (id, type, organization_id, and for a person, groups and roles) wins over a property of the same name, as resource.type and resource.id and action.name win over theirs. A relationship check expands at most 1,000 distinct object#relation pairs, and a request's checks together read at most 5,000 relationship sets; past either it is refused with 422 rebac.check_too_complex.
         */
        post: operations["evaluateAccess"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/access/v1/evaluations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * AuthZEN evaluations
         * @description OpenID AuthZEN access evaluations: several evaluations in one call, each answered as the single evaluation endpoint answers one. The top-level subject, resource, action and context are defaults; an evaluation that names one of them replaces it whole. Decisions come back in the request's order. options.evaluations_semantic is execute_all (the default), deny_on_first_deny, which stops after the first deny, or permit_on_first_permit, which stops after the first permit; the response then holds the evaluations up to that one. An evaluation the caller got wrong, such as one without a subject id, is denied with context.error {status, code, message} and counts as a deny. At most 100 evaluations (more is 422 authzen.too_many_evaluations); an unknown semantic is 422 authzen.evaluations_semantic_invalid. Without evaluations, the request is a single evaluation and the response is a single decision. Each relationship check expands at most 1,000 distinct object#relation pairs, and the request's checks together read at most 5,000 relationship sets: an evaluation past either is denied with context.error rebac.check_too_complex (422). Requires role.read.
         */
        post: operations["evaluateAccessBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/auth-policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get auth policy
         * @description The organization's authentication policy (defaults when none is stored), including its sign-in lockout settings and, read-only, the platform defaults and bounds for them.
         */
        get: operations["getAuthPolicy"];
        /**
         * Update auth policy
         * @description Replaces the organization's authentication policy. The sign-in lockout settings apply to the next sign-in attempt with no deployment. A lockout setting outside the documented bounds (`lockout_limits.min`..`lockout_limits.max`) is refused with 422 validation_failed, naming each field (code out_of_range), and nothing is stored. The password minimum length (8..128) and magic-link lifetime (5..1440 minutes) are clamped. Refused with 422 validation_failed, storing nothing, when the change would switch off every sign-in method (password, passkey and magic link; field password_enabled, code no_sign_in_method) or switch on otp_email_enabled / otp_sms_enabled (code not_available — no one-time-code sign-in exists). Changes apply to the next sign-in; the policy is not cached. Every sign-in method may be switched off only while the organization has an active SAML, LDAP or OpenID Connect connection to sign in through (a draft or disabled one does not count); its members then sign in with single sign-on alone, break-glass members included.
         */
        put: operations["setAuthPolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/auth-policy/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * How the organization's people sign in
         * @description Counts of the organization's live accounts by way of signing in: with a password, with a passkey, and per social provider it set up (linked accounts); for each, only is how many have no other way in (no other credential and no linked identity), so would be left out were it turned off. Magic links and email codes aren't counted as a way in; magic_link_enabled says whether they are one. Needs policy.read.
         */
        get: operations["getSignInMethodUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/authorization/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List access decisions
         * @description The access decisions the organization asked of GET /v1/check (source check), the relationship check (relation_check), AuthZEN evaluation and evaluations (authzen) and ABAC evaluate (abac_evaluate, or abac_draft with an unsaved policy), newest first, a page at a time: who asked (caller_type, caller_id and, for an application's token, caller_client), about which subject, resource and action, the answer, and the model, rule and reason that decided it. Decisions the platform makes guarding its own routes are not kept. They are kept for 30 days and written within a second or so of being answered; at a surge too great to keep up with, some may not be kept. Requires policy.read, since rule names the ABAC policy that decided.
         */
        get: operations["listAccessDecisions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/groups/{groupID}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List group roles
         * @description Lists the roles granted to a group within the organization; every member of the group inherits these roles' permissions. Use it to review a group's authorization before changing it. Grant a role with the grant-role-to-group call and remove one with the revoke-role-from-group call.
         */
        get: operations["listGroupRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/groups/{groupID}/roles/{roleID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Grant role to group
         * @description Grant a role to a group. Every member of the group inherits the role's permissions (effective permissions = direct user grants UNION group-derived grants). The role and group must belong to the organization. The caller must hold every permission the role carries in this organization (403 rbac.grant_exceeds_caller, naming one it lacks), and only an owner gives the owner role (403 rbac.owner_only); an owner may give any role. A member holding no role until now takes a seat; when that leaves more seats in use than the plan has, nothing is granted (402 billing.plan_limit, metadata resource seats).
         */
        post: operations["grantGroupRole"];
        /**
         * Revoke role from group
         * @description Revokes a role from a group within the organization; members lose the role's group-derived permissions as soon as this returns, though direct user grants of the same role are unaffected. This is the counterpart to the grant-role-to-group call, and is held to the same rule: only an owner takes the owner role off a group (403 rbac.owner_only), and nobody takes off a role carrying a permission they lack (403 rbac.grant_exceeds_caller). Review the group's remaining roles with the list-group-roles call.
         */
        delete: operations["revokeGroupRole"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ip-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List rules + enforcement
         * @description Lists the organization's address rules and whether they are enforced. Requires policy.read.
         */
        get: operations["listIpRules"];
        put?: never;
        /**
         * Add rule
         * @description Adds an allow or deny rule for an address range (CIDR). Deny rules win over allow rules. Requires policy.write.
         */
        post: operations["createIpRule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ip-rules/{ruleID}": {
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
         * Delete rule
         * @description Deletes one of the organization's address rules. Requires policy.write.
         */
        delete: operations["deleteIpRule"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ip-rules/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check an address
         * @description Says what the address rules make of an address ({"ip": "…"}): enabled, allowed, and the reason. The same decision every sign-in gets while the rules are on; an address that can't be read is refused.
         */
        post: operations["checkIpAddress"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ip-rules/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set enforcement
         * @description Turns the organization's address rules on or off ({"enabled": bool}). While they are on, every sign-in to the organization (password, passkey, magic link, social, SAML, LDAP, invitation, organization switch, application authorization, device approval and the device's token collection) and every session renewal asks them first. An address is refused when a deny rule matches it, or when allow rules exist and none matches; deny wins. An address that can't be read is refused. A refusal answers 403 auth.address_not_allowed (access_denied to an application), names no rule, and is audited as auth.address_refused with the rule responsible, the address and the path. Off, nothing is checked. Switching them on is refused with 409 risk.rules_lock_out_caller when they would refuse the address the request comes from (as are adding or removing a rule while they are on, when the result would), so an admin can't lock themselves out; the console calls from its own server, so its address must stay allowed. Switching them off always works.
         */
        put: operations["setIpRuleEnforcement"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/policy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get policy
         * @description The organization's security policy. An organization that has not saved one reads the platform defaults.
         */
        get: operations["getSecurityPolicy"];
        /**
         * Update policy
         * @description Replaces the organization's security policy. Session bounds apply to sessions and application grants started afterwards. A value out of range is refused with 422 validation_failed naming the field. The policy holds no IP lists: which addresses may sign in is the address rules (/v1/organizations/{organizationID}/ip-rules). ip_allowlist and ip_denylist are still accepted empty, for older consoles; entries are refused with 422 validation_failed, code retired.
         */
        put: operations["setSecurityPolicy"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change part of the policy
         * @description Changes only the fields sent, over the stored policy, and keeps the rest; the read, the change and the write happen under the policy's lock, so a rule saved meanwhile is kept (PUT takes the same lock). Validation, auditing (security_policy.updated) and the step-up are as for PUT.
         */
        patch: operations["updateSecurityPolicy"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List relation tuples
         * @description List tuples anchored on one side of the relationship. Supply exactly one of:
         *     - **object** — all tuples where this is the object ("type:id"); returns who has a relation on it.
         *     - **subject** — all tuples where this is the subject ("type:id" or "type:id#relation"); reverse-lookup of what a principal can reach.
         */
        get: operations["listRelationTuples"];
        put?: never;
        /**
         * Write relation tuple
         * @description Writes a relationship tuple asserting that a subject holds a named relation on an object, the building block of the ReBAC graph. The subject may be a direct principal or a userset reference (type:id#relation) so relationships can be composed. Test the effect of a tuple with the relation-check call and remove it with the delete-tuple call.
         */
        post: operations["writeRelationTuple"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples/{id}": {
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
         * Delete relation tuple
         * @description Removes a relationship tuple by its identifier, severing that edge in the ReBAC graph. Any access that depended solely on this tuple is revoked as soon as this returns, so re-verify affected grants with the relation-check call. This is the counterpart to the write-tuple call.
         */
        delete: operations["deleteRelationTuple"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check relation
         * @description Evaluates whether a user holds a relation on an object, composing every model: an ABAC deny policy for the object's type with the relation as action refuses and stops; otherwise a relationship tuple (following userset references transitively), a role granting type:relation or type.relation, or an ABAC allow policy permits. A role grant counts without a tuple. An engine error refuses. The response names the deciding model and rule in decided_by; pass explain=true to also receive the chain of tuples that granted access and the decision's trace. A check expands at most 1,000 distinct object#relation pairs, and the check with its explanation reads at most 5,000 relationship sets; past either it is refused with 422 rebac.check_too_complex. This is a read-only decision; author the underlying tuples with the write-tuple call.
         */
        post: operations["checkRelation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples/graph": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Expand identity graph
         * @description Builds a node+edge graph of all subject identities reachable from a
         *     given object+relation, up to `depth` hops. Answers the question:
         *     "who/what can reach this resource, and through which chain of
         *     relationships?"
         *
         *     Each **node** is a `"type:id"` identity (user, group, agent, document,
         *     or any other modeled entity). Each **edge** is a named relation between
         *     two nodes, following userset references recursively. The result is
         *     suitable for graph visualization (e.g. a security-posture or privilege-path
         *     view) or as input to further investigation queries.
         *
         *     A graph that would read more than 5,000 object and relation pairs is
         *     refused with 422 rebac.check_too_complex: narrow the root or the depth.
         *
         *     This is the ReBAC analogue of a privilege-path graph: it is explicit about
         *     the boundaries of what Qeet ID's own relation-tuple store covers (only
         *     tuples modeled here, not external RBAC or cloud IAM), and never
         *     over-claims coverage.
         */
        get: operations["expandRelationGraph"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples/objects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List relationship objects
         * @description Lists, a page at a time by id, the objects of one type the organization's relationship tuples name, each with how many tuples it has; next_cursor fetches the next page and total counts them all. Requires role.read.
         */
        get: operations["listRelationObjects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/relation-tuples/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List relationship object types
         * @description Lists the types of object the organization's relationship tuples name, with how many objects of each and how many tuples. Requires role.read.
         */
        get: operations["listRelationObjectTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List roles
         * @description Lists the roles defined in the organization, including both system roles and organization-defined custom roles. Use it to populate role pickers and to review the organization's RBAC configuration. Define a new custom role with the create-role call.
         */
        get: operations["listRoles"];
        put?: never;
        /**
         * Create role
         * @description Creates a custom role in the organization from a name and description. The role starts with no permissions; attach them with the grant-permission-to-role call before putting it to use. Assign the finished role with the assign-role-to-user or grant-role-to-group calls.
         */
        post: operations["createRole"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/roles/{roleID}": {
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
         * Delete a role
         * @description Deletes a custom role. It is refused with 409 rbac.role_in_use while anyone holds it, any group is granted it, or an invitation that can still be accepted or resent offers it, with how many of each (metadata people, groups, invitations): give them another role first, since someone whose only role it is would leave the organization with it. A built-in role (owner, admin, member, viewer) can't be deleted (403 rbac.system_role_fixed), and a role of another organization answers 404. Audited as role.deleted with its name. Needs role.write and a recent sign-in (step-up).
         */
        delete: operations["deleteRole"];
        options?: never;
        head?: never;
        /**
         * Rename a role
         * @description Renames a custom role or changes its description; a field left out stays as it is. A built-in role (owner, admin, member, viewer) can't be changed (403 rbac.system_role_fixed), a name another role of the organization has is refused with 409 rbac.role_name_exists, and a role of another organization answers 404. Audited as role.updated with the old and new value of each field that changed; a request that changes nothing records nothing. Needs role.write and a recent sign-in (step-up).
         */
        patch: operations["renameRole"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/roles/{roleID}/holders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Who holds a role
         * @description One page of the people holding one of the organization's roles, by email, with whether they hold it directly and the groups they hold it through, and every group granted the role. Needs role.read. 404 for a role of another organization.
         */
        get: operations["listRoleHolders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/roles/{roleID}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set a role's permissions
         * @description Makes the listed permissions the whole of a custom role's permissions, in one transaction: the ones not listed are taken away, and the response lists the role's permissions as they now are. The caller must hold every permission added or taken away, unless they are an owner (403 rbac.grant_exceeds_caller naming the first one; nothing changes). A built-in role (owner, admin, member, viewer) can't be changed (403 rbac.system_role_fixed); a role of another organization, or a permission ID that doesn't exist, answers 404. Send [] to take every permission away. Audited as one role.permissions_set listing the permissions added and removed; a request that changes nothing records nothing. Needs role.write and a recent sign-in (step-up).
         */
        put: operations["setRolePermissions"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/anomalies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List anomalies
         * @description Lists recent login anomalies detected for the organization for review by a security operator. Each entry carries the anomaly's context and its open or resolved state. Triage counts are available from the anomaly-summary call, and an individual entry is closed with the resolve-anomaly call.
         */
        get: operations["listSecurityAnomalies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/anomalies/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve anomaly
         * @description Marks a login anomaly as resolved, recording that an operator has reviewed it and removing it from the open queue. Resolving is a review action; it does not itself block a user or revoke a session, so take any remediation separately. The updated totals are reflected by the anomaly-summary call. Audited as anomaly.resolved, naming the caller and the anomaly's type, severity and account; another organization's anomaly, or one already resolved, is 404.
         */
        post: operations["resolveSecurityAnomaly"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/anomalies/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Anomaly summary
         * @description Returns aggregate counts of login anomalies for the organization, including open, resolved, affected-user, and high-severity totals, for a dashboard overview. It summarizes the same records enumerated by the list-anomalies call. Drill into individual entries there and close them with the resolve-anomaly call.
         */
        get: operations["getSecurityAnomalySummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/bots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Bot telemetry
         * @description Returns recent automated-traffic verdicts and aggregate statistics from bot detection for the organization, for review in the security dashboard. It reports observed telemetry only and changes no configuration. Tune how detection behaves with the bot-settings calls.
         */
        get: operations["getBotTelemetry"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/bots/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get bot settings
         * @description Returns the organization's bot-detection configuration, such as whether detection is enforced and the action taken on a bot verdict. Use it to populate the settings surface before editing. Apply changes with the update-bot-settings call and review observed activity with the bot-telemetry call.
         */
        get: operations["getBotSettings"];
        /**
         * Update bot settings
         * @description Updates the organization's bot-detection configuration and applies it to subsequent authentication traffic. Retrieve the current configuration first with the get-bot-settings call, since this call replaces the stored settings with the submitted state. Review the effect afterward through the bot-telemetry call. Audited as bot.settings_updated, naming the caller, with each setting it changed (its old and new value) and the settings saved.
         */
        put: operations["setBotSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/security/risk-settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get risk settings
         * @description Returns the medium/high risk-score thresholds, the level at which step-up MFA is forced even for a trusted device, and the two additive adaptive-MFA signals layered on top: impossible-travel (a login from a new country sooner than min_travel_hours after the last one) and device reputation (a login from a browser+OS combination never seen before for this user). Both are independently toggled and off by default.
         */
        get: operations["getRiskSettings"];
        /**
         * Update risk settings
         * @description Updates the organization's adaptive-risk configuration, including the medium and high risk-score thresholds, the level at which step-up MFA is forced even for a trusted device, and the impossible-travel and device-reputation signals. Both additive signals are off by default and take effect for subsequent sign-ins once enabled. Retrieve the current values first with the get-risk-settings call, since this call replaces the stored settings with the submitted state. Audited as risk.settings_updated, naming the caller, with each setting it changed (its old and new value) and the settings saved.
         */
        put: operations["setRiskSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List passkeys
         * @description The signed-in user's passkeys, newest first, and whether they may add one. Also accepts the hosted-login session cookie (qe_ls) in place of a bearer token, so the hosted login can show a signed-in user their passkeys.
         */
        get: operations["listMyPasskeys"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys/{id}": {
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
         * Delete passkey
         * @description Deletes one of the caller's passkeys. Needs a recent step-up; with the hosted-login session cookie (qe_ls, and the CSRF token) in place of a bearer token, a sign-in within the organization's step-up window stands in for one, else 403 step_up_required. Audited as passkey.deleted (its id and name) in the audit trail of the organization the session is in, and the account holder is emailed that a passkey was removed. Removing the account's only way to sign in is refused with 409 auth.last_sign_in_method and recorded there as auth.sign_in_method_removal_refused.
         */
        delete: operations["deleteMyPasskey"];
        options?: never;
        head?: never;
        /**
         * Rename passkey
         * @description Renames one of the signed-in user's own passkeys. The name is cleaned first: control characters count as spaces, bidirectional control characters are removed, runs of spaces collapse into one and the ends are trimmed. Markup is stored as typed and must be shown as text. Another user's passkey, like an unknown id, is not found and is left unchanged. Also accepts the hosted-login session cookie (qe_ls), with the CSRF token, in place of a bearer token, as Delete passkey does. Audited as passkey.renamed, with the new and previous name, in the audit trail of the organization the session is in.
         */
        patch: operations["renameMyPasskey"];
        trace?: never;
    };
    "/v1/passkeys/login/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login begin
         * @description Begins a passkey sign-in ceremony and returns its session_id and the WebAuthn request options. Every ceremony is discoverable: the options carry no allowCredentials, and the answer is the same whether or not the email (optional; an empty body is allowed) has an account or a passkey. With an email, only a passkey of that account can finish the ceremony. The browser that begins it is given an HttpOnly binding cookie (qe_passkey, __Host- prefixed outside dev) naming the ceremony; only that browser can finish it at POST /v1/passkeys/login/session. A body not sent as JSON is refused (415 unsupported_media_type). On a domain whose organization requires single sign-on, a ceremony begun with that email is refused with 403 auth.sso_required before the address is looked up (see the SSORequired response).
         */
        post: operations["beginPasskeySignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys/login/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login finish
         * @description The token form of passkey sign-in: completes the ceremony with the assertion and returns the token pair, setting no cookie, for a caller that keeps tokens on a server (such as the console's). A browser signs in to the hosted login with POST /v1/passkeys/login/session instead, so no token pair reaches its script. A body not sent as JSON is refused (415 unsupported_media_type). When the account's organization has switched passkeys off, the sign-in is refused with 403 passkey.disabled before the assertion is verified. A refused ceremony or assertion is recorded in the organization's audit trail as auth.sign_in_failed (method passkey, reason the error code), naming the account when it was identified. A passkey of an account on a domain whose organization requires single sign-on is refused with 403 auth.sso_required (see the SSORequired response).
         */
        post: operations["finishPasskeySignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys/login/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login finish (hosted)
         * @description The hosted form of passkey sign-in: completes the ceremony with the assertion and sets the hosted-login SSO cookie (qe_ls), so the browser continues into the OAuth authorize flow, answering with the user id only: no token reaches the page's script. Only the browser that began the ceremony, holding the binding cookie from POST /v1/passkeys/login/begin, finishes it here; any other is refused with 403 passkey.browser_mismatch and the ceremony is left untouched. It is protected against cross-site requests as POST /v1/auth/session is, and a body not sent as JSON is refused (415 unsupported_media_type). When the account's organization has switched passkeys off, the sign-in is refused with 403 passkey.disabled before the assertion is verified. A refused ceremony or assertion is recorded in the organization's audit trail as auth.sign_in_failed (method passkey, reason the error code), naming the account when it was identified. A passkey of an account on a domain whose organization requires single sign-on is refused with 403 auth.sso_required, and no cookie is set (see the SSORequired response). While the account's own organization's address rules are on, an address they refuse is answered 403 auth.address_not_allowed (recorded as auth.address_refused), and no cookie is set.
         */
        post: operations["createPasskeySession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys/register/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register begin
         * @description Starts adding a passkey for the signed-in user and returns the WebAuthn creation options with a single-use ceremony id (valid five minutes, bound to this user). Also accepts the hosted-login session cookie (qe_ls) in place of a bearer token; that call, being a cookie session, needs the CSRF token (X-CSRF-Token echoing the qe_csrf cookie) and an allowed Origin. Refused with 403 passkey.disabled when the user's organization has passkeys switched off.
         */
        post: operations["beginPasskeyRegistration"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/passkeys/register/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register finish
         * @description Verifies the attestation and stores the passkey. An optional `name` is cleaned and checked as in Rename passkey (422 when too long, before the ceremony is used, so it can be finished again with a corrected name); without one the passkey is named after the enrolling browser, for example "Chrome on macOS", or "Passkey". The passkey sign-up finish calls name the passkey the same way. The passkey belongs to the signed-in user (and so to their organization); the body cannot name another. The ceremony id is single-use and only the user it was issued to can finish it: an expired or already-used one is refused (400 auth.session_expired), another user's with 400 passkey.session_mismatch. Refused with 403 passkey.disabled when the user's organization has switched passkeys off since the ceremony began. Accepts the hosted-login session cookie like Register begin, with the same CSRF requirement. The new passkey is audited as passkey.registered (its id and name) in the audit trail of the organization the session is in, and the account holder is emailed that a passkey was added.
         */
        post: operations["finishPasskeyRegistration"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List permissions
         * @description Returns the catalog of permissions defined in the system that can be granted to roles under RBAC. Use it to populate role-editing surfaces and to discover the permission keys accepted by the permission-check call. The list is a reference catalog and reflects no particular user's grants.
         */
        get: operations["listPermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/register/passkey/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Passkey-first signup begin (organization-scoped hosted signup)
         * @description Starts the passwordless counterpart to hosted organization signup, returning the WebAuthn credential-creation options for a passkey scoped to the supplied organization. It is gated by the organization's self-registration policy and is refused when self-registration is disabled. Finish the ceremony by returning the signed attestation to the organization-scoped passkey-register finish call. Where the organization has passkeys switched off, it is refused with 403 passkey.disabled before a ceremony starts. The answer here is the same whether or not the address has an account, and starting claims nothing; an address already taken, or on a domain another organization has verified (only that organization creates accounts there), is refused at the finish call with the neutral 422 unprocessable of POST /v1/auth/signup, which does not name the reason. Every attempt here takes at least the same minimum time. On a domain whose organization requires single sign-on, the ceremony is refused with 403 auth.sso_required and nothing is created (see the SSORequired response).
         */
        post: operations["beginPasskeySignUpInOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/register/passkey/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Passkey-first signup finish (organization-scoped hosted signup)
         * @description Completes passwordless hosted signup by verifying the authenticator attestation and creating the user in the ceremony's organization with the passkey as its credential. On success it sets the hosted-login SSO cookie so the browser continues into the OAuth authorize and consent flow rather than returning bearer tokens. The account is passwordless and its passkey satisfies MFA on its own. A body not sent as JSON is refused (415 unsupported_media_type). A ceremony finished after the organization switched passkeys off is refused with 403 passkey.disabled and nothing is created. An address already taken, or on a domain another organization has verified, is refused with the neutral 422 unprocessable of POST /v1/auth/signup, which does not name the reason, and nothing is created.
         */
        post: operations["finishPasskeySignUpInOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/roles/{roleID}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List permissions granted to a role
         * @description Lists the permissions currently granted to a role, resolving what any holder of that role can do. Use it to review a role before changing its grants. Add a permission with the grant-permission-to-role call and remove one with the revoke-permission-from-role call, or set them all at once with PUT /v1/organizations/{organizationID}/roles/{roleID}/permissions.
         */
        get: operations["listRolePermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/roles/{roleID}/permissions/{permID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Grant permission to role
         * @description Grants a permission to a role, so every current and future holder of the role gains it through their effective permissions. The role and permission must both exist, and the grant is idempotent. Reverse it with the revoke-permission-from-role call, and inspect the role's grants with the list-role-permissions call. The caller must hold the permission in this organization, unless they are an owner (403 rbac.grant_exceeds_caller otherwise). A built-in role (owner, every permission; admin, all but organization.delete; viewer, every read but secret.read; member, none) holds what its definition says, so it can't be changed (403 rbac.system_role_fixed). Audited in the organization's audit log as role.permission_granted, naming the role, the permission (permission_id, permission) and the caller.
         */
        post: operations["grantRolePermission"];
        /**
         * Revoke permission from role
         * @description Revokes a permission from a role; holders lose it from their effective permissions as soon as this returns, unless another role still grants it. This is the counterpart to the grant-permission-to-role call. Confirm the resulting grants with the list-role-permissions call. A built-in role (owner, every permission; admin, all but organization.delete; viewer, every read but secret.read; member, none) holds what its definition says, so it can't be changed (403 rbac.system_role_fixed), and nobody takes away a permission they don't hold (403 rbac.grant_exceeds_caller). Audited in the organization's audit log as role.permission_revoked, naming the role, the permission (permission_id, permission) and the caller.
         */
        delete: operations["revokeRolePermission"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/signup/passkey/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Passkey-first signup begin (organization-less)
         * @description Starts the passwordless counterpart to email/password signup, returning the WebAuthn credential-creation options the authenticator needs to mint a passkey. No password is created and no user exists yet; the account is materialized only when the ceremony completes. Finish registration by returning the signed attestation to the passkey-signup finish call. The answer here is the same whether or not the address has an account, and starting claims nothing, so another start for the same address works; an address already taken, or on a domain an organization has verified (that organization creates its people's accounts), is refused at the finish call with the neutral 422 unprocessable of POST /v1/auth/signup, which does not name the reason. Every attempt here takes at least the same minimum time. On a domain whose organization requires single sign-on, the ceremony is refused with 403 auth.sso_required and nothing is created (see the SSORequired response).
         */
        post: operations["beginPasskeySignUp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/signup/passkey/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Passkey-first signup finish (organization-less)
         * @description Completes passwordless signup by verifying the authenticator attestation from the begin step and creating an organization-less user with the new passkey as its founding credential. On success it returns a token pair; because the passkey is first-class, the account has no password and can both authenticate and satisfy MFA with the passkey alone. As with password signup, create an organization through the Identity Management API before any organization-scoped call, and the creator becomes the organization owner. An address already taken, or on a domain an organization has verified, is refused with the neutral 422 unprocessable of POST /v1/auth/signup, which does not name the reason, and nothing is created.
         */
        post: operations["finishPasskeySignUp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{userID}/organizations/{organizationID}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Effective permissions
         * @description Returns the flattened set of permission keys a user effectively holds in a organization, combining direct role assignments with roles inherited through group membership, and in grants every grant behind them: each permission with the role granting it, held directly or through which group (one entry per role and group, so a permission granted twice appears twice). Use it to explain why a user can or cannot perform an action, complementing the single-permission decision from the permission-check call. It is read-only and reflects the grants in force at call time. Needs role.read, even for the caller's own: a person reads their own without it at GET /v1/me/permissions.
         */
        get: operations["listEffectivePermissions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{userID}/organizations/{organizationID}/roles/{roleID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign role to user
         * @description Assigns a role to a user within the organization, adding the role's permissions to that user's effective permissions. The role must belong to the organization and the user must already be a member of it, or have it as their home organization; otherwise the call answers 404 rbac.user_or_role_not_found, the same for a missing id as for another organization's. The assignment is idempotent. Reverse it with the unassign-role-from-user call, and verify the outcome with the effective-permissions call. The caller must hold every permission the role carries in this organization (403 rbac.grant_exceeds_caller, naming one it lacks), and only an owner gives the owner role (403 rbac.owner_only); an owner may give any role. A person's first role in the organization takes a seat (people holding a role, directly or through a group, plus pending invitations); when the plan's seats are all taken it is refused with 402 billing.plan_limit (metadata resource seats, limit). Another role for someone who holds one takes no seat.
         */
        post: operations["assignUserRole"];
        /**
         * Unassign role from user
         * @description Removes a directly assigned role from a user within the organization; the user loses that role's permissions unless a group still confers it. This is the counterpart to the assign-role-to-user call. Confirm the remaining grants with the effective-permissions call. Removing the owner role is refused with 409 organization.last_owner, and nothing changes, when it would leave an organization with no active owner: make someone else an owner first. Removing a role is held to the rule for giving it (403 rbac.grant_exceeds_caller, or rbac.owner_only for the owner role), and the person must not outrank the caller (403 rbac.target_is_owner / rbac.target_outranks_caller). Removing the last role of someone whose account belongs to another organization ends their membership here, so their sessions here end too (announced as session.revoked, reason removed_from_organization), as removing them from the organization does.
         */
        delete: operations["unassignUserRole"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Result of an ABAC evaluation. */
        ABACDecision: {
            /** @description True when an allow policy matched and no deny policy matched. */
            allow?: boolean;
            /** @enum {string} */
            effect?: "allow" | "deny";
            /** @description Present, true, when the request's draft policy determined the outcome. A new draft has no matched_policy_id; one standing in for a stored policy has that policy's. */
            matched_draft?: boolean;
            /**
             * Format: uuid
             * @description ID of the policy that determined the outcome, if any.
             */
            matched_policy_id?: string | null;
            /** @description Human-readable explanation of the decision. Show reason_code's meaning instead. */
            reason?: string;
            /**
             * @description Why: an allow policy matched; a deny policy matched; a deny policy applied as an attribute it compares is absent; a policy's condition failed to evaluate, so it refused (the error is logged, not returned); or no allow policy matched.
             * @enum {string}
             */
            reason_code?: "authz.allowed_by_policy" | "authz.denied_by_policy" | "authz.attribute_absent" | "authz.condition_error" | "authz.no_matching_allow";
            /** @description The policy that decided (policy_id, policy_name, priority); absent for authz.no_matching_allow. */
            reason_params?: {
                [key: string]: unknown;
            };
            /** @description Grant-path trace (present only when ?explain=true). */
            trace?: string[];
        };
        /** @description Input for an ABAC policy evaluation. Subject/resource/context carry the attribute bags. */
        ABACEvaluateRequest: {
            /** @description The action being attempted, e.g. "read"; policies see it as action.name. */
            action: string;
            /** @description Optional attributes of the action, the action namespace beside action.name (which wins over an attribute of that name), e.g. {"channel":"api"}. */
            action_attrs?: {
                [key: string]: unknown;
            } | null;
            /** @description Request-context attributes, e.g. {"ip":"1.2.3.4","hour":14}. */
            context?: {
                [key: string]: unknown;
            } | null;
            /** @description An unsaved policy to evaluate with the stored ones, writing nothing. It is checked as a save is (name may be left out); with replaces, it stands in for that stored policy. It applies only when enabled and its resource type and action match the request, so a disabled draft only takes the replaced policy out. */
            draft?: components["schemas"]["ABACPolicyCreate"] & {
                /**
                 * Format: uuid
                 * @description The stored policy the draft stands in for; one the organization doesn't have is 404.
                 */
                replaces?: string | null;
            };
            /** @description Resource attributes. */
            resource?: {
                /** @description Additional resource attributes; type and id above win over attributes of those names. */
                attrs?: {
                    [key: string]: unknown;
                };
                /** @description Resource identifier. */
                id?: string;
                /** @description Resource type, e.g. "document". */
                type?: string;
            } | null;
            /** @description Subject (caller) attributes, e.g. {"id":"user:123","department":"eng"}. */
            subject?: {
                [key: string]: unknown;
            } | null;
        };
        /** @description One ABAC policy row. */
        ABACPolicy: {
            /** @description Action matched by this policy; '*' matches any. */
            action: string;
            /** @description Recursive JSON condition tree. An empty object {} means unconditional. Logical nodes: {"all":[...]}, {"any":[...]}, {"not": node}. Comparison leaf: {"attr":"subject.dept","op":"eq","value":"eng"}. A leaf's value may instead reference another attribute, {"attr":"subject.region","op":"eq","value":{"attr":"resource.region"}}, for eq, ne, gt, gte, lt, lte, in, nin and contains (not regex, prefix, suffix or exists). The reference is exactly {"attr":"<subject|resource|action|context>.<path>"}, names an attribute other than the leaf's own, and is the whole value, never an array element. A string value is always a literal, even "resource.region". A comparison with a missing attribute (absent or null), on either side and with any operator, ne and nin included, is unknown; not of unknown is unknown, all is unknown unless a child is false, and any unknown unless a child is true. A condition left unknown fails closed: a deny policy applies (reason authz.attribute_absent) and an allow policy grants nothing. exists alone tests presence and is never unknown, so a deny meant only for requests that carry an attribute guards it with exists in an all (otherwise a deny for "*" on an attribute the platform's own route check doesn't supply refuses every request there). prefix and suffix need a non-empty string value and match only string attributes; any other value is refused with 422 abac.condition_invalid, as is contains or regex with an empty value. Two more leaves combine roles and relationships with attributes: {"role":"<name>"} holds when the subject has the role, by name, in the organization (directly or through a group), as the platform supplies subject.roles when it decides for a person itself; it is unknown when no roles are supplied. {"relation":{"relation":"viewer", "object":"document:1"}} holds when the subject (subject.id, a user) has the relationship on the object in the organization's ReBAC tuples, the object given as type:id or as an attribute reference {"attr":"resource.object"}; it is unknown with no subject id or no object. Like a missing attribute, an unknown role or relation applies a deny and grants nothing. */
            condition: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            created_at: string;
            description: string;
            /** @enum {string} */
            effect: "allow" | "deny";
            enabled: boolean;
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: uuid */
            organization_id: string;
            /** @description Higher priority is evaluated first; deny wins at any priority. */
            priority: number;
            /** @description Resource type matched by this policy; '*' matches any. */
            resource_type: string;
            /** Format: date-time */
            updated_at: string;
            /**
             * Format: uuid
             * @description The person who made the last save; null for a machine caller, or one from before it was kept.
             */
            updated_by: string | null;
            /** @description The policy's saves counted from 1; each create, change or restore adds one. */
            version: number;
        };
        ABACPolicyCreate: {
            /** @description Action to match; '*' matches any action. */
            action: string;
            /** @description Optional condition tree. Omit or send {} for unconditional. Same grammar as ABACPolicy.condition, including attribute references; a malformed condition or reference is refused with 422 abac.condition_invalid. */
            condition?: {
                [key: string]: unknown;
            };
            description?: string;
            /** @enum {string} */
            effect: "allow" | "deny";
            /**
             * @description Whether the policy is evaluated; left out, it is saved disabled.
             * @default false
             */
            enabled: boolean;
            name: string;
            /**
             * @description Higher priority policies are evaluated first.
             * @default 0
             */
            priority: number;
            /** @description Resource type to match; '*' matches any resource type. */
            resource_type: string;
        };
        /** @description A person's request for one of the organization's roles, and its answer. */
        AccessRequest: {
            /**
             * Format: date-time
             * @description For an approved, time-limited request, when the role is taken back; cleared once the role is given to the requester for good (assigned directly, by a group or the directory), so it isn't taken back then.
             */
            access_ends_at?: string;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            decided_at?: string;
            decided_by?: components["schemas"]["AccessRequestPerson"];
            decision_note?: string;
            /** @description How long the role was asked for; absent means for good. */
            duration_hours?: number;
            /**
             * Format: date-time
             * @description When it was.
             */
            ended_at?: string;
            /**
             * Format: date-time
             * @description When the request lapses if nobody answers it.
             */
            expires_at: string;
            /** Format: uuid */
            id: string;
            reason: string;
            requester: components["schemas"]["AccessRequestPerson"];
            role: components["schemas"]["AccessRequestRole"];
            /** @enum {string} */
            status: "pending" | "approved" | "denied" | "cancelled" | "expired";
        };
        AccessRequestPerson: {
            email: string;
            /** Format: uuid */
            id: string;
            name?: string;
        };
        AccessRequestRole: {
            description?: string;
            /** Format: uuid */
            id: string;
            name: string;
        };
        Anomaly: {
            /** Format: date-time */
            created_at: string;
            detail: string;
            /** Format: uuid */
            id: string;
            ip?: string;
            /** @description The detection's structured context. For a sign-in lock: reason, account, network, counter (account_network or account), failures, threshold, window_minutes, locked_until. For a throttled source: reason, network, counter (source), distinct_accounts, window_minutes, throttled_until. */
            metadata?: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            resolved_at?: string;
            /**
             * Format: uuid
             * @description The person who resolved it; absent while open.
             */
            resolved_by?: string;
            resolved_by_email?: string;
            severity: string;
            status: string;
            /** @description e.g. credential_stuffing (an account locked after repeated failed sign-ins) or password_spraying (a source network throttled for failing against many accounts). */
            type: string;
            user_email?: string;
            /** Format: uuid */
            user_id?: string;
        };
        AuthenticatorSelection: {
            authenticatorAttachment?: string;
            requireResidentKey?: boolean;
            residentKey?: string;
            userVerification?: string;
        };
        AuthPolicy: {
            /** @description How long a lock lasts. null = the platform default. Must lie within lockout_limits (default bounds 15..1440). */
            lockout_duration_minutes: number | null;
            lockout_limits: components["schemas"]["LockoutLimits"];
            /** @description Failed password sign-ins to one account from one network, each within the window of the last, that lock the account for that network. null = the platform default. Must lie within lockout_limits (default bounds 3..5): an organization may make the lockout stricter, never looser. */
            lockout_threshold: number | null;
            /** @description A failure is forgotten once this many minutes pass with no new failure. null = the platform default. Must lie within lockout_limits (default bounds 15..1440). */
            lockout_window_minutes: number | null;
            magic_link_enabled: boolean;
            magic_link_ttl_minutes: number;
            otp_email_enabled: boolean;
            otp_sms_enabled: boolean;
            passkey_enabled: boolean;
            password_enabled: boolean;
            password_min_length: number;
            password_require_number: boolean;
            password_require_symbol: boolean;
            password_require_uppercase: boolean;
            /** @description How long a device stays remembered after the sign-in that remembered it, in days (30 by default; 0 on update keeps the default). Applies to devices remembered after it is set. */
            remember_device_days: number;
            remember_device_enabled: boolean;
            self_registration_enabled: boolean;
        };
        /** @description The authentication policy PUT stores, whole: a switch left out is off, a lockout setting left out or null is the platform default, and remember_device_days left out is 30; password_min_length and magic_link_ttl_minutes are clamped to their bounds. lockout_limits is read-only and ignored. */
        AuthPolicyUpdate: {
            /** @description How long a lock lasts. null = the platform default. Must lie within lockout_limits (default bounds 15..1440). */
            lockout_duration_minutes?: number | null;
            lockout_limits?: components["schemas"]["LockoutLimits"];
            /** @description Failed password sign-ins to one account from one network, each within the window of the last, that lock the account for that network. null = the platform default. Must lie within lockout_limits (default bounds 3..5): an organization may make the lockout stricter, never looser. */
            lockout_threshold?: number | null;
            /** @description A failure is forgotten once this many minutes pass with no new failure. null = the platform default. Must lie within lockout_limits (default bounds 15..1440). */
            lockout_window_minutes?: number | null;
            magic_link_enabled?: boolean;
            magic_link_ttl_minutes?: number;
            otp_email_enabled?: boolean;
            otp_sms_enabled?: boolean;
            passkey_enabled?: boolean;
            password_enabled?: boolean;
            password_min_length?: number;
            password_require_number?: boolean;
            password_require_symbol?: boolean;
            password_require_uppercase?: boolean;
            /** @description How long a device stays remembered after the sign-in that remembered it, in days (30 by default; 0 on update keeps the default). Applies to devices remembered after it is set. */
            remember_device_days?: number;
            remember_device_enabled?: boolean;
            self_registration_enabled?: boolean;
        };
        /** @description What decided a composed authorization decision. The ABAC policy (rule, policy_id) is named only to a caller holding policy.read; anyone else sees rule "an attribute policy". */
        AuthzDecidedBy: {
            /** @enum {string} */
            model?: "organization" | "abac" | "rbac" | "rebac" | "none";
            /** Format: uuid */
            policy_id?: string;
            /**
             * @description What decided it: no organization, an engine failure (refused), a role or a relationship tuple granting it, nothing allowing it, or an ABAC policy (allowing, denying, denying as an attribute it compares is absent, or refusing as its condition failed to evaluate).
             * @enum {string}
             */
            reason_code?: "authz.no_organization" | "authz.engine_error" | "authz.role_grant" | "authz.relation_grant" | "authz.nothing_allows" | "authz.allowed_by_policy" | "authz.denied_by_policy" | "authz.attribute_absent" | "authz.condition_error";
            /** @description What reason_code names: permission for authz.role_grant; relation and object for authz.relation_grant; policy_id, policy_name and priority for an ABAC policy, shown only to a caller holding policy.read. */
            reason_params?: {
                [key: string]: unknown;
            };
            /** @description What decided it, in English. Show reason_code's meaning instead. */
            rule?: string;
        };
        AuthZENAction: {
            name?: string;
            /** @description The action's attributes for ABAC policies (action.*). */
            properties?: {
                [key: string]: unknown;
            };
        };
        AuthZENResource: {
            id?: string;
            /** @description The resource's attributes for ABAC policies (resource.*). */
            properties?: {
                [key: string]: unknown;
            };
            type?: string;
        };
        AuthZENSubject: {
            id?: string;
            /** @description The subject's attributes for ABAC policies (subject.*). */
            properties?: {
                [key: string]: unknown;
            };
            type?: string;
        };
        /** @description One link in an authorization decision's grant path: a role that confers the requested permission and how that role reaches the user. */
        AuthzGrantStep: {
            /** @description The conferring role, e.g. "role:admin". */
            granted_by: string;
            /**
             * Format: uuid
             * @description Set only when via is a group grant.
             */
            group_id?: string;
            /** @description The group's name, set only when via is a group grant. */
            group_name?: string;
            permission: string;
            /** Format: uuid */
            role_id: string;
            role_name: string;
            /** @description "direct" for a user grant, or "group:<name>" for a group-derived grant. */
            via: string;
        };
        BotEvent: {
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            ip?: string;
            /**
             * @description How that account's next sign-in from the same address, within five minutes, ended.
             * @enum {string}
             */
            outcome: "signed_in" | "failed" | "unknown";
            score: number;
            user_agent: string;
            user_email?: string;
            /**
             * Format: uuid
             * @description The account the sign-in attempt was for, when it exists.
             */
            user_id?: string;
            verdict: string;
        };
        BotSettings: {
            captcha: boolean;
            honeypot: boolean;
            score_threshold: number;
            signature: boolean;
            ua_check: boolean;
        };
        CallerPrincipal: {
            /** @example user */
            actor?: string;
            /** Format: uuid */
            organization_id?: string | null;
            scopes?: string[];
            /** Format: uuid */
            session_id?: string | null;
            /** Format: uuid */
            user_id?: string | null;
        };
        confirmEnrollInput: {
            code: string;
        };
        CredentialDescriptor: {
            id: unknown;
            transports?: string[];
            type: string;
        };
        CredentialParameter: {
            alg: number;
            type: string;
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
        /** @description A role granted to a group, with the role's name for display. */
        GroupRole: {
            /** Format: date-time */
            granted_at: string;
            name: string;
            /** Format: uuid */
            role_id: string;
        };
        /** @description The platform defaults for the lockout settings (threshold 5, window and duration 15 minutes) and the inclusive bounds an organization may choose within. The bounds run from the defaults toward stricter only: a threshold down to 3, a window and lock up to 24 hours. An organization's settings govern the lock on one network; the lock on every network (4 times the platform threshold) always uses the platform defaults. Ignored on update. */
        LockoutLimits: {
            defaults: components["schemas"]["LockoutSettings"];
            max: components["schemas"]["LockoutSettings"];
            min: components["schemas"]["LockoutSettings"];
        };
        LockoutSettings: {
            duration_minutes: number;
            threshold: number;
            window_minutes: number;
        };
        loginBeginInput: {
            email?: string | null;
        } | null;
        LoginFactor: {
            /** @description An email or SMS factor's masked address or number. */
            destination?: string;
            /**
             * Format: uuid
             * @description An email or SMS factor's id.
             */
            id?: string;
            /** @enum {string} */
            type?: "totp" | "recovery_code" | "email" | "sms" | "passkey" | "push";
        };
        loginFinishInput: {
            credential: unknown;
            /** Format: uuid */
            session_id: string;
        };
        LoginRequest: {
            /** Format: email */
            email: string;
            password: string;
        };
        /** @description A sign-in stopped before its session: the account holds a second factor, or must have one — its organization requires MFA (of everyone, or of administrators) or it is marked as requiring it. Complete it at POST /v1/auth/mfa (token sign-in) or /v1/auth/session/mfa (hosted login). Each challenge is audited as auth.mfa_challenged with its reason (enrolled, organization_required, admin_required or user_required) and how the first factor was proven (password, magic_link, social or ldap); meeting it as auth.mfa_verified. */
        MFAChallenge: {
            /**
             * Format: date-time
             * @description On an enrolment challenge in the organization's grace period: when it ends. Until then the setup may be put off (skip: true).
             */
            enrollment_due_at?: string;
            /** @description The account must have a second factor and holds none: set up an authenticator app (POST /v1/auth/mfa/enroll) and complete the challenge with a code from it. */
            enrollment_required?: boolean;
            /** @description Exactly the second factors this person can complete the challenge with — an authenticator app, recovery codes, each confirmed email or SMS factor (with its id and masked destination, for POST /v1/auth/mfa/send), passkeys while the organization allows them, and push devices. Empty for an enrolment challenge. */
            factors: components["schemas"]["LoginFactor"][];
            /** @description The distinct factor types of factors (["totp"] for an enrolment challenge). */
            methods: ("totp" | "recovery_code" | "email" | "sms" | "passkey" | "push")[];
            mfa_required: boolean;
            mfa_token: string;
        };
        OTPFactor: {
            channel: string;
            /** Format: date-time */
            created_at: string;
            destination: string;
            /** Format: uuid */
            id: string;
            verified: boolean;
        };
        /** @description An active session (id, ip, user agent, timestamps). */
        Passkey: {
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_used_at?: string | null;
            /** @description User-supplied text: show it as text, never as markup. Null for a passkey enrolled before passkeys were named by default. */
            name?: string | null;
            transports?: string[] | null;
            /** Format: uuid */
            user_id: string;
        };
        Permission: {
            description: string;
            /** Format: uuid */
            id: string;
            key: string;
        };
        PublicKeyCredentialCreationOptions: {
            attestation?: string;
            attestationFormats?: string[];
            authenticatorSelection?: components["schemas"]["AuthenticatorSelection"];
            challenge: unknown;
            excludeCredentials?: components["schemas"]["CredentialDescriptor"][];
            extensions?: unknown;
            hints?: string[];
            pubKeyCredParams?: components["schemas"]["CredentialParameter"][];
            rp: components["schemas"]["RelyingPartyEntity"];
            timeout?: number;
            user: components["schemas"]["UserEntity"];
        };
        PublicKeyCredentialRequestOptions: {
            allowCredentials?: components["schemas"]["CredentialDescriptor"][];
            challenge: unknown;
            extensions?: unknown;
            hints?: string[];
            rpId?: string;
            timeout?: number;
            userVerification?: string;
        };
        PushChallenge: {
            action: string;
            /** @description What the phone shows so the person can decide. */
            context: {
                /** @description The IP address the request came from. */
                ip?: string;
                /** @description Where the request came from, approximately, from the trusted proxy's country and city headers: "Bengaluru, India", the country alone, or absent when neither is known. */
                location?: string;
                /** @description For a step-up, the session it was raised for. */
                session_id?: string;
                /** Format: date-time */
                timestamp?: string;
                /** @description The browser's User-Agent. */
                user_agent?: string;
            };
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            status: string;
            /** Format: uuid */
            user_id: string;
        };
        PushDevice: {
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_seen_at: string;
            name: string;
            platform: string;
        };
        RecoveryStatus: {
            enrolled: boolean;
            remaining: number;
            total: number;
        };
        RefreshRequest: {
            refresh_token: string;
        };
        registerFinishInput: {
            credential: unknown;
            name: string;
            /** Format: uuid */
            session_id: string;
        };
        RelyingPartyEntity: {
            id: string;
            name: string;
        };
        RequestableRole: components["schemas"]["AccessRequestRole"] & {
            /** @description The person already holds it directly. */
            held: boolean;
        };
        RiskSettings: {
            /** @description Whether the deployment names a trusted proxy country header (GEO_COUNTRY_HEADER). Without one impossible travel never fires. Ignored on update. */
            readonly country_header_configured: boolean;
            /**
             * Format: date-time
             * @description When the instance answering last read a country from that header; null if none since it started (no header, or the proxy isn't sending it). Ignored on update.
             */
            readonly country_last_seen_at: string | null;
            /** @description Off by default. Flags a login from a browser+OS combination never seen before for this user. */
            device_reputation_enabled: boolean;
            /** @enum {string} */
            force_mfa_at_level: "medium" | "high";
            high_threshold: number;
            /** @description Off by default. Also needs a geo signal to do anything — see GEO_COUNTRY_HEADER. */
            impossible_travel_enabled: boolean;
            medium_threshold: number;
            /** @description A login from a different country than the last one, sooner than this many hours later, is flagged. */
            min_travel_hours: number;
        };
        /** @description The sign-in risk settings PUT stores. A threshold left out or below 0.1 is 0.1, force_mfa_at_level anything but medium is high, and min_travel_hours left out or not above 0 is the default. */
        RiskSettingsUpdate: {
            /** @description Whether the deployment names a trusted proxy country header (GEO_COUNTRY_HEADER). Without one impossible travel never fires. Ignored on update. */
            readonly country_header_configured?: boolean;
            /**
             * Format: date-time
             * @description When the instance answering last read a country from that header; null if none since it started (no header, or the proxy isn't sending it). Ignored on update.
             */
            readonly country_last_seen_at?: string | null;
            /** @description Off by default. Flags a login from a browser+OS combination never seen before for this user. */
            device_reputation_enabled?: boolean;
            /** @enum {string} */
            force_mfa_at_level?: "medium" | "high";
            high_threshold?: number;
            /** @description Off by default. Also needs a geo signal to do anything — see GEO_COUNTRY_HEADER. */
            impossible_travel_enabled?: boolean;
            medium_threshold?: number;
            /** @description A login from a different country than the last one, sooner than this many hours later, is flagged. */
            min_travel_hours?: number;
        };
        Role: {
            /** Format: date-time */
            created_at: string;
            description: string;
            /** @description Who holds the role, in the roles list only. */
            holders?: {
                /** @description Groups granted the role. */
                groups: number;
                /** @description People granted the role themselves. */
                people_direct: number;
                /** @description People holding it only through a group. */
                people_through_groups: number;
            };
            /** Format: uuid */
            id: string;
            /** @description A built-in role (owner, admin, member or viewer), whose permissions can't be changed and which doesn't count against the plan's custom roles. */
            is_system: boolean;
            name: string;
            /** Format: uuid */
            organization_id: string;
        };
        RoleCreate: {
            description?: string | null;
            name: string;
        };
        RoleUpdate: {
            description?: string | null;
            name?: string | null;
        };
        Rule: {
            action: string;
            cidr: string;
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            id: string;
            label: string;
            /** Format: uuid */
            organization_id: string;
        };
        SecurityPolicy: {
            /** @description How many live sessions one person may hold in the organization at once; null for no limit (the default). Counted and enforced as a session opens, so simultaneous sign-ins cannot exceed it. */
            max_sessions: number | null;
            /**
             * Format: date-time
             * @description When the requirement was turned on (from optional); null while optional. Moving between required and admin_only keeps it.
             */
            readonly mfa_enforced_since: string | null;
            /**
             * @description Who must use a second factor to sign in, enforced at password sign-in: optional (only people who set one up are challenged), required (everyone), admin_only (anyone holding a role, directly or through a group, that grants an administrative permission: one that changes who signs in or with what authority, such as user.write, user.credentials, user.suspend, session.revoke, member.invite or role.write, the same administrators single sign-on never adopts by address). Separately, an account an administrator marks as requiring MFA must, whatever is set here. An account that must and holds no factor sets up an authenticator app before any session is issued.
             * @enum {string}
             */
            mfa_enforcement: "optional" | "required" | "admin_only";
            /** @description For this many days after the requirement is turned on, the accounts that already existed may put setting up a second factor off (they are prompted at each sign-in). 0, the default: no grace period. */
            mfa_grace_days: number;
            /** Format: uuid */
            organization_id: string;
            /**
             * @description How long a session may go without being renewed before it ends: a duration of at least 15m and no longer than session_max_age. Applies to sessions started after it is saved. Omitted or zero on update: the platform default (no longer than session_max_age).
             * @example 24h
             */
            session_idle_timeout: string;
            /**
             * @description What a sign-in at max_sessions does: evict_oldest ends the person's least recently used session (renewal stops at once; an access token it already issued lasts out its own lifetime, ACCESS_TOKEN_TTL), announced to session.revoked subscribers as session_limit; refuse refuses the sign-in with 403 auth.session_limit. Both are audited.
             * @enum {string}
             */
            session_limit_action: "evict_oldest" | "refuse";
            /**
             * @description How long a session lasts after sign-in however active it is, and an application's grant however often it is renewed: a duration such as "720h" or "90m", between 1h and 8760h. Applies to sessions and grants started after it is saved. Omitted or zero on update: the platform default.
             * @example 720h
             */
            session_max_age: string;
            settings: {
                [key: string]: unknown;
            };
            /** @description The factor types that count as a step-up (otp: an emailed or text-message code; webauthn: a passkey). Null or empty: every one. A session stepped up by a factor that is not listed is asked again. */
            step_up_methods: ("totp" | "recovery_code" | "otp" | "webauthn" | "push")[] | null;
            /**
             * @description How long a step-up keeps a session's sensitive actions unlocked: a duration between 1m and 60m. A step-up belongs to the session that earned it; it ends with that session, and a changed password or an administrative factor reset clears it. Omitted or zero on update: 5m.
             * @example 5m
             */
            step_up_window: string;
        };
        /** @description The security policy as PUT replaces it and PATCH changes it: PUT takes the whole policy, PATCH only the fields to change. */
        SecurityPolicyUpdate: {
            /**
             * @deprecated
             * @description Retired: accepted only empty, for older consoles; an entry is refused with 422 validation_failed, code retired. Which addresses may sign in is the address rules' (/v1/organizations/{organizationID}/ip-rules).
             */
            ip_allowlist?: string[];
            /**
             * @deprecated
             * @description Retired, as ip_allowlist.
             */
            ip_denylist?: string[];
            /** @description How many live sessions one person may hold in the organization at once; null for no limit (the default). Counted and enforced as a session opens, so simultaneous sign-ins cannot exceed it. */
            max_sessions?: number | null;
            /**
             * Format: date-time
             * @description When the requirement was turned on (from optional); null while optional. Moving between required and admin_only keeps it.
             */
            readonly mfa_enforced_since?: string | null;
            /**
             * @description Who must use a second factor to sign in, enforced at password sign-in: optional (only people who set one up are challenged), required (everyone), admin_only (anyone holding a role, directly or through a group, that grants an administrative permission: one that changes who signs in or with what authority, such as user.write, user.credentials, user.suspend, session.revoke, member.invite or role.write, the same administrators single sign-on never adopts by address). Separately, an account an administrator marks as requiring MFA must, whatever is set here. An account that must and holds no factor sets up an authenticator app before any session is issued.
             * @enum {string}
             */
            mfa_enforcement?: "optional" | "required" | "admin_only";
            /** @description For this many days after the requirement is turned on, the accounts that already existed may put setting up a second factor off (they are prompted at each sign-in). 0, the default: no grace period. */
            mfa_grace_days?: number;
            /** Format: uuid */
            organization_id?: string;
            /**
             * @deprecated
             * @description Accepted and ignored, and never returned; see password_min_length.
             */
            password_complexity?: string;
            /**
             * @deprecated
             * @description Accepted and ignored, and never returned. Password rules are the auth policy's (AuthPolicy, PUT /v1/organizations/{organizationID}/auth-policy), which sign-in and the compliance checks apply.
             */
            password_min_length?: number;
            /**
             * @description How long a session may go without being renewed before it ends: a duration of at least 15m and no longer than session_max_age. Applies to sessions started after it is saved. Omitted or zero on update: the platform default (no longer than session_max_age).
             * @example 24h
             */
            session_idle_timeout?: string;
            /**
             * @description What a sign-in at max_sessions does: evict_oldest ends the person's least recently used session (renewal stops at once; an access token it already issued lasts out its own lifetime, ACCESS_TOKEN_TTL), announced to session.revoked subscribers as session_limit; refuse refuses the sign-in with 403 auth.session_limit. Both are audited.
             * @enum {string}
             */
            session_limit_action?: "evict_oldest" | "refuse";
            /**
             * @description How long a session lasts after sign-in however active it is, and an application's grant however often it is renewed: a duration such as "720h" or "90m", between 1h and 8760h. Applies to sessions and grants started after it is saved. Omitted or zero on update: the platform default.
             * @example 720h
             */
            session_max_age?: string;
            settings?: {
                [key: string]: unknown;
            };
            /** @description The factor types that count as a step-up (otp: an emailed or text-message code; webauthn: a passkey). Null or empty: every one. A session stepped up by a factor that is not listed is asked again. */
            step_up_methods?: ("totp" | "recovery_code" | "otp" | "webauthn" | "push")[] | null;
            /**
             * @description How long a step-up keeps a session's sensitive actions unlocked: a duration between 1m and 60m. A step-up belongs to the session that earned it; it ends with that session, and a changed password or an administrative factor reset clears it. Omitted or zero on update: 5m.
             * @example 5m
             */
            step_up_window?: string;
        };
        Session: {
            /** @description The city the session was opened from, when the proxy names one (GEO_CITY_HEADER); omitted otherwise. */
            city?: string;
            /**
             * @description Where the session was opened, approximately — the ISO 3166-1 alpha-2 country a trusted upstream proxy reported (GEO_COUNTRY_HEADER). Omitted when the deployment supplies none.
             * @example IN
             */
            country?: string;
            /** Format: date-time */
            created_at?: string;
            /** @description True for the session the listing request was made with. */
            current?: boolean;
            /**
             * @description The device and browser in words, read from the user agent on the server ("Unknown device" when it says nothing recognisable). Show this; user_agent stays for support.
             * @example Chrome on macOS
             */
            device?: string;
            /** @enum {string} */
            device_kind?: "desktop" | "mobile" | "tablet" | "unknown";
            /**
             * Format: date-time
             * @description When the session ends however active it is.
             */
            expires_at?: string;
            /** Format: uuid */
            id?: string;
            /**
             * Format: date-time
             * @description When the session ends unless renewed first (never after expires_at).
             */
            idle_expires_at?: string;
            ip?: string | null;
            /**
             * Format: date-time
             * @description The session's last renewal, from which its idle timeout counts.
             */
            last_seen_at?: string;
            /** Format: uuid */
            organization_id?: string;
            /** Format: date-time */
            revoked_at?: string | null;
            /**
             * @description active, revoked (ended by sign-out or revocation) or expired (reached its maximum age or idle timeout first). Only active sessions can be revoked.
             * @enum {string}
             */
            status?: "active" | "revoked" | "expired";
            user_agent?: string | null;
            /** Format: uuid */
            user_id?: string;
        } & {
            [key: string]: unknown;
        };
        SessionRequest: {
            /** @description The OAuth client the hosted login is serving. Its organization's sign-in lockout settings apply where they are stricter than the platform defaults, never looser, to the lock on the network the attempt comes from; the lock on every network always uses the platform defaults. Omitted or unknown = the platform defaults. The account's own organization may still refuse password sign-in after the password is verified (403 auth.method_disabled). */
            client_id?: string | null;
            /** Format: email */
            email: string;
            password: string;
        };
        SignupRequest: {
            display_name?: string | null;
            /** Format: email */
            email: string;
            password: string;
        };
        SignupResponse: {
            access_token: string;
            /** Format: date-time */
            expires_at: string;
            refresh_token: string;
            /** Format: uuid */
            session_id: string;
            /** @example Bearer */
            token_type: string;
            /** @description The new account. It belongs to no organization yet, so its organization_id is the nil UUID (all zeros) until it creates or joins one. */
            user: components["schemas"]["User"];
            /** Format: uuid */
            user_id: string;
        };
        Stats: {
            blocked_24h: number;
            challenged_24h: number;
            threshold: number;
        };
        ThreatSummary: {
            /** @description Distinct accounts of the organization with an open event, counting the account an event names and every account a password spray targeted (a password_spraying event lists them in metadata.targeted_user_ids, only the organization's own). */
            affected_accounts: number;
            high_severity_24h: number;
            open: number;
            resolved_24h: number;
        };
        TokenPair: {
            access_token: string;
            /** Format: date-time */
            expires_at: string;
            /**
             * Format: date-time
             * @description When the session ends unless it is renewed before then: the organization's idle timeout from this sign-in or renewal, never after session_expires_at. Clients can warn the user ahead of either time; the server refuses a renewal after them with 401 auth.session_timed_out whatever the client does.
             */
            idle_expires_at: string;
            /**
             * Format: uuid
             * @description The organization the token is scoped to; absent for a session that belongs to no organization.
             */
            organization_id?: string;
            refresh_token: string;
            /**
             * Format: date-time
             * @description When the session ends however active it is: the organization's maximum session age from sign-in (the platform default where it sets none). Switching organization never moves it later.
             */
            session_expires_at: string;
            /** Format: uuid */
            session_id: string;
            /** @example Bearer */
            token_type: string;
            /** Format: uuid */
            user_id: string;
        };
        /** @description Present, and true, when the list was cut at its limit (1,000 items unless the operation says otherwise): there are more than were answered. */
        Truncated: boolean;
        Tuple: {
            /** Format: uuid */
            id: string;
            object: string;
            relation: string;
            subject: string;
            /** @description A user subject's person, by display name or address, when they belong to the organization. */
            subject_name?: string;
        };
        User: {
            /** @description The same roles with their IDs. */
            assigned_roles?: {
                /** Format: uuid */
                id?: string;
                name?: string;
            }[];
            /** @description The person's picture as a data:image/ URL, or null for none. */
            avatar_url: string | null;
            /** Format: date-time */
            created_at: string;
            /**
             * Format: date-time
             * @description When someone since deleted was, on a members list that asked to include them (include_deleted); absent for everyone else.
             */
            deleted_at?: string;
            display_name: string | null;
            /** Format: email */
            email: string;
            /** Format: date-time */
            email_verified_at: string | null;
            /** @description Number of groups the user belongs to in this organization; on the list and GET /v1/users/{id}. */
            groups_count?: number;
            /** @description The name of the organization that manages the account (organization_id). */
            home_organization_name?: string | null;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description Their most recent session activity or sign-in in this organization, or null; on the list and GET /v1/users/{id}.
             */
            last_seen_at?: string | null;
            /** @description The address of that session or sign-in, or null. */
            last_seen_ip?: string | null;
            metadata: {
                [key: string]: unknown;
            } | null;
            /** @description True if the user has a confirmed TOTP, a verified OTP factor, or a push device; on the list and GET /v1/users/{id}. */
            mfa_enabled?: boolean;
            /** Format: uuid */
            organization_id: string;
            phone: string | null;
            /** Format: date-time */
            phone_verified_at: string | null;
            /** @description Role names in the organization reading the user, on the list and GET /v1/users/{id}. */
            roles?: string[];
            /**
             * @description deleted only for someone since deleted, on a members list that asked to include them (include_deleted).
             * @enum {string}
             */
            status: "active" | "invited" | "suspended" | "deleted";
            /** @description On GET /v1/users/{id}, for a suspended person whose home is this organization; absent otherwise. */
            suspension?: {
                reason?: string;
                source?: string;
                /** Format: date-time */
                suspended_at?: string | null;
                /**
                 * Format: uuid
                 * @description The person who last suspended them by hand; null for a suspension by policy or provisioning.
                 */
                suspended_by?: string | null;
                suspended_by_email?: string | null;
            } | null;
            /** Format: date-time */
            updated_at: string;
        };
        UserEntity: {
            displayName: string;
            id: unknown;
            name: string;
        };
        verifyInput: {
            code: string;
        };
        webauthnVerifyInput: {
            credential: unknown;
            /** Format: uuid */
            session_id: string;
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
        /** @description The attempt was refused and not counted, the same answer whatever the password and whether the address has an account. Either the sign-in lockout could not be evaluated, its counters could not be read or written (`auth.sign_in_unavailable`, retryable), or the server is too busy to check a password now (`server.overloaded`, retryable, with Retry-After). */
        SignInUnavailable: {
            headers: {
                /** @description With `server.overloaded`, seconds to wait before trying again (1 to 3), also sent as `metadata.retry_after`. */
                "Retry-After"?: number;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description The address must sign in through its organization's identity provider (`auth.sso_required`): its domain is managed by an organization (the domain it verified, or the closest verified domain above it) that has switched sso_enabled on for that domain and has an active SAML, LDAP or OpenID Connect connection. Decided from the domain before any account is looked up, so every address on the domain gets this answer whether or not it has an account; only the organization's break-glass members, and its administrators single sign-on can't sign in (an administrator isn't adopted by address, so one without an identity linked to an active connection keeps their own methods), are let through. error.metadata.connections lists the organization's active connections to sign in with, each {id, protocol: saml | ldap | oidc, name}: start SAML at GET /v1/saml/login/{id}, LDAP at POST /ldap/{id}/authenticate, OpenID Connect at GET /v1/oidc-connections/{id}/login. */
        SSORequired: {
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
        /** @description The body was not sent as JSON (`unsupported_media_type`). Routes that sign a browser in accept only an application/json body, which a page on another site cannot make the browser post. */
        UnsupportedMediaType: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: {
        /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
        OrganizationID: string;
    };
    requestBodies: never;
    headers: {
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
    requestPasswordReset: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Where the reset was requested from. `hosted_login` makes the emailed link open the hosted login's own reset page. `console`, any other value, or omitting it opens the console's reset screen (the default). */
                    app?: string | null;
                    /** Format: email */
                    email: string;
                    /** @description Accepted for compatibility with clients that send it, and not used: an email address is unique across the platform. */
                    organization_id?: string | null;
                    /** @description Hosted login only: where to continue after the reset, carried in the emailed link. Kept only if it is this API's `/oauth/authorize` endpoint; anything else is ignored. */
                    return_to?: string | null;
                };
            };
        };
        responses: {
            /** @description Accepted (always, to avoid account enumeration); returns a neutral confirmation message */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "ada@example.com",
                 *       "password": "corr3ct-h0rse-battery"
                 *     }
                 */
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /**
             * @description Either a full token pair (no MFA) or an MFA challenge to complete at
             *     POST /v1/auth/mfa — when the user holds a second factor, or must have
             *     one (see MFAChallenge).
             */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"] | components["schemas"]["MFAChallenge"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["SignInUnavailable"];
        };
    };
    signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed out */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    consumeMagicLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                };
            };
        };
        responses: {
            /** @description A token pair, or an MFA challenge to complete at POST /v1/auth/mfa */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"] | components["schemas"]["MFAChallenge"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resendMagicLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                };
            };
        };
        responses: {
            /** @description A neutral confirmation message */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createMagicLinkSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                };
            };
        };
        responses: {
            /** @description Signed in to the hosted login (the cookie is set), or an MFA challenge to complete first */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        return_to?: string;
                        /** Format: uuid */
                        user_id: string;
                    } | (components["schemas"]["MFAChallenge"] & {
                        return_to?: string;
                    });
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    sendMagicLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description hosted_login opens the link in the hosted login; omitted for the console. */
                    app?: string | null;
                    /** Format: email */
                    email: string;
                    /**
                     * Format: uuid
                     * @description The organization whose sign-in page asks; omitted from the console. It brands the email and sees the request only for its own members; it never changes the account's own rules.
                     */
                    organization_id?: string | null;
                    /** @description Hosted login only — where the sign-in journey continues. */
                    return_to?: string | null;
                };
            };
        };
        responses: {
            /** @description Accepted (always, to avoid account enumeration); returns a neutral confirmation message */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getCurrentPrincipal: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current principal */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CallerPrincipal"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeSignInMfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "mfa_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJwdXJwb3NlIjoibWZhIn0.FAKE-signature",
                 *       "code": "492817"
                 *     }
                 */
                "application/json": {
                    /** @description An authenticator-app code, a one-time recovery code, or a code sent to an email or SMS factor (POST /v1/auth/mfa/send). */
                    code?: string;
                    mfa_token: string;
                    /** @description An assertion from the passkey ceremony begun for this challenge (POST /v1/auth/mfa/passkey/begin). */
                    passkey?: {
                        credential?: {
                            [key: string]: unknown;
                        };
                        /** Format: uuid */
                        session_id?: string;
                    };
                    /** @description true to complete with the push request sent for this challenge (POST /v1/auth/mfa/push). Answers 409 mfa.push_pending — not counted as a failed attempt — until it is approved on the device; a denied request counts as a wrong answer, an expired one answers mfa.push_challenge_expired. */
                    push?: boolean;
                    /** @description true to put off setting up a second factor, for an enrolment challenge that carries enrollment_due_at; a session is issued without one. Refused with 403 mfa.enrollment_required once the grace period has ended. Not counted as an attempt. */
                    skip?: boolean;
                };
            };
        };
        responses: {
            /** @description Second factor verified (or, for an enrolment challenge, set up or put off); token pair issued, with recovery_codes when an authenticator app was just set up. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJzdWIiOiIwMThmMmE3MCJ9.FAKE-signature",
                     *       "token_type": "Bearer",
                     *       "expires_at": "2026-09-24T10:30:00Z",
                     *       "refresh_token": "Jk3vQm9xT2pL0sWc8hYbR4nZaE6uFi1oPq7dGt5yHw0",
                     *       "session_expires_at": "2026-10-24T10:15:00Z",
                     *       "idle_expires_at": "2026-10-01T10:15:00Z",
                     *       "session_id": "018f2a70-5b6c-7d8e-9f01-2a3b4c5d6e7f",
                     *       "user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00"
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPair"] & {
                        recovery_codes?: string[];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    enrollSignInTotp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    mfa_token: string;
                };
            };
        };
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
                        provisioning_url: string;
                        secret: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    beginSignInMfaPasskey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    mfa_token: string;
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
                        publicKey: {
                            [key: string]: unknown;
                        };
                        /** Format: uuid */
                        session_id: string;
                    };
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
    sendSignInMfaPush: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    mfa_token: string;
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
                        /** Format: date-time */
                        expires_at?: string;
                        /** @description Show it on the sign-in screen; the phone sends it back to approve. */
                        number?: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            /** @description The request reached none of the person's phones (mfa.push_delivery_failed) */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    sendSignInMfaCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    factor_id?: string | null;
                    mfa_token: string;
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
                        sent?: boolean;
                    };
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
    getMyPasswordStatus: {
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
                        has_password: boolean;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setMyPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    current_password: string;
                    new_password: string;
                };
            };
        };
        responses: {
            /** @description Password updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    refreshTokens: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "refresh_token": "Jk3vQm9xT2pL0sWc8hYbR4nZaE6uFi1oPq7dGt5yHw0"
                 *     }
                 */
                "application/json": components["schemas"]["RefreshRequest"];
            };
        };
        responses: {
            /** @description Rotated token pair */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJzdWIiOiIwMThmMmE3MCIsIm4iOjJ9.FAKE-signature",
                     *       "token_type": "Bearer",
                     *       "expires_at": "2026-09-24T10:44:00Z",
                     *       "refresh_token": "Pq7dGt5yHw0Jk3vQm9xT2pL0sWc8hYbR4nZaE6uFi1o",
                     *       "session_expires_at": "2026-10-24T10:15:00Z",
                     *       "idle_expires_at": "2026-10-01T10:29:00Z",
                     *       "session_id": "018f2a70-5b6c-7d8e-9f01-2a3b4c5d6e7f",
                     *       "user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00"
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPair"];
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
    signUpInOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    display_name?: string | null;
                    /** Format: email */
                    email: string;
                    /** Format: uuid */
                    organization_id: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description User created; SSO cookie set, or an enrolment challenge returned */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id: string;
                    } | (components["schemas"]["MFAChallenge"] & {
                        /** Format: uuid */
                        user_id?: string;
                    });
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    resetPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    new_password: string;
                    token: string;
                };
            };
        };
        responses: {
            /** @description Password reset; returns a confirmation message */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    createSsoSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionRequest"];
            };
        };
        responses: {
            /**
             * @description Either the SSO cookie was set (`{user_id}`) or an MFA challenge to
             *     complete at POST /v1/auth/session/mfa — when the user holds a second
             *     factor, or must have one (see MFAChallenge). No cookie is set until
             *     then.
             */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id: string;
                    } | components["schemas"]["MFAChallenge"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            /** @description The account is locked for this network or everywhere (`auth.account_locked`), or the source network is throttled for spraying (`too_many_requests`). The same answer whatever the password and whether the address has an account. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            503: components["responses"]["SignInUnavailable"];
        };
    };
    deleteSsoSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signed out and the cookie cleared, and applications that registered a front-channel logout URI took part in the session: the hosted login loads each URI, which carries iss and sid, to sign the browser out of that application too. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        frontchannel_logout_uris: string[];
                    };
                };
            };
            /** @description Signed out (or there was no session to end), cookie cleared, and no application to sign out of in the browser */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The request failed the CSRF check (`csrf_failed`): it came from an origin that is not allowed, or did not echo the qe_csrf cookie in the X-CSRF-Token header. Nothing was signed out. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeSsoSessionMfa: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description An authenticator-app code, a one-time recovery code, or a code sent to an email or SMS factor (POST /v1/auth/mfa/send). */
                    code?: string | null;
                    mfa_token: string;
                    /** @description An assertion from the passkey ceremony begun for this challenge (POST /v1/auth/mfa/passkey/begin). */
                    passkey?: {
                        credential?: {
                            [key: string]: unknown;
                        };
                        /** Format: uuid */
                        session_id?: string;
                    } | null;
                    /** @description true to complete with the push request sent for this challenge (POST /v1/auth/mfa/push). Answers 409 mfa.push_pending — not counted as a failed attempt — until it is approved on the device; a denied request counts as a wrong answer, an expired one answers mfa.push_challenge_expired. */
                    push?: boolean | null;
                    /** @description Trust this device so future logins can skip the second factor (adaptive MFA). Honoured only when the organization has enabled remember-device; sets the qe_td cookie. */
                    remember?: boolean | null;
                    /** @description true to put off setting up a second factor, for an enrolment challenge that carries enrollment_due_at; a session is issued without one. Refused with 403 mfa.enrollment_required once the grace period has ended. Not counted as an attempt. */
                    skip?: boolean | null;
                };
            };
        };
        responses: {
            /** @description Second factor verified (or set up, or put off); SSO cookie set. recovery_codes are the account's new recovery codes when an authenticator app was just set up. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        recovery_codes?: string[];
                        /** Format: uuid */
                        user_id?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    listMySessions: {
        parameters: {
            query?: {
                /** @description Opaque owner-scoped cursor returned by the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 100 (default 50). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active sessions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        has_more?: boolean;
                        items?: components["schemas"]["Session"][];
                        /** @description Opaque owner-scoped cursor for the next page; omitted on the final page. */
                        next_cursor?: string;
                        total?: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeMySession: {
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
            /** @description Session revoked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    signOutEverywhere: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller was signed out everywhere */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    /** @description Clears the hosted-login cookie (`qe_ls`). */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Application refresh grants ended. */
                        app_grants: number;
                        /** @description Hosted-login browser sessions ended. */
                        hosted_login_sessions: number;
                        /** @description Unredeemed authorisation codes spent, and device or back-channel sign-in requests (pending, or approved but not collected) denied. */
                        pending_authorizations: number;
                        /** @description Number of sign-ins ended by this call, all places together; 0 when there were none. */
                        revoked: number;
                        /** @description Sessions ended, the current one included. */
                        sessions: number;
                        /** @description Devices remembered to skip the second factor that were forgotten; each is asked for the second factor at its next sign-in. */
                        trusted_devices: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeMyOtherSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The other sessions were ended */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Number of sessions ended by this call; 0 when there were none. */
                        revoked: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listMySignInMethods: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The counts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        linked_identities?: number;
                        passkeys?: number;
                        password?: boolean;
                        total?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    signUp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "ada@example.com",
                 *       "password": "corr3ct-h0rse-battery",
                 *       "display_name": "Ada Lovelace"
                 *     }
                 */
                "application/json": components["schemas"]["SignupRequest"];
            };
        };
        responses: {
            /** @description Created; token pair + user */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "user": {
                     *         "id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *         "organization_id": "00000000-0000-0000-0000-000000000000",
                     *         "email": "ananya.rao@brightleaffoods.in",
                     *         "email_verified_at": null,
                     *         "phone": null,
                     *         "phone_verified_at": null,
                     *         "display_name": "Ananya Rao",
                     *         "avatar_url": null,
                     *         "status": "active",
                     *         "metadata": {},
                     *         "created_at": "2026-09-24T11:00:00Z",
                     *         "updated_at": "2026-09-24T11:00:00Z"
                     *       },
                     *       "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJzdWIiOiIwMThmMmE3MCJ9.FAKE-signature",
                     *       "token_type": "Bearer",
                     *       "expires_at": "2026-09-24T11:15:00Z",
                     *       "refresh_token": "rt_2b9f4c7a1e6d8035b4c2a1908f7e6d5c",
                     *       "session_id": "018f2a70-5b6c-7d8e-9f01-2a3b4c5d6e7f",
                     *       "user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f"
                     *     }
                     */
                    "application/json": components["schemas"]["SignupResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    switchOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    organization_id: string;
                };
            };
        };
        responses: {
            /** @description Token pair scoped to the target organization */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenPair"];
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
    listMyTrustedDevices: {
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
                        items: {
                            /** Format: date-time */
                            created_at: string;
                            /** @description The request came from this device. */
                            current: boolean;
                            /** @description The device and browser in words, such as "Chrome on macOS". */
                            device: string;
                            /** @enum {string} */
                            device_kind: "desktop" | "mobile" | "tablet" | "unknown";
                            /** Format: date-time */
                            expires_at: string;
                            /** Format: uuid */
                            id: string;
                            /**
                             * Format: date-time
                             * @description When the device last skipped the second factor.
                             */
                            last_used_at: string | null;
                            /**
                             * Format: uuid
                             * @description The organization the device was remembered in.
                             */
                            organization_id: string | null;
                            user_agent: string;
                        }[];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    forgetAllMyTrustedDevices: {
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
                        /** @description How many devices were forgotten. */
                        forgotten?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    forgetMyTrustedDevice: {
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
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description How many devices were forgotten. */
                        forgotten?: number;
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
    countMyTrustedDevices: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Live trusted-device count */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Live trusted devices (one browser cookie = one device). */
                        devices: number;
                        /** @description Distinct people those devices belong to. */
                        users: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    checkPermission: {
        parameters: {
            query: {
                /** @description When "true", also return the role grant path(s), a reason on denial and the decision's trace. */
                explain?: "true";
                organization_id: string;
                permission: string;
                user_id: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Decision: {allowed, decided_by}. With explain=true also paths, reason (on denial) and trace. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        allowed: boolean;
                        decided_by: components["schemas"]["AuthzDecidedBy"];
                        paths?: components["schemas"]["AuthzGrantStep"][];
                        /** @description Set only on a denial, with explain=true, in English. Show reason_code's meaning instead. */
                        reason?: string;
                        /**
                         * @description Set with reason. authz.no_role_grant when no role grants the permission; an ABAC code when a policy refused it.
                         * @enum {string}
                         */
                        reason_code?: "authz.no_role_grant" | "authz.denied_by_policy" | "authz.attribute_absent" | "authz.condition_error";
                        /** @description With an ABAC code, the policy (policy_id, policy_name, priority), to a caller holding policy.read. */
                        reason_params?: {
                            [key: string]: unknown;
                        };
                        /** @description With explain=true. Each step in order, prefixed with its model (organization, abac, rbac, rebac, none). */
                        trace?: string[];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listMyAccessRequests: {
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
                        access_requests: components["schemas"]["AccessRequest"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createAccessRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description How long the role is needed; absent means for good. */
                    duration_hours?: number | null;
                    /** @description Why, in 1 to 500 characters. */
                    reason: string;
                    /**
                     * Format: uuid
                     * @description The role asked for.
                     */
                    role_id: string;
                };
            };
        };
        responses: {
            /** @description Asked */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        access_request: components["schemas"]["AccessRequest"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    cancelMyAccessRequest: {
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
            /** @description Cancelled */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listRequestableRoles: {
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
                        roles: components["schemas"]["RequestableRole"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listMyEffectivePermissions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller's effective permissions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Every grant behind them: one entry per permission, role and group (a permission granted twice appears twice). */
                        grants: components["schemas"]["AuthzGrantStep"][];
                        /** @description Each permission key once, in order. */
                        permissions: string[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listOtpFactors: {
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
                        items: components["schemas"]["OTPFactor"][];
                        truncated?: components["schemas"]["Truncated"];
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
    addOtpFactor: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @enum {string|null} */
                    channel?: "email" | "sms" | null;
                    /** @description The email address or phone number the codes go to. */
                    destination?: string | null;
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
                    "application/json": {
                        /** Format: uuid */
                        factor_id: string;
                        message: string;
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
    deleteOtpFactor: {
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
    challengeOtpFactor: {
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
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        message: string;
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
    confirmOtpFactor: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["verifyInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        verified: boolean;
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
    verifyOtp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["verifyInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        verified: boolean;
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
    getPushChallenge: {
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
            /** @description Challenge status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PushChallenge"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    respondToPushChallenge: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    approved: boolean;
                    device_token: string;
                    /** @description The number shown where the request was asked for; required to approve. */
                    number?: number | null;
                    /** Format: uuid */
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description Challenge response recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "approved" | "denied";
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
    listMyPushDevices: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Registered devices */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["PushDevice"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    registerPushDevice: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string | null;
                    /** @enum {string} */
                    platform: "ios" | "android";
                    push_token: string;
                };
            };
        };
        responses: {
            /** @description Device registered; device_token is returned once */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        device: components["schemas"]["PushDevice"];
                        device_token: string;
                        warning: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeMyPushDevice: {
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
            /** @description Device revoked */
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
    listPendingPushRequests: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    device_token: string;
                    /** Format: uuid */
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description The requests waiting for an answer, newest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        challenges: components["schemas"]["PushChallenge"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    replacePushDeviceToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    device_token: string;
                    push_token: string;
                    /** Format: uuid */
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description The new push token is stored */
            204: {
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
    unlinkPushDevice: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    device_token: string;
                    /** Format: uuid */
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description The phone is no longer linked */
            204: {
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
    createPairingCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Pairing code issued */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example ABCDE-FGHJK */
                        code: string;
                        /** Format: date-time */
                        expires_at: string;
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        status: "pending";
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getPairingCode: {
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
            /** @description The pairing code's state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        device_id?: string;
                        /** Format: date-time */
                        expires_at: string;
                        /** Format: uuid */
                        id: string;
                        /** @enum {string} */
                        status: "pending" | "linked" | "expired";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    withdrawPairingCode: {
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
            /** @description The code no longer works */
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
    claimPairingCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    code: string;
                    name?: string | null;
                    /** @enum {string} */
                    platform: "ios" | "android";
                    push_token: string;
                };
            };
        };
        responses: {
            /** @description The phone is linked; device_token is returned once */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The account the phone now approves sign-ins for, so the app can name it. */
                        account?: {
                            /** Format: email */
                            email: string;
                        };
                        device: components["schemas"]["PushDevice"];
                        device_token: string;
                        /** Format: uuid */
                        user_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startPushStepUp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Request sent */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        challenge_id?: string;
                        /** Format: date-time */
                        expires_at?: string;
                        number?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completePushStepUp: {
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
            /** @description Stepped up */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status?: "approved";
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            409: components["responses"]["Conflict"];
            /** @description The request expired unanswered (mfa.push_challenge_expired) */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getRecoveryCodesStatus: {
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
                    "application/json": components["schemas"]["RecoveryStatus"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    regenerateRecoveryCodes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        recovery_codes: string[];
                        warning: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    getStepUpStatus: {
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
                        /** @description The factor types the organization counts; null when every one does. */
                        allowed_methods?: string[] | null;
                        /** @description The session is stepped up now. */
                        recently_verified?: boolean;
                        /**
                         * Format: date-time
                         * @description The session's latest step-up, whether or not it still counts.
                         */
                        verified_at?: string | null;
                        /** @description How long a step-up lasts in the organization. */
                        window_seconds?: number;
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
    getTotpStatus: {
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
                        enrolled: boolean;
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
    disableTotp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    confirmTotpEnrollment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["confirmEnrollInput"];
            };
        };
        responses: {
            /** @description Created */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        recovery_codes: string[];
                        warning: string;
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
            503: components["responses"]["Overloaded"];
        };
    };
    startTotpEnrollment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description The account name the authenticator app shows; the signed-in subject when omitted. */
                    account?: string | null;
                };
            };
        };
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
                        provisioning_url?: string;
                        /** @description The account holds a confirmed app, which keeps working until this one is confirmed. */
                        replacing?: boolean;
                        secret?: string;
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
    verifyTotp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["verifyInput"];
            };
        };
        responses: {
            /** @description Created */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        verified: boolean;
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
            503: components["responses"]["Overloaded"];
        };
    };
    challengeWebauthnFactor: {
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
                        publicKey: components["schemas"]["PublicKeyCredentialRequestOptions"];
                        /** Format: uuid */
                        session_id: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            /** @description WebAuthn second factor not enabled */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    verifyWebauthnFactor: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["webauthnVerifyInput"];
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
                        verified: boolean;
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
            /** @description WebAuthn second factor not enabled */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    evaluateAbacPolicies: {
        parameters: {
            query?: {
                /** @description When true, the response includes a human-readable trace of each evaluated policy. */
                explain?: boolean;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ABACEvaluateRequest"];
            };
        };
        responses: {
            /** @description Decision */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ABACDecision"];
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
    listAbacPolicies: {
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
                        items: components["schemas"]["ABACPolicy"][];
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
    createAbacPolicy: {
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
                "application/json": components["schemas"]["ABACPolicyCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ABACPolicy"];
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
    getAbacPolicy: {
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
                    "application/json": components["schemas"]["ABACPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteAbacPolicy: {
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    updateAbacPolicy: {
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
                "application/json": components["schemas"]["ABACPolicyCreate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ABACPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAbacPolicyVersions: {
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
            /** @description The policy's versions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            action?: string;
                            condition?: {
                                [key: string]: unknown;
                            };
                            description?: string;
                            /** @enum {string} */
                            effect?: "allow" | "deny";
                            enabled?: boolean;
                            name?: string;
                            priority?: number;
                            resource_type?: string;
                            /** Format: date-time */
                            saved_at?: string;
                            /** Format: uuid */
                            saved_by?: string | null;
                            version?: number;
                        }[];
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
    restoreAbacPolicyVersion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                version: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The policy, as restored */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ABACPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAccessRequests: {
        parameters: {
            query?: {
                /** @description At most this many, 1 to 200 (100 by default). */
                limit?: number;
                /** @description Only requests with this status. */
                status?: "pending" | "approved" | "denied" | "cancelled" | "expired";
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
                        access_requests: components["schemas"]["AccessRequest"][];
                        /** @description How many of the organization's requests are waiting. */
                        pending: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getAccessRequest: {
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
                    "application/json": {
                        access_request: components["schemas"]["AccessRequest"];
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
    approveAccessRequest: {
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
                    /** @description Optional, up to 500 characters; the requester sees it. */
                    note?: string | null;
                };
            };
        };
        responses: {
            /** @description Approved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        access_request: components["schemas"]["AccessRequest"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    denyAccessRequest: {
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
                    /** @description Why, up to 500 characters; the requester sees it. */
                    note: string;
                };
            };
        };
        responses: {
            /** @description Denied */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        access_request: components["schemas"]["AccessRequest"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    evaluateAccess: {
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
                    action: {
                        name?: string;
                        /** @description The action's attributes for ABAC policies (action.*). */
                        properties?: {
                            [key: string]: unknown;
                        };
                    };
                    /** @description Optional. The request's attributes for ABAC policies (context.*), such as ip or mfa. { explain: true } includes the grant path and the decision's trace inline in the response context, and is not an attribute. */
                    context?: {
                        [key: string]: unknown;
                    } | null;
                    resource?: {
                        id?: string;
                        /** @description The resource's attributes for ABAC policies (resource.*). */
                        properties?: {
                            [key: string]: unknown;
                        };
                        type?: string;
                    } | null;
                    subject: {
                        id?: string;
                        /** @description The subject's attributes for ABAC policies (subject.*). */
                        properties?: {
                            [key: string]: unknown;
                        };
                        type?: string;
                    };
                };
            };
        };
        responses: {
            /** @description { decision: bool, context: { decided_by, paths | path, trace } } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        context: {
                            decided_by: components["schemas"]["AuthzDecidedBy"];
                            /** @description With explain, for a relation check: the chain of relation tuples that allowed it; null when nothing did. */
                            path?: {
                                depth: number;
                                object: string;
                                relation: string;
                                subject: string;
                            }[] | null;
                            /** @description With explain, for a permission check: every grant behind an allow. */
                            paths?: components["schemas"]["AuthzGrantStep"][] | null;
                            /** @description With explain, the decision's trace. */
                            trace?: string[] | null;
                        } & {
                            [key: string]: unknown;
                        };
                        decision: boolean;
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
    evaluateAccessBatch: {
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
                    action?: components["schemas"]["AuthZENAction"];
                    context?: {
                        [key: string]: unknown;
                    } | null;
                    evaluations?: {
                        action?: components["schemas"]["AuthZENAction"];
                        context?: {
                            [key: string]: unknown;
                        };
                        resource?: components["schemas"]["AuthZENResource"];
                        subject?: components["schemas"]["AuthZENSubject"];
                    }[] | null;
                    options?: {
                        /** @enum {string} */
                        evaluations_semantic?: "execute_all" | "deny_on_first_deny" | "permit_on_first_permit";
                    } | null;
                    resource?: components["schemas"]["AuthZENResource"];
                    subject?: components["schemas"]["AuthZENSubject"];
                };
            };
        };
        responses: {
            /** @description { evaluations: [{ decision, context }] }, or a single { decision, context } without evaluations. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        context?: Record<string, never>;
                        decision?: boolean;
                        evaluations?: {
                            context?: Record<string, never>;
                            decision?: boolean;
                        }[];
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
    getAuthPolicy: {
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
                    "application/json": components["schemas"]["AuthPolicy"];
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
    setAuthPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description The whole policy (a full replace). `lockout_limits` is read-only and ignored. */
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AuthPolicyUpdate"];
            };
        };
        responses: {
            /** @description The stored policy */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthPolicy"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            /** @description A lockout setting is outside the documented bounds; nothing was stored. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSignInMethodUsage: {
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
            /** @description The counts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        magic_link_enabled: boolean;
                        passkey: {
                            only: number;
                            people: number;
                        };
                        password: {
                            only: number;
                            people: number;
                        };
                        people: number;
                        social: {
                            linked: number;
                            only: number;
                            provider: string;
                        }[];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAccessDecisions: {
        parameters: {
            query?: {
                /** @description Only allowed (true) or refused (false) decisions. */
                allowed?: boolean;
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Decisions of the last 1 to 30 days; 30 by default. */
                days?: number;
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                source?: "check" | "relation_check" | "authzen" | "abac_evaluate" | "abac_draft";
                /** @description Only decisions about this subject (a user id, or type:id). */
                subject?: string;
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
            /** @description Decisions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** @description The permission key, relation or action. */
                            action: string;
                            allowed: boolean;
                            /** @description The application whose token asked, when one did. */
                            caller_client?: string;
                            /** Format: uuid */
                            caller_id?: string;
                            /** @description user, api_key, service or agent. */
                            caller_type?: string;
                            /** Format: date-time */
                            decided_at: string;
                            /** Format: uuid */
                            id: string;
                            /** @description rbac, rebac, abac or none: the model that decided. */
                            model: string;
                            reason_code?: string;
                            /** @description "permission" for a permission check, else type:id. */
                            resource: string;
                            /** @description The role, relation or ABAC policy that decided. */
                            rule?: string;
                            /** @enum {string} */
                            source: "check" | "relation_check" | "authzen" | "abac_evaluate" | "abac_draft";
                            subject: string;
                        }[];
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
    listGroupRoles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Roles granted to the group */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["GroupRole"][];
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
    grantGroupRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Granted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The plan has no seat left for a member holding no role (billing.plan_limit). */
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
    revokeGroupRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
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
    listIpRules: {
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
                        enabled: boolean;
                        items: components["schemas"]["Rule"][];
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
    createIpRule: {
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
                    /** @enum {string} */
                    action: "allow" | "deny";
                    cidr: string;
                    label: string;
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
                    "application/json": components["schemas"]["Rule"];
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
    deleteIpRule: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                ruleID: string;
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
    checkIpAddress: {
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
                    ip: string;
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
                        allowed: boolean;
                        enabled: boolean;
                        /** @description The reason in English. Show reason_code's meaning instead. */
                        reason: string;
                        /**
                         * @description Allowed; refused by a deny rule; outside every allow rule; refused as the address can't be read; or allowed because the rules are off.
                         * @enum {string}
                         */
                        reason_code: "ip.allowed" | "ip.deny_rule" | "ip.not_in_allow_rules" | "ip.address_unknown" | "ip.enforcement_disabled";
                        /** @description For ip.deny_rule, the rule's cidr. */
                        reason_params?: {
                            [key: string]: unknown;
                        };
                        /** @description What the organization's rules decide whatever the enforcement flag, so they can be tried before they are turned on; with enforcement on it matches the fields above. */
                        rules?: {
                            allowed: boolean;
                            /** @description The reason in English. */
                            reason: string;
                            /** @enum {string} */
                            reason_code: "ip.allowed" | "ip.deny_rule" | "ip.not_in_allow_rules" | "ip.address_unknown";
                            /** @description For ip.deny_rule, the rule's cidr. */
                            reason_params?: {
                                [key: string]: unknown;
                            };
                        };
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
    setIpRuleEnforcement: {
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
                    enabled: boolean;
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
                        enabled: boolean;
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
    getSecurityPolicy: {
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
                    "application/json": components["schemas"]["SecurityPolicy"];
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
    setSecurityPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description The whole policy; organization_id is taken from the path. */
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SecurityPolicyUpdate"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SecurityPolicy"];
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
    updateSecurityPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description Only the fields to change; a null clears a nullable one, such as max_sessions. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["SecurityPolicyUpdate"];
            };
        };
        responses: {
            /** @description The whole policy after the change */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SecurityPolicy"];
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
    listRelationTuples: {
        parameters: {
            query?: {
                /** @description Object ref "type:id", e.g. document:readme. Mutually exclusive with subject. */
                object?: string;
                /** @description Subject ref "type:id" or "type:id#relation", e.g. user:abc123. Returns all objects the subject appears on. Mutually exclusive with object. */
                subject?: string;
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
            /** @description Tuples anchored on the given object or subject */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Tuple"][];
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
    writeRelationTuple: {
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
                    /** @description "type:id" */
                    object: string;
                    relation: string;
                    /** @description "user:<id>" or "type:id#relation" (userset) */
                    subject: string;
                };
            };
        };
        responses: {
            /** @description Tuple written */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Tuple"];
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
    deleteRelationTuple: {
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
    checkRelation: {
        parameters: {
            query?: {
                /** @description When "true", returns the root-to-leaf chain of relation tuples that granted (or would grant) access instead of just the boolean. */
                explain?: "true" | "false";
            };
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
                    object: string;
                    relation: string;
                    user_id: string;
                };
            };
        };
        responses: {
            /** @description { allowed, decided_by } by default; with explain=true also path, where each step is { object, relation, subject, depth }, and trace */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        allowed: boolean;
                        decided_by: components["schemas"]["AuthzDecidedBy"];
                        path?: {
                            depth: number;
                            object: string;
                            relation: string;
                            subject: string;
                        }[];
                        trace?: string[];
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
    expandRelationGraph: {
        parameters: {
            query: {
                /** @description Maximum hops to follow (default and max 10) */
                depth?: number;
                /** @description Root object ref "type:id", e.g. document:security-runbook */
                object: string;
                /** @description Relation to expand from the root, e.g. viewer */
                relation: string;
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
            /** @description Graph of all nodes and directed edges reachable from the root */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        edges: {
                            from: string;
                            relation: string;
                            to: string;
                        }[];
                        nodes: {
                            /** @description "type:id" */
                            id: string;
                            label: string;
                            /** @description A user node's person, by display name or address, when they belong to the organization. */
                            name?: string;
                            type: string;
                        }[];
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
    listRelationObjects: {
        parameters: {
            query: {
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 500. A larger value is lowered to 500; a smaller or malformed one gets the default. */
                limit?: number;
                /** @description The type of object, such as document. */
                type: string;
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
            /** @description Objects */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            id: string;
                            /** @description "type:id" */
                            object: string;
                            tuples: number;
                        }[];
                        /** @description Present when there is another page. */
                        next_cursor?: string;
                        total: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listRelationObjectTypes: {
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
            /** @description Object types */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            objects: number;
                            tuples: number;
                            type: string;
                        }[];
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
    listRoles: {
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
            /** @description Roles */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Role"][];
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
    createRole: {
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
                "application/json": components["schemas"]["RoleCreate"];
            };
        };
        responses: {
            /** @description Role created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Role"];
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
    deleteRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
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
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    renameRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoleUpdate"];
            };
        };
        responses: {
            /** @description The role */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Role"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listRoleHolders: {
        parameters: {
            query?: {
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 500 (default 100). A larger value is lowered to 500; a smaller or malformed one gets the default. */
                limit?: number;
            };
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The role's holders */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        groups: {
                            /** Format: uuid */
                            id: string;
                            name: string;
                        }[];
                        next_cursor?: string;
                        people: {
                            direct: boolean;
                            display_name: string;
                            email: string;
                            /** Format: uuid */
                            user_id: string;
                            via_groups: {
                                /** Format: uuid */
                                id: string;
                                name: string;
                            }[];
                        }[];
                    };
                };
            };
            400: components["responses"]["Unprocessable"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setRolePermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    permission_ids: string[];
                };
            };
        };
        responses: {
            /** @description The role's permissions as they now are */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Permission"][];
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
    listSecurityAnomalies: {
        parameters: {
            query?: {
                /** @description The previous page's next_cursor. */
                cursor?: string;
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
            /** @description A page of anomalies, newest first */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Anomaly"][];
                        /** @description Present when there is a next page. */
                        next_cursor?: string;
                        /** @description How many anomalies match. */
                        total: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    resolveSecurityAnomaly: {
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
            /** @description Anomaly resolved */
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
    getSecurityAnomalySummary: {
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
            /** @description Open/resolved/affected/high-severity counts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ThreatSummary"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getBotTelemetry: {
        parameters: {
            query?: {
                /** @description The previous page's next_cursor. */
                cursor?: string;
                /** @description Page size, 1 to 200 (default 50). A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: number;
                verdict?: "allowed" | "challenged" | "blocked";
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
            /** @description Recent bot verdicts and stats */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description A page of detections, newest first. */
                        items: components["schemas"]["BotEvent"][];
                        /** @description Present when there is a next page. */
                        next_cursor?: string;
                        stats: components["schemas"]["Stats"];
                        /** @description How many detections match. */
                        total: number;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getBotSettings: {
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
            /** @description Bot-detection settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BotSettings"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setBotSettings: {
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
                "application/json": components["schemas"]["BotSettings"];
            };
        };
        responses: {
            /** @description Updated settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BotSettings"];
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
    getRiskSettings: {
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
            /** @description Risk settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RiskSettings"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setRiskSettings: {
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
                "application/json": components["schemas"]["RiskSettingsUpdate"];
            };
        };
        responses: {
            /** @description Updated settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RiskSettings"];
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
    listMyPasskeys: {
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
                        /** @description False when the user's organization has passkeys switched off (auth policy passkey_enabled): do not offer adding a passkey, which register begin and finish then refuse (403 passkey.disabled). Always true for a user without an organization. */
                        enrollment_allowed: boolean;
                        items: components["schemas"]["Passkey"][];
                        truncated?: components["schemas"]["Truncated"];
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
    deleteMyPasskey: {
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
    renameMyPasskey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description 1 to 64 characters after cleaning; empty or whitespace-only is refused. */
                    name: string;
                };
            };
        };
        responses: {
            /** @description The renamed passkey */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Passkey"];
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
    beginPasskeySignIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                /**
                 * @example {
                 *       "email": "ada@example.com"
                 *     }
                 */
                "application/json": components["schemas"]["loginBeginInput"];
            };
        };
        responses: {
            /** @description The ceremony's session_id and the WebAuthn request options (publicKey), without allowCredentials */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "publicKey": {
                     *         "challenge": "q8V3m9pT1xRwz0LkYb2NcHs4dFgJ6uEo7iAa5tSvWyQ",
                     *         "rpId": "id.qeet.in",
                     *         "userVerification": "required"
                     *       },
                     *       "session_id": "018f2a72-3d4e-7f5a-9b6c-7d8e9f0a1b2c"
                     *     }
                     */
                    "application/json": {
                        publicKey: components["schemas"]["PublicKeyCredentialRequestOptions"];
                        /** Format: uuid */
                        session_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    finishPasskeySignIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                /**
                 * @example {
                 *       "session_id": "018f2a72-3d4e-7f5a-9b6c-7d8e9f0a1b2c",
                 *       "credential": {
                 *         "id": "3xQm7Lk2pR9vT0sWb4nYcE",
                 *         "rawId": "3xQm7Lk2pR9vT0sWb4nYcE",
                 *         "type": "public-key",
                 *         "response": {
                 *           "authenticatorData": "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAQ",
                 *           "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoicThWM205cFQxeFJ3ejBMa1liMk5jSHM0ZEZnSjZ1RW83aUFhNXRTdld5USJ9",
                 *           "signature": "MEUCIQDFAKE-signatureFAKE-signatureFAKE",
                 *           "userHandle": "AY8qcBorfD2eT1prfI2eDw"
                 *         }
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["loginFinishInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJzdWIiOiIwMThmMmE3MCJ9.FAKE-signature",
                     *       "token_type": "Bearer",
                     *       "expires_at": "2026-09-24T10:30:00Z",
                     *       "refresh_token": "Jk3vQm9xT2pL0sWc8hYbR4nZaE6uFi1oPq7dGt5yHw0",
                     *       "session_expires_at": "2026-10-24T10:15:00Z",
                     *       "idle_expires_at": "2026-10-01T10:15:00Z",
                     *       "session_id": "018f2a70-5b6c-7d8e-9f01-2a3b4c5d6e7f",
                     *       "user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00"
                     *     }
                     */
                    "application/json": components["schemas"]["TokenPair"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createPasskeySession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The WebAuthn assertion (PublicKeyCredential JSON). */
                    credential: {
                        [key: string]: unknown;
                    };
                    /** Format: uuid */
                    session_id: string;
                };
            };
        };
        responses: {
            /** @description Signed in to the hosted login (the cookie is set) */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    beginPasskeyRegistration: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
                        publicKey: components["schemas"]["PublicKeyCredentialCreationOptions"];
                        /** Format: uuid */
                        session_id: string;
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
    finishPasskeyRegistration: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["registerFinishInput"];
            };
        };
        responses: {
            /** @description Created */
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
    listPermissions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Permissions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Permission"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    beginPasskeySignUpInOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Starts a passwordless counterpart to POST /auth/register — gated by the organization's self_registration_enabled policy. */
        requestBody: {
            content: {
                "application/json": {
                    display_name?: string | null;
                    email: string;
                    /** Format: uuid */
                    organization_id: string;
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
                        publicKey: components["schemas"]["PublicKeyCredentialCreationOptions"];
                        /** Format: uuid */
                        session_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    finishPasskeySignUpInOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Verifies the attestation, creates the user in the ceremony's organization, and sets the hosted-login SSO cookie. */
        requestBody: {
            content: {
                "application/json": {
                    credential: {
                        [key: string]: unknown;
                    };
                    name?: string | null;
                    /** Format: uuid */
                    session_id: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listRolePermissions: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                roleID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Permissions granted to the role */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Permission"][];
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
    grantRolePermission: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                permID: string;
                roleID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Granted */
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
    revokeRolePermission: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                permID: string;
                roleID: string;
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
    beginPasskeySignUp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Starts a passwordless counterpart to POST /auth/signup — no password is created. */
        requestBody: {
            content: {
                "application/json": {
                    display_name?: string | null;
                    email: string;
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
                        publicKey: components["schemas"]["PublicKeyCredentialCreationOptions"];
                        /** Format: uuid */
                        session_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["SSORequired"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    finishPasskeySignUp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Verifies the attestation, creates the organization-less user with the passkey as its founding credential, and returns a token pair. */
        requestBody: {
            content: {
                "application/json": {
                    credential: {
                        [key: string]: unknown;
                    };
                    name?: string | null;
                    session_id: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        access_token: string;
                        /** Format: date-time */
                        expires_at: string;
                        refresh_token: string;
                        /** Format: uuid */
                        session_id: string;
                        token_type: string;
                        /** Format: uuid */
                        user_id: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listEffectivePermissions: {
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
            /** @description Effective permissions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        grants: components["schemas"]["AuthzGrantStep"][];
                        permissions: string[];
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
    assignUserRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
                userID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Assigned */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The plan has no seat left for a person's first role (billing.plan_limit). */
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
    unassignUserRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                roleID: string;
                userID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Unassigned */
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
}
