// Generated from contract/qeet-id-server/federation.yaml by `bun run contract:sync`. Do not edit:
// `bun run contract:check` fails when this file and the document disagree.
export interface paths {
    "/.well-known/jwks.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * JWKS
         * @description Publishes the issuer's public signing keys as a JWK Set so relying parties and resource servers can verify Qeet-issued ID tokens and JWT access tokens, with Qeet acting as the OpenID provider. Served unauthenticated at the root, not under /v1, and advertised as jwks_uri in the discovery document. Keys rotate, so callers should cache by key id and refetch when they encounter an unknown one. Any origin may read it (CORS Access-Control-Allow-Origin: *, without credentials).
         */
        get: operations["getJwks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/oauth-authorization-server": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OAuth authorization server metadata
         * @description Returns the OAuth 2.0 authorization server metadata (RFC 8414) for clients that speak only OAuth, and for model-context-protocol clients following the protected-resource document to the authorization server it names. It is the same document as the OpenID configuration, so the endpoints and capabilities in the two always agree. Served unauthenticated at the root, not under /v1.
         */
        get: operations["getOauthAuthorizationServerMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/oauth-protected-resource": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Protected resource metadata
         * @description Protected-resource metadata (RFC 9728) for MCP authorization-server compliance. Advertises the resource identifier, its authorization server(s), the scopes it accepts (scopes_supported), and the supported bearer methods and token-signing algorithms. The authorization server is named by its issuer identifier (JWT_ISSUER, the iss of its tokens), whatever host the request reached, and resolves to its RFC 8414 metadata at /.well-known/oauth-authorization-server.
         */
        get: operations["getProtectedResourceMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/openid-configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OpenID configuration
         * @description Returns the OpenID Connect discovery metadata for Qeet as the OpenID provider: issuer, authorization, token, userinfo, JWKS, revocation, introspection and end-session endpoints, plus the supported grant types, scopes (openid, profile, email, phone and offline_access) and algorithms. The advertised token_endpoint is /v1/oauth/token, which serves every grant, client_credentials for the service principals and agents included. Served unauthenticated at the root, not under /v1. Its issuer is the one the ID tokens and authorization responses carry (JWT_ISSUER). Any origin may read it (CORS Access-Control-Allow-Origin: *, without credentials).
         */
        get: operations["getOpenidConfiguration"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ldap/{id}/authenticate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authenticate (public)
         * @description Signs a person in with their directory username and password and answers with a token pair, or with a challenge to complete at POST /v1/auth/mfa as for a password sign-in. The connection's organization's network rules apply first (403 auth.address_not_allowed, whatever the password), then the password is checked by a bind against the connection's directory, under the sign-in lockout, login hook, risk and second-factor rules of that organization, as a password sign-in is. The lockout counts a username case-insensitively, ignoring extra spaces. A wrong username or password is refused with 401 ldap.invalid_credentials and counted by the lockout like a wrong password. A locked account answers 429 auth.account_locked whatever the password (a throttled source network, 429 too_many_requests), and when the lockout counters cannot be read or written the sign-in is refused with 503 auth.sign_in_unavailable. A disabled connection is refused with 403 ldap.connection_disabled, and a draft one, still being set up, with 403 ldap.connection_draft; one whose organization's plan no longer includes LDAP is refused with 402 billing.upgrade_required, before the directory is asked. A sign-in that needs another step (a second factor, setting one up, or a risk confirmation by an emailed code) answers with that challenge, as POST /v1/auth/login does; the session it completes is recorded as an ldap_mfa sign-in. A directory account whose email belongs to an account outside the connection's organization is refused with 403 ldap.account_not_in_organization, and an account that is not active with 403 auth.account_inactive. An empty username or password is refused with 400 ldap.credentials_required, and a connection that does not verify the directory's certificate with 422 ldap.tls_verify_required. The account signed in must have the connection's organization as its home (403 ldap.account_not_in_organization), and an existing one adopted by email a verified address, or one the organization's directory provisioned (SCIM), which is then marked verified (403 ldap.account_unverified otherwise). A directory entry is linked to the connection that bound it. An address not yet linked is adopted or given an account only on a domain the organization has verified (the most specific verified domain decides, 403 ldap.email_domain_unverified otherwise), and an account that owns the organization or holds any permission there but the reads organization.read, user.read, role.read, group.read, connection.read, apikey.read, webhook.read, billing.read, policy.read, audit.read and analytics.read is not adopted by its address (403 ldap.account_administers): it keeps its own credentials. A new account is created only while the domain that manages the address has jit_enabled on; otherwise an address with no account is refused with 403 ldap.jit_not_allowed and nothing is created. Existing members are adopted either way. Every sign-in then brings the account in step with the directory, each change audited: its display name; its address, when the directory's is on a domain the organization has verified, is no other account's, and the account doesn't administer the organization (recovery links sent to the old address then stop working); and its groups, as GET /v1/organizations/{organizationID}/ldap/{id}/group-mappings describes.
         */
        post: operations["authenticateLdap"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ldap/{id}/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Hosted sign-in session (public)
         * @description POST /ldap/{id}/authenticate for the hosted login: the same checks, answered as POST /v1/auth/session is, with the hosted-login session cookie (qe_ls) and the user's id, or the challenge to complete first at POST /v1/auth/session/mfa. Mounted at the root, not under /v1, and unauthenticated; CSRF-checked.
         */
        post: operations["createLdapSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/introspect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Token introspect (RFC 7662)
         * @description Reports whether a supplied access or refresh token is currently active and returns its associated claims when it is (RFC 7662), with Qeet acting as the OAuth authorization server. Callers authenticate with OAuth client credentials supplied as form parameters or via HTTP Basic. Mounted at the root, not under /v1; it pairs with the revocation endpoint for token lifecycle management. A public client can't call it: its client_id is in every sign-in link and proves nothing, so the call answers 401 oidc.client_auth_failed. Wrong secrets are audited. An application only learns about tokens it owns: an access token issued to it (its client_id claim), or one issued for a registered resource it serves (server_client_id), and a refresh token issued to it. Any other token, including another application's in the same organization or one from another organization, answers only {"active": false}, so the endpoint never confirms a token exists; asking about another application's token is audited as oidc.introspection_refused. An active access token reports its real aud (a string for one audience, a list for several), its client_id, and resource when it was issued for one. Introspection is the authoritative answer on revocation: a signature-valid access token whose account is suspended or deleted, whose membership of the organization has ended, whose sign-in has ended, or whose agent is no longer active, answers {"active": false}. The sign-in is the session the token names in sid: a person's own session, or for an application's token the hosted-login session it was issued in, ended by signing out of it (one that only expired still renews through its grant). Device and backchannel tokens name no session. A verifier that checks tokens offline (signature and expiry) accepts such a token until it expires (ACCESS_TOKEN_TTL, 10 minutes by default); call introspection where revocation must take effect at once. A browser may call it from an origin one of the applications allows (web_origins), without credentials.
         */
        post: operations["introspectToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Token revoke (RFC 7009)
         * @description Revokes a refresh token (RFC 7009), with Qeet acting as the OAuth authorization server. Callers authenticate with OAuth client credentials. Revoking a refresh token ends the whole grant it belongs to, every earlier and later rotation of it, so no link of the chain stays usable; introspection then reports every link inactive, the grant leaves the admin grant list, and the revocation is audited as oidc.grant_revoked. An access token can't be revoked (it is stateless and lasts out its short lifetime): presenting one answers 400 unsupported_token_type. Per the RFC the endpoint returns 200 for an unknown or already-invalid token, and for another client's token, which it leaves untouched. Mounted at the root, not under /v1. A public client may revoke its own tokens with its client_id alone. A browser may call it from an origin one of the applications allows (web_origins), without credentials.
         */
        post: operations["revokeToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/acs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * [acs] Assertion Consumer Service
         * @description The SAML Assertion Consumer Service for a specific connection, with Qeet acting as the Service Provider. It validates the external IdP's signed SAMLResponse and assertion (an EncryptedAssertion is decrypted with the connection's SP key first and must still be signed; signature by any of the certificates the connection trusts; conditions, allowing three minutes of clock difference with the IdP either way; and replay protection), provisions or resolves the user just-in-time, and redirects to the SPA callback with a one-time login code carried in the URL fragment. An answer to a sign-in request completes only in the browser that began it (holding the cookie the login call set): from another it spends the request and answers 403 saml.other_browser, so a sign-in begun by someone else can't be completed in a victim's browser. An IdP-initiated answer, which answers no request, is accepted only where the connection allows those. The SPA then trades that code for tokens at POST /saml/exchange. Mounted at the root, not under /v1, and unauthenticated. An existing account is signed in only while this organization is its home, and one adopted by email must have a verified address or have been provisioned by the organization's directory (SCIM), and is then marked verified: another organization's account or a guest whose home is elsewhere is refused with 403 saml.user_organization_mismatch, an unverified one with 403 saml.account_unverified. A subject is linked to the connection that asserted it, so another connection asserting it doesn't sign it in. An address not yet linked is adopted or given an account only on a domain the organization has verified (the most specific verified domain decides, 403 saml.email_domain_unverified otherwise), and an account that owns the organization or holds any permission there but the reads organization.read, user.read, role.read, group.read, connection.read, apikey.read, webhook.read, billing.read, policy.read, audit.read and analytics.read is not adopted by its address (403 saml.account_administers): it keeps its own credentials. A new account is created only while the domain that manages the address has jit_enabled on; otherwise an address with no account is refused with 403 saml.jit_not_allowed and nothing is created. Existing members are adopted either way. Every sign-in then brings the account in step with the assertion, each change audited: its display name; its address, when the asserted one is on a domain the organization has verified, is no other account's, and the account doesn't administer the organization (recovery links sent to the old address then stop working); and its groups, as GET /v1/organizations/{organizationID}/saml/{id}/group-mappings describes. The organization's plan must include enterprise SSO when the assertion arrives, so a connection set up on a plan that has since lapsed signs no one in (402 billing.upgrade_required). A failure of a sign-in the hosted login began (its return_to stored with the request, named by the answer once it is bound to this browser, or else by this browser's binding cookie) redirects instead to the hosted login's /sign-in with a generic error (sso, or account_inactive for a suspended or deleted account) and the same return_to; the detail is logged, never shown.
         */
        post: operations["consumeSamlAssertion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange code (public)
         * @description Trades the one-time login code minted by the SAML Assertion Consumer Service for a Qeet access and refresh token pair, with Qeet acting as the Service Provider. The code is single-use and short-lived. It trades only while the connection that issued it is still active: 403 saml.connection_disabled or saml.connection_draft once it has been switched off or put back to draft, and 401 saml.login_code_invalid once it is deleted. Mounted at the root, not under /v1, and unauthenticated; it is the second step after POST /saml/acs/{id}.
         */
        post: operations["exchangeSamlCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/idp/{organizationID}/certificate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [idp] IdP signing certificate
         * @description Returns the certificate the organization's SAML Identity Provider signs assertions with, as PEM, the same one its metadata publishes, for Service Providers that ask for the certificate on its own. Mounted at the root, not under /v1, and unauthenticated. An unknown or inactive organization returns 404.
         */
        get: operations["getSamlIdpCertificate"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/idp/{organizationID}/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [idp] IdP metadata
         * @description Returns the organization's SAML Identity Provider metadata XML, including the organization's IdP entity id (/saml/idp/{organizationID}), the signing certificate and the redirect- and POST-binding SingleSignOnService endpoints (/saml/idp/{organizationID}/sso), for downstream Service Providers to configure Qeet as their IdP, and the NameID formats it issues (emailAddress, persistent and unspecified). Mounted at the root, not under /v1, and unauthenticated. An unknown or inactive organization returns 404. Register each downstream SP with the SAML SP (IdP side) endpoints before it can obtain assertions at the organization's IdP SSO endpoint.
         */
        get: operations["getSamlIdpMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/idp/{organizationID}/sso": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [idp] IdP SSO (redirect binding)
         * @description The organization's SAML SingleSignOnService over the HTTP-Redirect binding, with Qeet acting as the Identity Provider. It handles SP-initiated SSO from the AuthnRequest of a Service Provider registered in that organization and IdP-initiated SSO by SP reference; only SPs of the organization in the path are matched. The user is authenticated by the hosted-login SSO cookie, and the browser is bounced to the hosted login when no session exists. On success it returns an auto-submitting HTML form that POSTs a signed SAMLResponse to the SP's registered ACS URL. Only people whose home is the organization are signed in (403 saml.user_organization_mismatch otherwise), and an SP with assignment_required only those assigned to it, themselves or through a group of the organization they belong to: anyone else is refused with 403 saml.sp_not_assigned, and the refusal is audited as saml.idp_assertion_refused. The assertion's NameID follows the SP's name_id_format and name_id_attribute (an emailAddress NameID is the email; a persistent one an opaque value made for this person at this SP the first time they sign in to it, which never changes, or their user id when name_id_attribute is user_id); a NameID from a metadata key the person has no single value for is refused with 403 saml.name_id_unavailable, also audited. The assertion carries the attributes the SP maps, each the person has a value for. A browser asking for HTML gets every error as a page showing its message and code; anything else gets the JSON error. An unknown or inactive organization, or an unknown SP, returns 404; a disabled SP answers 403 saml.service_provider_disabled, and one still in draft 403 saml.service_provider_draft, whether or not anyone is signed in (a signed-in person's attempt is audited as saml.idp_assertion_refused, reason draft). The organization's plan must include enterprise SSO at every sign-in, not only when the SP was registered (402 billing.upgrade_required). As at OIDC authorize, the organization's address rules apply (403 auth.address_not_allowed, recorded as auth.address_refused with path saml_idp), and so does its second-factor requirement: a session whose sign-in didn't meet it is sent to sign in again (302 to the hosted login's /sign-in with prompt=login, returning here marked with login_after), and a fresh sign-in that still hasn't is refused with 403 step_up_required or mfa.enrollment_required, audited as saml.idp_assertion_refused with reason second_factor_required. An SP with require_signed_requests is signed in only by a request signed with its certificate, over the query as the Redirect binding defines (RSA or ECDSA with SHA-256 or SHA-512) or by an enveloped XML signature, and is otherwise refused with 403 saml.request_signature_invalid, as is a Redirect-binding query that gives SAMLRequest, RelayState, SigAlg or Signature twice or under a percent-encoded name; IdP-initiated sign-in is unaffected. An SP with encrypt_assertions gets the signed assertion as an EncryptedAssertion to its certificate. The POST-binding variant is POST /saml/idp/{organizationID}/sso.
         */
        get: operations["startSamlIdpSso"];
        put?: never;
        /**
         * [idp] IdP SSO (POST binding)
         * @description The organization's SAML SingleSignOnService over the HTTP-POST binding, with Qeet acting as the Identity Provider; equivalent to GET /saml/idp/{organizationID}/sso for Service Providers that send the AuthnRequest via POST. Only SPs of the organization in the path are matched. The user is authenticated by the hosted-login SSO cookie, with a redirect to the hosted login when no session exists; that sign-in returns to GET /saml/idp/{organizationID}/sso carrying the request and RelayState, so the flow resumes. A posted request over 256 KiB is refused with saml.authn_request_invalid. Any supplied AssertionConsumerServiceURL must match the SP's registered ACS. On success it returns an auto-submitting form that POSTs a signed SAMLResponse to that ACS. Who is signed in, and what the assertion says, is as for GET /saml/idp/{organizationID}/sso: an SP with assignment_required refuses anyone not assigned to it with an audited 403 saml.sp_not_assigned. An unknown or inactive organization, or an unknown SP, returns 404. The organization's plan must include enterprise SSO at every sign-in (402 billing.upgrade_required), and its address rules and second-factor requirement apply as for GET.
         */
        post: operations["startSamlIdpSsoWithPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/login/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Login redirect (public)
         * @description Initiates SP-initiated SAML login for a specific connection, with Qeet acting as the Service Provider: it builds and stores an AuthnRequest, sets an HttpOnly cookie binding it to this browser, and redirects the browser to the external IdP's SSO URL. The IdP returns its assertion to POST /saml/acs/{id}. Only an active connection signs anyone in: a disabled one answers 403 saml.connection_disabled, and a draft one, still being set up, 403 saml.connection_draft, here and at the ACS. Mounted at the root, not under /v1, and unauthenticated. The organization's plan must include enterprise SSO (402 billing.upgrade_required).
         */
        get: operations["startSamlSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/metadata/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * SP metadata (public)
         * @description Returns Qeet's Service Provider metadata XML for a specific connection, comprising the SP entity id, the HTTP-POST Assertion Consumer Service location and, under KeyDescriptor use="encryption", the connection's own certificate for the IdP to encrypt assertions to (made the first time the metadata is fetched; its private key is stored envelope-encrypted), for an external IdP administrator to configure the trust. Mounted at the root, not under /v1, and unauthenticated. Qeet acts as the Service Provider here; this is distinct from the IdP-side metadata at /saml/idp/{organizationID}/metadata.
         */
        get: operations["getSamlSpMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/saml/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Hosted sign-in session (public)
         * @description Trades the one-time login code a hosted-login SAML sign-in came back with (the hosted login's /sign-in URL fragment, saml_code) for the hosted-login session, as POST /v1/auth/session answers: the qe_ls cookie and the user's id. The code is single-use and short-lived (401 saml.login_code_invalid, saml.login_code_used or saml.login_code_expired), and trades only while the connection that issued it is still active (403 saml.connection_disabled or saml.connection_draft; 401 saml.login_code_invalid once it is deleted). The organization's network rules apply (403 auth.address_not_allowed), and an account that is not active is refused (403 auth.account_inactive). As the console's SAML sign-in, no second factor is asked: the identity provider decides how its people sign in. The session is recorded as a saml sign-in. Mounted at the root, not under /v1, and unauthenticated; CSRF-checked.
         */
        post: operations["createSamlSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] List groups
         * @description Lists the groups SCIM provisioned for the organization identified by the SCIM bearer token (a group an administrator made is neither listed nor readable or changeable here, so a directory can't put anyone in a group that carries roles), with optional SCIM filtering and pagination, returning a SCIM 2.0 ListResponse, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape.
         */
        get: operations["listScimGroups"];
        put?: never;
        /**
         * [scim] Create group
         * @description Provisions a new group in the organization identified by the SCIM bearer token, with Qeet acting as the SCIM 2.0 server for an external IdP. The group, and every later change to it and its members, is audited (group.created, group.updated, group.member_added, group.member_removed, group.deleted; actor scim). Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape.
         */
        post: operations["createScimGroup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] Get group
         * @description Returns a single provisioned group by id for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape.
         */
        get: operations["getScimGroup"];
        /**
         * [scim] Replace group
         * @description Replaces a group's attributes wholesale with the supplied SCIM representation for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Use PATCH for incremental membership or attribute changes. Mounted at the root under /scim/v2; errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape. A member set that gives someone a first role, through the group's, beyond the plan's seats is refused with 403 in that envelope and nothing changes.
         */
        put: operations["replaceScimGroup"];
        post?: never;
        /**
         * [scim] Delete group
         * @description Deletes a provisioned group by id for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape.
         */
        delete: operations["deleteScimGroup"];
        options?: never;
        head?: never;
        /**
         * [scim] Patch group
         * @description Applies a SCIM PatchOp to a group, typically a membership add or remove or an attribute change, for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape. Adding someone holding no role to a group that carries one takes a seat; when the plan's seats are all taken the whole change is refused with 403 in that envelope and nothing changes.
         */
        patch: operations["patchScimGroup"];
        trace?: never;
    };
    "/scim/v2/ResourceTypes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] ResourceTypes
         * @description Returns the SCIM 2.0 ResourceTypes discovery document describing the User and Group resources Qeet exposes as a SCIM server. Requires the SCIM bearer token and is mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape.
         */
        get: operations["listScimResourceTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Schemas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] Schemas
         * @description Returns the SCIM 2.0 schema definitions for the resources Qeet exposes as a SCIM server, for IdP discovery. Requires the SCIM bearer token and is mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape.
         */
        get: operations["listScimSchemas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/ServiceProviderConfig": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] ServiceProviderConfig
         * @description Returns the SCIM 2.0 ServiceProviderConfig advertising Qeet's supported SCIM capabilities as a SCIM server, where PATCH and filter are supported while bulk, sort, changePassword and etag are not, along with the organization bearer-token authentication scheme. Requires the SCIM bearer token and is mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope.
         */
        get: operations["getScimServiceProviderConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] List users
         * @description Lists provisioned users for the organization identified by the SCIM bearer token, with optional SCIM filtering (for example userName eq) and pagination; a userName eq lookup finds any account at home in the organization, whoever created it, so an identity provider can match and link existing members, returning a SCIM 2.0 ListResponse, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape.
         */
        get: operations["listScimUsers"];
        put?: never;
        /**
         * [scim] Create user
         * @description Provisions a new user in the organization identified by the SCIM bearer token, with Qeet acting as the SCIM 2.0 server for an external IdP. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape. A userName belonging to an account already at home in the organization (invited, or signed in with single sign-on) adopts that account: it is tagged as provisioned with the externalId and updated, and answered 201. When nothing vouched for that account's address yet (its holder never proved it, and the directory didn't provision it), adoption also removes every credential and sign-in set up on it (recorded as auth.credentials_removed), so whoever registered the address first keeps no way in; the person signs in through the organization's identity provider, or resets the password. The response is unchanged. A userName taken elsewhere, or on a domain another organization has verified, is refused with 409.
         */
        post: operations["createScimUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/scim/v2/Users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * [scim] Get user
         * @description Returns a single provisioned user by id for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape.
         */
        get: operations["getScimUser"];
        /**
         * [scim] Replace user
         * @description Replaces a user's attributes wholesale with the supplied SCIM representation for the organization identified by the SCIM bearer token, with Qeet acting as the SCIM server. Use PATCH for targeted changes such as deprovisioning. Mounted at the root under /scim/v2; errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape. An account that owns the organization is never changed or deleted by the directory (403). A new userName for an account that administers the organization (any administrative permission, directly or through a group) is refused with 403 and nothing changes: its address is changed in the console, as single sign-on never moves it either. Setting active to true lifts only a suspension the directory set: one an administrator, a policy or another directory set stands, while the rest of the change applies.
         */
        put: operations["replaceScimUser"];
        post?: never;
        /**
         * [scim] Delete user
         * @description Deprovisions a user by id for the organization identified by the SCIM bearer token, soft-deleting the account after confirming it belongs to the organization and ending every way it signs in (sessions, hosted-login sessions, remembered devices, application grants, pending authorizations and unused recovery links), with Qeet acting as the SCIM server. As an administrator's deletion does, it revokes the admin-portal links and pending invitations the user issued and records the critical user.integrations_left event listing the integrations they created; the SCIM response is unchanged. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope rather than the standard Qeet error shape. An account that owns the organization is never deleted by the directory (403).
         */
        delete: operations["deleteScimUser"];
        options?: never;
        head?: never;
        /**
         * [scim] Patch user (deprovision)
         * @description Applies a SCIM PatchOp to a user for the organization identified by the SCIM bearer token; setting active to false (a boolean, or the string Entra sends) is the deprovisioning path IdPs rely on and suspends the account, ending every way it signs in as an administrator's suspension does; displayName, name.givenName/familyName/formatted, externalId and userName (or the primary email) are applied too, a new userName only on a domain the organization has verified (400 invalidValue otherwise), counted verified, with links sent to the old address ending; and displayName may also be updated, with Qeet acting as the SCIM server. Mounted at the root under /scim/v2, not under /v1. Errors use the RFC 7644 SCIM error envelope, not the standard Qeet error shape. An account that owns the organization is never changed or deleted by the directory (403). A new userName for an account that administers the organization (any administrative permission, directly or through a group) is refused with 403 and nothing changes: its address is changed in the console, as single sign-on never moves it either. Setting active to true lifts only a suspension the directory set: one an administrator, a policy or another directory set stands, while the rest of the change applies.
         */
        patch: operations["patchScimUser"];
        trace?: never;
    };
    "/v1/admin-portal/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get portal context
         * @description Returns the organization name, granted capabilities, session expiry, and branding for the cookie-authenticated portal, and, when the link's capabilities include scim, the SCIM base URL to enter at the IdP.
         */
        get: operations["getPortalContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List domains (portal)
         * @description Lists the domains of the organization bound to the portal session, with the DNS record each needs and its verification status. Requires the link's capabilities to include domain_verification.
         */
        get: operations["listPortalDomains"];
        put?: never;
        /**
         * Claim a domain (portal)
         * @description Claims a domain for the organization bound to the portal session and returns the DNS TXT record to publish, as the organization-admin claim-domain endpoint does, under the same plan. Requires the link's capabilities to include domain_verification. Audited as domain.created by the admin portal.
         */
        post: operations["claimPortalDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/domains/{id}": {
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
         * Turn single sign-on on or off for a domain (portal)
         * @description Sets whether the organization's people at this domain are sent to its identity provider when they sign in (sso_enabled), as the organization-admin domain settings do; no other setting changes. Requires the link's capabilities to include domain_verification and saml; the domain must belong to the organization bound to the portal session. Audited as domain.settings_updated by the admin portal.
         */
        patch: operations["updatePortalDomain"];
        trace?: never;
    };
    "/v1/admin-portal/domains/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify a domain (portal)
         * @description Looks up the domain's TXT record and, on a match, marks it verified, as the organization-admin verify-domain endpoint does. A domain another organization has verified answers 409 domainverify.claimed_by_other; a record not found yet 422 domainverify.dns_record_missing (retryable). Requires the link's capabilities to include domain_verification; the domain must belong to the organization bound to the portal session. Audited as domain.verified by the admin portal.
         */
        post: operations["verifyPortalDomain"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/saml": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List connections (portal)
         * @description Requires the link's capabilities to include "saml". Each connection carries the service-provider addresses the IT admin enters at their IdP.
         */
        get: operations["listPortalSamlConnections"];
        put?: never;
        /**
         * Create connection (portal)
         * @description Requires the link's capabilities to include "saml". A name alone creates a draft whose service-provider addresses (sp_entity_id, acs_url, sp_metadata_url) are in the answer, so the IT admin can give them to the IdP before its details exist; the IdP's entity ID, SSO URL and certificate then come together through the update endpoint. Any of them given brings the rest (422 admin_portal.saml_fields_required otherwise). As on the organization-admin endpoint, an IdP SSO URL that is not an absolute https URL answers 422 saml.sso_url_invalid, a certificate that does not parse 422 saml.certificate_invalid, and an organization whose plan does not include enterprise SSO 402 billing.upgrade_required.
         */
        post: operations["createPortalSamlConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/saml/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get connection (portal)
         * @description Returns a single SAML connection for the external IT admin in the cookie-authenticated admin portal; the link's capabilities must include saml. The connection belongs to the organization bound to the portal session. Mirrors the organization-admin get-connection endpoint without requiring a Qeet ID account.
         */
        get: operations["getPortalSamlConnection"];
        put?: never;
        post?: never;
        /**
         * Delete connection (portal)
         * @description Deletes a SAML connection from the cookie-authenticated admin portal; the link's capabilities must include saml, and the deletion is confined to the organization bound to the portal session and is audited. It mirrors the organization-admin delete-connection endpoint for an account-less external IT admin.
         */
        delete: operations["deletePortalSamlConnection"];
        options?: never;
        head?: never;
        /**
         * Update connection (portal)
         * @description Updates a SAML connection from the cookie-authenticated admin portal; the link's capabilities must include saml, and the change is confined to the organization bound to the portal session and is audited. It lets an external IT admin adjust IdP details without a Qeet ID account; validate the result with the portal test endpoint. A new IdP SSO URL or certificate is checked as on create (422 saml.sso_url_invalid, saml.certificate_invalid). A portal session is no person who could outrank anyone, so it changes what the connection trusts (a new idp_entity_id or idp_certificate) only while no administrator is linked to it (403 rbac.trust_change_outranks_caller otherwise).
         */
        patch: operations["updatePortalSamlConnection"];
        trace?: never;
    };
    "/v1/admin-portal/saml/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test connection (portal)
         * @description Same offline preflight as the admin endpoint — no network I/O.
         */
        post: operations["testPortalSamlConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/saml/{id}/test-sign-ins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Begin a test sign-in (portal)
         * @description Starts a real sign-in through the connection in the IT admin's browser that signs nobody in: no account is created or changed and no session is issued, and a draft connection can be tested. Requires the link's capabilities to include saml; the connection must belong to the organization bound to the portal session. Send the browser to redirect_url. The IdP's answer is validated exactly as a sign-in's (signature, issuer, audience, destination, validity period, correlation, replay) and only in the browser that began the test; the browser then returns to the hosted enterprise-setup page with `#saml_test={test id}&saml_connection={connection id}` in its fragment, and the result is read from the test-sign-in endpoint below. The test waits ten minutes for the answer, and the result is kept for an hour. Audited as saml.test_sign_in_started. An IdP SSO URL that is not an absolute https URL answers 422 saml.sso_url_invalid, a certificate that does not parse 422 saml.certificate_invalid.
         */
        post: operations["startPortalSamlTestSignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/saml/{id}/test-sign-ins/{testID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a test sign-in (portal)
         * @description Returns a test sign-in of the connection and what it found. Requires the link's capabilities to include saml; the connection must belong to the organization bound to the portal session. A test no answer reached within ten minutes reads as expired.
         */
        get: operations["getPortalSamlTestSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/scim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get SCIM config (portal)
         * @description Requires the link's capabilities to include "scim". Never exposes the provisioned-users list — only rotate/revoke/status.
         */
        get: operations["getPortalScimConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/scim/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate SCIM token (portal)
         * @description Returns the full plaintext token exactly once, alongside the updated config view.
         */
        post: operations["replaceAllPortalScimTokens"];
        /**
         * Revoke SCIM token (portal)
         * @description Revokes the organization's SCIM provisioning token from the cookie-authenticated admin portal, immediately stopping inbound SCIM provisioning until a new token is issued; the link's capabilities must include scim. To keep provisioning running, rotate to a fresh token instead with POST /v1/admin-portal/scim/token. Scoped to the organization bound to the portal session.
         */
        delete: operations["revokeAllPortalScimTokens"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin-portal/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange a one-time portal link
         * @description Consumes the link token from `Authorization: Bearer <token>` and sets a short-lived HttpOnly portal session cookie. The link token cannot be exchanged again.
         */
        post: operations["createPortalSession"];
        /**
         * Revoke the current portal session
         * @description Revokes the current admin-portal session and clears its session cookie, ending the external IT admin's portal access. Authenticated by the portal session cookie. A new session requires exchanging a fresh link token at POST /v1/admin-portal/session.
         */
        delete: operations["deletePortalSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/social/identities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List my connected social accounts
         * @description The signed-in (organization-less/console) user's connected social identities, recorded by platform sign-in and the link flow.
         */
        get: operations["listMySocialIdentities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/social/identities/{id}": {
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
         * Unlink one of my connected social accounts
         * @description Detaches a linked social (OAuth) identity from the authenticated caller's own account, scoped so a user can only unlink their own identities, with Qeet acting as the OAuth client for the external provider. Establish a link with the connect-provider flow at POST /v1/social/{provider}/link/start, and list current links with GET /v1/me/social/identities.
         */
        delete: operations["unlinkMySocialIdentity"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Authorize
         * @description Begins the OAuth 2.0 / OpenID Connect authorization-code flow with Qeet as the provider. The end user is identified by the hosted-login SSO session cookie: with no session the browser is redirected to the hosted login, with the qe_sc cookie naming the application (an hour, HttpOnly, cleared once a code is issued) so the sign-in that follows records it in its auth.login_succeeded event (client_id, client_name), with missing consent to the hosted consent screen, and otherwise back to the client's redirect_uri carrying an authorization code and state. Exchange that code for tokens at the token endpoint (authorization_code grant). The redirect_uri must be one the client registered, character for character, except that a public (native) client's http redirect to a loopback IP literal (such as http://127.0.0.1/cb or http://[::1]/cb) may name any port (RFC 8252 §7.3), as a native application listens on whatever port it is given; a confidential client's matches exactly, and localhost is a name, not a literal, and matches exactly. Otherwise the error is shown here and nothing is sent to that address. The code goes to the redirect_uri as requested, port included, and redeems only with that same redirect_uri. When consent is needed, the request is stored server-side and the hosted consent screen is given only its request_id. While the client organization's address rules are on, a browser address they refuse gets access_denied at the redirect_uri and no code, and the refusal is audited (auth.address_refused). Every application, confidential ones included, must send a PKCE code_challenge with code_challenge_method S256; a request without one gets invalid_request at the redirect_uri (oidc.code_challenge_required) before any consent is asked. A confidential application whose pkce_exempt_until is still ahead is excused until then. The challenge binds the code to the request, so a nonce is optional (OpenID Connect Core 3.1.2.1); one that is sent comes back in the ID token. response_type is required and only code is served (else invalid_request / unsupported_response_type at the redirect_uri); request and request_uri are refused (request_not_supported, request_uri_not_supported), as is a response_mode other than query. prompt=none never shows a page: no sign-in answers login_required, no consent consent_required. prompt=login, and a sign-in older than max_age seconds, send the browser to sign in again and then complete the request (the request it comes back with carries a login_after marker the server signs, so one added by hand doesn't stand for the sign-in); prompt=consent asks for consent again. The ID token carries auth_time (when the person signed in) and sid (the hosted-login session). When the client's organization requires a second factor the hosted sign-in didn't meet, the browser is sent to sign in again for this request (where the hosted login asks for it), once; prompt=none answers interaction_required, and a fresh sign-in that still hasn't met one gets access_denied at the redirect_uri.
         */
        get: operations["authorize"];
        put?: never;
        /**
         * Authorize (form POST)
         * @description The authorization request sent as a form, which OpenID Connect Core 3.1.2.1 requires an authorization endpoint to accept beside GET. It takes the same parameters as GET, in the body, and answers 303 to the GET form of the same request, where the request is checked and the hosted-login session cookie is read (a cross-site POST doesn't carry it). No session is needed and nothing is changed here.
         */
        post: operations["authorizeWithPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/authorize/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authorize decision (consent)
         * @description Records the end user's allow or deny decision on the hosted consent screen for the authorization request stored under request_id. The user is identified by the hosted-login session cookie, and the request must belong to that session, be undecided and unexpired; it can be decided once. Every protocol value (redirect_uri, scope, state, nonce, PKCE) comes from the stored request. Older consent screens may also echo those values: each one sent must match the stored request, or the decision is refused (400 oidc.consent_request_invalid). The answer is JSON naming where the browser goes next: the client's registered redirect_uri with a code, or with error=access_denied and the original state.
         */
        post: operations["submitConsent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/authorize/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Authorize request (consent)
         * @description Returns the stored authorization request the hosted consent screen is showing: the client and the scopes it asks for. The request must belong to the caller's hosted-login session and be undecided and unexpired; otherwise 400 oidc.consent_request_invalid.
         */
        get: operations["getConsentRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/bc-authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Backchannel authentication (CIBA, poll mode)
         * @description OpenID CIBA §7. Client-authenticated endpoint for a client that already knows who the user is (login_hint, an email scoped to the client's organization) — no browser redirect. Best-effort notifies the user (in-app), then returns auth_req_id; the client polls /v1/oauth/token with grant_type=urn:openid:params:grant-type:ciba while the user approves/denies via GET/POST /v1/oauth/bc-authorize/{pending,decision}. Only a confidential client may call it; a public client is refused with 401 oidc.client_auth_failed and can't be registered with the CIBA grant.
         */
        post: operations["startBackchannelAuthentication"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/bc-authorize/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve or deny a pending CIBA request
         * @description Records the authenticated user's decision on one of their own pending requests (the id from GET .../pending, not the raw auth_req_id). Approving is a sign-in to the application, held to its organization's rules as device approval is: the user must still be an active member of it (403 oidc.user_organization_mismatch), approve from an address its rules allow (403 auth.address_not_allowed, recorded as auth.address_refused with path ciba_approval), and through a session that met the second factor it requires (403 step_up_required or mfa.enrollment_required). A refused approval leaves the request pending.
         */
        post: operations["submitBackchannelDecision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/bc-authorize/pending": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List my pending CIBA requests
         * @description The authenticated user's own still-pending, unexpired backchannel authentication requests — an "approve sign-in" view.
         */
        get: operations["listMyPendingBackchannelRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/device": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Device verification context
         * @description Returns the requesting client's display name and requested scopes for a pending device-authorization, looked up by user_code, so the hosted-login /device page can render the approval screen. SSO-cookie gated.
         */
        get: operations["getDeviceVerification"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/device_authorization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Device authorization
         * @description Client-authenticated endpoint for input-constrained (CLI/TV/IoT) clients. Returns a (device_code, user_code) pair plus the verification URIs; the device then polls /v1/oauth/token with grant_type=urn:ietf:params:oauth:grant-type:device_code. A client not registered for the urn:ietf:params:oauth:grant-type:device_code grant is refused with unauthorized_client, here and when polling.
         */
        post: operations["startDeviceAuthorization"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/device/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Device decision (approve)
         * @description The SSO-cookie-identified user approves or denies a pending device request identified by user_code. On approval the user (who must belong to the client's organization, and approve from an address its address rules allow, else 403 auth.address_not_allowed) is bound and the device can complete its token poll. Approving for an organization that requires a second factor of the user needs a hosted sign-in that met one (403 step_up_required or mfa.enrollment_required otherwise).
         */
        post: operations["submitDeviceDecision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/login-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Login context
         * @description Returns the context the hosted-login application needs to render itself for a given OAuth client: the client's display name, logo and home page, its organization, the organization's enabled social login providers, self-registration and remember-device flags, and optional per-organization branding (only while the organization's plan includes custom_branding; otherwise none, and the hosted login shows its default look). Consumed by the hosted login UI during the authorize flow. It carries no tokens and performs no state change. sign_in_methods ({password, passkey, magic_link}) says which first-factor methods the client's organization allows, so the hosted login offers only those. password_policy, magic_link_ttl_minutes and remember_device_days are the organization's settings the hosted pages show before anyone signs in. logo_uri and client_uri are the values the organization's admin registered for the client, never anything from the request, and are absent when not set.
         */
        get: operations["getLoginContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * RP-initiated logout
         * @description Performs OpenID Connect RP-initiated logout: ends the hosted-login SSO session behind the qe_ls cookie and what it started — the refresh grants applications received through it are revoked and its unredeemed authorization codes can no longer be redeemed — and clears the cookie. Only the cookie identifies the session to end; without it nothing is ended. The sign-out is recorded in the audit log (auth.signed_out), naming client_id when it is a registered application. When the client supplies a registered post_logout_redirect_uri the browser is redirected there with any provided state; otherwise the hosted logged-out page is shown. Other browsers and API sessions are unaffected. Advertised as end_session_endpoint in discovery; a POST variant exists at the same path for relying parties that submit the request as a form. A sign-out must carry an id_token_hint (one of our ID tokens, expired or not, issued to a registered application, client_id when given, for this session's person and naming this session when it names one; another session's, and any other token this server signs, such as an access token or a sign-in ticket, is refused with 400 invalid_request) or a logout_confirmation ticket: without either, the browser is sent to the hosted login's /sign-out page to confirm, with a ticket that brings it back, so a plain link or image can't sign anyone out. Every application that holds a code or grant from the ended session is told: a signed logout token (OpenID Connect Back-Channel Logout 1.0, with sid) is POSTed to its backchannel_logout_uri and retried with backoff, a final failure audited as oidc.backchannel_logout_failed; its frontchannel_logout_uri (with iss and sid) is given to the hosted signed-out page, which then continues to the post_logout_redirect_uri through /v1/oauth/logout/continue. Audited as oidc.sign_out_notified.
         */
        get: operations["endSession"];
        put?: never;
        /**
         * RP-initiated logout
         * @description Identical to GET /v1/oauth/logout for relying parties that issue the logout request as a POST: it ends the hosted-login SSO session and the application grants and unredeemed codes it started, clears the cookie, then redirects to a registered post_logout_redirect_uri with state when supplied, or to the hosted logged-out page. Advertised as end_session_endpoint in discovery.
         */
        post: operations["endSessionWithPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/logout/continue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Continue after sign-out
         * @description Sends the browser on to the post-logout address a sign-out validated, from the signed ticket the hosted signed-out page was given after loading the applications' front-channel pages. An invalid or expired ticket goes to the hosted signed-out page instead. Never a redirect to an address the ticket doesn't sign.
         */
        get: operations["continueSignOut"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * OAuth token (every grant)
         * @description The OAuth token endpoint (RFC 6749 §3.2) advertised in discovery, the one for every grant, chosen by grant_type: authorization_code, refresh_token, device_code (RFC 8628), token-exchange (RFC 8693) and CIBA with Qeet as the authorization server, and client_credentials for the machine identities. Clients authenticate with their credentials in the form body or via HTTP Basic. Errors take the RFC 6749 §5.2 shape (error, error_description): a missing grant_type is invalid_request, an unknown grant unsupported_grant_type, and a grant the client may not use unauthorized_client. A missing or wrong secret, or an unknown client_id, is refused with 401 invalid_client, described the same whatever kind of client the id names, with WWW-Authenticate: Basic when the client used HTTP Basic. The client_credentials grant serves service principals and AI agents: client_id is the principal's or agent's id and client_secret its secret. It answers a token for the identity itself, carrying every scope it holds (scope is ignored), marked actor_type service or agent (an agent's also agent_id), lasting the access-token lifetime for a principal and the agent's own token_ttl_seconds for an agent, with expires_at beside expires_in. A disabled principal or an agent that isn't active is refused with unauthorized_client once its secret checks out, a principal or agent of a suspended or deleted organization as an unknown client, and an application (an OIDC client) with unauthorized_client once its own credentials check out. Every grant refuses an account that is suspended or deleted with invalid_grant, and a refused refresh ends the application's refresh tokens for that user. Device polling from an address the organization's address rules refuse answers access_denied address_not_allowed and spends the device code; code redemption, refresh and CIBA polling come from the application's server, so the address rules are asked at authorization or approval instead. An authorization code redeems once, with the code_verifier of its challenge; a code issued under a PKCE exemption redeems only while the exemption lasts. A code presented a second time is refused with invalid_grant and the grant its first redemption issued is revoked, every renewal of it included (audited as oidc.authorization_code_reused). Token exchange (RFC 8693) is bounded: the caller must be entitled to the subject token (issued to it, issued for a registered resource it serves, or the person consented to it; else invalid_request), the person must still be active and the organization live (else invalid_grant), the result expires no later than the subject token, carries a new session id, and records its exchange_depth; a token two exchanges deep can't be exchanged again (invalid_request). Every exchange is audited as oidc.token_exchanged; the result holds at most the subject token's scopes that the caller is registered for and, when it holds the token by the person's consent, that they consented to; a scope beyond those is invalid_scope. A refresh token comes only to an application registered for refresh_token, on the authorization_code, device_code and CIBA grants: with every grant, unless the application lists offline_access among its scopes, in which case only with a grant of offline_access (OpenID Connect Core §11). The ID token a refresh issues again reports the original sign-in, as OpenID Connect Core 12.2 asks: the same auth_time and sid as the first one, and no nonce. A refresh may name only the resource (RFC 8707) its grant is bound to: another is refused with 400 invalid_target, and naming none carries the bound resource forward. The client_credentials, device_code and CIBA grants take no resource: one sent is refused with invalid_target. Device and CIBA polling authenticate the client as the other grants do; a public client is identified by its client_id, and the device_code or auth_req_id is the proof (CIBA serves confidential clients only). The per-address rate limit answers 429 too_many_requests in the error envelope. A refresh is refused with unauthorized_client when the client is no longer registered for refresh_token, and with invalid_grant once the person is no longer an active member of the client's organization (its own account, or one holding a role there) or the organization is suspended. A refresh carries forward only the granted scopes the client still registers (scope in the response says which) and is refused with invalid_scope when none is left. The same membership is required when a code, device approval or backchannel request is redeemed (a code, device code or backchannel request refused so is spent). A code, device code or backchannel approval is refused with unauthorized_client once its client is no longer registered for that grant, and a backchannel approval also once its client is no longer a confidential one. A device code or backchannel request is spent only together with storing its refresh token, so a failure leaves it for the next poll. A browser may call it from an origin one of the applications allows (web_origins), without credentials.
         */
        post: operations["requestToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oauth/userinfo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * UserInfo
         * @description Returns the OpenID Connect UserInfo claims for the signed-in user of the presented bearer access token, with Qeet acting as the OpenID provider: sub and organization_id, plus the standard claims the token's scopes grant: email gives email and email_verified; profile gives name, picture, locale (where known) and updated_at; phone gives phone_number and phone_number_verified. No claim is returned without its scope. A token without the openid scope is refused with 403 oidc.insufficient_scope and WWW-Authenticate: Bearer error="insufficient_scope"; a missing, invalid or expired token, or one whose account has been suspended or deleted, gets 401 with error="invalid_token". GET and POST answer alike (OIDC Core 5.3.1). Advertised as userinfo_endpoint in discovery, with the claims in claims_supported. Accepts an access token issued to an application (one carrying client_id), the one authenticated endpoint that does. A browser may call it from an origin one of the applications allows (web_origins), without credentials.
         */
        get: operations["getUserInfo"];
        put?: never;
        /**
         * UserInfo (POST)
         * @description Returns the OpenID Connect UserInfo claims for the signed-in user of the presented bearer access token, with Qeet acting as the OpenID provider: sub and organization_id, plus the standard claims the token's scopes grant: email gives email and email_verified; profile gives name, picture, locale (where known) and updated_at; phone gives phone_number and phone_number_verified. No claim is returned without its scope. A token without the openid scope is refused with 403 oidc.insufficient_scope and WWW-Authenticate: Bearer error="insufficient_scope"; a missing, invalid or expired token, or one whose account has been suspended or deleted, gets 401 with error="invalid_token". GET and POST answer alike (OIDC Core 5.3.1). Advertised as userinfo_endpoint in discovery, with the claims in claims_supported. Accepts an access token issued to an application (one carrying client_id), the one authenticated endpoint that does. A browser may call it from an origin one of the applications allows (web_origins), without credentials.
         */
        post: operations["getUserInfoWithPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc-connections/{id}/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Complete OIDC sign-in (public)
         * @description Where the provider sends the browser back; register it as the connection's redirect URI. The state is spent whatever happens next, and an unknown, spent or expired one answers 400 oidc_connection.state_invalid. A sign-in completes only in the browser that began it, holding the cookie the login call set (403 oidc_connection.other_browser). A refusal by the provider (an error parameter) answers 401 oidc_connection.provider_refused. Otherwise the code is traded at the provider's token endpoint with the PKCE verifier (502 oidc_connection.token_exchange_failed) and the ID token is validated: its signature against the provider's published keys (fetched again once for a key not yet seen), an asymmetric algorithm, iss equal to the connection's issuer (or, for a provider serving many tenants, the issuer of a tid the connection lists), aud naming the client (and azp the client when it names several), exp and iat within a minute's skew, and the nonce this sign-in sent; any failure answers 401 oidc_connection.id_token_invalid. The subject (issuer and sub) is linked to the connection, so another connection asserting it signs nobody in. A linked subject signs in while the organization is still its account's home (403 oidc_connection.user_organization_mismatch). An address not yet linked is adopted or given an account only on a domain the organization has verified (403 oidc_connection.email_domain_unverified), and not when the provider's email_verified is false (403 oidc_connection.email_unverified); a provider that doesn't say (Microsoft Entra ID) is trusted for those domains. An adopted account must have the organization as its home and a verified address (403 oidc_connection.account_unverified), and one that owns or administers the organization is never adopted by its address (403 oidc_connection.account_administers). A suspended account is refused. Every refusal is audited as auth.sign_in_failed with the error code as its reason. On success the browser goes to the console's /sso/callback with a one-time code in the fragment (#oidc_code=...), to trade at POST /v1/oidc-connections/exchange. The plan is checked again when the answer arrives, so one that has since lapsed signs no one in (402 billing.upgrade_required). Once the state is found to be this browser's, a refusal of a sign-in the hosted login began redirects instead to the hosted login's /sign-in with a generic error (sso, or account_inactive for a suspended or deleted account) and its return_to; the refusal is still audited. Unauthenticated.
         */
        get: operations["completeOidcConnectionSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc-connections/{id}/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Begin OIDC sign-in (public)
         * @description Begins a sign-in through an OpenID Connect connection: it records the sign-in's state, PKCE verifier (S256) and nonce, sets an HttpOnly cookie binding the sign-in to this browser, and redirects the browser to the provider's authorization endpoint, which must be https, asking for the connection's scopes. The provider sends the browser back to GET /v1/oidc-connections/{id}/callback. Only an active connection signs anyone in: a draft one answers 403 oidc_connection.connection_draft and a disabled one 403 oidc_connection.connection_disabled. A provider that can't be reached answers 502 oidc_connection.provider_unreachable; a discovery document that can't be used, or whose issuer isn't the connection's (unless it serves many organizations and the connection lists those it accepts), 500 oidc_connection.misconfigured. The organization's plan must include enterprise SSO (402 billing.upgrade_required). Unauthenticated.
         */
        get: operations["startOidcConnectionSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc-connections/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange OIDC sign-in code (public)
         * @description Trades the one-time login code an OpenID Connect sign-in handed the console for a Qeet access and refresh token pair in the connection's organization, while the connection is still active. The code is single-use (401 oidc_connection.login_code_used) and lasts five minutes (401 oidc_connection.login_code_expired); an unknown one answers 401 oidc_connection.login_code_invalid and none 400 oidc_connection.login_code_required. The organization's login hook and address rules apply. Unauthenticated; sent with Cache-Control: no-store.
         */
        post: operations["exchangeOidcConnectionCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc-connections/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Hosted sign-in session (public)
         * @description Trades the one-time login code a hosted-login OpenID Connect sign-in came back with (the hosted login's /sign-in URL fragment, oidc_code) for the hosted-login session, as POST /v1/auth/session answers: the qe_ls cookie and the user's id. The code is single-use and short-lived (401 oidc_connection.login_code_invalid, oidc_connection.login_code_used or oidc_connection.login_code_expired). The organization's network rules apply (403 auth.address_not_allowed), and an account that is not active is refused (403 auth.account_inactive). As the console's sign-in through a connection, no second factor is asked. The session is recorded as an oidc sign-in. Unauthenticated; CSRF-checked.
         */
        post: operations["createOidcConnectionSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc/clients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register OIDC client
         * @description Registers an OIDC relying-party client in the caller's organization, derived from the authenticating principal, so it can drive the authorization-code and related flows. A confidential client's secret is returned exactly once in the response and cannot be retrieved later; roll it afterward with the rotate-secret endpoint. Registration is audited. A public client can't hold token exchange or CIBA (400 oidc.unsupported_flow).
         */
        post: operations["registerOidcClient"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc/clients/{id}": {
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
         * Delete OIDC client (by scope)
         * @description Deletes an OIDC client addressed by id alone, with the owning organization derived from the caller's JWT so the deletion can never cross organizations. This serves the admin UI's client list, which is not organization-path scoped, and the deletion is audited. The organization-path variant DELETE /v1/organizations/{organizationID}/oidc/clients/{id} performs the same operation for organization-scoped callers.
         */
        delete: operations["unregisterOidcClient"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/oidc/signing-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Signing keys metadata
         * @description Returns non-secret metadata for the issuer's OIDC signing keys, including the candidate, active and not-yet-expired retired keys, with key id, algorithm and status. No private key material is exposed. The signing key is issuer-global rather than organization-scoped; the corresponding public keys are published at the JWKS endpoint.
         */
        get: operations["listSigningKeys"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/admin-portal/links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List admin portal links
         * @description Lists the admin-portal links an organization admin has generated for external IT admins, returning metadata only; the raw link token is shown just once at generation and is never returned again. Generate a link with POST to this path and revoke one with the delete endpoint.
         */
        get: operations["listAdminPortalLinks"];
        put?: never;
        /**
         * Generate an admin portal link
         * @description Mints a one-time link an external IT admin (no Qeet ID account) can exchange for a short-lived portal session, scoped to the given capabilities and expiring after ttl_seconds (900 to 86400, default 3600 when omitted; a value out of range is refused with 422 adminportal.ttl_out_of_range, whose metadata carries min_seconds and max_seconds). The raw token/url is returned exactly once; the URL opens the hosted enterprise-setup page ({LOGIN_BASE_URL}/enterprise-setup) and carries the token only in its fragment.
         */
        post: operations["createAdminPortalLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/admin-portal/links/{id}": {
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
         * Revoke an admin portal link
         * @description Revokes a generated admin-portal link so it can no longer be exchanged for a portal session at POST /v1/admin-portal/session. Any portal session already established from the link is governed separately. Pairs with the link list and generation endpoints.
         */
        delete: operations["revokeAdminPortalLink"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List recorded directory operations
         * @description Organization-scoped SCIM writes and LDAP operations, newest first. Requires connection.read. Counts and durations describe observed operations, not provider scheduler jobs. Request bodies and credentials are never stored.
         */
        get: operations["listDirectoryActivity"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List directory failure alerts
         * @description Requires connection.read. Every alert of the organization, newest first, with the person it notifies (user_id), when it was made and when it last notified.
         */
        get: operations["listDirectoryAlerts"];
        put?: never;
        /**
         * Create a directory failure alert
         * @description Requires connection.write and a user principal. Creates an in-app alert for the caller when the failure threshold is reached within 15 minutes. Notifications are rate limited to once per alert per 15 minutes. Audited as directory.alert_created.
         */
        post: operations["createDirectoryAlert"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/alerts/{alertID}": {
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
         * Remove a directory failure alert
         * @description Requires connection.write. Removes one of the organization's alerts. Audited as directory.alert_deleted.
         */
        delete: operations["deleteDirectoryAlert"];
        options?: never;
        head?: never;
        /**
         * Change or pause a directory failure alert
         * @description Requires connection.write. Changes the fields given on one of the organization's alerts: enabled false pauses it, a connection_id of "" makes it cover every connection. Audited as directory.alert_updated.
         */
        patch: operations["updateDirectoryAlert"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List directory connections
         * @description Combines the organization's configured SCIM endpoint and LDAP connections. Requires connection.read. Organization scope is derived from the authenticated principal and must match the path. Credentials are never returned. Health is unknown until explicitly observed; last_activity_at is a request or login timestamp and is not evidence of a successful synchronization.
         */
        get: operations["listDirectoryConnections"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/connections/{connectionID}/mappings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List effective profile mapping rules
         * @description Lists the effective profile attribute-mapping rules configured for a directory connection, together with the supported profile target fields. Requires connection.read and is scoped to the organization in the path. These rules apply to SCIM user writes and LDAP just-in-time provisioning; create rules with POST and remove them with DELETE.
         */
        get: operations["listProfileMappings"];
        put?: never;
        /**
         * Create a profile mapping
         * @description Requires connection.write. Maximum 50 rules per connection and one enabled rule per target. Rules apply to SCIM user writes and LDAP JIT provisioning. Profile data is organization-scoped; groups are profile labels, not role or group membership grants. Email mapping affects creation, not existing account email addresses. Secret sources and privilege targets are rejected.
         */
        post: operations["createProfileMapping"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/connections/{connectionID}/mappings/{mappingID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update a versioned profile mapping
         * @description Requires connection.write. The current version is required to prevent lost updates. Audited in the same transaction.
         */
        put: operations["setProfileMapping"];
        post?: never;
        /**
         * Delete a profile mapping
         * @description Deletes a single profile attribute-mapping rule from a directory connection, scoped to the organization and connection in the path and requiring connection.write. The removal is audited in the same transaction, and subsequent SCIM writes and LDAP provisioning no longer apply the rule. Returns 404 when the mapping does not exist in this organization and connection.
         */
        delete: operations["deleteProfileMapping"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/connections/{connectionID}/mappings/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview the saved mappings with source data
         * @description Requires connection.read. Uses the provisioning engine, without persisting the source or changing users. Source input is capped at 64 KiB.
         */
        post: operations["previewProfileMappings"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List directory errors and remediation summary
         * @description Requires connection.read. Only errors from the authenticated organization are returned. Unknown affected-user counts are null, not inferred from request volume. A person's own credentials refused at an LDAP sign-in is not an error here (it shows in the sync activity as a warning and doesn't count towards alerts); the service account or the directory refusing is. A later successful operation on a connection (a passing check, sign-in or push) resolves its open connection and permission failures, as resolved by the system (resolved_by null) and audited as directory.errors_resolved; a failure being retried is left for its retry.
         */
        get: operations["listDirectoryErrors"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/errors/{eventID}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve a directory error
         * @description Requires connection.write. Atomically closes an open error with an audit record. Does not retry its original operation.
         */
        post: operations["resolveDirectoryError"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/errors/{eventID}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry a failed LDAP connection check
         * @description Requires connection.write. Repeats only a failed manual LDAP bind check using current connection settings. SCIM pushes and sign-ins cannot be replayed because request bodies and credentials are never retained. Concurrent retries serialize and a successful retry closes the original error atomically with an audit record. Failed checks remain open.
         */
        post: operations["retryDirectoryError"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/directory/profiles/{userID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A person's directory profile
         * @description Requires user.read. The fields each directory connection's mappings set on the person (email, display_name, first_name, last_name, department, title, manager_id, groups), as the directory last sent them, one item per connection, newest first, with the connection and when it updated them. A person of another organization has none here.
         */
        get: operations["getDirectoryProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ldap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List connections
         * @description Lists the organization's LDAP connections, without their bind passwords. Requires connection.read.
         */
        get: operations["listLdapConnections"];
        put?: never;
        /**
         * Create connection
         * @description Creates a directory connection. A connection that turns off verification of the directory server's certificate (skip_tls_verify) is refused with 422 ldap.tls_verify_required, and nothing is saved; only a development server (SERVICE_ENV=dev) allows it. Requires connection.write.
         */
        post: operations["createLdapConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ldap/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get connection
         * @description Returns one of the organization's LDAP connections, without its bind password. Requires connection.read.
         */
        get: operations["getLdapConnection"];
        put?: never;
        post?: never;
        /**
         * Delete connection
         * @description Deletes one of the organization's LDAP connections. Requires connection.write.
         */
        delete: operations["deleteLdapConnection"];
        options?: never;
        head?: never;
        /**
         * Update connection
         * @description Applies a partial update to a directory connection. A connection that turns off verification of the directory server's certificate (skip_tls_verify) is refused with 422 ldap.tls_verify_required, and so is any other change to a connection saved that way until it turns verification back on; only a development server (SERVICE_ENV=dev) allows it. Requires connection.write. Changing what the connection trusts (its server_url, bind_dn, base_dn, user_filter or TLS settings) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        patch: operations["updateLdapConnection"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ldap/{id}/group-mappings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List group mappings
         * @description Lists the group mappings of an LDAP connection in the organization. Each maps a group the directory gives the person (idp_group, compared ignoring case) to one of the organization's groups. The groups are the values of the connection's directory mapping targeting groups when it has one (with its transform, such as extracting the CN), else of the entry's memberOf. At every sign-in through the connection the person joins the groups those reach, through these mappings or as the external id of a group SCIM provisioned, and leaves the groups the connection's sign-ins put them in that they no longer reach. A membership an administrator or SCIM made is never changed, and a group whose roles carry the owner role or an administrative permission (any but the reads organization.read, user.read, role.read, group.read, connection.read, apikey.read, webhook.read, billing.read, policy.read, audit.read and analytics.read) is never joined: sign-in takes out anyone it put there. Requires connection.read; an unknown connection, or another organization's, answers 404.
         */
        get: operations["listLdapGroupMappings"];
        put?: never;
        /**
         * Map a directory group
         * @description Maps a group the directory gives the person (a memberOf DN, or the value the connection's groups mapping makes of it) to one of the organization's groups, from each person's next sign-in. Whoever maps a group hands out what it grants: the caller must hold every permission the group's roles carry, as adding a member needs (403 rbac.grant_exceeds_caller, or rbac.owner_only for a group holding the owner role). A group whose roles carry the owner role or an administrative permission can't be mapped at all (422 group.mapping_privileged), and the group must be the organization's (404 group.not_found). The same pair twice is refused with 409 group.mapping_exists, an empty or over-long idp_group with 422 validation_failed, and a connection holds up to 1,000 mappings (422 group.mapping_too_many). Audited as ldap.group_mapping_created. Requires group.write. Needs a recent step-up.
         */
        post: operations["createLdapGroupMapping"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ldap/{id}/group-mappings/{mappingID}": {
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
         * Remove a group mapping
         * @description Removes a group mapping of the connection. Once none of the connection's mappings reaches the group, the memberships of it the connection's sign-ins made end at once, each audited as group.member_removed; one a SCIM group's external id still reaches comes back at the person's next sign-in. Audited as ldap.group_mapping_deleted. Requires group.write. Needs a recent step-up.
         */
        delete: operations["deleteLdapGroupMapping"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/ldap/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test bind
         * @description Binds with the connection's service account to prove its settings, without signing anyone in. A connection that turns off verification of the directory server's certificate (skip_tls_verify) is refused with 422 ldap.tls_verify_required; only a development server (SERVICE_ENV=dev) allows it. Requires connection.write.
         */
        post: operations["testLdapConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oauth/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List device authorizations
         * @description Lists RFC 8628 device-authorization records for the organization for administrative visibility. Rows never include the device_code or its hash. These records originate at POST /v1/oauth/device_authorization and are completed when the device polls the token endpoint with the device_code grant; revoke a stale one with the delete endpoint.
         */
        get: operations["listDeviceAuthorizations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oauth/devices/{id}": {
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
         * Revoke device authorization
         * @description Revokes a device authorization in the organization so the device can no longer complete or continue its token poll at the token endpoint. For an approval the device has already redeemed, the grant it bought ends too: its refresh tokens stop working at once, and access tokens already issued run out on their own. Audited as oauth.device_revoked, with grant_ended saying whether a grant ended.
         */
        delete: operations["revokeDeviceAuthorization"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oauth/grants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List active grants
         * @description Lists the active consent grants the organization's users have given to OIDC clients, for administrative review, latest used first, a page at a time: next_cursor fetches the next page and total counts every grant matching the filter. Each names its application and person, when it began (authorized_at), when the application was last issued tokens under it (last_used_at), and when the person last consented to the application (consented_at, null for an application that asks for none). Revoke a grant with the delete endpoint, or several, or every grant of one application, with the revoke endpoint, to force the client to obtain consent again on its next authorization request.
         */
        get: operations["listOauthGrants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oauth/grants/{id}": {
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
         * Revoke grant
         * @description Revokes a specific user-to-client consent grant in the organization; the action is audited. The affected client must obtain consent again at its next authorization request. Pairs with the grant list.
         */
        delete: operations["revokeOauthGrant"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oauth/grants/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke several grants
         * @description Revokes, in one transaction, the grants ids names (up to 100; each ends its whole client-and-person chain, as the delete endpoint does, and an unknown one is skipped), or every grant the organization's people gave client_id. Send one of the two. Returns how many people's access to an application it ended. Audited as oauth.grant_revoked for each grant named, or once as oauth.client_grants_revoked for an application. Requires connection.write.
         */
        post: operations["revokeOauthGrants"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc-connections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List OIDC connections
         * @description Lists the organization's OpenID Connect connections, through which its people sign in with its own identity provider (Microsoft Entra ID, Okta, Google Workspace and the like), with Qeet acting as the relying party. Scoped to the organization in the path. Client secrets are never returned. Each connection carries the redirect_uri to register with the provider. Requires connection.read.
         */
        get: operations["listOidcConnections"];
        put?: never;
        /**
         * Create OIDC connection
         * @description Creates an OpenID Connect connection in the organization, a draft unless a status is given. The issuer must be an absolute https URL without a query or fragment (422 oidc_connection.issuer_invalid); the discovery document is read from discovery_url, or from the issuer's /.well-known/openid-configuration when none is given (422 oidc_connection.discovery_url_invalid). The client secret is stored encrypted and never returned. Scopes default to openid, email and profile, and openid is always asked for (422 oidc_connection.scopes_invalid). allowed_idp_tenant_ids are the provider's own tenant IDs (the tid claim, as Microsoft Entra ID issues it) a token must name: an Entra issuer that serves every organization (common, organizations or consumers) is refused without them (422 oidc_connection.idp_tenant_ids_required), or anyone with a Microsoft account could sign in. claim_mapping names the claims read for the email address (required, default email), name, given and family names and groups. Missing fields answer 422 oidc_connection.fields_required, an unknown status 422 oidc_connection.status_invalid. The organization's plan must include single sign-on (402 billing.upgrade_required). Audited as oidc_connection.created. Requires connection.write. Needs a recent step-up.
         */
        post: operations["createOidcConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc-connections/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get OIDC connection
         * @description Returns one of the organization's OpenID Connect connections, without its client secret. Another organization's connection answers 404. Requires connection.read.
         */
        get: operations["getOidcConnection"];
        put?: never;
        post?: never;
        /**
         * Delete OIDC connection
         * @description Deletes one of the organization's OpenID Connect connections, with the sign-ins and login codes it has in flight. Its people no longer sign in through it. Audited as oidc_connection.deleted. Another organization's connection answers 404. Requires connection.write. Needs a recent step-up.
         */
        delete: operations["deleteOidcConnection"];
        options?: never;
        head?: never;
        /**
         * Update OIDC connection
         * @description Changes the given fields of one of the organization's OpenID Connect connections, checked as on create; an absent field is kept, as is the client secret when client_secret is absent or empty. Only an active connection signs anyone in. A change that would leave a Microsoft issuer serving every organization without allowed_idp_tenant_ids is refused (422 oidc_connection.idp_tenant_ids_required). Audited as oidc_connection.updated with the fields changed. Another organization's connection answers 404. Requires connection.write. Needs a recent step-up. Changing what the connection trusts (its issuer, discovery_url, client_id or allowed_idp_tenant_ids) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        patch: operations["updateOidcConnection"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List OIDC clients
         * @description Lists the OIDC relying-party clients registered in the organization, confined to the organization in the path. Only client metadata is returned; secrets are never included. Manage an individual client with the get, update, delete and rotate-secret endpoints.
         */
        get: operations["listOidcClients"];
        put?: never;
        /**
         * Create OIDC client
         * @description Registers an OIDC relying-party client under the organization in the path, the admin-UI counterpart to POST /v1/oidc/clients. A confidential client's secret is returned once at creation and is not recoverable afterward; roll it later with the rotate-secret endpoint. Creation is audited. A public client can't hold token exchange or CIBA (400 oidc.unsupported_flow).
         */
        post: operations["createOidcClient"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get OIDC client
         * @description Returns a single OIDC client's configuration in the organization, including redirect URIs, grant types, scopes and client type, scoped to the organization in the path. The client secret is never returned. Update the record with PATCH or roll its credential with the rotate-secret endpoint.
         */
        get: operations["getOidcClient"];
        put?: never;
        post?: never;
        /**
         * Delete OIDC client
         * @description Deletes an OIDC client scoped to the organization in the path; the deletion is audited. Tokens and grants held by the client stop being honoured. The by-id variant DELETE /v1/oidc/clients/{id} performs the same deletion using the caller's JWT organization.
         */
        delete: operations["deleteOidcClient"];
        options?: never;
        head?: never;
        /**
         * Update OIDC client
         * @description Applies a partial update to an OIDC client in the organization; omitted fields are left unchanged. Changes are confined to the organization in the path and are audited. Use the rotate-secret endpoint to change the client secret, which this endpoint does not accept or return. The edited client is held to the same rules as registration: supported grant types, valid redirect URIs, and no token exchange or CIBA for a public client. pkce_exempt_until sets (a date-time) or clears (null) a confidential application's exemption from sending a PKCE code_challenge; it must end in the future and within 90 days, else 422 oidc.pkce_exemption_invalid, and a public application can't have one.
         */
        patch: operations["updateOidcClient"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients/{id}/auth-failures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Application secret failures
         * @description An application's wrong-secret lockout and its last 20 failed authentications, newest first, each with its time and address (no secret material is ever recorded). Wrong secrets count against a confidential application on every endpoint that takes one (code exchange, refresh, token exchange, device and backchannel requests, revocation, introspection), per source network (an IPv4 address or an IPv6 /64); past the threshold from one network (10 in 15 minutes) every authentication from that network is refused for 15 minutes, the right secret included, with the same 401 oidc.client_auth_failed as a wrong secret or an unknown application, while other networks are unaffected. Each failure is audited as oidc.client_auth_failed; a lockout as oidc.client_locked_out, with its source_network, and announced as the oidc.client_locked_out event. A successful authentication resets its network's count. locked_until is when the last lockout in force ends, null when none is.
         */
        get: operations["listOidcClientSecretFailures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients/{id}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Acknowledge a shadow-AI candidate
         * @description Marks the client reviewed, attributed to the calling human principal — it drops off the shadow-AI list until/unless its grant_types change again.
         */
        post: operations["acknowledgeShadowAiClient"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate client secret
         * @description Generates a new secret for a confidential OIDC client in the organization and returns it exactly once; the previous secret stops working immediately. The rotation is audited. Update any client still using the old secret before its next token request.
         */
        post: operations["rotateOidcClientSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/clients/shadow-ai": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List shadow-AI candidates
         * @description OIDC clients whose grant_types include a machine grant type (client_credentials or token-exchange) that haven't been explicitly reviewed — the same "unmanaged non-human identity" risk the agents/service-accounts registries exist to close, surfaced for a client that picked up a machine grant type sideways. Ordered by live (active, unexpired, unrevoked) refresh-token count so clients actually in use surface first.
         */
        get: operations["listShadowAiClients"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/resources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List resources
         * @description The organization's registered resources (RFC 8707): the downstream services its applications may ask tokens for, with the resource parameter at authorize or the token endpoint. A token issued for a resource names it alone as its audience, so the platform API and every other service refuse it; an unregistered resource is refused with invalid_target. server_client_id, when set, is the application that serves the resource and may introspect tokens issued for it.
         */
        get: operations["listOidcResources"];
        put?: never;
        /**
         * Register a resource
         * @description Registers a resource: identifier is an absolute URI without a fragment (422 oidc.resource_invalid), unique on the platform (409 oidc.resource_exists), not the platform's own token issuer or audience or on their host or this API's public host (409 oidc.resource_reserved), not on a domain another organization has verified (409 oidc.resource_domain_taken), and, when it has a host, on one the organization has verified, itself or a domain above it (403 oidc.resource_domain_unverified; an identifier without a host, such as a URN, needs none); server_client_id, optional, must be one of the organization's applications. Audited as oidc.resource_registered. Every organization's tokens share one issuer, so a resource server should also check the token's organization_id claim is its own organization.
         */
        post: operations["registerOidcResource"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/oidc/resources/{id}": {
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
         * Remove a resource
         * @description Removes a registered resource: no new token is issued for it; tokens already issued last out their short lifetime. Audited as oidc.resource_removed.
         */
        delete: operations["deleteOidcResource"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List connections
         * @description Lists the organization's inbound SAML connections, where Qeet acts as the Service Provider consuming an external Identity Provider, scoped to the organization in the path. Create a connection with POST, then validate it with the connection test endpoint before relying on it for sign-in.
         */
        get: operations["listSamlConnections"];
        put?: never;
        /**
         * Create connection
         * @description Creates an inbound SAML connection in the organization with the external IdP's entity id, SSO URL and signing certificate so Qeet can act as the Service Provider for that IdP. A name alone creates a draft before the IdP's details are known, since the IdP needs the connection's addresses first: the answer carries them (sp_entity_id, acs_url, sp_metadata_url), and the IdP's details are added later by PATCH, its metadata or its certificates. Any one of the IdP's details brings the rest with it (422 saml.connection_fields_required), and a connection without them is a draft only (422 saml.connection_incomplete). Validate the configuration with the connection test endpoint, then drive sign-in via GET /saml/login/{id}. Scoped to the organization in the path. A status, when given, must be draft, active or disabled (422 saml.status_invalid). The organization's plan must include enterprise SSO (402 billing.upgrade_required, metadata.feature sso), and every sign-in through the connection checks it again.
         */
        post: operations["createSamlConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml-providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List SAML SPs (IdP side)
         * @description Lists the downstream Service Providers registered in the organization that consume Qeet as their SAML Identity Provider. This is the IdP-side registry, distinct from the inbound SAML connections where Qeet is the Service Provider. Register a new SP with POST to this path.
         */
        get: operations["listSamlApps"];
        put?: never;
        /**
         * Register SAML SP (IdP side)
         * @description Registers a downstream Service Provider in the organization, including its entity id, ACS URL and NameID format, so it can obtain signed assertions from Qeet acting as the Identity Provider. Registered SPs are matched by AuthnRequest issuer or SP reference at the organization's IdP SSO endpoint, /saml/idp/{organizationID}/sso; the entity id need be unique only within the organization. Give the SP administrator the organization's IdP metadata from /saml/idp/{organizationID}/metadata to complete the trust. The ACS URL, where signed assertions are posted, must be an absolute https URL without user information (plain http only to localhost), or the answer is 422 saml.acs_url_invalid. A status, when given, must be draft, active or disabled (422 saml.status_invalid), and an entity id already registered in the organization is refused with 409 saml.sp_entity_id_taken. The NameID format is emailAddress (the default), persistent or unspecified (422 saml.name_id_format_invalid otherwise), and name_id_attribute names where its value comes from: email, user_id, persistent_id (an opaque value made for each person at this SP, which never changes) or metadata.<key>. An emailAddress NameID is always the email and a persistent one persistent_id (its default) or user_id; another combination is refused with 422 saml.name_id_attribute_invalid. attributes, when given, replaces the default email and name attributes; an empty list sends none, and an invalid one is refused with 422 saml.attributes_invalid naming each field at fault. assignment_required limits sign-in to the people and groups assigned to the SP. The registration is audited as saml.sp_created with these settings.
         */
        post: operations["registerSamlApp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml-providers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get SAML SP
         * @description Returns a single registered downstream Service Provider's configuration in the organization, from the IdP-side registry where Qeet acts as the Identity Provider. Update it with PATCH or remove it with DELETE.
         */
        get: operations["getSamlApp"];
        put?: never;
        post?: never;
        /**
         * Delete SAML SP
         * @description Removes a downstream Service Provider from the organization's IdP-side registry so it can no longer obtain assertions from Qeet as the Identity Provider. The deletion is audited. Pairs with the SP list and registration endpoints.
         */
        delete: operations["deleteSamlApp"];
        options?: never;
        head?: never;
        /**
         * Update SAML SP
         * @description Updates a registered downstream Service Provider's configuration in the organization, such as its entity id, ACS URL, NameID settings or status, on the IdP side where Qeet acts as the Identity Provider. Changes are confined to the organization in the path and are audited as saml.sp_updated, naming the fields changed and the new entity id, ACS URL, NameID, attribute and assignment settings. A new ACS URL is checked as on registration (422 saml.acs_url_invalid), and so are the NameID settings and attributes. A new NameID format without a name_id_attribute moves the attribute to the format's default when the current one doesn't fit it (persistent_id for persistent, email for emailAddress); a name_id_attribute given must fit the format (422 saml.name_id_attribute_invalid). attributes replaces the whole list, and assignment_required turns assigned-people-only sign-in on or off; the people and groups assigned stay either way.
         */
        patch: operations["updateSamlApp"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml-providers/{id}/assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List SAML SP assignments
         * @description Lists who is assigned to one of the organization's downstream Service Providers: the people, and the groups whose members are. When the SP has assignment_required, only they are signed in to it; otherwise every person whose home is the organization is, and the list has no effect until it is turned on. Assign or unassign with the users/{userID} and groups/{groupID} routes below. An SP of another organization answers 404.
         */
        get: operations["listSamlAppAssignments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml-providers/{id}/assignments/groups/{groupID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign a group to a SAML SP
         * @description Assigns a group of the organization to one of its downstream Service Providers, so an SP with assignment_required signs in the group's members (its own members, not those of groups nested under it). Another organization's group, or an unknown one, is refused with 404 saml.assignee_not_found. Assigning a group already assigned changes nothing. The assignment is audited as saml.sp_group_assigned, and needs a recent step-up.
         */
        post: operations["assignSamlAppToGroup"];
        /**
         * Unassign a group from a SAML SP
         * @description Removes a group's assignment to one of the organization's downstream Service Providers; its members assigned themselves stay assigned. A group not assigned answers 404. The removal is audited as saml.sp_group_unassigned, and needs a recent step-up.
         */
        delete: operations["unassignSamlAppFromGroup"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml-providers/{id}/assignments/users/{userID}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign a person to a SAML SP
         * @description Assigns a person to one of the organization's downstream Service Providers, so an SP with assignment_required signs them in. Only a person whose home is the organization can be assigned, the only people its SPs sign in: anyone else, including another organization's, is refused with 404 saml.assignee_not_found. Assigning someone already assigned changes nothing. The assignment is audited as saml.sp_user_assigned, and needs a recent step-up.
         */
        post: operations["assignSamlAppToUser"];
        /**
         * Unassign a person from a SAML SP
         * @description Removes a person's own assignment to one of the organization's downstream Service Providers; one through a group they belong to stays. A person not assigned themselves answers 404. The removal is audited as saml.sp_user_unassigned, and needs a recent step-up.
         */
        delete: operations["unassignSamlAppFromUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get connection
         * @description Returns a single inbound SAML connection's configuration in the organization, where Qeet acts as the Service Provider consuming an external IdP. Update it with PATCH, validate it with the connection test endpoint, or remove it with DELETE.
         */
        get: operations["getSamlConnection"];
        put?: never;
        post?: never;
        /**
         * Delete connection
         * @description Deletes an inbound SAML connection in the organization so Qeet no longer accepts assertions from that external IdP. The deletion is audited and is scoped to the organization in the path.
         */
        delete: operations["deleteSamlConnection"];
        options?: never;
        head?: never;
        /**
         * Update connection
         * @description Applies a partial update to an inbound SAML connection in the organization, covering the IdP entity id, SSO URL, signing certificate, attribute mappings or status, with Qeet acting as the Service Provider. A new idp_certificate replaces every certificate the connection trusts; to roll over without an outage, use the certificates endpoints instead. Changes are confined to the organization in the path and are audited. Re-run the connection test endpoint after changing IdP details. An active connection needs the IdP's entity ID, SSO URL and a certificate: turning on one without them is refused with 422 saml.connection_incomplete. Changing what the connection trusts (a new idp_entity_id or idp_certificate) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        patch: operations["updateSamlConnection"];
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/certificates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add IdP certificate
         * @description Makes the connection also trust another of the IdP's signing certificates, such as the next one it has published ahead of a certificate rollover. An assertion signed with any certificate the connection trusts is accepted, so add the new certificate before the IdP switches and remove the old one after. The connection's certificates, with their validity periods, are in its certificates field. A certificate that doesn't parse answers 422 saml.certificate_invalid, one already trusted 409 saml.certificate_exists, and a ninth 422 saml.certificate_limit. Audited; another organization's connection answers 404. Changing what the connection trusts (another certificate) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        post: operations["addSamlCertificate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/certificates/{certificateID}": {
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
         * Remove IdP certificate
         * @description Stops the connection trusting one of its IdP signing certificates, such as the old one once the IdP has rolled over to its next. The connection's last certificate can't be removed (409 saml.certificate_last); idp_certificate becomes the oldest one left. Audited; another organization's connection answers 404.
         */
        delete: operations["removeSamlCertificate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/group-mappings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List group mappings
         * @description Lists the group mappings of an inbound SAML connection in the organization. Each maps a group the connection's IdP asserts (idp_group, compared ignoring case) to one of the organization's groups. At every sign-in through the connection the person joins the groups their asserted groups reach, through these mappings or as the external id of a group SCIM provisioned, and leaves the groups the connection's sign-ins put them in that they no longer reach; the groups are read from the connection's groups_attribute. A membership an administrator or SCIM made is never changed, and a group whose roles carry the owner role or an administrative permission (any but the reads organization.read, user.read, role.read, group.read, connection.read, apikey.read, webhook.read, billing.read, policy.read, audit.read and analytics.read) is never joined: sign-in takes out anyone it put there. Requires connection.read; an unknown connection, or another organization's, answers 404.
         */
        get: operations["listSamlGroupMappings"];
        put?: never;
        /**
         * Map an IdP group
         * @description Maps a group the connection's IdP asserts to one of the organization's groups, from each person's next sign-in. Whoever maps a group hands out what it grants: the caller must hold every permission the group's roles carry, as adding a member needs (403 rbac.grant_exceeds_caller, or rbac.owner_only for a group holding the owner role). A group whose roles carry the owner role or an administrative permission can't be mapped at all (422 group.mapping_privileged), and the group must be the organization's (404 group.not_found). The same pair twice is refused with 409 group.mapping_exists, an empty or over-long idp_group with 422 validation_failed, and a connection holds up to 1,000 mappings (422 group.mapping_too_many). Audited as saml.group_mapping_created. Requires group.write. Needs a recent step-up.
         */
        post: operations["createSamlGroupMapping"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/group-mappings/{mappingID}": {
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
         * Remove a group mapping
         * @description Removes a group mapping of the connection. Once none of the connection's mappings reaches the group, the memberships of it the connection's sign-ins made end at once, each audited as group.member_removed; one a SCIM group's external id still reaches comes back at the person's next sign-in. Audited as saml.group_mapping_deleted. Requires group.write. Needs a recent step-up.
         */
        delete: operations["deleteSamlGroupMapping"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply IdP metadata
         * @description Gives the connection its IdP's SSO URL and signing certificates from the IdP's metadata, as on import: from metadata_url, which the connection then refreshes from; from metadata_xml, which stops any refreshing; or, with an empty object, from the URL the connection already refreshes from. The metadata must describe the connection's own IdP (its idp_entity_id), so it can't repoint the connection at another; otherwise 422 saml.metadata_invalid. With no source and no stored URL, 422 saml.metadata_required. Audited; another organization's connection answers 404. Changing what the connection trusts (metadata pasted in or from another URL; a refresh from the connection's own metadata_url is not) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        post: operations["applySamlIdpMetadata"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Test SAML connection
         * @description Runs offline checks (entity ID present, https SSO URL, the signing certificate parses and is in its validity window, email attribute mapped) and returns per-check results. No network I/O.
         */
        post: operations["testSamlConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/saml/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create connection from IdP metadata
         * @description Creates an inbound SAML connection from the external IdP's SAML 2.0 metadata, given either as the XML (metadata_xml) or as a URL to fetch it from (metadata_url). The connection takes the IdP's entity id, its https HTTP-Redirect SingleSignOnService and its signing certificates from the metadata. A connection given a URL refreshes from it every few hours, adding the IdP's new signing certificates and dropping those the metadata no longer lists (certificates an administrator added are kept); metadata that can't be fetched or no longer describes the same IdP changes nothing and is reported in metadata_error. The URL is fetched only from public https addresses, with a 10-second timeout and a 1 MiB limit. Metadata describing several identity providers needs idp_entity_id to pick one. Neither or both sources answer 422 saml.metadata_required; unusable metadata 422 saml.metadata_invalid, with the reason in detail; a URL that isn't allowed 422 saml.metadata_url_invalid; one that can't be fetched 422 saml.metadata_unreachable. The organization's plan must include enterprise SSO (402 billing.upgrade_required), checked before anything is fetched. Scoped to the organization in the path and audited.
         */
        post: operations["importSamlConnection"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get SCIM config
         * @description Returns the organization's SCIM settings, never a token: whether one works, the newest working token's prefix and creation, the latest use of any, how many work (token_count), and how the last change the identity provider sent was answered (last_request). List the tokens themselves with GET /v1/organizations/{organizationID}/scim/tokens. Requires connection.read.
         */
        get: operations["getScimConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List provisioned groups
         * @description Lists the groups the organization's identity provider made over SCIM, newest first, a page at a time, each with its external id and its count of members. Requires connection.read.
         */
        get: operations["listProvisionedGroups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate SCIM token
         * @description Issues a new SCIM token, named "SCIM token", and revokes every earlier one at once; the token is shown only in this answer. To switch an identity provider over without a gap, rotate one token with POST /v1/organizations/{organizationID}/scim/tokens/{id}/rotate instead, which keeps the old one working for an overlap. Requires connection.write. Needs a recent step-up.
         */
        post: operations["replaceAllScimTokens"];
        /**
         * Revoke SCIM token
         * @description Revokes every SCIM token of the organization that still works, which stops provisioning; 404 when none does. To stop one token of several, use DELETE /v1/organizations/{organizationID}/scim/tokens/{id}. Requires connection.write. Needs a recent step-up.
         */
        delete: operations["revokeAllScimTokens"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List SCIM tokens
         * @description Lists the organization's SCIM tokens, newest first, including revoked and expired ones, never the tokens themselves. Requires connection.read.
         */
        get: operations["listScimTokens"];
        put?: never;
        /**
         * Create a SCIM token
         * @description Issues a named SCIM token beside the organization's others, for a second identity provider or a staged switch; the token is shown only in this answer and only its hash is kept. Without expires_at it works until revoked or rotated. An organization holds at most 10 working tokens that have not been rotated (409 scim.token_limit). Requires connection.write. Needs a recent step-up.
         */
        post: operations["createScimToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/tokens/{id}": {
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
         * Revoke a SCIM token
         * @description Revokes one of the organization's SCIM tokens at once, including a rotated one still in its overlap; the organization's other tokens keep working. 404 scim.token_not_found when the token is not the organization's or is already revoked. Requires connection.write. Needs a recent step-up.
         */
        delete: operations["revokeScimToken"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/tokens/{id}/rotate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate a SCIM token
         * @description Issues a token in place of one of the organization's, under its name, shown only in this answer. The old token keeps working for overlap_hours (default 168, a week; at most 720), or until its own earlier expiry, so the identity provider can be switched without a gap; then it is refused. An overlap of 0 revokes it at once. Revoke it early with DELETE /v1/organizations/{organizationID}/scim/tokens/{id}. Only a working token that has not been rotated can be (409 scim.token_inactive). The body is optional. Requires connection.write. Needs a recent step-up.
         */
        post: operations["rotateScimToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/scim/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List provisioned users
         * @description Lists the users provisioned over SCIM, newest first, a page at a time: next_cursor fetches the next page and total counts them all. Requires connection.read.
         */
        get: operations["listProvisionedUsers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/service-principals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List service principals
         * @description Lists the organization's service principals, without their secrets. Requires apikey.read.
         */
        get: operations["listServicePrincipals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/service-principals/{id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enable service principal
         * @description Turns a disabled service principal back on, so its secret gets tokens again; enabling one that is on changes nothing. Requires apikey.write. Needs a recent step-up. Audited as service_principal.enabled.
         */
        post: operations["enableServicePrincipal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/service-principals/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate service principal secret
         * @description Gives a service principal a new client secret, returned only now, and keeps the old secret getting tokens for overlap_hours (default 24, at most 168; 0 stops it at once). Tokens already issued are unaffected. The new secret carries the principal's scopes, so the caller must hold every one of them, as for creating one (403 rbac.grant_exceeds_caller, the secret unchanged). Requires apikey.write. Needs a recent step-up. Audited as service_principal.secret_rotated.
         */
        post: operations["rotateServicePrincipalSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{organizationID}/social/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List providers
         * @description Lists the organization's social sign-in providers, without their client secrets. Requires connection.read.
         */
        get: operations["listSocialProviders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/service-principals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create service principal
         * @description Creates a service principal, a non-human machine identity, in the caller's organization and returns its client id and one-time client secret, which cannot be retrieved afterward. The principal authenticates for machine-to-machine access at the client-credentials token endpoint (POST /v1/oauth/token). Creation is audited; disable the principal when it is no longer needed. Send an Idempotency-Key header to retry it safely: a retry with the same key and body within 24 hours gets the first answer, marked Idempotent-Replayed: true; the same key with another body answers 422 idempotency.key_reused, one still being processed 409 idempotency.in_progress, and one whose first request stopped before answering 409 idempotency.outcome_unknown: check whether it took effect, then retry with a new key. A credential carries only authority its creator holds: every scope must be one the caller holds (a vault scope needs secret.read; a machine caller, a scope of its own), or the request is refused with 403 rbac.grant_exceeds_caller naming the scope.
         */
        post: operations["createServicePrincipal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/service-principals/{id}": {
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
         * Disable service principal
         * @description Disables a service principal: its credentials no longer get tokens, and the tokens it already holds are refused at once (401) and introspect inactive. Requires apikey.write. Needs a recent step-up.
         */
        delete: operations["disableServicePrincipal"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/{provider}/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Social login callback
         * @description Completes a social sign-in: exchanges the provider's code, then signs in the account linked to that provider identity, adopts the organization's existing account for a verified address, or creates an account. The callback completes only in the browser that began the sign-in, which holds the binding cookie from GET /v1/social/{provider}/start: the same return link opened in another browser, or without the cookie, is refused and nothing is issued — the browser is sent to the hosted login with error=other_browser and the return_to (the console flow gets social_error=other_browser). A link ceremony (POST /v1/social/{provider}/link/start) attaches nothing here: the browser is sent to the account page with a one-time link_code and the provider, which the account that began the link completes at POST /v1/social/link/complete. Creating one is self-registration: when the organization does not allow it, nothing is created, the attempt is audited (social.signup_refused, naming the provider and the address), and the browser is sent to the hosted login with error=registration_closed and the original return_to. Nor is an account created on a domain another organization has verified (error=social), or on one whose organization requires single sign-on (error=sso_required and the original return_to, so the hosted login can send the person to the organization's single sign-on; like the password sign-in's 403 auth.sso_required it depends only on the domain). The console's own sign-up (intent=signup) creates no account on a domain an organization has verified either (error=social). An address the organization's address rules refuse is sent there with error=address_not_allowed and the return_to, and no hosted-login session is opened. An existing account whose address has never been verified, unless the organization's directory provisioned it (SCIM), is not adopted by the provider's word (error=account_unverified; the console flow gets social_error=account_unverified): it must verify the address, or reset its password from the emailed link, first. An OpenID Connect provider's word counts as verified only for an address on a domain the organization has verified (see POST /v1/social/providers). A suspended or deleted account gets error=account_inactive (the console flow gets social_error=account_inactive). When the sign-in must meet a second factor first (the account holds one, the organization requires one, or the sign-in is risky; a remembered device may skip it as for a password sign-in), no hosted-login session is opened either: the browser is sent to the hosted login with the return_to, and the challenge in the URL fragment (mfa_token, methods, factors — the JSON list a password sign-in's challenge carries, with an email or SMS factor's id and masked destination — and enrollment_required / enrollment_due_at for one to set up), to complete at POST /v1/auth/session/mfa. Other failures send it there with error=social. An organization's own provider signs in only an account whose home is that organization, whether linked before or adopted by email. Neither it nor the console's own sign-in signs in, adopts or links an account on a domain whose organization requires single sign-on, except its break-glass members (error=sso_required and the return_to; the console flow is sent to the hosted login with error=sso_required too): only that organization's identity provider signs its people in. Nor does any provider adopt by email an account that owns or administers the organization (social.account_administers; the browser gets error=social): it keeps its own credentials and connects the provider from its account.
         */
        get: operations["completeSocialSignIn"];
        put?: never;
        /**
         * Social login callback using form_post
         * @description Sign in with Apple returns the authorization response as a bounded form POST. Successful callbacks redirect with a one-time Qeet login code. The browser must hold the binding cookie, as for the GET callback.
         */
        post: operations["completeSocialSignInWithFormPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/{provider}/link/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Begin linking a provider to my account
         * @description Authenticated "connect this provider" ceremony. Returns the provider authorize URL for the browser to navigate to. The callback never creates or switches accounts, and attaches nothing itself: it sends the browser back to the account page (/account/security) with a one-time link_code and the provider, and the identity is attached only when the account that began the link completes it at POST /v1/social/link/complete.
         */
        post: operations["startSocialLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/{provider}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Start social login
         * @description Begins a social sign-in and redirects the browser to the provider. ?organization (slug) or ?organization_id names the organization; without either it is the console's own sign-in, where ?intent=signup allows creating an account. ?return_to opts into the hosted flow. The browser is given an HttpOnly binding cookie (qe_social, __Host- prefixed outside dev, SameSite=None so a form_post callback carries it) naming the sign-in, which the callback requires.
         */
        get: operations["startSocialSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exchange social code
         * @description Trades the one-time code a social sign-in callback handed back (the console's own, or an organization's) for the sign-in's result. Social sign-in takes the same second-factor decision as a password sign-in: the response is a token pair, or, when the account holds a second factor, the organization requires one, or the sign-in is risky, the challenge instead (mfa_required, mfa_token, methods, factors, and enrollment_required for an account that must set one up), completed at POST /v1/auth/mfa. An organization's code trades only while the provider that issued it is still on: 404 social.provider_not_configured once it has been switched off, and 401 social.login_code_invalid once it is deleted.
         */
        post: operations["exchangeSocialCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/identities/{id}": {
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
         * Unlink identity
         * @description Unlinks a social sign-in from the account of a member of the caller's organization. Requires user.write. Refused with 403 rbac.target_is_owner when the account is an owner's and the caller isn't one, and 403 rbac.target_outranks_caller when it holds a permission the caller doesn't.
         */
        delete: operations["unlinkSocialIdentity"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/link/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete linking a provider to my account
         * @description Attaches the provider identity a link callback returned, held under the one-time link_code the account page was sent back with, to the caller. Only the account that began the link (POST /v1/social/{provider}/link/start) completes it; for any other the code is spent and the answer is 403 social.link_account_mismatch, so a connect link sent to someone else never attaches their provider account to the sender's. An unknown, used or expired code answers 400 social.link_code_invalid (codes live two minutes); an identity already linked to another account answers 409 social.already_linked. An account whose organization requires single sign-on on its domain links no provider (403 auth.sso_required), as no social sign-in signs it in.
         */
        post: operations["completeSocialLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/platform/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List enabled platform social providers
         * @description Lists the platform-level social login providers enabled in the deployment configuration, as opposed to an organization's own configured providers, with Qeet acting as the OAuth client. Served without authentication so the hosted login can render the available sign-in options. Begin a sign-in with GET /v1/social/{provider}/start.
         */
        get: operations["listPlatformSocialProviders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upsert provider
         * @description Adds a social provider, or replaces the settings of one the organization already has. Replacing keeps whether the provider is switched on, and an empty client_secret keeps the stored one. The secret is stored encrypted and never returned. A provider named github, facebook, x, discord or apple uses that provider's own OAuth 2.0 flow and needs no discovery URL (kind names it); any other name is an OpenID Connect provider found by discovery_url. For apple, client_id is the Services ID and client_secret the .p8 private key with apple_team_id and apple_key_id: the server signs Apple's short-lived client secret from them for each sign-in, and a key that can't sign one is refused with 422. X signs in with PKCE. An address from GitHub, X (confirmed_email) or Discord (verified) counts as verified; one from Facebook doesn't, so it can make a new account but never sign in to an existing one by its address. An OpenID Connect provider's endpoints are the organization's choice, so its word verifies an address only on a domain the organization has verified: elsewhere it too can make a new account, its address unverified, but never sign in to an existing one by its address. Audited as social_provider.created or social_provider.updated (the fields saved and whether the secret was replaced, never its value). Changing what the connection trusts (an OpenID Connect provider's discovery_url, including setting one up again under a name it had before) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        post: operations["upsertSocialProvider"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/social/providers/{provider}": {
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
         * Remove a provider
         * @description Removes one of the caller's organization's social providers. The identities people linked through it are kept — they still show in those people's connected accounts and work again if the provider is added back — but nobody can sign in through it meanwhile. Refused with 409 social.provider_in_use (metadata.people: how many) while anyone in the organization can sign in only through it (no password, no passkey, no other linked identity); give them another way in first. Audited as social_provider.deleted. 404 for a provider the organization does not have.
         */
        delete: operations["deleteSocialProvider"];
        options?: never;
        head?: never;
        /**
         * Update a provider
         * @description Changes only the fields given on one of the caller's organization's social providers — switch it off or on, replace its secret, or change its client ID or discovery URL. Takes effect for the next sign-in; other providers are unaffected. A switched-off provider reads to a signing-in user exactly like one that was never set up. Audited as social_provider.updated (fields changed, whether the secret was replaced), social_provider.disabled and social_provider.enabled. 404 for a provider the organization does not have. Switching it off is refused with 409 social.provider_in_use (metadata.people: how many) while anyone in the organization can sign in only through it, as removing it is; give them another way in first. Changing what the connection trusts (an OpenID Connect provider's discovery_url) is acting on every account linked to it, as the changed connection could sign in as any of them: while an administrator is linked, it needs a caller who outranks each one (403 rbac.trust_change_outranks_caller otherwise).
         */
        patch: operations["updateSocialProvider"];
        trace?: never;
    };
    "/v1/sso/discovery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Discover where an address signs in (public)
         * @description Home-realm discovery: says whether an email address signs in through its organization's identity provider, and through which connections. It is judged by the address's domain alone, so every address on a domain gets the same answer whether or not it has an account. sso is true when the organization that verified the domain (or the closest verified domain above it) has switched sso_enabled on for it and has an active SAML, LDAP or OpenID Connect connection; those addresses' own sign-in methods are then refused with 403 auth.sso_required, except for the organization's break-glass members. Each connection gives login_path, below the API's address: a browser goes to it for SAML and OpenID Connect (method redirect), and the directory login name and password are posted to it for LDAP (method credentials). The hosted login adds return_to to a redirect, and posts a credentials connection's sign-in to session_path, which answers with the hosted-login session. An address that is not routed answers sso false with no connections. Unauthenticated; rate-limited like sign-in.
         */
        post: operations["discoverSso"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/users/{userID}/social/identities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List linked identities
         * @description Lists the social accounts linked to a user in the organization. Requires user.read.
         */
        get: operations["listUserSocialIdentities"];
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
        AdminPortalLink: {
            capabilities: ("saml" | "scim" | "domain_verification")[];
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            created_by: string | null;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_used_at: string | null;
            /** Format: uuid */
            organization_id: string;
            /** Format: date-time */
            revoked_at: string | null;
        };
        /** @description A SAML connection as the admin portal shows it, with the service-provider addresses the IT admin enters at their IdP. */
        AdminPortalSAMLConnection: components["schemas"]["SAMLConnection"] & {
            /**
             * Format: uri
             * @description The assertion consumer service URL the IdP posts its answers to.
             */
            acs_url: string;
            /** @description The service provider's entity ID (audience) for this connection. */
            sp_entity_id: string;
            /**
             * Format: uri
             * @description Where the service provider's SAML metadata for this connection is served.
             */
            sp_metadata_url: string;
        };
        adminUser: {
            /** Format: date-time */
            created_at: string;
            display_name: string | null;
            email: string;
            external_id: string | null;
            /** Format: uuid */
            id: string;
            status: string;
        };
        CIBAPendingRequest: {
            binding_message?: string;
            client_name: string;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            scopes: string[];
        };
        ConfigView: {
            /**
             * Format: date-time
             * @description When the newest working token was issued.
             */
            created_at: string | null;
            /** @description How the last change the identity provider sent was answered; null before the first. Reads are not recorded. */
            last_request: {
                /** Format: date-time */
                at: string;
                /** @description The directory error code, such as DIR-409. */
                error_code?: string;
                http_status: number;
                /** @enum {string} */
                operation: "post" | "put" | "patch" | "delete";
                /** @description The SCIM error type the answer gave, such as scim.uniqueness or scim.invalidValue. */
                reason?: string;
                /** @enum {string} */
                resource: "user" | "group";
                /** @enum {string} */
                status: "success" | "warning" | "failed";
            } | null;
            /**
             * Format: date-time
             * @description The latest use of any working token, recorded at most once a minute.
             */
            last_used_at: string | null;
            provisioned_count: number;
            /** @description How many tokens work, rotated ones still in their overlap included. */
            token_count: number;
            /** @description The newest working token's prefix. */
            token_prefix?: string;
            /** @description Whether any token works. */
            token_set: boolean;
        };
        /** @description RFC 8628 §3.2 device authorization response. */
        DeviceAuthorizationResponse: {
            device_code: string;
            expires_in: number;
            /** @description Minimum seconds the device must wait between token polls. */
            interval?: number;
            /** @description Human-friendly code (XXXX-XXXX) from an unambiguous alphabet. */
            user_code: string;
            /** Format: uri */
            verification_uri: string;
            /** Format: uri */
            verification_uri_complete?: string;
        };
        DirectoryAlert: {
            /** @description The connection it watches; null for every connection. */
            connection_id: string | null;
            /** Format: date-time */
            created_at: string;
            /** @description False while paused. */
            enabled: boolean;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_notified_at: string | null;
            name: string;
            /** @description Failures within 15 minutes that notify. */
            threshold: number;
            /**
             * Format: uuid
             * @description The person it notifies (who made it).
             */
            user_id: string;
        };
        DirectoryEvent: {
            category: string;
            connection_id: string;
            duration_ms: number;
            error_code: string;
            groups_synced: number;
            http_status: number;
            /** Format: uuid */
            id: string;
            message: string;
            operation: string;
            /** @description Safe details of the failure: host, the directory server it used. */
            params?: {
                [key: string]: string;
            };
            /** @description The failure's own code, such as ldap.dial_failed, ldap.service_bind_failed, ldap.tls_verify_required or ldap.invalid_credentials, or the SCIM error type an answer to the identity provider gave (scim.uniqueness, say). Absent on a success, and on events from before it was kept. */
            reason?: string;
            /** @enum {string} */
            resolution: "open" | "resolved" | "retried";
            /** Format: date-time */
            resolved_at: string | null;
            resource_id: string;
            /** @enum {string} */
            resource_type: "user" | "group" | "connection";
            /** Format: uuid */
            retry_of: string | null;
            retryable: boolean;
            /** @enum {string} */
            severity: "" | "warning" | "critical";
            /** Format: date-time */
            started_at: string;
            /** @enum {string} */
            status: "success" | "warning" | "failed";
            /** @description The login name an LDAP sign-in tried. */
            subject?: string;
            /** @enum {string} */
            trigger: "push" | "manual" | "sign-in";
            /**
             * Format: uuid
             * @description The person an LDAP sign-in was for, once the directory knew them.
             */
            user_id?: string;
            users_synced: number;
        };
        DirectoryMapping: {
            enabled: boolean;
            /** Format: uuid */
            readonly id?: string;
            pattern?: string;
            required: boolean;
            source_attribute: string;
            /** @enum {string} */
            target_field: "email" | "display_name" | "first_name" | "last_name" | "department" | "title" | "manager_id" | "groups";
            /** @enum {string} */
            transform: "none" | "trim" | "lowercase" | "uppercase" | "extract";
            /** @enum {string} */
            value_type: "string" | "array";
            version?: number;
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
        exchangeInput: {
            code: string;
        };
        ExternalIdentity: {
            email: string | null;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            linked_at: string;
            /** Format: uuid */
            organization_id: string;
            provider: string;
            subject: string;
            /** Format: uuid */
            user_id: string;
        };
        Grant: {
            /**
             * Format: date-time
             * @description When the grant began.
             */
            authorized_at: string;
            client_id: string;
            client_name: string;
            /**
             * Format: date-time
             * @description When the person last consented to the application; null for an application that asks for no consent.
             */
            consented_at: string | null;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            issued_at: string;
            /**
             * Format: date-time
             * @description When the application was last issued tokens under the grant (the same as issued_at).
             */
            last_used_at: string;
            scopes: string[];
            user_email: string;
            /** Format: uuid */
            user_id: string;
            user_name: string | null;
        };
        /** @description RFC 7662 response; `active` plus claims when active. */
        Introspection: {
            active?: boolean;
        } & {
            [key: string]: unknown;
        };
        /** @description A public signing key. An EC key (kty EC) has crv, x and y; an RSA key (kty RSA) has n and e. */
        JWK: {
            /** @description ES256 for an EC P-256 key, RS256 for an RSA key. */
            alg: string;
            /** @description EC keys only. The curve, P-256. */
            crv?: string;
            /** @description RSA keys only. The public exponent. */
            e?: string;
            kid: string;
            /** @description EC or RSA. */
            kty: string;
            /** @description RSA keys only. The modulus. */
            n?: string;
            use: string;
            /** @description EC keys only. */
            x?: string;
            /** @description EC keys only. */
            y?: string;
        };
        JWKS: {
            keys?: components["schemas"]["JWK"][];
        };
        LdapConnection: {
            base_dn: string;
            bind_dn: string;
            /** Format: date-time */
            created_at: string;
            email_attribute: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_login_at: string | null;
            name: string;
            name_attribute: string;
            /** Format: uuid */
            organization_id: string;
            server_url: string;
            skip_tls_verify: boolean;
            start_tls: boolean;
            status: string;
            /** Format: date-time */
            updated_at: string;
            user_filter: string;
        };
        LdapCreateInput: {
            base_dn: string;
            bind_dn: string;
            bind_password: string;
            email_attribute: string;
            name: string;
            name_attribute: string;
            server_url: string;
            skip_tls_verify: boolean;
            start_tls: boolean;
            status: string;
            user_filter: string;
        };
        /** @description The fields to change; every one is optional, and one left out or null keeps its value. */
        LdapUpdateInput: {
            base_dn?: string | null;
            bind_dn?: string | null;
            bind_password?: string | null;
            email_attribute?: string | null;
            name?: string | null;
            name_attribute?: string | null;
            server_url?: string | null;
            skip_tls_verify?: boolean | null;
            start_tls?: boolean | null;
            status?: string | null;
            user_filter?: string | null;
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
        /** @description Admin view of an RFC 8628 device-authorization row. Never includes the device_code or its hash. */
        OAuthDeviceAuthorization: {
            client_id: string;
            /** @description The application's name; empty once the application is deleted. */
            client_name: string;
            /**
             * Format: date-time
             * @description When the device redeemed the approval for tokens; null until then.
             */
            consumed_at: string | null;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_polled_at: string | null;
            scopes: string[];
            /** @enum {string} */
            status: "pending" | "authorized" | "denied";
            user_code: string;
            user_email: string;
            /** Format: uuid */
            user_id: string | null;
        };
        /** @description An RFC 6749 §5.2 error, as the token, revocation, device and backchannel endpoints answer. */
        OAuthError: {
            /** @enum {string} */
            error: "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "invalid_scope" | "invalid_target" | "authorization_pending" | "slow_down" | "access_denied" | "expired_token" | "unsupported_token_type" | "unknown_user_id";
            error_description?: string;
        };
        OAuthTokenRequest: {
            /** @description RFC 8693 token-exchange grant only (optional) — names the delegate acting on the subject's behalf (e.g. an AI agent); the issued token carries an "act" claim. */
            actor_token?: string;
            actor_token_type?: string;
            /** @description Present when grant_type is the CIBA grant; the auth_req_id the backchannel authentication request answered. */
            auth_req_id?: string;
            /** @description The application's client_id, or on client_credentials the service principal's or agent's id. Sent here or as the HTTP Basic user. */
            client_id?: string;
            client_secret?: string;
            code?: string;
            code_verifier?: string;
            /** @description Present when grant_type is the RFC 8628 device_code grant. */
            device_code?: string;
            /** @enum {string} */
            grant_type: "authorization_code" | "refresh_token" | "urn:ietf:params:oauth:grant-type:device_code" | "urn:ietf:params:oauth:grant-type:token-exchange" | "urn:openid:params:grant-type:ciba" | "client_credentials";
            /** Format: uri */
            redirect_uri?: string;
            refresh_token?: string;
            requested_token_type?: string;
            /**
             * Format: uri
             * @description RFC 8707 resource indicator, accepted on authorization_code, refresh_token and token-exchange: the issued access token's audience is this resource alone (e.g. an MCP server). On refresh_token, omitting it carries the resource bound at the original grant forward, and naming another is refused with invalid_target. Refused with invalid_target on client_credentials, device_code and CIBA.
             */
            resource?: string;
            /** @description The scopes asked for, on token-exchange. Ignored on client_credentials: the token always carries every scope the service principal or agent holds. */
            scope?: string;
            /** @description RFC 8693 token-exchange grant only — the token identifying the party whose authority is being exercised. */
            subject_token?: string;
            /** @description RFC 8693 token-exchange grant only. Only "urn:ietf:params:oauth:token-type:access_token" is supported. */
            subject_token_type?: string;
        };
        OAuthTokenResponse: {
            access_token?: string;
            /**
             * Format: date-time
             * @description When the access token expires; client_credentials tokens only.
             */
            expires_at?: string;
            /** @description The access token's lifetime in seconds. */
            expires_in?: number;
            id_token?: string;
            /** @description RFC 8693 token-exchange answers only; the type of the issued token, urn:ietf:params:oauth:token-type:access_token. */
            issued_token_type?: string;
            refresh_token?: string;
            scope?: string;
            /** @example Bearer */
            token_type?: string;
        };
        /** @description The ID token claims a sign-in reads. An empty name reads none, except for email, which is required. */
        OIDCClaimMapping: {
            /**
             * @description The claim holding the email address, such as email, preferred_username or upn. The provider's email_verified is consulted only when this is email.
             * @default email
             */
            email: string;
            /** @default family_name */
            family_name: string;
            /** @default given_name */
            given_name: string;
            /**
             * @description The claim listing the person's groups, kept on their linked identity.
             * @default
             */
            groups: string;
            /** @default name */
            name: string;
        };
        OIDCClient: {
            /**
             * Format: uri
             * @description Receives a signed logout token (OpenID Connect Back-Channel Logout, with sid) when someone the application signed in signs out; "" for none.
             */
            backchannel_logout_uri: string;
            client_id: string;
            /**
             * Format: uri
             * @description The application's home page, an https URL; the hosted sign-in page shows its host. "" for none (set "" to clear).
             */
            client_uri: string;
            /** Format: date-time */
            created_at: string;
            /**
             * Format: uri
             * @description Loaded by the hosted signed-out page (with iss and sid) when someone the application signed in signs out; "" for none.
             */
            frontchannel_logout_uri: string;
            grant_types: string[];
            /** Format: uuid */
            id: string;
            /**
             * Format: uri
             * @description The application's logo, an https URL, shown on the hosted sign-in page; "" for none (set "" to clear).
             */
            logo_uri: string;
            name: string;
            /** Format: uuid */
            organization_id: string;
            /**
             * Format: date-time
             * @description When this confidential application's exemption from sending a PKCE code_challenge ends; null for none.
             */
            pkce_exempt_until: string | null;
            post_logout_uris: string[];
            redirect_uris: string[];
            scopes: string[];
            /** @enum {string} */
            type: "public" | "confidential";
            /** @description The origins a browser application calls the token, userinfo, revocation and introspection endpoints from, which CORS then allows (without credentials): those the application set, else the origins of its http(s) redirect URIs. */
            web_origins?: string[];
        };
        OIDCClientCreate: {
            /**
             * Format: uri
             * @description Receives a signed logout token (OpenID Connect Back-Channel Logout, with sid) when someone the application signed in signs out; "" for none.
             */
            backchannel_logout_uri?: string | null;
            /**
             * Format: uri
             * @description The application's home page, an https URL; the hosted sign-in page shows its host. "" for none (set "" to clear).
             */
            client_uri?: string | null;
            /**
             * Format: uri
             * @description Loaded by the hosted signed-out page (with iss and sid) when someone the application signed in signs out; "" for none.
             */
            frontchannel_logout_uri?: string | null;
            /** @description Any of authorization_code, refresh_token, urn:ietf:params:oauth:grant-type:device_code, token exchange (token_exchange or urn:ietf:params:oauth:grant-type:token-exchange; confidential only) and urn:openid:params:grant-type:ciba (confidential only). client_credentials is refused with oidc.grant_type_unsupported: a machine caller is a service principal, which gets its tokens from POST /v1/oauth/token. */
            grant_types?: string[] | null;
            /**
             * Format: uri
             * @description The application's logo, an https URL, shown on the hosted sign-in page; "" for none (set "" to clear).
             */
            logo_uri?: string | null;
            name: string;
            /** Format: uuid */
            organization_id: string;
            post_logout_uris?: string[] | null;
            redirect_uris?: string[] | null;
            /** @description The scopes the application may request. offline_access needs no entry: an application registered for refresh_token may always request it. Listing offline_access opts the application in to OpenID Connect Core §11: it then gets a refresh token only for a request granted offline_access, where otherwise every grant to an application registered for refresh_token comes with one. */
            scopes?: string[] | null;
            /** @enum {string} */
            type: "public" | "confidential";
            /** @description Origins (scheme, host and optional port: https, or http only for localhost) a browser application calls the OAuth endpoints from. Left out or null: its redirect URIs' origins. An entry that isn't one is refused with 422 oidc.web_origin_invalid. */
            web_origins?: string[] | null;
        };
        /** @description Partial (COALESCE-style) update; omitted fields are left unchanged. */
        OIDCClientUpdate: {
            /**
             * Format: uri
             * @description Receives a signed logout token (OpenID Connect Back-Channel Logout, with sid) when someone the application signed in signs out; "" for none.
             */
            backchannel_logout_uri?: string | null;
            /**
             * Format: uri
             * @description The application's home page, an https URL; the hosted sign-in page shows its host. "" for none (set "" to clear).
             */
            client_uri?: string | null;
            /**
             * Format: uri
             * @description Loaded by the hosted signed-out page (with iss and sid) when someone the application signed in signs out; "" for none.
             */
            frontchannel_logout_uri?: string | null;
            /** @description Any of authorization_code, refresh_token, urn:ietf:params:oauth:grant-type:device_code, token exchange (token_exchange or urn:ietf:params:oauth:grant-type:token-exchange; confidential only) and urn:openid:params:grant-type:ciba (confidential only). client_credentials is refused with oidc.grant_type_unsupported: a machine caller is a service principal, which gets its tokens from POST /v1/oauth/token. */
            grant_types?: string[] | null;
            /**
             * Format: uri
             * @description The application's logo, an https URL, shown on the hosted sign-in page; "" for none (set "" to clear).
             */
            logo_uri?: string | null;
            name?: string | null;
            /**
             * Format: date-time
             * @description Sets (a date-time, within 90 days) or clears (null) a confidential application's PKCE exemption; omitted, unchanged.
             */
            pkce_exempt_until?: string | null;
            post_logout_uris?: string[] | null;
            redirect_uris?: string[] | null;
            /** @description The scopes the application may request. offline_access needs no entry: an application registered for refresh_token may always request it. Listing offline_access opts the application in to OpenID Connect Core §11: it then gets a refresh token only for a request granted offline_access, where otherwise every grant to an application registered for refresh_token comes with one. */
            scopes?: string[] | null;
            /** @description Sets the origins a browser application calls the OAuth endpoints from; null goes back to its redirect URIs' origins; left out, unchanged. An entry that isn't an origin is refused with 422 oidc.web_origin_invalid. */
            web_origins?: string[] | null;
        };
        OIDCConnection: {
            /** @description The provider's own tenant IDs (tid) accepted; empty accepts the issuer alone. */
            allowed_idp_tenant_ids?: string[];
            claim_mapping?: components["schemas"]["OIDCClaimMapping"];
            client_id?: string;
            /** Format: date-time */
            created_at?: string;
            /** @description Where the discovery document is read; empty for the issuer's /.well-known/openid-configuration. */
            discovery_url?: string;
            /** Format: uuid */
            id?: string;
            /** @description The iss an ID token must carry. */
            issuer?: string;
            /** Format: date-time */
            last_login_at?: string | null;
            name?: string;
            /** Format: uuid */
            organization_id?: string;
            /**
             * Format: uri
             * @description The redirect URI to register with the provider.
             */
            redirect_uri?: string;
            scopes?: string[];
            /** @enum {string} */
            status?: "draft" | "active" | "disabled";
            /** Format: date-time */
            updated_at?: string;
        };
        OIDCConnectionCreate: {
            allowed_idp_tenant_ids?: string[] | null;
            claim_mapping?: components["schemas"]["OIDCClaimMapping"];
            client_id: string;
            client_secret: string;
            discovery_url?: string | null;
            /** Format: uri */
            issuer: string;
            name: string;
            scopes?: string[] | null;
            /**
             * @default draft
             * @enum {string|null}
             */
            status: "draft" | "active" | "disabled" | null;
        };
        OIDCConnectionUpdate: {
            allowed_idp_tenant_ids?: string[] | null;
            claim_mapping?: components["schemas"]["OIDCClaimMapping"];
            client_id?: string | null;
            /** @description A new client secret; absent or empty keeps the stored one. */
            client_secret?: string | null;
            discovery_url?: string | null;
            /** Format: uri */
            issuer?: string | null;
            name?: string | null;
            scopes?: string[] | null;
            /** @enum {string|null} */
            status?: "draft" | "active" | "disabled" | null;
        };
        /** @description OIDC discovery metadata (issuer, endpoints, supported features). */
        OIDCDiscovery: {
            [key: string]: unknown;
        };
        OIDCResource: {
            /** Format: date-time */
            created_at?: string;
            /** Format: uuid */
            id?: string;
            /** Format: uri */
            identifier?: string;
            name?: string;
            /** Format: uuid */
            organization_id?: string;
            server_client_id?: string;
        };
        PortalBranding: {
            background_color?: string;
            logo_url?: string;
            primary_color?: string;
            secondary_color?: string;
        };
        PortalContext: {
            branding?: components["schemas"]["PortalBranding"];
            /** @description What the link may set up. */
            capabilities: ("saml" | "scim" | "domain_verification")[];
            /** Format: date-time */
            expires_at: string;
            organization_name: string;
            /**
             * Format: uri
             * @description The SCIM 2.0 base URL the IT admin enters at their IdP. Present only when the link's capabilities include scim.
             */
            scim_base_url?: string;
        };
        Provider: {
            apple_key_id?: string;
            apple_team_id?: string;
            client_id: string;
            /** Format: date-time */
            created_at: string;
            discovery_url: string | null;
            enabled: boolean;
            /** Format: uuid */
            id: string;
            /**
             * @description oidc for a provider found by discovery_url, else the adapter its name picks.
             * @enum {string}
             */
            kind: "oidc" | "github" | "facebook" | "x" | "discord" | "apple";
            /** Format: uuid */
            organization_id: string;
            provider: string;
        };
        SAMLAttributeMapping: {
            /** @description The attribute's SAML Name, unique within the SP */
            name: string;
            /**
             * @description The attribute's NameFormat; basic when absent
             * @enum {string}
             */
            name_format?: "basic" | "uri" | "unspecified";
            /** @description email; user_id (the account ID, the same at every app); persistent_id (an opaque value made for this person at this SP, which never changes); display_name; given_name and family_name (the user-metadata key of that name, else the person's directory profile first_name or last_name); groups (the names of their groups in the organization, one value each); roles (the names of their roles there, directly or through a group, one value each); or metadata.<key> (that user-metadata key: a string, number or boolean, or an array of them as one value each) */
            source: string;
        };
        SAMLCertificate: {
            /** @description PEM or base64 DER X.509 certificate */
            certificate?: string;
            /** Format: date-time */
            created_at?: string;
            /** @description SHA-256 fingerprint as colon-separated hex; empty if it doesn't parse. */
            fingerprint_sha256?: string;
            /** Format: uuid */
            id?: string;
            /**
             * Format: date-time
             * @description When the certificate expires; an assertion it signed is refused after then.
             */
            not_after?: string | null;
            /** Format: date-time */
            not_before?: string | null;
            /**
             * @description Whether an administrator added the certificate or the IdP's metadata listed it.
             * @enum {string}
             */
            source?: "manual" | "metadata";
            /** @description The certificate's subject; empty if it doesn't parse. */
            subject?: string;
        };
        SAMLConnection: {
            /** @description Where the IdP posts assertions. */
            acs_url: string;
            /**
             * @description Accept unsolicited assertions that carry no InResponseTo, i.e. IdP-initiated SSO. Off by default. Enabling it relaxes only the AuthnRequest correlation — signature, issuer, audience, destination and time-condition validation are unchanged, and response and assertion IDs are still consumed for replay protection.
             * @default false
             */
            allow_idp_initiated: boolean;
            /** @description Every IdP signing certificate the connection trusts, oldest first. An assertion signed with any of them is accepted, so an IdP can roll its key over without a sign-in outage. */
            certificates: components["schemas"]["SAMLCertificate"][];
            /** Format: date-time */
            created_at: string;
            email_attribute: string;
            /** @description The attribute carrying the person's groups, matched against the connection's group mappings and the external ids of groups SCIM provisioned. Empty (the default) reads groups, http://schemas.microsoft.com/ws/2008/06/identity/claims/groups and memberOf. When Microsoft Entra ID leaves the groups out for being too many, memberships stay as they are. */
            groups_attribute: string;
            /** Format: uuid */
            id: string;
            /** @description The oldest of the signing certificates the connection trusts. */
            idp_certificate: string;
            idp_entity_id: string;
            /** Format: uri */
            idp_sso_url: string;
            /** Format: date-time */
            last_login_at: string | null;
            /** @description Why the last refresh from metadata_url failed; null once one succeeds. */
            metadata_error: string | null;
            /**
             * Format: date-time
             * @description When the connection last took its settings from the IdP's metadata.
             */
            metadata_refreshed_at: string | null;
            /**
             * Format: uri
             * @description The IdP metadata URL the connection refreshes its SSO URL and certificates from; null when it doesn't refresh.
             */
            metadata_url: string | null;
            name: string;
            /** @description The attribute carrying the person's display name. When it is empty or the assertion lacks it, the common display-name attributes are read, else the given and family names joined. Each sign-in sets the account's display name to what the assertion carries. */
            name_attribute: string;
            /** Format: uuid */
            organization_id: string;
            /** @description The connection's own entity ID, for the IdP. */
            sp_entity_id: string;
            /** @description The connection's own metadata, for the IdP to import. */
            sp_metadata_url: string;
            /** @enum {string} */
            status: "draft" | "active" | "disabled";
            /** Format: date-time */
            updated_at: string;
        };
        /** @description The name, with all of the IdP's entity ID, SSO URL and certificate, or none of them for a draft. */
        SAMLConnectionCreate: {
            email_attribute?: string | null;
            /** @description The attribute carrying the person's groups; empty reads the common ones (see SAMLConnection). Over 256 characters is refused with 422 validation_failed. */
            groups_attribute?: string | null;
            /** @description PEM or base64 DER X.509 signing certificate. On update it becomes the only certificate the connection trusts; add and remove certificates one at a time with the certificates endpoints. */
            idp_certificate?: string | null;
            idp_entity_id?: string | null;
            /** Format: uri */
            idp_sso_url?: string | null;
            name: string;
            name_attribute?: string | null;
            status?: string | null;
        };
        SAMLConnectionImport: {
            email_attribute?: string | null;
            /** @description The assertion attribute carrying a person's groups; empty reads the common ones. */
            groups_attribute?: string | null;
            /** @description The entity id of the IdP to use, when the metadata describes several. */
            idp_entity_id?: string | null;
            /**
             * Format: uri
             * @description Where to fetch the IdP's metadata from, and refresh it from later. Give this or metadata_xml.
             */
            metadata_url?: string | null;
            /** @description The IdP's SAML 2.0 metadata document. Give this or metadata_url. */
            metadata_xml?: string | null;
            name: string;
            name_attribute?: string | null;
            status?: string | null;
        };
        /** @description The fields to change; every one is optional, and a field left out or null keeps its value. */
        SAMLConnectionUpdate: {
            /** @description Accept IdP-initiated sign-ins (unsolicited assertions); see SAMLConnection. */
            allow_idp_initiated?: boolean | null;
            email_attribute?: string | null;
            /** @description The attribute carrying the person's groups; empty reads the common ones (see SAMLConnection). Over 256 characters is refused with 422 validation_failed. */
            groups_attribute?: string | null;
            /** @description PEM or base64 DER X.509 signing certificate (422 saml.certificate_invalid otherwise). It becomes the only certificate the connection trusts; add and remove certificates one at a time with the certificates endpoints. */
            idp_certificate?: string | null;
            idp_entity_id?: string | null;
            /**
             * Format: uri
             * @description Checked as on create (422 saml.sso_url_invalid).
             */
            idp_sso_url?: string | null;
            name?: string | null;
            name_attribute?: string | null;
            /**
             * @description Turning a connection active needs its IdP's entity ID, SSO URL and a certificate (422 saml.connection_incomplete otherwise).
             * @enum {string|null}
             */
            status?: "draft" | "active" | "disabled" | null;
        };
        SAMLServiceProvider: {
            /** Format: uri */
            acs_url: string;
            /** @description Only the people assigned to the SP, themselves or through a group, may sign in to it */
            assignment_required: boolean;
            /** @description The attributes each assertion carries beside the NameID, in this order; one the person has no value for is left out */
            attributes: components["schemas"]["SAMLAttributeMapping"][];
            /** @description The app's own certificate (PEM), kept for require_signed_requests, encrypt_assertions or both. */
            certificate: string;
            /** @description What the certificate says about itself; null without one. */
            certificate_details: {
                fingerprint_sha256?: string;
                /** Format: date-time */
                not_after?: string;
                /** Format: date-time */
                not_before?: string;
                subject?: string;
            } | null;
            /** Format: date-time */
            created_at: string;
            /** @description Each assertion, signed as always, is encrypted to the app's certificate (AES-256-GCM, its key by RSA-OAEP). */
            encrypt_assertions: boolean;
            entity_id: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            last_login_at: string | null;
            name: string;
            /** @description Where the NameID comes from — email, user_id, persistent_id or metadata.<key> */
            name_id_attribute: string;
            /** @description urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress, urn:oasis:names:tc:SAML:2.0:nameid-format:persistent or urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified */
            name_id_format: string;
            /** Format: uuid */
            organization_id: string;
            /** @description The app's sign-in requests must be signed with its certificate; one that isn't is refused with 403 saml.request_signature_invalid. Sign-in the IdP starts has no request and is unaffected. */
            require_signed_requests: boolean;
            status: string;
            /** Format: date-time */
            updated_at: string;
        };
        SAMLServiceProviderAssignments: {
            groups?: {
                /** Format: date-time */
                assigned_at?: string;
                /** Format: uuid */
                assigned_by?: string | null;
                /** Format: uuid */
                group_id?: string;
                name?: string;
            }[];
            users?: {
                /** Format: date-time */
                assigned_at?: string;
                /** Format: uuid */
                assigned_by?: string | null;
                display_name?: string | null;
                email?: string;
                /** Format: uuid */
                user_id?: string;
            }[];
        };
        SAMLServiceProviderCreate: {
            /** Format: uri */
            acs_url: string;
            /** @description Sign in only the people assigned to the SP; off by default */
            assignment_required?: boolean | null;
            /** @description The attributes to send; absent sends the default email (from email) and name (from display_name), an empty list none */
            attributes?: components["schemas"]["SAMLAttributeMapping"][] | null;
            /** @description The app's own certificate (PEM). It must be kept for require_signed_requests, encrypt_assertions or both (422 saml.certificate_unused otherwise), and either needs one (422 saml.certificate_required); encryption needs an RSA key (422 saml.encryption_key_unsupported). */
            certificate?: string | null;
            /** @description Encrypt each assertion to the certificate; off by default */
            encrypt_assertions?: boolean | null;
            entity_id: string;
            name: string;
            /** @description Where the NameID comes from — email, user_id, persistent_id or metadata.<key>; by default persistent_id for a persistent NameID and email otherwise */
            name_id_attribute?: string | null;
            /** @description urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress (the default), urn:oasis:names:tc:SAML:2.0:nameid-format:persistent or urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified */
            name_id_format?: string | null;
            /** @description Refuse sign-in requests not signed with the certificate; off by default */
            require_signed_requests?: boolean | null;
            /**
             * @description The SP's state; refused with 422 saml.status_invalid otherwise.
             * @enum {string|null}
             */
            status?: "draft" | "active" | "disabled" | null;
        };
        /** @description The fields to change; every one is optional, and one left out or null keeps its value. attributes replaces the whole list. */
        SAMLServiceProviderUpdate: {
            /** Format: uri */
            acs_url?: string | null;
            /** @description Sign in only the people assigned to the SP; off by default */
            assignment_required?: boolean | null;
            /** @description The attributes to send; absent sends the default email (from email) and name (from display_name), an empty list none */
            attributes?: components["schemas"]["SAMLAttributeMapping"][] | null;
            /** @description The app's own certificate (PEM). It must be kept for require_signed_requests, encrypt_assertions or both (422 saml.certificate_unused otherwise), and either needs one (422 saml.certificate_required); encryption needs an RSA key (422 saml.encryption_key_unsupported). */
            certificate?: string | null;
            /** @description Encrypt each assertion to the certificate; off by default */
            encrypt_assertions?: boolean | null;
            entity_id?: string | null;
            name?: string | null;
            /** @description Where the NameID comes from — email, user_id, persistent_id or metadata.<key>; by default persistent_id for a persistent NameID and email otherwise */
            name_id_attribute?: string | null;
            /** @description urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress (the default), urn:oasis:names:tc:SAML:2.0:nameid-format:persistent or urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified */
            name_id_format?: string | null;
            /** @description Refuse sign-in requests not signed with the certificate; off by default */
            require_signed_requests?: boolean | null;
            /**
             * @description The SP's state; refused with 422 saml.status_invalid otherwise.
             * @enum {string|null}
             */
            status?: "draft" | "active" | "disabled" | null;
        };
        SAMLTestAttribute: {
            friendly_name?: string;
            name: string;
            values: string[];
        };
        /** @description A test sign-in through a connection and what it found. The findings (name_id to attributes) are present once the IdP's answer validated. */
        SAMLTestSignIn: {
            /** @description The attributes the IdP asserted, by name; at most 64, each with at most 32 values. */
            attributes?: components["schemas"]["SAMLTestAttribute"][];
            /** Format: date-time */
            completed_at?: string | null;
            /** Format: uuid */
            connection_id: string;
            /** Format: date-time */
            created_at: string;
            /** @description The address a sign-in would use, from the connection's email attribute or else the NameID. */
            email?: string;
            /** @description Whether the address is on a domain the organization verified, without which a sign-in is refused. */
            email_domain_verified: boolean;
            /** @description Why the test failed, as the error code a sign-in would answer with. */
            error_code?: string;
            /** @description What the validation found, for the IT admin. Plain text. */
            error_detail?: string;
            error_message?: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            id: string;
            /** @description The name a sign-in would use, from the connection's name attribute. */
            name?: string;
            name_id?: string;
            name_id_format?: string;
            /**
             * Format: uri
             * @description The IdP address to send the browser to. Only when the test begins.
             */
            redirect_url?: string;
            /**
             * @description succeeded means a sign-in with the same answer would pass the IdP and domain checks.
             * @enum {string}
             */
            status: "pending" | "succeeded" | "failed" | "expired";
        };
        /** @description An RFC 7644 §3.12 SCIM error. */
        SCIMError: {
            detail?: string;
            schemas: "urn:ietf:params:scim:api:messages:2.0:Error"[];
            /** @example uniqueness */
            scimType?: string;
            /** @example 409 */
            status: string;
        };
        SCIMGroup: {
            displayName: string;
            externalId?: string;
            id?: string;
            members?: {
                display?: string;
                /** @description User id */
                value?: string;
            }[];
            meta?: {
                [key: string]: unknown;
            };
            /**
             * @example [
             *       "urn:ietf:params:scim:schemas:core:2.0:Group"
             *     ]
             */
            schemas: string[];
        };
        SCIMListResponse: {
            itemsPerPage?: number;
            Resources?: {
                [key: string]: unknown;
            }[];
            /**
             * @example [
             *       "urn:ietf:params:scim:api:messages:2.0:ListResponse"
             *     ]
             */
            schemas?: string[];
            startIndex?: number;
            totalResults?: number;
        };
        SCIMPatchOp: {
            Operations: {
                /** @enum {string} */
                op: "add" | "remove" | "replace";
                path?: string;
                value?: unknown;
            }[];
            /**
             * @example [
             *       "urn:ietf:params:scim:api:messages:2.0:PatchOp"
             *     ]
             */
            schemas: string[];
        };
        /** @description A SCIM bearer token, without the token itself. */
        SCIMToken: {
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            expires_at: string | null;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description Recorded at most once a minute.
             */
            last_used_at: string | null;
            name: string;
            /**
             * Format: uuid
             * @description The token that replaced this one when it was rotated.
             */
            replaced_by: string | null;
            /** Format: date-time */
            revoked_at: string | null;
            /**
             * @description active: works. rotated: replaced, and works until expires_at, when its overlap ends. expired: past expires_at. revoked: revoked.
             * @enum {string}
             */
            status: "active" | "rotated" | "expired" | "revoked";
            /** @description The token's first characters, to recognise it by. */
            token_prefix: string;
        };
        SCIMUser: {
            active?: boolean;
            displayName?: string;
            emails?: {
                primary?: boolean;
                type?: string;
                value?: string;
            }[];
            externalId?: string;
            id?: string;
            meta?: {
                [key: string]: unknown;
            };
            name?: {
                familyName?: string;
                formatted?: string;
                givenName?: string;
            };
            /**
             * @example [
             *       "urn:ietf:params:scim:schemas:core:2.0:User"
             *     ]
             */
            schemas: string[];
            userName?: string;
        };
        ServicePrincipal: {
            /** Format: date-time */
            created_at: string;
            description: string;
            /** Format: date-time */
            disabled_at: string | null;
            /** Format: uuid */
            id: string;
            /**
             * Format: date-time
             * @description When the principal was last issued a token, to the minute.
             */
            last_used_at: string | null;
            name: string;
            /** Format: uuid */
            organization_id: string;
            /**
             * Format: date-time
             * @description Present while the secret replaced at its last rotation still works, until then.
             */
            previous_secret_expires_at?: string;
            scopes: string[];
        };
        ServicePrincipalCreate: {
            description?: string | null;
            name: string;
            /** Format: uuid */
            organization_id: string;
            scopes?: string[] | null;
        };
        ShadowAICandidate: {
            client_id: string;
            /** Format: date-time */
            created_at: string;
            grant_types: string[];
            /** Format: uuid */
            id: string;
            live_grants: number;
            name: string;
        };
        /** @description Non-secret metadata for an issuer signing key (no key material). */
        SigningKey: {
            /**
             * Format: date-time
             * @description When the key became the active signing key; null for a candidate that never was, or a key the registry doesn't hold.
             */
            activated_at: string | null;
            /**
             * @description ES256 for an EC P-256 key, RS256 for an RSA key.
             * @example ES256
             */
            alg: string;
            /**
             * Format: date-time
             * @description When the key registry first held the key; null for a key it doesn't hold (one only in configuration).
             */
            created_at: string | null;
            /** @description RFC 7638 JWK thumbprint of the public key. */
            kid: string;
            /** Format: date-time */
            retire_at?: string | null;
            /** @enum {string} */
            status: "candidate" | "active" | "retired";
            /** @example sig */
            use: string;
        };
        SSOGroupMapping: {
            /** Format: date-time */
            created_at: string;
            /** Format: uuid */
            group_id: string;
            group_name: string;
            /** Format: uuid */
            id: string;
            /** @description The group as the identity provider asserts it (a name, an object id or an LDAP DN), compared ignoring case. */
            idp_group: string;
        };
        SSOGroupMappingCreate: {
            /** Format: uuid */
            group_id: string;
            idp_group: string;
        };
        TestCheck: {
            detail?: string;
            name: string;
            ok: boolean;
        };
        TestResult: {
            checks: components["schemas"]["TestCheck"][];
            ok: boolean;
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
        /** @description The token request was refused (RFC 6749 §5.2). */
        OAuthBadRequest: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OAuthError"];
            };
        };
        /** @description The request was refused. A refusal the protocol names is an RFC 6749 §5.2 error; a request that couldn't be read is the API's own error. */
        OAuthOrBadRequest: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OAuthError"] | components["schemas"]["Error"];
            };
        };
        /** @description The client failed to authenticate (invalid_client). */
        OAuthUnauthorized: {
            headers: {
                /** @description Basic realm="qeet", sent when the client used HTTP Basic. */
                "WWW-Authenticate"?: string;
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["OAuthError"];
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
        /** @description RFC 7644 error: the request or a value in it is invalid, such as a malformed filter or PATCH operation (scimType names which, where RFC 7644 has one). */
        SCIMBadRequest: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
            };
        };
        /** @description RFC 7644 error with scimType uniqueness: the externalId is taken, or a group without an externalId takes a displayName, ignoring case, that another group without one uses (including when the change clears the externalId). */
        SCIMConflict: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
            };
        };
        /** @description RFC 7644 error: the organization's plan does not include SCIM provisioning. */
        SCIMForbidden: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
            };
        };
        /** @description RFC 7644 error: the organization has no such user or group. */
        SCIMNotFound: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
            };
        };
        /** @description RFC 7644 error: no SCIM token was sent, or it is not one of an organization's active SCIM tokens. */
        SCIMUnauthorized: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
            };
        };
        /** @description RFC 7644 error: the userName is taken (scimType uniqueness), or is on a domain another organization manages. */
        SCIMUserConflict: {
            headers: {
                "X-Request-Id": components["headers"]["RequestId"];
                [name: string]: unknown;
            };
            content: {
                "application/scim+json": components["schemas"]["SCIMError"];
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
    getJwks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description JWK Set */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JWKS"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getOauthAuthorizationServerMetadata: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authorization server metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCDiscovery"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getProtectedResourceMetadata: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Protected-resource metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The authorization server's issuer identifier. */
                        authorization_servers?: string[];
                        bearer_methods_supported?: string[];
                        resource?: string;
                        resource_documentation?: string;
                        resource_signing_alg_values_supported?: string[];
                        scopes_supported?: string[];
                    };
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getOpenidConfiguration: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Discovery metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCDiscovery"];
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    authenticateLdap: {
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
                    /** Format: password */
                    password: string;
                    username: string;
                };
            };
        };
        responses: {
            /** @description Signed in with a token pair, or a challenge to complete at POST /v1/auth/mfa (the MFAChallenge of the authentication API). */
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
            /** @description The directory refused the username or password (`ldap.invalid_credentials`). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description The organization's plan does not include LDAP (`billing.upgrade_required`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description The organization does not allow sign-in from this network (`auth.address_not_allowed`), the connection is disabled or still a draft (`ldap.connection_disabled`, `ldap.connection_draft`), or the account may not sign in here (`ldap.account_not_in_organization`, `ldap.account_unverified`, `ldap.email_domain_unverified`, `ldap.account_administers`, `ldap.jit_not_allowed`, `auth.account_inactive`). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            /** @description The account is locked (`auth.account_locked`), the source network is throttled, or the rate limit is exceeded (`too_many_requests`). A locked account gets the same answer whatever the password. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description The sign-in lockout could not be evaluated, so the attempt was refused (`auth.sign_in_unavailable`, retryable). */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createLdapSession: {
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
                    /** Format: password */
                    password: string;
                    username: string;
                };
            };
        };
        responses: {
            /** @description Signed in to the hosted login (the qe_ls cookie is set and the user's id answered), or the challenge to complete at POST /v1/auth/session/mfa. */
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
            /** @description The organization's plan does not include LDAP (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    introspectToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    /** @description The client's ID, when it authenticates in the form body rather than with HTTP Basic. */
                    client_id?: string;
                    /** @description The client's secret, when it authenticates in the form body (client_secret_post). */
                    client_secret?: string;
                    token: string;
                    token_type_hint?: string;
                };
            };
        };
        responses: {
            /** @description Introspection result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Introspection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    /** @description The client's ID, when it authenticates in the form body rather than with HTTP Basic; a public client sends only this. */
                    client_id?: string;
                    /** @description A confidential client's secret, when it authenticates in the form body (client_secret_post). */
                    client_secret?: string;
                    token: string;
                    /** @enum {string} */
                    token_type_hint?: "access_token" | "refresh_token";
                };
            };
        };
        responses: {
            /** @description Revoked (RFC 7009: always 200 even for unknown tokens) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["OAuthOrBadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    consumeSamlAssertion: {
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
                "application/x-www-form-urlencoded": {
                    RelayState?: string;
                    SAMLResponse?: string;
                };
            };
        };
        responses: {
            /** @description Signature-validated; redirect with a one-time login code */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    exchangeSamlCode: {
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
            /** @description Token pair */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSamlIdpCertificate: {
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
            /** @description The signing certificate, PEM */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/x-pem-file": string;
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSamlIdpMetadata: {
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
            /** @description IdP metadata XML */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/samlmetadata+xml": string;
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startSamlIdpSso: {
        parameters: {
            query?: {
                RelayState?: string;
                SAMLRequest?: string;
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
            /** @description Auto-submit POST form back to the SP ACS with a signed SAMLResponse */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            /** @description Redirect to hosted login when no SSO session */
            302: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
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
    startSamlIdpSsoWithPost: {
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
                "application/x-www-form-urlencoded": {
                    RelayState?: string;
                    SAMLRequest?: string;
                };
            };
        };
        responses: {
            /** @description Auto-submit POST form back to the SP ACS with a signed SAMLResponse */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
            /** @description Redirect to hosted login when no SSO session */
            302: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startSamlSignIn: {
        parameters: {
            query?: {
                /** @description For a sign-in started on the hosted login, where the browser goes back to once it's signed in (the application's authorize request): a path, or an absolute URL on an allowed origin (400 saml.return_to_invalid otherwise). The IdP's answer then returns to the hosted login's /sign-in with the one-time code in the URL fragment, for POST /saml/session. */
                return_to?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the external IdP with an AuthnRequest */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getSamlSpMetadata: {
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
            /** @description SP metadata XML */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/samlmetadata+xml": string;
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createSamlSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The saml_code from the URL fragment. */
                    code: string;
                };
            };
        };
        responses: {
            /** @description Signed in to the hosted login; the hosted-login session cookie (qe_ls) is set. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id?: string;
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
    listScimGroups: {
        parameters: {
            query?: {
                count?: number;
                filter?: string;
                startIndex?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMListResponse"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createScimGroup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/scim+json": components["schemas"]["SCIMGroup"];
            };
        };
        responses: {
            /** @description Group created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMGroup"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            409: components["responses"]["SCIMConflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getScimGroup: {
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
            /** @description Group */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMGroup"];
                };
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    replaceScimGroup: {
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
                "application/scim+json": components["schemas"]["SCIMGroup"];
            };
        };
        responses: {
            /** @description Replaced */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMGroup"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            409: components["responses"]["SCIMConflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteScimGroup: {
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
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    patchScimGroup: {
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
                "application/scim+json": components["schemas"]["SCIMPatchOp"];
            };
        };
        responses: {
            /** @description Patched */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMGroup"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            409: components["responses"]["SCIMConflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listScimResourceTypes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SCIM metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": {
                        [key: string]: unknown;
                    };
                };
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listScimSchemas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SCIM metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": {
                        [key: string]: unknown;
                    };
                };
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getScimServiceProviderConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SCIM metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": {
                        [key: string]: unknown;
                    };
                };
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listScimUsers: {
        parameters: {
            query?: {
                count?: number;
                /** @description SCIM filter, e.g. userName eq "a@b.com" */
                filter?: string;
                startIndex?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ListResponse */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMListResponse"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createScimUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SCIMUser"];
                /**
                 * @example {
                 *       "schemas": [
                 *         "urn:ietf:params:scim:schemas:core:2.0:User"
                 *       ],
                 *       "userName": "ada@example.com",
                 *       "displayName": "Ada Lovelace",
                 *       "active": true,
                 *       "name": {
                 *         "givenName": "Ada",
                 *         "familyName": "Lovelace",
                 *         "formatted": "Ada Lovelace"
                 *       },
                 *       "emails": [
                 *         {
                 *           "value": "ada@example.com",
                 *           "primary": true
                 *         }
                 *       ],
                 *       "externalId": "okta-00u1a2b3c4"
                 *     }
                 */
                "application/scim+json": components["schemas"]["SCIMUser"];
            };
        };
        responses: {
            /** @description User provisioned */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "schemas": [
                     *         "urn:ietf:params:scim:schemas:core:2.0:User"
                     *       ],
                     *       "id": "018f2a70-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
                     *       "userName": "ada@example.com",
                     *       "displayName": "Ada Lovelace",
                     *       "active": true,
                     *       "name": {
                     *         "givenName": "Ada",
                     *         "familyName": "Lovelace",
                     *         "formatted": "Ada Lovelace"
                     *       },
                     *       "emails": [
                     *         {
                     *           "value": "ada@example.com",
                     *           "primary": true
                     *         }
                     *       ],
                     *       "externalId": "okta-00u1a2b3c4",
                     *       "meta": {
                     *         "resourceType": "User",
                     *         "created": "2026-09-24T10:15:00Z",
                     *         "lastModified": "2026-09-24T10:15:00Z"
                     *       }
                     *     }
                     */
                    "application/scim+json": components["schemas"]["SCIMUser"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            409: components["responses"]["SCIMUserConflict"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getScimUser: {
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
                    "application/scim+json": components["schemas"]["SCIMUser"];
                };
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    replaceScimUser: {
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
                "application/scim+json": components["schemas"]["SCIMUser"];
            };
        };
        responses: {
            /** @description Replaced */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMUser"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteScimUser: {
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
            /** @description Deprovisioned */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    patchScimUser: {
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
                "application/scim+json": components["schemas"]["SCIMPatchOp"];
            };
        };
        responses: {
            /** @description Patched */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/scim+json": components["schemas"]["SCIMUser"];
                };
            };
            400: components["responses"]["SCIMBadRequest"];
            401: components["responses"]["SCIMUnauthorized"];
            403: components["responses"]["SCIMForbidden"];
            404: components["responses"]["SCIMNotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getPortalContext: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Portal context */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PortalContext"];
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listPortalDomains: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
                        items: components["schemas"]["Domain"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    claimPortalDomain: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
            /** @description Domain claimed; publish the returned TXT record, then verify */
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
    updatePortalDomain: {
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
                    sso_enabled: boolean;
                };
            };
        };
        responses: {
            /** @description The domain, with its setting */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    verifyPortalDomain: {
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
            /** @description The domain, verified */
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
    listPortalSamlConnections: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Connections */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["AdminPortalSAMLConnection"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createPortalSamlConnection: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SAMLConnectionCreate"];
            };
        };
        responses: {
            /** @description Connection created, with the service-provider addresses to enter at the IdP */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminPortalSAMLConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getPortalSamlConnection: {
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
            /** @description Connection, with the service-provider addresses to enter at the IdP */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminPortalSAMLConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deletePortalSamlConnection: {
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
    updatePortalSamlConnection: {
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
                "application/json": components["schemas"]["SAMLConnectionUpdate"];
            };
        };
        responses: {
            /** @description Updated, with the service-provider addresses to enter at the IdP */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminPortalSAMLConnection"];
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
    testPortalSamlConnection: {
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
            /** @description Per-check preflight results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TestResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startPortalSamlTestSignIn: {
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
            /** @description Test begun; send the browser to redirect_url */
            201: {
                headers: {
                    /** @description Binds the test to this browser. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLTestSignIn"];
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
    getPortalSamlTestSignIn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                testID: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The test and its findings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLTestSignIn"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getPortalScimConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description SCIM config */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigView"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    replaceAllPortalScimTokens: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description { token: string, config: object } */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        config: components["schemas"]["ConfigView"];
                        token: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeAllPortalScimTokens: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    createPortalSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Portal session created */
            201: {
                headers: {
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        context: components["schemas"]["PortalContext"];
                        /** Format: date-time */
                        expires_at: string;
                        redirect_url: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deletePortalSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Session revoked */
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
    listMySocialIdentities: {
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
                        items: components["schemas"]["ExternalIdentity"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    unlinkMySocialIdentity: {
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
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    authorize: {
        parameters: {
            query: {
                client_id: string;
                /** @description Required (43 characters, base64url of the SHA-256 of the code_verifier), unless the confidential application is exempt (pkce_exempt_until). */
                code_challenge?: string;
                /** @description Required with code_challenge; only S256. */
                code_challenge_method?: "S256";
                /** @description Seconds; a sign-in older than this is made fresh before the code is issued. */
                max_age?: number;
                /** @description Optional (at most 255 characters), as PKCE binds the code to the request; echoed in the ID token when sent. */
                nonce?: string;
                /** @description Space-separated; none, login and consent are honoured. */
                prompt?: string;
                /** @description A registered redirect URI, matched exactly; for a public client, on an http loopback IP literal any port matches. */
                redirect_uri: string;
                /** @description An RFC 8707 resource the access token is for; it must be registered for the organization (else invalid_target). The code carries it, and the token names it alone as its audience. */
                resource?: string;
                response_type: "code";
                /** @description Space-separated scopes, each registered for the application; offline_access, which asks for a refresh token, is accepted from any application registered for refresh_token and is consented to like any other scope. */
                scope?: string;
                state?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the hosted-login UI or back to the client with a code */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    authorizeWithPost: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    client_id: string;
                    code_challenge?: string;
                    /** @enum {string} */
                    code_challenge_method?: "S256";
                    max_age?: number;
                    nonce?: string;
                    prompt?: string;
                    /** Format: uri */
                    redirect_uri: string;
                    /** Format: uri */
                    resource?: string;
                    /** @enum {string} */
                    response_type: "code";
                    scope?: string;
                    state?: string;
                };
            };
        };
        responses: {
            /** @description Redirect to the GET form of the same authorization request */
            303: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    submitConsent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    approve: boolean;
                    /** Format: uuid */
                    request_id: string;
                };
            };
        };
        responses: {
            /** @description Where the consent screen sends the browser next */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        redirect?: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getConsentRequest: {
        parameters: {
            query: {
                request_id: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The stored request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        client_id: string;
                        request_id: string;
                        scope: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startBackchannelAuthentication: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    /** @description Shown to the user in the consent notification (e.g. a transaction reference). */
                    binding_message?: string;
                    client_id: string;
                    client_secret?: string;
                    /** Format: email */
                    login_hint: string;
                    scope?: string;
                };
            };
        };
        responses: {
            /** @description Backchannel authentication response */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        auth_req_id?: string;
                        expires_in?: number;
                        interval?: number;
                    };
                };
            };
            400: components["responses"]["OAuthOrBadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    submitBackchannelDecision: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    approve: boolean;
                    /** Format: uuid */
                    id: string;
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
                        status?: string;
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
    listMyPendingBackchannelRequests: {
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
                        items: components["schemas"]["CIBAPendingRequest"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getDeviceVerification: {
        parameters: {
            query: {
                /** @description The human-typed user_code (e.g. BCDF-GHJK). */
                user_code: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Device verification context */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        client_name: string;
                        scopes: string[];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startDeviceAuthorization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    client_id: string;
                    client_secret?: string;
                    scope?: string;
                };
            };
        };
        responses: {
            /** @description Device authorization response */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceAuthorizationResponse"];
                };
            };
            400: components["responses"]["OAuthOrBadRequest"];
            401: components["responses"]["Unauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    submitDeviceDecision: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    approve: boolean;
                    user_code: string;
                };
            };
        };
        responses: {
            /** @description Decision recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status: "authorized" | "denied";
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
    getLoginContext: {
        parameters: {
            query: {
                client_id: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Hosted-login context (client name, logo, home page, branding) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description The organization's brand for the hosted pages, each part present only when set; null when none is (or the plan doesn't include custom_branding). */
                        branding: {
                            /** @description Optional page background from organization branding settings. */
                            background_color?: string;
                            logo_url?: string;
                            primary_color?: string;
                            secondary_color?: string;
                        } | null;
                        client_name: string;
                        /**
                         * Format: uri
                         * @description The application's registered home page (https); absent when not set. The hosted page shows its host.
                         */
                        client_uri?: string;
                        /**
                         * Format: uri
                         * @description The application's registered logo (https); absent when not set.
                         */
                        logo_uri?: string;
                        /** @description How long a sign-in link the organization sends works, in minutes. */
                        magic_link_ttl_minutes?: number;
                        /** Format: uuid */
                        organization_id: string;
                        /** @description The name of the organization the application belongs to, so the hosted pages can say whose rules apply. Absent when it can't be read. */
                        organization_name?: string;
                        /** @description The rules the organization's new passwords must meet, so the hosted pages can show them as they are met. The server still checks them when a password is set. Absent when the policy can't be read. */
                        password_policy?: {
                            min_length: number;
                            require_number: boolean;
                            require_symbol: boolean;
                            require_uppercase: boolean;
                        };
                        /** @description The names of the social sign-in providers the organization has turned on, for GET /v1/social/{provider}/start; empty when none is, or they can't be read. */
                        providers: string[];
                        /** @description How long the organization remembers a device that skipped the second step, in days. Applies only when remember_device_enabled. */
                        remember_device_days?: number;
                        /** @description Whether a device may skip the second step for remember_device_days; false when the setting can't be read. */
                        remember_device_enabled: boolean;
                        /** @description Whether people may create an account here; false when the setting can't be read. */
                        self_registration_enabled: boolean;
                        /** @description Which first-factor methods the organization allows. All true when the setting can't be read; each is refused anyway where the credential is accepted. */
                        sign_in_methods: {
                            magic_link: boolean;
                            passkey: boolean;
                            password: boolean;
                        };
                    } & {
                        [key: string]: unknown;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    endSession: {
        parameters: {
            query?: {
                /** @description The application asking for the sign-out. Required for post_logout_redirect_uri to be honoured, and recorded with the sign-out when registered. */
                client_id?: string;
                id_token_hint?: string;
                post_logout_redirect_uri?: string;
                state?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to post_logout_redirect_uri */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["OAuthOrBadRequest"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    endSessionWithPost: {
        parameters: {
            query?: {
                /** @description The application asking for the sign-out. Required for post_logout_redirect_uri to be honoured, and recorded with the sign-out when registered. */
                client_id?: string;
                id_token_hint?: string;
                post_logout_redirect_uri?: string;
                state?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/x-www-form-urlencoded": {
                    client_id?: string;
                    id_token_hint?: string;
                    logout_confirmation?: string;
                    post_logout_redirect_uri?: string;
                    state?: string;
                };
            };
        };
        responses: {
            /** @description Redirect to post_logout_redirect_uri */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["OAuthOrBadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    continueSignOut: {
        parameters: {
            query: {
                ticket: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the validated post-logout address, or the signed-out page */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    requestToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": components["schemas"]["OAuthTokenRequest"];
            };
        };
        responses: {
            /** @description Token response */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OAuthTokenResponse"];
                };
            };
            400: components["responses"]["OAuthBadRequest"];
            401: components["responses"]["OAuthUnauthorized"];
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getUserInfo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description UserInfo claims */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        email?: string;
                        email_verified?: boolean;
                        locale?: string;
                        name?: string;
                        /** Format: uuid */
                        organization_id?: string;
                        phone_number?: string;
                        phone_number_verified?: boolean;
                        picture?: string;
                        /** Format: uuid */
                        sub?: string;
                        updated_at?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getUserInfoWithPost: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description UserInfo claims */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        email?: string;
                        email_verified?: boolean;
                        locale?: string;
                        name?: string;
                        /** Format: uuid */
                        organization_id?: string;
                        phone_number?: string;
                        phone_number_verified?: boolean;
                        picture?: string;
                        /** Format: uuid */
                        sub?: string;
                        updated_at?: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeOidcConnectionSignIn: {
        parameters: {
            query?: {
                code?: string;
                error?: string;
                state?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the console with a one-time login code in the fragment */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan no longer includes enterprise SSO (`billing.upgrade_required`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startOidcConnectionSignIn: {
        parameters: {
            query?: {
                /** @description For a sign-in started on the hosted login, where the browser goes back to once it's signed in (the application's authorize request): a path, or an absolute URL on an allowed origin (400 oidc_connection.return_to_invalid otherwise). The provider's answer then returns to the hosted login's /sign-in with the one-time code in the URL fragment, for POST /v1/oidc-connections/session. */
                return_to?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to the provider's authorization endpoint */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description The organization's plan does not include enterprise SSO (`billing.upgrade_required`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    exchangeOidcConnectionCode: {
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
            /** @description Token pair */
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
            429: components["responses"]["TooManyRequests"];
        };
    };
    createOidcConnectionSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The oidc_code from the URL fragment. */
                    code: string;
                };
            };
        };
        responses: {
            /** @description Signed in to the hosted login; the hosted-login session cookie (qe_ls) is set. */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        user_id?: string;
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
    registerOidcClient: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OIDCClientCreate"];
            };
        };
        responses: {
            /** @description Client created (secret shown once) */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        client?: components["schemas"]["OIDCClient"];
                        client_secret?: string;
                        warning?: string;
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
    unregisterOidcClient: {
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
            /** @description Client deleted */
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
    listSigningKeys: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Signing keys (candidate, active, and unexpired retired keys) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        keys: components["schemas"]["SigningKey"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listAdminPortalLinks: {
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
            /** @description Links (metadata only — the raw token is never returned again after generation) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["AdminPortalLink"][];
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
    createAdminPortalLink: {
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
                    capabilities: ("saml" | "scim" | "domain_verification")[];
                    /** @description How long the link lasts, in seconds, from 900 to 86400. Omitted or 0 means an hour. */
                    ttl_seconds?: number | null;
                };
            };
        };
        responses: {
            /** @description Link generated */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        link?: components["schemas"]["AdminPortalLink"];
                        /** @description The raw token — shown only here. Not recoverable afterward. */
                        token?: string;
                        /** Format: uri */
                        url?: string;
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
    revokeAdminPortalLink: {
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
    listDirectoryActivity: {
        parameters: {
            query?: {
                connection_id?: string;
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                days?: number;
                /** @description Page size, 1 to 100 (default 25). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
                q?: string;
                status?: "success" | "warning" | "failed";
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
            /** @description Operation page, filtered summary, and daily UTC volumes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["DirectoryEvent"][];
                        limit: number;
                        next_cursor?: components["schemas"]["NextCursor"];
                        summary: {
                            average_duration_ms?: number | null;
                            failed?: number;
                            successful?: number;
                            total?: number;
                            warnings?: number;
                        };
                        total: number;
                        volume: {
                            /** Format: date */
                            date?: string;
                            groups?: number;
                            users?: number;
                        }[];
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
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    listDirectoryAlerts: {
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
            /** @description The alerts */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["DirectoryAlert"][];
                        truncated?: components["schemas"]["Truncated"];
                    };
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
            /** @description Organization mismatch or missing connection.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    createDirectoryAlert: {
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
                    connection_id?: string | null;
                    name: string;
                    threshold: number;
                };
            };
        };
        responses: {
            /** @description Alert created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DirectoryAlert"];
                };
            };
            /** @description Invalid alert settings */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Authenticated user required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Connection not found in this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteDirectoryAlert: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alertID: string;
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
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No such alert in the organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    updateDirectoryAlert: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                alertID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description A connection of the organization, or "" for every connection. */
                    connection_id?: string | null;
                    enabled?: boolean | null;
                    name?: string | null;
                    threshold?: number | null;
                };
            };
        };
        responses: {
            /** @description The alert as changed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DirectoryAlert"];
                };
            };
            /** @description Invalid alert settings */
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
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No such alert in the organization, or an unknown connection */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listDirectoryConnections: {
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
            /** @description Directory connection inventory */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            /** Format: date-time */
                            created_at?: string | null;
                            environment?: string | null;
                            /** @description SCIM, the groups it provisioned; null for LDAP, which provisions none. */
                            group_count?: number | null;
                            /** @enum {string} */
                            health: "healthy" | "warning" | "failed" | "unknown";
                            id: string;
                            /** Format: date-time */
                            last_activity_at?: string | null;
                            /** Format: date-time */
                            last_sync_at?: string | null;
                            name: string;
                            reference: string;
                            /** @enum {string} */
                            scope: "users-and-groups" | "users-on-signin";
                            server_url?: string | null;
                            /** @enum {string} */
                            status: "configured" | "active" | "draft" | "disabled";
                            /** @enum {string} */
                            type: "scim" | "ldap";
                            /** @description SCIM, the people it provisioned; LDAP, the people with an identity this connection signed in (not deleted ones). */
                            user_count?: number | null;
                        }[];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            /** @description Invalid organization identifier */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Authentication and organization scope required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.read permission */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
            /** @description Directory inventory could not be loaded */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listProfileMappings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                connectionID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Rules and supported profile target types */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["DirectoryMapping"][];
                        targets?: {
                            [key: string]: string;
                        };
                        truncated?: components["schemas"]["Truncated"];
                    };
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
            /** @description Organization mismatch or missing connection.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Connection not found in this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    createProfileMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                connectionID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DirectoryMapping"];
            };
        };
        responses: {
            /** @description Mapping created and audited */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DirectoryMapping"];
                };
            };
            /** @description Invalid id, version or body */
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
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Connection not found in this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Duplicate enabled target or rule limit reached */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            /** @description Mapping refused: validation_failed, with error.fields[0].field naming the property at fault (source_attribute, target_field, value_type, transform or pattern) and error.fields[0].code the reason: directory.mapping_source_invalid, directory.mapping_source_credential, directory.mapping_target_unsupported, directory.mapping_value_type_mismatch, directory.mapping_transform_unsupported, directory.mapping_pattern_unexpected or directory.mapping_pattern_invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    setProfileMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                connectionID: string;
                mappingID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DirectoryMapping"];
            };
        };
        responses: {
            /** @description Updated mapping and incremented version */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DirectoryMapping"];
                };
            };
            /** @description Invalid id, version or body */
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
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Connection not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Stale version, missing mapping or duplicate enabled target */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            413: components["responses"]["PayloadTooLarge"];
            /** @description Mapping refused: validation_failed, with error.fields[0].field naming the property at fault (source_attribute, target_field, value_type, transform or pattern) and error.fields[0].code the reason: directory.mapping_source_invalid, directory.mapping_source_credential, directory.mapping_target_unsupported, directory.mapping_value_type_mismatch, directory.mapping_transform_unsupported, directory.mapping_pattern_unexpected or directory.mapping_pattern_invalid. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteProfileMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                connectionID: string;
                mappingID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Mapping removed and audited */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Mapping not found in this organization and connection */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    previewProfileMappings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                connectionID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    source: {
                        [key: string]: unknown;
                    };
                };
            };
        };
        responses: {
            /** @description Transformed profile, per-rule preview values and validation issues */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Every field the person would get, with its value and where it came from: a mapping, or the connection's own default where no mapping sets it (SCIM userName and displayName; an LDAP connection's email and name attributes, mail and cn unless set). */
                        effective?: {
                            [key: string]: {
                                /** @description The source attribute it was read from. */
                                attribute: string;
                                /** @enum {string} */
                                from: "mapping" | "default";
                                value: unknown;
                            };
                        };
                        issues?: {
                            /**
                             * @description Stable reason for the issue; word it from this.
                             * @enum {string}
                             */
                            code: "directory.mapping_preview_too_large" | "directory.mapping_source_invalid" | "directory.mapping_source_credential" | "directory.mapping_target_unsupported" | "directory.mapping_target_duplicate" | "directory.mapping_value_type_mismatch" | "directory.mapping_transform_unsupported" | "directory.mapping_pattern_unexpected" | "directory.mapping_pattern_invalid" | "directory.mapping_source_missing" | "directory.mapping_source_empty" | "directory.mapping_value_not_string" | "directory.mapping_value_not_array" | "directory.mapping_value_too_long" | "directory.mapping_value_too_many" | "directory.mapping_value_unmatched" | "directory.mapping_email_invalid" | "directory.mapping_display_name_too_long";
                            /** @description Target profile field of the mapping at fault; empty for directory.mapping_preview_too_large. */
                            field: string;
                            /**
                             * Format: uuid
                             * @description The mapping at fault; the nil UUID for directory.mapping_preview_too_large.
                             */
                            mapping_id: string;
                            /** @description English text kept for compatibility; it may change. */
                            message: string;
                        }[];
                        profile?: {
                            [key: string]: unknown;
                        };
                        valid?: boolean;
                        values?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description Invalid source JSON */
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
            /** @description Organization mismatch or missing connection.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Connection not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Source exceeds the supported size */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    listDirectoryErrors: {
        parameters: {
            query?: {
                connection_id?: string;
                /** @description Opaque pagination cursor from a prior response's next_cursor. */
                cursor?: components["parameters"]["Cursor"];
                days?: number;
                /** @description Page size, 1 to 100 (default 25). A larger value is lowered to 100; a smaller or malformed one gets the default. */
                limit?: number;
                q?: string;
                resolution?: "open" | "resolved" | "retried";
                severity?: "warning" | "critical";
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
            /** @description Error page, categories, affected connections, and latest remediations */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        categories: {
                            count: number;
                            key: string;
                        }[];
                        connections: {
                            count: number;
                            key: string;
                        }[];
                        items: components["schemas"]["DirectoryEvent"][];
                        limit: number;
                        next_cursor?: components["schemas"]["NextCursor"];
                        remediations: components["schemas"]["DirectoryEvent"][];
                        summary: {
                            critical: number;
                            impacted_users: number | null;
                            open: number;
                            retried: number;
                            warning: number;
                        };
                        total: number;
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
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Organization mismatch or missing connection.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    resolveDirectoryError: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                eventID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Error resolved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        succeeded?: boolean;
                    };
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
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error not found in this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error already closed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    retryDirectoryError: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                eventID: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Check completed; succeeded reports the actual outcome */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        succeeded?: boolean;
                    };
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
            /** @description Organization mismatch or missing connection.write */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error not found in this organization */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Operation cannot be retried or is already closed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    getDirectoryProfile: {
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
            /** @description The person's profiles */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: {
                            connection_id: string;
                            /** @description The connection's name; empty if it was removed. */
                            connection_name: string;
                            fields: {
                                [key: string]: unknown;
                            };
                            /** Format: date-time */
                            updated_at: string;
                        }[];
                        truncated?: components["schemas"]["Truncated"];
                    };
                };
            };
            /** @description Invalid person */
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
            /** @description Organization mismatch or missing user.read */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    listLdapConnections: {
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
                        items: components["schemas"]["LdapConnection"][];
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
    createLdapConnection: {
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
                "application/json": components["schemas"]["LdapCreateInput"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LdapConnection"];
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
    getLdapConnection: {
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
                    "application/json": components["schemas"]["LdapConnection"];
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
    deleteLdapConnection: {
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
    updateLdapConnection: {
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
                "application/json": components["schemas"]["LdapUpdateInput"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LdapConnection"];
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
    listLdapGroupMappings: {
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
            /** @description The connection's group mappings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["SSOGroupMapping"][];
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
    createLdapGroupMapping: {
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
                "application/json": components["schemas"]["SSOGroupMappingCreate"];
            };
        };
        responses: {
            /** @description Mapped */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SSOGroupMapping"];
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
    deleteLdapGroupMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                mappingID: string;
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
    testLdapConnection: {
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
            /** @description The bind succeeded ({"ok": true}) */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listDeviceAuthorizations: {
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
            /** @description Device authorizations */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["OAuthDeviceAuthorization"][];
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
    revokeDeviceAuthorization: {
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
            /** @description Device authorization revoked */
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
    listOauthGrants: {
        parameters: {
            query?: {
                /** @description Only the grants given to this application. */
                client_id?: string;
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 500. A larger value is lowered to 500; a smaller or malformed one gets the default. */
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
            /** @description Consent grants */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["Grant"][];
                        /** @description Present when there is another page. */
                        next_cursor?: string;
                        total: number;
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
    revokeOauthGrant: {
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
            /** @description Grant revoked */
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
    revokeOauthGrants: {
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
                    client_id?: string | null;
                    ids?: string[] | null;
                };
            };
        };
        responses: {
            /** @description Revoked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        revoked: number;
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
    listOidcConnections: {
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
            /** @description Connections */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["OIDCConnection"][];
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
    createOidcConnection: {
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
                "application/json": components["schemas"]["OIDCConnectionCreate"];
            };
        };
        responses: {
            /** @description Connection created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include single sign-on (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getOidcConnection: {
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
            /** @description Connection */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteOidcConnection: {
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
    updateOidcConnection: {
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
                "application/json": components["schemas"]["OIDCConnectionUpdate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCConnection"];
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
    listOidcClients: {
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
            /** @description OIDC clients */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["OIDCClient"][];
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
    createOidcClient: {
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
                "application/json": components["schemas"]["OIDCClientCreate"];
            };
        };
        responses: {
            /** @description Client created (secret shown once) */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        client?: components["schemas"]["OIDCClient"];
                        client_secret?: string;
                        warning?: string;
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
    getOidcClient: {
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
            /** @description OIDC client */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCClient"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteOidcClient: {
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
            /** @description Client deleted */
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
    updateOidcClient: {
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
                "application/json": components["schemas"]["OIDCClientUpdate"];
            };
        };
        responses: {
            /** @description Updated OIDC client */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCClient"];
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
    listOidcClientSecretFailures: {
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
            /** @description The lockout in force (if any) and recent failures */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: {
                            /** Format: date-time */
                            at?: string;
                            ip?: string;
                            reason?: string;
                        }[];
                        /** Format: date-time */
                        locked_until?: string | null;
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
    acknowledgeShadowAiClient: {
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
    rotateOidcClientSecret: {
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
            /** @description New client secret (shown once) */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        client_secret?: string;
                        warning?: string;
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
    listShadowAiClients: {
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
                        items: components["schemas"]["ShadowAICandidate"][];
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
    listOidcResources: {
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
            /** @description Registered resources */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items?: components["schemas"]["OIDCResource"][];
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
    registerOidcResource: {
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
                    identifier: string;
                    name?: string | null;
                    server_client_id?: string | null;
                };
            };
        };
        responses: {
            /** @description Registered */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OIDCResource"];
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
    deleteOidcResource: {
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
    listSamlConnections: {
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
            /** @description Connections */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["SAMLConnection"][];
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
    createSamlConnection: {
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
                "application/json": components["schemas"]["SAMLConnectionCreate"];
            };
        };
        responses: {
            /** @description Connection created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include enterprise SSO (billing.upgrade_required). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listSamlApps: {
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
            /** @description Service providers */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["SAMLServiceProvider"][];
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
    registerSamlApp: {
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
                "application/json": components["schemas"]["SAMLServiceProviderCreate"];
            };
        };
        responses: {
            /** @description SP registered */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLServiceProvider"];
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
    getSamlApp: {
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
            /** @description Service provider */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLServiceProvider"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteSamlApp: {
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
    updateSamlApp: {
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
                "application/json": components["schemas"]["SAMLServiceProviderUpdate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLServiceProvider"];
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
    listSamlAppAssignments: {
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
            /** @description Assignments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLServiceProviderAssignments"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    assignSamlAppToGroup: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupID: string;
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    unassignSamlAppFromGroup: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                groupID: string;
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
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
    assignSamlAppToUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    unassignSamlAppFromUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
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
    getSamlConnection: {
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
            /** @description Connection */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    deleteSamlConnection: {
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
    updateSamlConnection: {
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
                "application/json": components["schemas"]["SAMLConnectionUpdate"];
            };
        };
        responses: {
            /** @description Updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLConnection"];
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
    addSamlCertificate: {
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
                    /** @description PEM or base64 DER X.509 signing certificate */
                    certificate: string;
                };
            };
        };
        responses: {
            /** @description Certificate added */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLCertificate"];
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
    removeSamlCertificate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                certificateID: string;
                id: string;
                /** @description The organization's ID. On an authenticated route it must be the organization of the caller's credential: another is refused with 403, and a value that is not a UUID with 400. */
                organizationID: components["parameters"]["OrganizationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Certificate removed */
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
    listSamlGroupMappings: {
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
            /** @description The connection's group mappings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["SSOGroupMapping"][];
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
    createSamlGroupMapping: {
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
                "application/json": components["schemas"]["SSOGroupMappingCreate"];
            };
        };
        responses: {
            /** @description Mapped */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SSOGroupMapping"];
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
    deleteSamlGroupMapping: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                mappingID: string;
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
    applySamlIdpMetadata: {
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
                    /** Format: uri */
                    metadata_url?: string | null;
                    metadata_xml?: string | null;
                };
            };
        };
        responses: {
            /** @description Connection updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLConnection"];
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
    testSamlConnection: {
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
            /** @description Per-check preflight results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TestResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    importSamlConnection: {
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
                "application/json": components["schemas"]["SAMLConnectionImport"];
            };
        };
        responses: {
            /** @description Connection created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SAMLConnection"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include enterprise SSO (`billing.upgrade_required`); nothing is fetched. */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            403: components["responses"]["Forbidden"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    getScimConfig: {
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
                    "application/json": components["schemas"]["ConfigView"];
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
    listProvisionedGroups: {
        parameters: {
            query?: {
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
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
                            external_id: string | null;
                            /** Format: uuid */
                            id: string;
                            members: number;
                            name: string;
                            /** Format: date-time */
                            updated_at: string;
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
    replaceAllScimTokens: {
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
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        config: components["schemas"]["ConfigView"];
                        token: string;
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
    revokeAllScimTokens: {
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
    listScimTokens: {
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
                        items: components["schemas"]["SCIMToken"][];
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
    createScimToken: {
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
                    /**
                     * Format: date-time
                     * @description When the token stops working; in the future. Omit for none.
                     */
                    expires_at?: string | null;
                    name: string;
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
                        scim_token: components["schemas"]["SCIMToken"];
                        /** @description The token to give the identity provider, shown only here. */
                        token: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include SCIM. */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    revokeScimToken: {
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
    rotateScimToken: {
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
                    /**
                     * Format: date-time
                     * @description When the new token stops working; in the future. Omit for none.
                     */
                    expires_at?: string | null;
                    /** @description How long the old token keeps working, in hours. Default 168. */
                    overlap_hours?: number | null;
                };
            };
        };
        responses: {
            /** @description Rotated */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        replaced: components["schemas"]["SCIMToken"];
                        scim_token: components["schemas"]["SCIMToken"];
                        /** @description The new token to give the identity provider, shown only here. */
                        token: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            /** @description The organization's plan does not include SCIM. */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listProvisionedUsers: {
        parameters: {
            query?: {
                /** @description The next_cursor of the previous page. */
                cursor?: string;
                /** @description Page size, 1 to 200. A larger value is lowered to 200; a smaller or malformed one gets the default. */
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
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        items: components["schemas"]["adminUser"][];
                        /** @description Present when there is another page. */
                        next_cursor?: string;
                        total: number;
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
    listServicePrincipals: {
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
                        items: components["schemas"]["ServicePrincipal"][];
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
    enableServicePrincipal: {
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
            /** @description Enabled */
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
    rotateServicePrincipalSecret: {
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
                        client_id: string;
                        client_secret: string;
                        /**
                         * Format: date-time
                         * @description When the old secret stops working.
                         */
                        previous_secret_expires_at: string;
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
        };
    };
    listSocialProviders: {
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
                        items: components["schemas"]["Provider"][];
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
    createServicePrincipal: {
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
                "application/json": components["schemas"]["ServicePrincipalCreate"];
            };
        };
        responses: {
            /** @description Service principal created (secret shown once) */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["NoStoreCacheControl"];
                    "Idempotent-Replayed": components["headers"]["IdempotentReplayed"];
                    Pragma: components["headers"]["NoStorePragma"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        client_id: string;
                        client_secret: string;
                        service_principal: components["schemas"]["ServicePrincipal"];
                        warning: string;
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
    disableServicePrincipal: {
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
    completeSocialSignIn: {
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
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    completeSocialSignInWithFormPost: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": {
                    code: string;
                    state: string;
                };
            };
        };
        responses: {
            /** @description Redirect to the hosted login or account application */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
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
    startSocialLink: {
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
                        authorize_url: string;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    startSocialSignIn: {
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
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    exchangeSocialCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["exchangeInput"];
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
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    unlinkSocialIdentity: {
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
    completeSocialLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The link_code from the callback's redirect. */
                    code: string;
                };
            };
        };
        responses: {
            /** @description Linked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        provider: string;
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
    listPlatformSocialProviders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Enabled provider names */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        providers: string[];
                    };
                };
            };
            429: components["responses"]["TooManyRequests"];
        };
    };
    upsertSocialProvider: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Adds a provider to the caller's organization, or replaces the settings of one it has. */
        requestBody?: {
            content: {
                "application/json": {
                    /** @description The ID of the key client_secret holds; required for apple. */
                    apple_key_id?: string | null;
                    /** @description Apple's team ID; required for apple. */
                    apple_team_id?: string | null;
                    client_id?: string | null;
                    /** @description Required for a new provider. On a provider that exists, empty keeps the stored secret. For Apple, the .p8 private key. */
                    client_secret?: string | null;
                    /** @description An OpenID Connect provider's public https discovery URL; ignored for github, facebook, x, discord and apple. */
                    discovery_url?: string | null;
                    provider?: string | null;
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
                    "application/json": components["schemas"]["Provider"];
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
    deleteSocialProvider: {
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
    updateSocialProvider: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    apple_key_id?: string | null;
                    apple_team_id?: string | null;
                    client_id?: string | null;
                    /** @description Replaces the stored secret; omitted or empty keeps it. For Apple, a new .p8 key, which must sign with the team and key IDs. */
                    client_secret?: string | null;
                    /** @description An OpenID Connect provider's alone; ignored for the others. */
                    discovery_url?: string | null;
                    /** @description false switches the provider off — it is no longer offered and sign-in through it is refused — until switched on again; other saves keep it off. */
                    enabled?: boolean | null;
                };
            };
        };
        responses: {
            /** @description The provider (never its secret) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Provider"];
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
    discoverSso: {
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
            /** @description Where the address signs in */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        connections: {
                            /** Format: uuid */
                            id: string;
                            login_path: string;
                            /** @enum {string} */
                            method: "redirect" | "credentials";
                            name: string;
                            /** @enum {string} */
                            protocol: "saml" | "oidc" | "ldap";
                            /** @description For a credentials connection, where the hosted login posts the same user name and password for its session. */
                            session_path?: string;
                        }[];
                        /** @description When sso is true, the name of the organization that manages the domain, for the sign-in page to say whose sign-in it is. Like the connections' names, it is the same for every address on the domain. */
                        organization_name?: string;
                        sso: boolean;
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            413: components["responses"]["PayloadTooLarge"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["TooManyRequests"];
        };
    };
    listUserSocialIdentities: {
        parameters: {
            query?: never;
            header?: never;
            path: {
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
                        items: components["schemas"]["ExternalIdentity"][];
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
}
