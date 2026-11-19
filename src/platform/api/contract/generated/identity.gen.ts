// Generated from contract/qeet-id-server/identity.yaml by `bun run contract:sync`. Do not edit:
// `bun run contract:check` fails when this file and the document disagree.
export interface paths {
    "/v1/branding/{organizationID}/logo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An organization's uploaded logo (public)
         * @description The image an organization uploaded as its logo (a PNG, JPEG, WEBP or SVG data URL in its branding), served so its emails and hosted pages can link to it: those get this address, with ?v= a hash of the image, in place of the data URL. Needs no credential, like the logo it shows. 404 when the organization uploaded none, links its logo by URL instead, or its plan lacks custom_branding. Served with X-Content-Type-Options nosniff and a sandboxing Content-Security-Policy, so an SVG's scripts never run; cacheable for an hour.
         */
        get: operations["getBrandingLogo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create group
         * @description Creates a group in the caller's organization. A parent_id must name one of the organization's own groups; otherwise the call answers 404 group.parent_not_found, the same for a missing id as for another organization's group. The name is stored trimmed, and a blank one answers 422 validation_failed. A name another of the organization's groups already uses, ignoring case and surrounding spaces, answers 409 group.name_exists; groups an identity provider provisions over SCIM with an externalId don't count. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key.
         */
        post: operations["createGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/{id}": {
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
         * Delete group
         * @description Deletes one of the organization's groups and its subgroups; members keep their accounts. Requires group.write and a fresh second factor (step-up). Deleting takes the group's roles from its members, so it is held to the rule for giving them: only an owner deletes a group holding the owner role (403 rbac.owner_only), and nobody deletes one whose roles carry a permission they lack (403 rbac.grant_exceeds_caller).
         */
        delete: operations["deleteGroup"];
        options?: never;
        head?: never;
        /**
         * Update group
         * @description Changes only the fields sent: an omitted name, description or parent_id keeps its value, and "parent_id": null makes the group top-level. A new parent must be one of the organization's own groups (404 group.parent_not_found otherwise) and not the group itself or one of its subgroups (400 group.cycle). Renaming to a name another of the organization's groups uses, ignoring case, answers 409 group.name_exists.
         */
        patch: operations["updateGroup"];
        trace?: never;
    };
    "/v1/groups/{id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List members
         * @description Lists a group's members. Requires group.read.
         */
        get: operations["listGroupMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/{id}/members/{userID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add member
         * @description Adds a user to one of the caller's groups. The user must be a live member of the caller's organization, or have it as their home organization; otherwise the call answers 404 group.user_not_found, the same for a missing id as for another organization's user. Adding someone already in the group is a no-op, except that a membership a single sign-on made becomes the administrator's, so the person's sign-ins no longer remove it. Joining a group gives its roles, so the caller must hold every permission they carry (403 rbac.grant_exceeds_caller naming one), and only an owner adds someone to a group holding the owner role (403 rbac.owner_only). Like the other routes that hand out authority, it needs a recent step-up. Someone holding no role who joins a group that carries one takes a seat; when the plan's seats are all taken they are not added (402 billing.plan_limit, metadata resource seats).
         */
        post: operations["addGroupMember"];
        /**
         * Remove member
         * @description Removes a user from a group. Requires group.write and a fresh second factor (step-up). Removing takes the group's roles from them, so it is held to the rule for giving them, as adding is (403 rbac.owner_only for a group holding the owner role, 403 rbac.grant_exceeds_caller for one whose roles carry a permission the caller lacks), and to their standing: nobody removes someone who outranks them (403 rbac.target_is_owner or rbac.target_outranks_caller). Someone whose identity provider still asserts a group mapped to this one rejoins it at their next single sign-on.
         */
        delete: operations["removeGroupMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk import groups
         * @description Creates groups from a flat list, resolving each row's parent by name. Rows are attempted independently: the response reports created, skipped (name already exists) and failed rows so a partial import can be retried.
         */
        post: operations["importGroups"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List group templates
         * @description Reusable group structures that can be applied to create a whole tree at once.
         */
        get: operations["listGroupTemplates"];
        put?: never;
        /**
         * Create a group template
         * @description Stores a named tree of groups. Up to 6 levels deep and 200 groups. A template that uses one group name twice, ignoring case and surrounding spaces, answers 422 validation_failed (field nodes, code duplicate_name).
         */
        post: operations["createGroupTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/templates/{id}": {
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
         * Delete a group template
         * @description Removes the template. Groups already created from it are untouched.
         */
        delete: operations["deleteGroupTemplate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/templates/{id}/apply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply a group template
         * @description Creates every group in the template in one transaction, optionally under an existing parent. The parent must belong to the caller's organization. Group names are unique in an organization, ignoring case, so applying a template whose groups already exist, including applying it a second time, answers 409 group.name_exists with the first colliding name in the error detail, and creates nothing. To apply it again (say, for another office), give a prefix, put before every group's name, and optionally a root_name for a template with one top group; names are checked trimmed, at most 200 characters (422 validation_failed before anything is made), and the audit event records both.
         */
        post: operations["applyGroupTemplate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create invite
         * @description Creates an invitation and emails its accept link. Requires member.invite. The address is kept lower-case and matched without regard to case. An invitation with no role_id, to someone already at home in another organization, is refused with 422 invite.role_required, as accepting it would join them to nothing. The accept link goes only to the invited address; the response carries the invitation and invite.delivery: status sent when a provider accepted the email, or not_sent with code and message when it did not (email.suppressed: the address bounced or reported spam before; email.provider_unavailable: no provider is configured). The invitation is created either way. A role_id that is not a role of the caller's organization is refused with 404 not_found, the same answer whether the role does not exist or belongs to another organization, and no invitation is created. A pending invitation holds a seat, as does each person holding a role, directly or through a group; when the plan's seats are all taken the invitation is refused with 402 billing.plan_limit (metadata resource seats, limit), and accepting it later takes no further seat. An invitation a person sent is accepted only while they still may give it: active, still in the organization and able to give its role, or acceptance is refused with 400 invite.invalid; removing them from the organization or deleting their account withdraws the invitations they sent. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key.
         */
        post: operations["createInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/{id}": {
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
         * Revoke invite
         * @description Withdraws a pending invitation; its link stops working. Requires member.invite.
         */
        delete: operations["revokeInvite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/{id}/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resend an invitation
         * @description Rotates the invitation token, extends its expiry, and re-sends the invitation email; the new link goes only to the invited address. Requires member.invite, and, as creating it does, every permission of the role the invitation grants (403 rbac.grant_exceeds_caller naming one the caller lacks; nothing changes). The response carries the invitation. Only pending or expired invites belonging to the caller's organization qualify; already-accepted or revoked invites are rejected. The recipient completes the flow through the accept-invite call, as with the original invitation. invite.delivery says whether the email went out (as on create): a suppressed address reports not_sent with email.suppressed rather than success.
         */
        post: operations["resendInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept invite (public)
         * @description Creates the invited account and signs it in. Its address is not verified by this: the account proves it later with a code or link sent to it (its invitations inbox stays closed until then). The response is a token pair, or, where the organization requires a second factor, the sign-in's challenge instead (mfa_required, mfa_token and, for an account with no factor yet, enrollment_required), met as at sign-in. Where the inviting organization has password sign-in switched off, accepting with a password is refused with 403 auth.method_disabled and nothing is created. An address on a domain another organization has verified gets no new account here (409 user.domain_managed_elsewhere): that organization creates it, and the invitee then signs in and accepts as themselves. An invitation whose sender may no longer give it (no longer active or in the organization, or no longer holding its role's permissions) is refused with 400 invite.invalid.
         */
        post: operations["acceptInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/accept/passkey/begin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invitation with a passkey — begin (public)
         * @description Starts accepting an invitation by founding the new account on a passkey instead of a password, returning the WebAuthn credential-creation options. The account's email and organization come from the invitation, never from the request. Refused like POST /v1/invites/accept (invite.link_invalid, invite.invalid, invite.expired, invite.account_exists — the invitee signs in and accepts as themselves, user.domain_managed_elsewhere), and with passkey.disabled when the organization has passkeys switched off. Starting again replaces an unfinished ceremony for the same invitation; the invitation stays pending until one finishes.
         */
        post: operations["beginPasskeyInviteAcceptance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/accept/passkey/finish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invitation with a passkey — finish (public)
         * @description Verifies the passkey and, in one transaction, creates the account in the inviting organization with it, grants the invited role and marks the invitation accepted; then signs the invitee in, returning a token pair as POST /v1/invites/accept does. Each ceremony finishes once: a second attempt, or one after the ceremony expired (auth.session_expired), creates nothing and leaves the invitation as it was. Refused, with nothing created, when the invitation was accepted, revoked or expired meanwhile, its sender may no longer give it (400 invite.invalid), or the organization switched passkeys off.
         */
        post: operations["finishPasskeyInviteAcceptance"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Look up an invitation (public)
         * @description Previews the invitation an emailed link names, so the acceptance screen can show the organization and address and offer the ways of accepting it. A password is offered where the organization allows password sign-in, and a passkey where it allows passkeys. account_exists means an account already holds the address, so the invitee signs in and accepts as themselves. Refused like acceptance: invite.link_invalid, invite.invalid (no longer pending, or its sender may no longer give it), invite.expired. Read-only. The token travels in the body so it stays out of logs.
         */
        post: operations["lookUpInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the authenticated user's profile
         * @description Returns the profile of the authenticated caller, resolved from the presented token rather than any path parameter. Use it to render the signed-in user's own account details. Also accepts the hosted-login session cookie (qe_ls) in place of a bearer token.
         */
        get: operations["getMyProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update the authenticated user's profile
         * @description Updates the authenticated caller's own profile. Only the supplied fields are changed, and the account is always resolved from the token, so a caller can never edit another user's profile through this route.
         */
        patch: operations["updateMyProfile"];
        trace?: never;
    };
    "/v1/me/email/change/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm my email change
         * @description Verifies the code sent to the new address and swaps it onto the account (marking it verified). Returns the new email. Only a code from the start-email-change call counts. The previous address is sent a notice of the change, and the reset and magic links already sent to it stop working. The organization's rules of the start call are applied again here (403 verification.email_managed), so a domain verified in between counts. Five wrong codes retire a code, and ten wrong codes in an hour, over every code asked for in between, refuse even the right one until the hour has passed (429 verification.attempts_exceeded with retry_after, in seconds).
         */
        post: operations["confirmMyEmailChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/email/change/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start changing my email
         * @description Sends an 8-digit verification code to the address the caller wants to move to, to prove they control it; confirm it with the confirm-email-change call. A new code replaces the caller's earlier ones, and one the mail provider refuses is withdrawn. At most ten codes an hour go to one person, and five to one address over every account, an address in use included (429 verification.code_send_limited with retry_after, in seconds). The answer is the same whether or not the address is already in use by another account. An address in use is sent a notice that it already has an account instead of a code, and is never assigned to the caller. An organization decides some changes, refused with 403 verification.email_managed saying which: an address its directory (SCIM) or single sign-on provides changes there; an address on a domain the account's organization manages moves only to another of its domains; and no address moves onto a domain another organization manages.
         */
        post: operations["startMyEmailChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List invitations addressed to me
         * @description Pending, unexpired invitations addressed to the signed-in user's email, each with the inviting organization's name — the in-app inbox for a user who may not belong to any org yet. Answers 403 invite.email_not_verified until the account's address is verified: anyone can sign up with any address.
         */
        get: operations["listMyInvites"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/invites/{id}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invitation from my inbox (by id)
         * @description Same as accepting by token, but selects the invite by id (from GET /v1/me/invites). Returns an organization-scoped token pair, under the same second-factor rule. Answers 403 invite.email_not_verified until the account's address is verified.
         */
        post: operations["acceptMyInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/invites/{id}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Decline an invitation from my inbox
         * @description Dismisses a pending invitation addressed to the caller's email (marks it declined). Scoped by email, so one user can't decline another's. Answers 403 invite.email_not_verified until the account's address is verified.
         */
        post: operations["declineMyInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/invites/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an invitation with my existing account (by token)
         * @description Joins the caller's existing account to the invited organization (no new user, no password) and returns an organization-scoped token pair. The invite must be addressed to the caller's own email (`invite.email_mismatch` otherwise), and its sender must still be able to give it (400 `invite.invalid`). An organization that requires a second factor of the caller (its security policy, or administrators-only for its administrators) is entered (the pair issued) only by a session whose sign-in met one, or that holds a fresh step-up; otherwise 403 step_up_required (step up, then switch in) or 403 mfa.enrollment_required (set a factor up first), unless the organization's grace period still lets the caller put the setup off. The new session carries the factor on, and continues the caller's sign-in: it ends when the caller's session would. The invite stays accepted when the pair is refused.
         */
        post: operations["acceptMyInviteByToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organizations available to the signed-in user
         * @description Caller-scoped user-only list of the active, non-deleted organizations the caller belongs to (their own organization, and each one where they hold a role). No user or organization identity is taken from query parameters. last_used_at excludes the current session so automatic sign-in scope is not labeled as a prior selection. Also accepts the hosted-login session cookie (qe_ls) in place of a bearer token, so Qeet ID's own hosted pages can list the caller's organizations by name. The cookie belongs to Qeet ID's sign-in domain, so another site's browser code cannot send it.
         */
        get: operations["listMyOrganizations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List organizations
         * @description Returns a page of the organizations the authenticated principal belongs to. Scope is taken from the caller's identity, never from a query parameter. Use the returned cursor to page through large result sets. A newly registered user with no organization sees an empty page until an organization is created.
         */
        get: operations["listOrganizations"];
        put?: never;
        /**
         * Create organization
         * @description Creates an organization and makes the calling user its owner. A newly registered user has no organization until this succeeds; every organization-scoped endpoint requires one. A verified email is required before an organization can be provisioned. Only the free plan is created here (plan may be left out): pro and enterprise answer 402 billing.checkout_required, since a paid plan starts with checkout. Every organization is created in the region this service is hosted in; asking for another is refused with 422 organization.region_unavailable (metadata.available names the one there is). The response includes a organization-scoped token pair so the client can immediately switch into the new organization; it continues the caller's session (its sign-in, second factor and end), and is left out for a caller without one.
         */
        post: operations["createOrganization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get organization
         * @description Returns a single organization by id. The caller must be a member of the organization; requests for an organization the principal does not belong to are rejected rather than disclosed.
         */
        get: operations["getOrganization"];
        put?: never;
        post?: never;
        /**
         * Delete organization
         * @description Schedules the organization's deletion seven days from now (202 with deletion_due_at), audited as organization.deletion_scheduled. Requires organization.delete, and only a person who owns the organization may (403 organization.owner_only otherwise), and 409 organization.deletion_scheduled answers one already scheduled. Until it is due the organization keeps working and shows deletion_due_at, and an owner can call it off (POST /v1/organizations/{organizationID}/deletion/cancel). Once due, a background job soft-deletes it: members lose access and organization-scoped calls stop resolving. Users who belonged only to this organization are left without one and must create or join another. In the same transaction every session in the organization ends (session.revoked with reason organization_deleted) and the deletion is audited (organization.deleted, by the system) and queued as an event; refresh and every sign-in refuse the organization from then on (403 auth.organization_inactive). The sessions' access tokens stop working on this API at once; a service that verifies tokens offline accepts one until it expires. Thirty days after that its data is purged for good: every row of it, its audit trail included, and the accounts whose home it was (one still a member of another organization is kept, with no home organization). A record of the purge (when, and how many rows of each table) outlives it, with a platform audit event organization.purged.
         */
        delete: operations["deleteOrganization"];
        options?: never;
        head?: never;
        /**
         * Update organization
         * @description Updates mutable organization attributes such as name and slug. Requires an administrative role within the organization. Only the fields supplied in the request body are changed. Changing status is an owner's (403 organization.owner_only otherwise), and an organization can't suspend itself (403 organization.self_suspend): that would lock out every member, its owners too, with nobody left to reactivate it; delete it instead. An organization suspended another way that is reactivated is audited as organization.reactivated and queued as an event. The region can't be changed (422 organization.region_read_only; the current value is accepted). A change to the name, logo or metadata is audited, in the same transaction, as organization.updated naming every field that changed (changed), with the old and new name (changes); the logo and metadata are named but not copied. An update that changes nothing records nothing.
         */
        patch: operations["updateOrganization"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/branding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get branding
         * @description Organization branding, including optional background_color and email_reply_to values in settings. Unknown settings are preserved by clients. Custom sender addresses are configuration preferences and do not activate a provider identity. The saved branding is returned whatever the plan, but the hosted login and emails show it only while the organization's plan includes custom_branding; after the plan lapses they use the default appearance.
         */
        get: operations["getBranding"];
        /**
         * Update branding
         * @description Requires custom_branding entitlement. Accepts at most 3 MiB of JSON, including an optional base64 PNG, JPEG, WEBP or SVG logo of at most 2 MiB decoded. settings.background_color is a six-digit hex color or empty for the default; settings.email_reply_to is a single mailbox or empty. Sender name and reply-to apply only to organization invitations and magic links. The provider-approved From address is retained.
         */
        put: operations["setBranding"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/break-glass-members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List break-glass members
         * @description Lists the members who keep their own sign-in methods (password, magic links, passkeys, password resets) on a domain where the organization requires single sign-on, so an outage of its identity provider can't lock everyone out. Requires connection.read.
         */
        get: operations["listBreakGlassMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/break-glass-members/{userID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Make a member break-glass
         * @description Lets a member keep their own sign-in methods on a domain where the organization requires single sign-on. The member must belong to the organization (it is their home, or they hold one of its roles), else 404 domainverify.not_member. Only an owner, in person, may (403 rbac.owner_only for anyone else, including an API key or other credential), with a recent step-up (403 step_up_required). Recorded in the audit trail as domain.break_glass_added in the same transaction; making a break-glass member break-glass again changes and records nothing.
         */
        put: operations["addBreakGlassMember"];
        post?: never;
        /**
         * Remove a break-glass member
         * @description Makes a break-glass member an ordinary one again: on a domain where the organization requires single sign-on they sign in only through it. Owner-only with a recent step-up, as for adding one. Recorded in the audit trail as domain.break_glass_removed in the same transaction; removing someone who isn't break-glass changes and records nothing.
         */
        delete: operations["removeBreakGlassMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/deletion/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel organization deletion
         * @description Calls off the organization's scheduled deletion and returns the organization, audited as organization.deletion_cancelled. Requires organization.delete, and only a person who owns the organization may (403 organization.owner_only otherwise); 409 organization.deletion_not_scheduled when none is.
         */
        post: operations["cancelOrganizationDeletion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List domains
         * @description Lists the domains claimed by the organization together with the DNS record each requires and its current verification status. Use this to track which domains are pending, verified, or failing checks. New domains are added with the claim-domain call and confirmed with the verify-domain call.
         */
        get: operations["listDomains"];
        put?: never;
        /**
         * Claim domain
         * @description Registers a domain for the organization and returns the DNS TXT record that must be published to prove ownership. The record lives under a dedicated verification subdomain so it does not disturb existing apex TXT records such as SPF. Publish the returned record in DNS, then call the verify-domain endpoint to complete the claim.
         */
        post: operations["claimDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/domains/{id}": {
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
         * Remove domain
         * @description Removes a claimed or verified domain from the organization. Any domain-based features that depended on it stop applying. Re-adding the domain later requires claiming and verifying it again.
         */
        delete: operations["deleteDomain"];
        options?: never;
        head?: never;
        /**
         * Update domain settings
         * @description Toggles SSO routing and just-in-time provisioning. Each switch applies to the addresses the domain manages once it is verified: the domain itself and those below it that no closer verified domain takes. With sso_enabled on, while the organization has an active SAML, LDAP or OpenID Connect connection, those addresses sign in only through it: password sign-in, magic links, passkey sign-in, password resets and self sign-up answer 403 auth.sso_required (with the connections to use), except for the organization's break-glass members (see the break-glass-members calls) and its administrators single sign-on can't sign in. With jit_enabled on, a SAML, LDAP or OpenID Connect sign-in creates an account for an address that has none; with it off, only existing members are adopted (saml.jit_not_allowed / ldap.jit_not_allowed / oidc_connection.jit_not_allowed otherwise). Both are off for a new domain.
         */
        patch: operations["updateDomain"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/domains/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify domain
         * @description Performs a live DNS lookup for the previously issued TXT record and, on a match, marks the domain verified by setting verified_at. Claim the domain first so the expected record is known; verification is only attempted when explicitly requested here, not in the background. Verifying ownership does not by itself enable SSO or just-in-time provisioning for the domain.
         */
        post: operations["verifyDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List groups
         * @description Lists the organization's groups. Requires group.read. A caller who also holds role.read gets each group's roles (those granted to the group itself), all read in one query, and may filter by them; without it roles are left out, and a role filter is refused with 403.
         */
        get: operations["listGroups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List invites
         * @description Lists the organization's invitations, without their tokens. Requires user.read.
         */
        get: operations["listInvites"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/login-domain": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Custom login domain status
         * @description Provisioning state of the organization's custom hosted-login hostname, plus the DNS records to publish, as last checked (checked_at): a read returns the kept result, and checks only when the hostname was never checked or has changed since; POST /v1/organizations/{organizationID}/login-domain/check runs a new check. Each stage is checked in order: the TXT record (dns_verified); then, over HTTPS, a certificate valid for the hostname (tls_state issued; pending until one is served); then the hosted login answering its health check on the hostname (endpoint_state live, with endpoint_url). TLS and the login endpoint report their own stage rather than being inferred from the DNS result. status is active once all three are done, pending before, and not_configured without a hostname.
         */
        get: operations["getLoginDomainStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/login-domain/check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check the custom login domain now
         * @description Checks every stage of the organization's custom hosted-login hostname now (as GET /v1/organizations/{organizationID}/login-domain describes), keeps the result as the last check, and returns it with checked_at. Needs connection.read.
         */
        post: operations["checkLoginDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/users/{id}/passkeys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a user's passkeys
         * @description The passkeys on a member's account, oldest first: each one's name, when it was added and when it last signed them in. Requires user.read; someone who doesn't belong to the caller's organization answers 404.
         */
        get: operations["listUserPasskeys"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/users/{id}/passkeys/{passkeyID}": {
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
         * Remove a user's passkey
         * @description Removes a passkey from a user's account, for example a lost device's, so it no longer signs them in. Requires user.credentials and a recent sign-in (step-up). Like a second-factor reset it is for the account's home organization only (403 user.managed_elsewhere for a member from elsewhere), and is refused with 403 user.credentials_shared, nothing changing, while the account also belongs to another organization. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one). The account's last way to sign in isn't removed (409 auth.last_sign_in_method). A passkey that isn't theirs answers 404. Audited as passkey.admin_deleted with the passkey's ID and name, and the person is emailed that an administrator of this organization removed it.
         */
        delete: operations["deleteUserPasskey"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/users/{id}/sessions/{sessionID}": {
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
         * End one of a user's sessions
         * @description Ends one of the user's live sessions, as GET /v1/users/{id}/sessions lists them: one in the caller's organization, or an account-level one when it is the user's home organization. Its refresh tokens stop working at once; access tokens it was issued are refused as the session's end is noticed. Requires session.revoke. The person must not outrank the caller: only an owner signs out an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one). A session that isn't theirs there, or has already ended, answers 404. Audited as session.admin_revoked with the session's ID, and announced to session.revoked subscribers with reason admin_revoked.
         */
        delete: operations["revokeUserSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/users/{id}/sign-ins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A person's sign-in summary
         * @description How the member signed in to the organization over a period, from its audit log: sign-ins by first method, with how many met a second step (recorded as metadata.second_factor from this release, or a method ending _mfa); by address (the 20 most used, with the last time); by browser and platform, as the session list names them; and failed sign-ins by reason. The period is from and to (RFC 3339), or days back from to (or now); 30 days by default, at most 366. A person from another organization counts their sign-ins to this one. Requires audit.read.
         */
        get: operations["getUserSignInSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List users
         * @description Returns a page of users in the caller's organization, with total, how many match. Every filter is optional and they combine: q (display name, email or phone, case-insensitive), role (a role name in the organization), department (metadata.department), mfa (on or off: a confirmed second factor), email_verified, status (active, invited or suspended), last_seen (today: under a day; week: 1 to 7 days; month: 7 to 30 days; older: over 30 days; never). sort is created (the default, newest first), name or last_seen, with order asc or desc; a malformed value is refused with 400. Pages by opaque cursor, in the default order only: next_cursor is present while there is another page, and any other order answers its first page. Requires an existing organization; scope comes from the authenticated principal. Members are the organization's own users (their home is this organization) and the people who hold a role in it; a member whose home is another organization is shown with empty metadata, which their home organization keeps; last_seen_at and last_seen_ip come from sessions in this organization only.
         */
        get: operations["listUsers"];
        put?: never;
        /**
         * Create user
         * @description Creates a user within the caller's organization. An initial password may be supplied, otherwise the account is created without a password credential and the user signs in via passkey, magic link, or an admin-triggered reset. The password must meet the organization's password rules (minimum length and required character classes), the offline strength baseline and, when enabled, the breached-password check; a refusal is a 422 naming the rule that failed (authpolicy.password_* or auth.password_weak). A refused password writes nothing. An address on a domain another organization has verified is refused with 409 user.domain_managed_elsewhere: only that organization creates accounts there. Requires an existing organization. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key.
         */
        post: operations["createUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get user
         * @description Returns a single user by id within the caller's organization. Requests for a user outside the organization are rejected rather than disclosed. Anyone who belongs to the caller's organization can be fetched: a role here, or here being their home. Anyone else is 404. Someone whose home is another organization is shown with empty metadata, which their home organization keeps.
         */
        get: operations["getUser"];
        put?: never;
        post?: never;
        /**
         * Delete user
         * @description Soft-deletes the user, moving the account into the organization recycle bin rather than erasing it. Requires user.delete. A soft-deleted account can be brought back with the restore call or removed for good with the purge call. It continues to appear in the deleted-users list until purged. In the same transaction every way the user is signed in ends (sessions, hosted-login sessions, application grants, remembered devices and pending authorizations), the deletion is audited (user.deleted, naming the admin) and a user.deleted event is queued; restoring the account brings none of those sessions back. The same transaction revokes the admin-portal links and pending invitations the user issued here and, when they created any integration here that still works (a service principal, SCIM token, webhook, auth hook or OIDC application), records the critical user.integrations_left event listing them for review. The answer names the deleted user, when, and by whom. Only the organization the account belongs to can delete it; for a member whose account belongs elsewhere the call answers 403 user.managed_elsewhere. Refused with 409 organization.last_owner, and nothing changes, when it would leave this organization with no active owner: make someone else an owner first. An organization the person owns elsewhere doesn't block it; it is left without an active owner. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        delete: operations["deleteUser"];
        options?: never;
        head?: never;
        /**
         * Update user
         * @description Updates mutable attributes of a user in the caller's organization. Only the fields present in the request body are modified. This edits directory attributes, not credentials or verification state. Changing the account (status, profile) belongs to the organization the account belongs to; for a member whose account belongs elsewhere the call answers 403 user.managed_elsewhere and nothing changes. Remove them from this organization instead (DELETE /v1/users/{id}/membership). Suspending is refused with 409 organization.last_owner, and nothing changes, when it would leave this organization with no active owner: make someone else an owner first. An organization the person owns elsewhere doesn't block it; it is left without an active owner. Changing the phone number clears its verification. A change to the display name, avatar, phone number or metadata is audited, in the same transaction, as user.updated naming the fields that changed (changed), never their values; a status change is audited as user.suspended or user.reactivated. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        patch: operations["updateUser"];
        trace?: never;
    };
    "/v1/users/{id}/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * User access summary
         * @description Per-user access within the caller's organization (User 360): the organization (organization), directly-assigned roles, group memberships, and counts of consented applications and enabled organization policies. Requires `user.read`.
         */
        get: operations["getUserAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/membership": {
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
         * Remove a member from this organization
         * @description Removes a member whose account belongs to another organization (or to none) from the caller's organization (requires user.delete), in one transaction: their roles and groups here, their sessions here, and the application grants and API keys they hold here. Their account and their other organizations are left alone. Audited as user.removed_from_organization, with an event; the admin-portal links and pending invitations they issued here are revoked, and the integrations they created here are listed in the critical user.integrations_left event, as on deleting an account. The organization's own accounts are suspended or deleted instead (409 user.managed_here); someone who doesn't belong here is 404. Removing an owner is refused with 409 organization.last_owner, and nothing changes, when it would leave the organization with no active owner. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        delete: operations["removeUserMembership"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/mfa": {
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
         * Admin reset user MFA
         * @description Account-recovery for a locked-out user, which also lifts a lock of their second-factor sign-in (403 mfa.locked). Requires the `user.credentials` permission; audited as `mfa.admin_reset`. Refused with 403 user.credentials_shared, and nothing changes, when the account also belongs to another organization: its password and second factors are the person's credentials there too, so only they change them (the password reset link reaches only their address). Otherwise the person is emailed that an administrator of this organization made the change. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        delete: operations["resetUserMfa"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/mfa-required": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set user MFA-required policy
         * @description Toggle the per-user `mfa_required` policy flag. Requires `user.credentials`; audited as `user.mfa_required_set` with the value set (`mfa_required`), in the same transaction as the change. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        put: operations["setUserMfaRequired"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Set password
         * @description Administratively sets or replaces a user's password. Requires user.credentials. The password must meet the organization's password rules (minimum length and required character classes), the offline strength baseline and, when enabled, the breached-password check; a refusal is a 422 naming the rule that failed (authpolicy.password_* or auth.password_weak). Every way the user is signed in ends in the same step, as with the revoke-all-sessions call, since an admin password reset is treated as incident response: their sessions, their hosted sign-in (browser) sessions, so one opened with the old password can no longer start an application's sign-in or enrol a passkey, the refresh grants their applications hold, the devices remembered to skip the second factor, and pending authorisations (unredeemed codes and device or back-channel sign-in requests). The user must authenticate again after this call. The audit record counts each (revoked_sessions, revoked_login_sessions, revoked_app_grants, revoked_trusted_devices, ended_pending_authorizations). Answers 501 not_implemented when this server is not configured to end sign-ins. Refused with 403 user.credentials_shared, and nothing changes, when the account also belongs to another organization: its password and second factors are the person's credentials there too, so only they change them (the password reset link reaches only their address). Otherwise the person is emailed that an administrator of this organization made the change. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        post: operations["setUserPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/purge": {
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
         * Purge user
         * @description Permanently deletes a soft-deleted user, removing it from the recycle bin. Requires user.delete. This is irreversible and cannot be undone by the restore call. Use it only after the account has been soft-deleted. The account's personal API keys and role memberships go with it; agents it sponsored and applications it reviewed are kept without it; an erasure request for it is kept and still names it. Audited as user.purged, in the same transaction as the purge. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        delete: operations["purgeUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/push-devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a member's linked phones
         * @description Lists the phones a member has linked for push approval. Requires the user.read permission; 404 for someone who is not a member of the caller's organization.
         */
        get: operations["listUserPushDevices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/push-devices/{deviceID}": {
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
         * Disconnect a member's phone
         * @description Disconnects a member's linked phone, for example a lost one, so it receives no approval requests and cannot answer one. Requires the user.credentials permission; audited as mfa.push_device_revoked. Refused with 403 rbac.target_is_owner when the member is an owner and the caller isn't, and 403 rbac.target_outranks_caller when they hold a permission the caller doesn't.
         */
        delete: operations["disconnectUserPushDevice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/reactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reactivate a suspended owned user
         * @description Requires user.suspend and ownership in the active organization. Revokes existing sessions and records audit/outbox evidence atomically; old sessions are never restored. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        post: operations["reactivateUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore user
         * @description Brings a soft-deleted user back from the organization recycle bin, reversing an earlier delete call and returning the reactivated account. Requires user.delete. Only accounts that are still soft-deleted (not yet purged) can be restored. It is the counterpart to the purge call. An address another account has taken since the deletion is refused with 409 auth.email_exists. Audited as user.restored, in the same transaction as the restore. The person must not outrank the caller: only an owner changes an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        post: operations["restoreUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/security": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * User security posture
         * @description Aggregated authentication posture for a user (User 360): MFA factors (TOTP / email-SMS OTP / push), passkeys, recovery codes, password state, and the active-session / device count. The sessions counted are those the list-sessions call returns: only the user's sessions in the caller's organization, plus their account-level sessions (in no organization) when the caller's organization is the user's home organization. Requires `user.read`.
         */
        get: operations["getUserSecurity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a user's live sessions
         * @description Admin view of a user's active (non-revoked) sessions, most recently seen first: only their sessions in the caller's organization, plus their account-level sessions (in no organization) when the caller's organization is the user's home organization. Sessions the user holds in other organizations are not listed. Requires `user.read`.
         */
        get: operations["listUserSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/sessions/revoke-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke all of a user's sessions
         * @description Admin force sign-out — ends every way the user is signed in, in one all-or-nothing step: every live session, every hosted-login (browser) session and every refresh grant held by applications, and records it as an administrative force sign-out. The access tokens of the user's sessions stop working on this API at once; applications' access tokens, and any a service verifies offline, last until they expire (minutes). Requires `session.revoke`. The person must not outrank the caller: only an owner signs out an owner (403 rbac.target_is_owner), and the caller must hold every permission the person holds here (403 rbac.target_outranks_caller naming one); acting on yourself is allowed.
         */
        post: operations["revokeAllUserSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/suspension": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Review a suspended owned user
         * @description Requires user.suspend and ownership. Updates review facts and emits audit/outbox evidence without reactivating the account.
         */
        put: operations["reviewUserSuspension"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/trusted-devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a member's remembered devices
         * @description Lists a member's devices remembered in the caller's organization. Requires the user.read permission; 404 for someone who is not a member.
         */
        get: operations["listUserTrustedDevices"];
        put?: never;
        post?: never;
        /**
         * Forget a member's remembered devices
         * @description Forgets every device a member has remembered in the caller's organization, so each is asked for the second factor at its next sign-in there. Requires the user.credentials permission; each is audited as auth.trusted_device_revoked. Refused with 403 rbac.target_is_owner when the member is an owner and the caller isn't, and 403 rbac.target_outranks_caller when they hold a permission the caller doesn't.
         */
        delete: operations["forgetAllUserTrustedDevices"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/trusted-devices/{deviceID}": {
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
         * Forget one of a member's remembered devices
         * @description Forgets one device a member has remembered in the caller's organization. Requires the user.credentials permission; 404 for a device that is not theirs there. Audited as auth.trusted_device_revoked. Refused with 403 rbac.target_is_owner when the member is an owner and the caller isn't, and 403 rbac.target_outranks_caller when they hold a permission the caller doesn't.
         */
        delete: operations["forgetUserTrustedDevice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/verify/email/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm email verification
         * @description Confirms email verification by validating the code delivered by the start-email-verification call and marking the address verified. Codes are single-use, expire after a short window, and are retired after a small number of wrong attempts, at which point a new code must be requested; ten wrong codes in an hour, over every code asked for in between, refuse even the right one until the hour has passed (429 verification.attempts_exceeded with retry_after, in seconds). Request the code with the start-email-verification call before invoking this. Only a code sent by the start-email-verification call to the address now on the account counts; a code sent for an email change is the invalid-code error.
         */
        post: operations["confirmEmailVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/verify/email/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start email verification
         * @description Sends a 6-digit code to the caller's address on file. It never verifies an address given in the request; moving to another address is the email-change flow (/v1/me/email/change/start). A new code replaces the caller's earlier ones, and one the mail provider refuses is withdrawn. At most ten codes an hour go to one person, and five to one address over every account (429 verification.code_send_limited with retry_after, in seconds).
         */
        post: operations["startEmailVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/verify/phone/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm phone verification
         * @description Confirms phone verification by validating the code delivered by the start-phone-verification call and marking the number verified. Codes are single-use, time-limited, and retired after a few incorrect attempts, requiring a fresh send; ten wrong codes in an hour, over every code asked for in between, refuse even the right one until the hour has passed (429 verification.attempts_exceeded with retry_after, in seconds). Request the code with the start-phone-verification call before invoking this. Audited in the audit trail of the organization the session is in as phone.verified, or phone.verification_failed with the reason for a wrong, used, expired or retired code, with the number masked to its last three digits.
         */
        post: operations["confirmPhoneVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{id}/verify/phone/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Start phone verification
         * @description Sends a 6-digit code to the number on file. Pass `phone` only to verify a different number. The number must be in E.164 form (422 validation_failed), SMS must be in the plan of the organization the session is in (402 billing.upgrade_required; refused outright for a session in none), and an SMS provider must be set up (503 verification.delivery_unavailable). As for MFA codes, a code goes at most every 30 seconds, ten an hour to one person and five an hour to one number over every account (429 verification.code_send_limited with retry_after, in seconds). A new code replaces the caller's earlier ones, and one the SMS provider refuses is withdrawn. Audited as phone.verification_started, with the number masked to its last three digits, in the audit trail of the organization the session is in.
         */
        post: operations["startPhoneVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk-create users
         * @description Create many users in one call. Each row is attempted independently — a bad or duplicate row, one on a domain another organization has verified, or one whose password the organization's password rules refuse, is reported in the response with its reason rather than failing the whole batch (partial success).
         */
        post: operations["bulkCreateUsers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/bulk/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import users from an IdP export (Auth0 / Cognito / Azure AD B2C)
         * @description Migration tooling for teams leaving another identity provider: the request body is that vendor's own raw user-export file, converted to the same shape POST /v1/users/bulk accepts and run through the identical per-row partial-success pipeline. No vendor exports a portable password hash, so every imported row lands with no password credential — passkey, magic link, OTP, or an admin-triggered reset are how an imported user first signs in.
         */
        post: operations["importUsers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/deleted": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List deleted users
         * @description Lists soft-deleted users held in the organization recycle bin. From here an account can be brought back with the restore call or removed permanently with the purge call.
         */
        get: operations["listDeletedUsers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * User directory summary
         * @description Organization-wide member counts for the Users admin summary: total, active, suspended, invited, with and without a second factor, new in the last 30 days; members by when they were last seen (last_seen: today, week, month, older, never, with the same edges as the list's last_seen filter); owners and admins without a second factor; members whose email isn't verified; and members by role and by department (metadata.department). Each count equals the list's total for the matching filter. Requires `user.read`.
         */
        get: operations["getUserStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/suspended": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List suspended users and review metrics
         * @description Requires user.read. Organization scope comes only from the authenticated principal. Includes owned accounts and organization members; private suspension metadata is masked for accounts owned elsewhere, with can_manage=false. Historical unknown timestamps and risk are not inferred.
         */
        get: operations["listSuspendedUsers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/trends": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * User directory 30-day trends
         * @description 30-day daily total/MFA-enrolled series for the Users KPI sparklines. Requires `user.read`.
         */
        get: operations["getUserTrends"];
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
        AcceptInput: {
            display_name: string;
            password: string;
            token: string;
        };
        AuthenticatorSelection: {
            authenticatorAttachment?: string;
            requireResidentKey?: boolean;
            residentKey?: string;
            userVerification?: string;
        };
        BreakGlassMember: {
            /** Format: date-time */
            created_at: string;
            /**
             * Format: uuid
             * @description The owner who named them, while that account exists.
             */
            created_by?: string;
            display_name?: string;
            email: string;
            /** Format: uuid */
            user_id: string;
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
        Delivery: {
            code?: string;
            message?: string;
            status: string;
        };
        DNSRecord: {
            name: string;
            type: string;
            value: string;
        };
        Domain: {
            /** Format: date-time */
            created_at: string;
            dns_record_name: string;
            dns_record_type: string;
            dns_record_value: string;
            domain: string;
            /** Format: uuid */
            id: string;
            /** @description Single sign-on creates an account at sign-in for an address on the domain that has none. */
            jit_enabled: boolean;
            /** Format: date-time */
            last_checked_at?: string;
            last_error?: string;
            /** @description Addresses on the domain sign in only through the organization's active SAML, LDAP or OpenID Connect connection (break-glass members and administrators single sign-on can't sign in excepted). */
            sso_enabled: boolean;
            status: string;
            verification_token: string;
            /** Format: date-time */
            verified_at?: string;
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
        Group: {
            /** Format: date-time */
            created_at: string;
            description: string;
            /** Format: uuid */
            id: string;
            member_count: number;
            name: string;
            /** Format: uuid */
            organization_id: string;
            /** Format: uuid */
            parent_id: string | null;
            /** @description The roles granted to the group itself, in the list only and only for a caller with role.read. */
            roles?: {
                name: string;
                /** Format: uuid */
                role_id: string;
            }[];
        };
        /** @description The group's organization is the caller's; it is never taken from the body. */
        GroupCreateInput: {
            description?: string | null;
            name: string;
            /**
             * Format: uuid
             * @description One of the organization's groups to nest it under; omit or null for a top-level group.
             */
            parent_id?: string | null;
        };
        GroupTemplate: {
            /** Format: date-time */
            created_at: string;
            description: string;
            group_count: number;
            /** Format: uuid */
            id: string;
            name: string;
            nodes: components["schemas"]["TemplateNode"][];
            /** Format: uuid */
            organization_id: string;
            /** Format: date-time */
            updated_at: string;
        };
        /** @description One group in a template tree. Recursive: `children` holds the same shape, up to 6 levels deep. */
        GroupTemplateNode: {
            children?: components["schemas"]["GroupTemplateNode"][] | null;
            description?: string | null;
            name: string;
        };
        /** @description Every field is optional; an omitted one keeps its value. */
        GroupUpdateInput: {
            description?: string | null;
            name?: string | null;
            /**
             * Format: uuid
             * @description The new parent group's id, or null to make the group top-level. Omit it to keep the parent.
             */
            parent_id?: string | null;
        };
        ImportResult: {
            created: number;
            failed: number;
            rows: components["schemas"]["ImportRowResult"][];
            skipped: number;
        };
        ImportRowResult: {
            /**
             * @description Set when the row isn't created: it has no name; a group of that name exists, or an earlier row made one; its parent is no existing group and no other row (or the rows form a cycle); or it failed on the server. Word the message from this.
             * @enum {string}
             */
            code?: "group.import_name_required" | "group.import_name_exists" | "group.import_parent_not_found" | "internal";
            /**
             * @description The row field the code concerns, when one does.
             * @enum {string}
             */
            field?: "name" | "parent";
            name: string;
            /** @description The code's meaning in English, kept for compatibility. */
            reason?: string;
            /** @enum {string} */
            status: "created" | "skipped" | "failed";
        };
        Invite: {
            /** Format: date-time */
            accepted_at: string | null;
            /** Format: date-time */
            created_at: string;
            delivery?: components["schemas"]["Delivery"];
            email: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            organization_id: string;
            /** Format: uuid */
            role_id: string | null;
            status: string;
        };
        InviteCreateInput: {
            email: string;
            /** Format: uuid */
            organization_id: string;
            /** Format: uuid */
            role_id: string | null;
        };
        LoginDomainStatus: {
            /**
             * Format: date-time
             * @description When this result was found; null without a hostname.
             */
            checked_at?: string | null;
            /** Format: date-time */
            dns_checked_at?: string;
            dns_detail: string;
            dns_verified: boolean;
            endpoint_state: string;
            endpoint_url?: string;
            login_domain: string;
            records: components["schemas"]["DNSRecord"][];
            status: string;
            tls_detail: string;
            tls_state: string;
        };
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
        Member: {
            display_name: string | null;
            email: string;
            /** Format: uuid */
            user_id: string;
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
        /** @description Present when there is another page: send it back as cursor to read that page. Absent on the last page. */
        NextCursor: string;
        Organization: {
            /** Format: date-time */
            created_at?: string;
            /**
             * Format: date-time
             * @description When a scheduled deletion takes effect; null when none is.
             */
            deletion_due_at?: string | null;
            /** Format: uuid */
            id?: string;
            /** @description List-only. Distinct members (rbac.user_roles holders) in this org. */
            member_count?: number;
            metadata?: {
                [key: string]: unknown;
            } | null;
            /** @description List-only. Members with at least one MFA factor enrolled. */
            mfa_enabled_count?: number;
            name?: string;
            /** @enum {string} */
            plan?: "free" | "pro" | "enterprise";
            /** @description The region this service is hosted in, where the organization's data is held. It is the same for every organization of a deployment and isn't a per-organization data-residency choice. */
            region?: string;
            slug?: string;
            /** @enum {string} */
            status?: "active" | "suspended";
            /** Format: date-time */
            updated_at?: string;
        };
        OrganizationBranding: {
            custom_domain?: string | null;
            /**
             * @deprecated
             * @description Accepted and ignored, and never returned. Email is sent from the platform's own address (an organization's domain would need verifying with the email provider); replies go to settings.email_reply_to.
             */
            email_from_address?: string | null;
            email_from_name?: string | null;
            logo_url?: string | null;
            /** Format: uuid */
            organization_id?: string;
            primary_color?: string | null;
            /** @description Brand-panel accent, independent of page background. */
            secondary_color?: string | null;
            settings?: {
                /** @description Hosted-login page background; empty keeps the default theme. */
                background_color?: string;
                /** @description Single reply mailbox for organization-scoped messages; empty omits Reply-To. */
                email_reply_to?: string;
            } & {
                [key: string]: unknown;
            };
        };
        OrganizationCreate: {
            metadata?: {
                [key: string]: unknown;
            } | null;
            name: string;
            /** @enum {string|null} */
            plan?: "free" | "pro" | "enterprise" | null;
            /** @description Optional. Only the region this service is hosted in is accepted (422 organization.region_unavailable, with metadata.available, otherwise); the organization is created there either way. */
            region?: string | null;
            slug: string;
        };
        OrganizationCreateResponse: {
            access_token?: string;
            /** Format: date-time */
            expires_at?: string;
            organization?: components["schemas"]["Organization"];
            /** Format: uuid */
            organization_id?: string;
            refresh_token?: string;
            /**
             * @example [
             *       "owner"
             *     ]
             */
            roles?: string[];
            /** Format: uuid */
            session_id?: string;
            token_type?: string;
            /** Format: uuid */
            user_id?: string;
        };
        OrganizationPage: {
            items?: components["schemas"]["Organization"][];
            next_cursor?: components["schemas"]["NextCursor"];
        } & components["schemas"]["Page"];
        OrganizationUpdate: {
            metadata?: {
                [key: string]: unknown;
            } | null;
            name?: string | null;
            /** @enum {string|null} */
            plan?: "free" | "pro" | "enterprise" | null;
            /** @description Read-only: the same value is accepted, as a form sends every field back; another is refused with 422 organization.region_read_only. */
            region?: string | null;
            /** @enum {string|null} */
            status?: "active" | "suspended" | null;
        };
        /** @description Cursor-paginated list wrapper. */
        Page: {
            items?: unknown[];
            /** @description Cursor for the next page; empty/absent at the end. */
            next_cursor?: string | null;
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
        ReceivedInvite: {
            /** Format: date-time */
            created_at: string;
            email: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            organization_id: string;
            organization_name: string;
            organization_slug: string;
            /** Format: uuid */
            role_id: string | null;
        };
        RelyingPartyEntity: {
            id: string;
            name: string;
        };
        SuspendedDirectoryUser: {
            avatar_url?: string | null;
            can_manage?: boolean;
            display_name?: string | null;
            /** Format: email */
            email?: string;
            /** Format: uuid */
            id?: string;
            /** Format: date-time */
            last_sign_in?: string | null;
            reason?: string;
            /** @enum {string} */
            review?: "pending" | "reviewed" | "external";
            /** @enum {string} */
            risk?: "unknown" | "low" | "medium" | "high";
            source?: string;
            /** Format: date-time */
            suspended_at?: string | null;
            team?: string;
        };
        TemplateNode: {
            children?: components["schemas"]["TemplateNode"][];
            description: string;
            name: string;
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
        User: {
            /** @description The same roles with their IDs. */
            assigned_roles?: {
                /** Format: uuid */
                id?: string;
                name?: string;
            }[];
            /** @description The person's picture as a data:image/ URL, or null for none. */
            avatar_url?: string | null;
            /** Format: date-time */
            created_at?: string;
            display_name?: string | null;
            /** Format: email */
            email?: string;
            /** Format: date-time */
            email_verified_at?: string | null;
            /** @description Number of groups the user belongs to in this organization; on the list and GET /v1/users/{id}. */
            groups_count?: number;
            /** @description The name of the organization that manages the account (organization_id). */
            home_organization_name?: string | null;
            /** Format: uuid */
            id?: string;
            /**
             * Format: date-time
             * @description Their most recent session activity or sign-in in this organization, or null; on the list and GET /v1/users/{id}.
             */
            last_seen_at?: string | null;
            /** @description The address of that session or sign-in, or null. */
            last_seen_ip?: string | null;
            metadata?: {
                [key: string]: unknown;
            } | null;
            /** @description True if the user has a confirmed TOTP, a verified OTP factor, or a push device; on the list and GET /v1/users/{id}. */
            mfa_enabled?: boolean;
            /** Format: uuid */
            organization_id?: string;
            phone?: string | null;
            /** Format: date-time */
            phone_verified_at?: string | null;
            /** @description Role names in the organization reading the user, on the list and GET /v1/users/{id}. */
            roles?: string[];
            /** @enum {string} */
            status?: "active" | "invited" | "suspended";
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
            updated_at?: string;
        };
        UserBulkImport: {
            /**
             * Format: uuid
             * @description Optional; when present must match the caller's organization.
             */
            organization_id?: string | null;
            /**
             * Format: uuid
             * @description A role of the organization to give every user the import makes, with the user in one transaction, audited as role.assigned. The whole import is refused, making nobody, when the caller lacks role.write or the authority the role carries (403 rbac.permission_denied, rbac.grant_exceeds_caller, rbac.owner_only), or the role isn't the organization's (404). Each user's role takes one of the plan's seats; once they are all taken, the rest of the rows are refused one by one with billing.plan_limit, making no account.
             */
            role_id?: string | null;
            users: {
                display_name?: string;
                /** Format: email */
                email: string;
                password?: string;
                /** @description E.164 */
                phone?: string;
            }[];
        };
        UserBulkImportResult: {
            /** @description The users the import made, by their row. */
            created: {
                email: string;
                /** Format: uuid */
                id: string;
                /** @description The row's place in the request, or its line in a vendor export. */
                line: number;
            }[];
            errors?: {
                /**
                 * @description Stable reason the row failed; word the error from this. Password, duplicate and domain refusals reuse the API error codes.
                 * @enum {string}
                 */
                code: "user.import_field_missing" | "user.import_field_invalid" | "user.import_field_too_long" | "user.import_row_malformed" | "user.import_source_invalid" | "auth.email_exists" | "user.domain_managed_elsewhere" | "authpolicy.password_too_short" | "authpolicy.password_no_uppercase" | "authpolicy.password_no_number" | "authpolicy.password_no_symbol" | "authpolicy.password_breached" | "auth.password_weak" | "internal";
                email?: string;
                /**
                 * @description The row's field the error concerns; absent when none.
                 * @enum {string}
                 */
                field?: "email" | "password" | "display_name" | "phone";
                /** @description POST /v1/users/bulk: the 1-based index in the users array. POST /v1/users/bulk/import: the line of the export file (azure_b2c: the 1-based position in value). Absent when the whole file failed. */
                line?: number;
                /** @description English text kept for compatibility; it may change. Show wording keyed on code. */
                message: string;
            }[];
            failed: number;
            succeeded: number;
        };
        UserCreate: {
            display_name?: string | null;
            /** Format: email */
            email: string;
            metadata?: {
                [key: string]: unknown;
            } | null;
            /** Format: uuid */
            organization_id: string;
            password?: string | null;
            /** @description E.164 */
            phone?: string | null;
        };
        UserEntity: {
            displayName: string;
            id: unknown;
            name: string;
        };
        UserPage: {
            items?: components["schemas"]["User"][];
            next_cursor?: components["schemas"]["NextCursor"];
            /** @description How many members the filters match. */
            total?: number;
        } & components["schemas"]["Page"];
        UserStats: {
            active?: number;
            /** @description Members holding the built-in owner or admin role with no confirmed second factor. */
            admins_without_mfa?: number;
            /** @description Up to 200 departments, largest first. */
            by_department?: {
                count?: number;
                department?: string;
            }[];
            by_role?: {
                count?: number;
                role?: string;
            }[];
            email_unverified?: number;
            invited?: number;
            last_seen?: {
                month?: number;
                never?: number;
                older?: number;
                today?: number;
                week?: number;
            };
            mfa_enabled?: number;
            mfa_missing?: number;
            new_last_30d?: number;
            suspended?: number;
            total?: number;
        };
        UserTrends: {
            /** @description 30-day daily cumulative MFA-enrolled count (oldest first). */
            mfa_enabled?: number[];
            /** @description 30-day daily cumulative member count (oldest first). */
            total?: number[];
        };
        UserUpdate: {
            /** @description A data:image/ URL, or an empty string to clear the picture. */
            avatar_url?: string | null;
            display_name?: string | null;
            metadata?: {
                [key: string]: unknown;
            } | null;
            phone?: string | null;
            /** @enum {string|null} */
            status?: "active" | "suspended" | null;
        };
        UserUser: {
            avatar_url: string | null;
            /** Format: date-time */
            created_at: string;
            display_name: string | null;
            email: string;
            /** Format: date-time */
            email_verified_at: string | null;
            groups_count?: number;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_seen_at?: string;
            last_seen_ip?: string;
            metadata: {
                [key: string]: unknown;
            };
            mfa_enabled?: boolean;
            /** Format: uuid */
            organization_id: string;
            phone: string | null;
            /** Format: date-time */
            phone_verified_at: string | null;
            roles?: string[];
            status: string;
            /** Format: date-time */
            updated_at: string;
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
        /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
        Limit: number;
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
    getBrandingLogo: {
        parameters: {
            query?: {
                /** @description The image's version, so a new upload isn't served from a cache; any value is accepted. */
                v?: string;
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
            /** @description The image */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "image/svg+xml": string;
                    "image/webp": string;
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createGroup: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["GroupCreateInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Group"];
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
    deleteGroup: {
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
    updateGroup: {
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
                "application/json": components["schemas"]["GroupUpdateInput"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Group"];
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
    listGroupMembers: {
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
                        items: components["schemas"]["Member"][];
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
    addGroupMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Added */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The plan has no seat left for someone the group would give a first role (billing.plan_limit). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    removeGroupMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userID: string;
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
    importGroups: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    groups: {
                        description?: string | null;
                        name: string;
                        /** @description Parent group name, resolved against existing and imported rows. */
                        parent?: string | null;
                    }[];
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
                    "application/json": components["schemas"]["ImportResult"];
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
    listGroupTemplates: {
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
                        items: components["schemas"]["GroupTemplate"][];
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
    createGroupTemplate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    description?: string | null;
                    name: string;
                    nodes: components["schemas"]["GroupTemplateNode"][];
                };
            };
        };
        responses: {
            /** @description OK */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GroupTemplate"];
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
    deleteGroupTemplate: {
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
    applyGroupTemplate: {
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
                "application/json": {
                    /** Format: uuid */
                    parent_id?: string | null;
                    /** @description Put before every group's name, such as "Pune · ". */
                    prefix?: string | null;
                    /** @description A new name for the template's one top group. */
                    root_name?: string | null;
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
                        items: components["schemas"]["Group"][];
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
    createInvite: {
        parameters: {
            query?: never;
            header?: {
                /** @description A key of the client's choosing, 1 to 255 printable characters, that makes retrying the request safe. Kept for 24 hours. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                /**
                 * @example {
                 *       "email": "grace@example.com",
                 *       "role_id": "018f2a6d-7b8c-7d9e-a0f1-2b3c4d5e6f70",
                 *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00"
                 *     }
                 */
                "application/json": components["schemas"]["InviteCreateInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "invite": {
                     *         "id": "018f2a74-5f6a-7b7c-9d8e-9f0a1b2c3d4e",
                     *         "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *         "email": "grace@example.com",
                     *         "role_id": "018f2a6d-7b8c-7d9e-a0f1-2b3c4d5e6f70",
                     *         "status": "pending",
                     *         "expires_at": "2026-10-01T10:20:00Z",
                     *         "accepted_at": null,
                     *         "created_at": "2026-09-24T10:20:00Z",
                     *         "delivery": {
                     *           "status": "sent"
                     *         }
                     *       }
                     *     }
                     */
                    "application/json": {
                        invite: components["schemas"]["Invite"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The plan has no seat left for another invitation (billing.plan_limit). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
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
    revokeInvite: {
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
    resendInvite: {
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
            /** @description Invitation resent */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        invite: components["schemas"]["Invite"];
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
    acceptInvite: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AcceptInput"];
            };
        };
        responses: {
            /** @description A token pair, or the second-factor challenge to complete first. */
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
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    beginPasskeyInviteAcceptance: {
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
                    token: string;
                };
            };
        };
        responses: {
            /** @description session_id and the publicKey creation options */
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
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    finishPasskeyInviteAcceptance: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    credential: {
                        [key: string]: unknown;
                    };
                    /** @description The passkey's name; defaults to one from the device. */
                    name?: string | null;
                    /** Format: uuid */
                    session_id: string;
                };
            };
        };
        responses: {
            /** @description Token pair for the new session */
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
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    lookUpInvite: {
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
            /** @description The invitation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        account_exists?: boolean;
                        email?: string;
                        /** Format: date-time */
                        expires_at?: string;
                        methods?: {
                            passkey?: boolean;
                            password?: boolean;
                        };
                        organization?: {
                            name?: string;
                            slug?: string;
                        };
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getMyProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description User profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    updateMyProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description A small image data URL (data:image/…); an empty string clears it. */
                    avatar_url?: string | null;
                    display_name?: string | null;
                    /**
                     * @description The console language.
                     * @enum {string|null}
                     */
                    locale?: "en" | "de" | "es" | "fr" | "hi" | "ja" | "pt" | "zh" | null;
                    /** @description Accepted and ignored here; an administrator changes it at PATCH /v1/users/{id}. */
                    metadata?: Record<string, never> | null;
                    /** @description Accepted and ignored here; an administrator changes it at PATCH /v1/users/{id}. */
                    phone?: string | null;
                    /** @description Accepted and ignored here; an administrator changes it at PATCH /v1/users/{id}. */
                    status?: string | null;
                } | null;
            };
        };
        responses: {
            /** @description Updated profile */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    confirmMyEmailChange: {
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
                        email: string;
                        message: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startMyEmailChange: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: email */
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
                        message: string;
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
    listMyInvites: {
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
                        items: components["schemas"]["ReceivedInvite"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    acceptMyInvite: {
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    declineMyInvite: {
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
                        message: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    acceptMyInviteByToken: {
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
            /** @description OK */
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
    listMyOrganizations: {
        parameters: {
            query?: {
                cursor?: string;
                /** @description Maximum items to return; a larger one returns 200. */
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Eligible organization page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** @description A verified organization domain, or empty if none. */
                            domain: string;
                            /** Format: uuid */
                            id: string;
                            /** Format: date-time */
                            last_used_at: string | null;
                            logo_url: string;
                            name: string;
                            plan: string;
                            region: string;
                            roles: string[];
                            slug: string;
                        }[];
                        next_cursor?: components["schemas"]["NextCursor"];
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
    listOrganizations: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Organization page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationPage"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createOrganization: {
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
                 *       "slug": "acme",
                 *       "name": "Acme, Inc.",
                 *       "plan": "free",
                 *       "metadata": {
                 *         "industry": "fintech"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["OrganizationCreate"];
            };
        };
        responses: {
            /** @description Created; caller becomes owner (token pair included) */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "organization": {
                     *         "id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *         "slug": "acme",
                     *         "name": "Acme, Inc.",
                     *         "plan": "free",
                     *         "region": "ap-south-1",
                     *         "created_at": "2026-09-24T10:15:00Z",
                     *         "updated_at": "2026-09-24T10:15:00Z",
                     *         "member_count": 1,
                     *         "mfa_enabled_count": 0
                     *       },
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *       "roles": [
                     *         "owner"
                     *       ],
                     *       "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0.eyJ0ZW5hbnQiOiJhY21lIn0.FAKE-signature",
                     *       "token_type": "Bearer",
                     *       "expires_at": "2026-09-24T11:15:00Z",
                     *       "refresh_token": "rt_1a2b3c4d5e6f70819a2b3c4d5e6f7081",
                     *       "session_id": "018f2a72-7d8e-7f90-b123-4c5d6e7f8091",
                     *       "user_id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f"
                     *     }
                     */
                    "application/json": components["schemas"]["OrganizationCreateResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            402: components["responses"]["PaymentRequired"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getOrganization: {
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
            /** @description Organization */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteOrganization: {
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
            /** @description Deletion scheduled */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        deletion_due_at?: string;
                        /** Format: uuid */
                        organization_id?: string;
                    };
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
    updateOrganization: {
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
                "application/json": components["schemas"]["OrganizationUpdate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
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
    getBranding: {
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
                    "application/json": components["schemas"]["OrganizationBranding"];
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
    setBranding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        /** @description Complete editable branding fields and settings. Preserve unrelated settings when updating. The organization ID is enforced by the authenticated route scope. */
        requestBody?: {
            content: {
                "application/json": components["schemas"]["OrganizationBranding"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrganizationBranding"];
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
    listBreakGlassMembers: {
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
            /** @description The organization's break-glass members */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["BreakGlassMember"][];
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
    addBreakGlassMember: {
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
            /** @description The member is break-glass */
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
    removeBreakGlassMember: {
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
            /** @description The person is no longer break-glass */
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
    cancelOrganizationDeletion: {
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
            /** @description Deletion cancelled */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Organization"];
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
    listDomains: {
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
            /** @description Domains with their DNS verification records */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["Domain"][];
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
    claimDomain: {
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
                    domain: string;
                };
            };
        };
        responses: {
            /** @description Domain claimed; publish the returned TXT record then verify */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
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
    deleteDomain: {
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
            /** @description Domain removed */
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
    updateDomain: {
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
                    jit_enabled?: boolean | null;
                    sso_enabled?: boolean | null;
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
                    "application/json": components["schemas"]["Domain"];
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
    verifyDomain: {
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
            /** @description Verification result (verified_at set on success) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Domain"];
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
    listGroups: {
        parameters: {
            query?: {
                /** @description Only the groups that grant some role, or none. Needs role.read. */
                grants?: "some" | "none";
                /** @description Only the groups granted this role. Needs role.read. */
                role?: string;
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
                        items: components["schemas"]["Group"][];
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
    listInvites: {
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
                        items: components["schemas"]["Invite"][];
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
    getLoginDomainStatus: {
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
                    "application/json": components["schemas"]["LoginDomainStatus"];
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
    checkLoginDomain: {
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
            /** @description The new check */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginDomainStatus"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listUserPasskeys: {
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
            /** @description The user's passkeys */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: {
                            /** Format: date-time */
                            created_at?: string;
                            /** Format: uuid */
                            id?: string;
                            /** Format: date-time */
                            last_used_at?: string | null;
                            name?: string | null;
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
    deleteUserPasskey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                passkeyID: string;
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
            409: components["responses"]["Conflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeUserSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
                sessionID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ended */
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
    getUserSignInSummary: {
        parameters: {
            query?: {
                days?: number;
                from?: string;
                to?: string;
            };
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
            /** @description The summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        by_address?: {
                            count?: number;
                            ip?: string;
                            /** Format: date-time */
                            last_at?: string;
                        }[];
                        by_browser?: {
                            count?: number;
                            device?: string;
                            kind?: string;
                        }[];
                        by_method?: {
                            count?: number;
                            method?: string;
                            with_second_step?: number;
                        }[];
                        failures?: number;
                        failures_by_reason?: {
                            count?: number;
                            reason?: string;
                        }[];
                        /** Format: date-time */
                        from?: string;
                        sign_ins?: number;
                        /** Format: date-time */
                        to?: string;
                        with_second_step?: number;
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
    listUsers: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                department?: string;
                email_verified?: boolean;
                last_seen?: "today" | "week" | "month" | "older" | "never";
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: components["parameters"]["Limit"];
                mfa?: "on" | "off";
                order?: "asc" | "desc";
                q?: string;
                role?: string;
                sort?: "created" | "name" | "last_seen";
                status?: "active" | "invited" | "suspended";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description User page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserPage"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createUser: {
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
                 *       "email": "grace@example.com",
                 *       "display_name": "Grace Hopper"
                 *     }
                 */
                "application/json": components["schemas"]["UserCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "018f2a73-4e5f-7a6b-8c7d-8e9f0a1b2c3d",
                     *       "organization_id": "018f2a6c-9c3d-7e4a-b2f1-3a5c9d8e1f00",
                     *       "email": "grace@example.com",
                     *       "email_verified_at": null,
                     *       "phone": null,
                     *       "phone_verified_at": null,
                     *       "display_name": "Grace Hopper",
                     *       "avatar_url": null,
                     *       "status": "active",
                     *       "metadata": {},
                     *       "created_at": "2026-09-24T10:20:00Z",
                     *       "updated_at": "2026-09-24T10:20:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["User"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            503: components["responses"]["Overloaded"];
        };
    };
    getUser: {
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
            /** @description User */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteUser: {
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
            /** @description The deleted user */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        deleted_at?: string;
                        /** Format: uuid */
                        deleted_by?: string | null;
                        /** Format: uuid */
                        id?: string;
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
    updateUser: {
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
                "application/json": components["schemas"]["UserUpdate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
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
    getUserAccess: {
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
            /** @description Access summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        applications_count?: number;
                        groups?: {
                            description?: string;
                            /** Format: uuid */
                            id?: string;
                            name?: string;
                        }[];
                        organization?: {
                            /** Format: uuid */
                            id?: string;
                            name?: string;
                            slug?: string;
                        } | null;
                        permissions_direct?: number;
                        permissions_inherited?: number;
                        permissions_total?: number;
                        policies_count?: number;
                        roles?: {
                            description?: string;
                            /** Format: uuid */
                            id?: string;
                            name?: string;
                        }[];
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
    removeUserMembership: {
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
            /** @description The member was removed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        id?: string;
                        roles_removed?: number;
                        sessions_ended?: number;
                    };
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
    resetUserMfa: {
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
            /** @description MFA reset; returns a confirmation message */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    setUserMfaRequired: {
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
                    required: boolean;
                };
            };
        };
        responses: {
            /** @description MFA-required flag updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        mfa_required?: boolean;
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
    setUserPassword: {
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
                    password: string;
                };
            };
        };
        responses: {
            /** @description Password set */
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
            /** @description Not configured on this server (`not_implemented`); nothing changes. */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: components["responses"]["Overloaded"];
        };
    };
    purgeUser: {
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
            /** @description Permanently purged */
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
    listUserPushDevices: {
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
                        items?: {
                            /** Format: date-time */
                            created_at?: string;
                            /** Format: uuid */
                            id?: string;
                            /** Format: date-time */
                            last_seen_at?: string;
                            name?: string;
                            /** @enum {string} */
                            platform?: "ios" | "android";
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
    disconnectUserPushDevice: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                deviceID: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disconnected */
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
    reactivateUser: {
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
            /** @description User reactivated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserUser"];
                };
            };
            400: components["responses"]["BadRequest"];
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing user.suspend */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Account not owned by this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Account is no longer suspended */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    restoreUser: {
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
            /** @description Restored */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["User"];
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
    getUserSecurity: {
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
            /** @description Security posture */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        active_sessions?: number;
                        distinct_devices?: number;
                        mfa_enabled?: boolean;
                        mfa_required?: boolean;
                        otp_factors?: number;
                        /** Format: date-time */
                        passkey_last_used_at?: string | null;
                        passkeys?: number;
                        /** Format: date-time */
                        password_changed_at?: string | null;
                        password_set?: boolean;
                        push_devices?: number;
                        recovery_codes_remaining?: number;
                        totp_enabled?: boolean;
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
    listUserSessions: {
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
            /** @description Active sessions */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: {
                            /** @description The city it was opened from, when the proxy names one. */
                            city?: string;
                            /** @description Where the session was opened, approximately (ISO 3166-1 alpha-2); omitted when unknown. */
                            country?: string;
                            /** Format: date-time */
                            created_at?: string;
                            /** @description The device and browser in words ("Chrome on macOS"), as the person's own session list says. */
                            device?: string;
                            /** @enum {string} */
                            device_kind?: "desktop" | "mobile" | "tablet" | "unknown";
                            /** Format: uuid */
                            id?: string;
                            ip?: string | null;
                            /** Format: date-time */
                            last_seen_at?: string;
                            user_agent?: string | null;
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
    revokeAllUserSessions: {
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
            /** @description Sessions revoked */
            200: {
                headers: {
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
                        /** @description Number of sign-ins ended, all places together. */
                        revoked: number;
                        /** @description Sessions ended. */
                        sessions: number;
                        /** @description Devices remembered to skip the second factor that were forgotten; each is asked for the second factor at its next sign-in. */
                        trusted_devices: number;
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
    reviewUserSuspension: {
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
                    /** @enum {string} */
                    reason: "unspecified" | "provider" | "suspicious_activity" | "policy_violation" | "account_compromise" | "offboarding" | "inactive" | "other";
                    /** @enum {string} */
                    review: "pending" | "reviewed";
                    /** @enum {string} */
                    risk: "unknown" | "low" | "medium" | "high";
                };
            };
        };
        responses: {
            /** @description Review saved */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid review facts */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing user.suspend */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Account not owned by this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Account is no longer suspended */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listUserTrustedDevices: {
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
                        items?: {
                            /** Format: date-time */
                            created_at?: string;
                            /** @description The request came from this device. */
                            current?: boolean;
                            /** @description The device and browser in words, such as "Chrome on macOS". */
                            device?: string;
                            /** @enum {string} */
                            device_kind?: "desktop" | "mobile" | "tablet" | "unknown";
                            /** Format: date-time */
                            expires_at?: string;
                            /** Format: uuid */
                            id?: string;
                            /**
                             * Format: date-time
                             * @description When the device last skipped the second factor.
                             */
                            last_used_at?: string | null;
                            /**
                             * Format: uuid
                             * @description The organization the device was remembered in.
                             */
                            organization_id?: string | null;
                            user_agent?: string;
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
    forgetAllUserTrustedDevices: {
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
    forgetUserTrustedDevice: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                deviceID: string;
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
    confirmEmailVerification: {
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
                    code: string;
                };
            };
        };
        responses: {
            /** @description Email verified; returns a confirmation message */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startEmailVerification: {
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
            /** @description Code sent; returns a confirmation message */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    confirmPhoneVerification: {
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
                    code: string;
                };
            };
        };
        responses: {
            /** @description Phone verified; returns a confirmation message */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startPhoneVerification: {
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
                "application/json": {
                    /** @description Optional; defaults to the user's phone on file. In E.164 form. */
                    phone?: string | null;
                };
            };
        };
        responses: {
            /** @description Code sent; returns a confirmation message */
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
            /** @description The plan of the organization the session is in does not include SMS. */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
            /** @description No SMS provider is set up to deliver the code. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    bulkCreateUsers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserBulkImport"];
            };
        };
        responses: {
            /** @description Per-row import summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserBulkImportResult"];
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
    importUsers: {
        parameters: {
            query: {
                /** @description auth0 expects NDJSON (one JSON object per line, from an Auth0 user-export job); cognito expects the User Import Job CSV template; azure_b2c expects a Microsoft Graph /users list response ({"value": [...]}). */
                source: "auth0" | "cognito" | "azure_b2c";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description The raw export file content, in the format documented for the chosen source. */
        requestBody: {
            content: {
                "application/json": string;
                "application/x-ndjson": string;
                "text/csv": string;
            };
        };
        responses: {
            /** @description Per-row import summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserBulkImportResult"];
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
    listDeletedUsers: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Soft-deleted users */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: {
                            /** Format: date-time */
                            created_at?: string;
                            /** Format: date-time */
                            deleted_at?: string;
                            /**
                             * Format: uuid
                             * @description The admin who deleted the user; null when not recorded.
                             */
                            deleted_by?: string | null;
                            display_name?: string | null;
                            email?: string;
                            /** Format: uuid */
                            id?: string;
                        }[];
                        next_cursor?: components["schemas"]["NextCursor"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getUserStats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Directory summary */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserStats"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listSuspendedUsers: {
        parameters: {
            query?: {
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                /** @description Page size, 1 to 100 (default 25). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
                q?: string;
                reason?: string;
                review?: "pending" | "reviewed" | "external";
                risk?: "unknown" | "low" | "medium" | "high";
                source?: string;
                team?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suspended users with scoped summary, reason/risk breakdowns and review queue */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["SuspendedDirectoryUser"][];
                        limit?: number;
                        next_cursor?: components["schemas"]["NextCursor"];
                        queue?: components["schemas"]["SuspendedDirectoryUser"][];
                        reasons?: {
                            count?: number;
                            key?: string;
                        }[];
                        risks?: {
                            count?: number;
                            key?: string;
                        }[];
                        summary?: {
                            high_risk?: number;
                            manual?: number;
                            pending?: number;
                            policy?: number;
                            total?: number;
                        };
                        teams?: string[];
                        total?: number;
                    };
                };
            };
            /** @description Invalid filters */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Authentication and organization required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing user.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getUserTrends: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Trend series */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserTrends"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
}
