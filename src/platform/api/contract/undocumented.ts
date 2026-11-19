// What the server sends or accepts that its API documents leave out, keyed `METHOD path`. Each entry
// names the server code that shows it, is reported for the document, and goes once the document has
// it; `bun run contract:check` prints how many are left. Never add a field the server lacks.

/**
 * Per operation: `answer` fields it sends, `body` fields it accepts, and `partial` when the server
 * takes any part of a body the document lists as required.
 */
export type Undocumented = {
  // internal/identity/organization/organization.go: Organization.LogoURL (json "logo_url"), always
  // sent; UpdateInput and CreateInput take it.
  "GET /v1/organizations/{organizationID}": { answer: { logo_url: string } };
  "PATCH /v1/organizations/{organizationID}": {
    body: { logo_url?: string | null };
    answer: { logo_url: string };
  };
  "POST /v1/organizations/{organizationID}/deletion/cancel": { answer: { logo_url: string } };
  "POST /v1/organizations": { body: { logo_url?: string } };
  // internal/federation/ldap/connections.go: UpdateInput, every field a pointer.
  "PATCH /v1/organizations/{organizationID}/ldap/{id}": { partial: true };
  // internal/federation/saml/connections.go: UpdateInput, every field a pointer, with
  // allow_idp_initiated; the document gives the create body instead.
  "PATCH /v1/organizations/{organizationID}/saml/{id}": {
    partial: true;
    body: { allow_idp_initiated?: boolean | null };
  };
  // internal/federation/saml/idp_sp.go: UpdateSPInput, every field a pointer, with status and
  // assignment_required; the document gives the create body instead.
  "PATCH /v1/organizations/{organizationID}/saml-providers/{id}": {
    partial: true;
    body: { status?: string | null; assignment_required?: boolean | null };
  };
  // internal/operations/qeetai/http.go, status: always { configured, available, provider, model,
  // source }; the document has only configured, provider and model.
  "GET /v1/qeetai/status": {
    answer: { available: boolean; source: "organization" | "platform" | "none" };
  };
  // internal/access/authorization/rbac/rbac.go: Role.Description, always sent; the create
  // answer's document leaves it out.
  "POST /v1/organizations/{organizationID}/roles": { answer: { description: string } };
};
