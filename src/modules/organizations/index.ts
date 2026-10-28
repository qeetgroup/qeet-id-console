// Public API of the organizations module.
export * from "./api/domains";
export { type EmailTemplate, useEmailTemplates } from "./api/email-templates";
export { orgKeys } from "./api/keys";
export { type Org, orgQueries, useOrgs } from "./api/orgs";
// The list's address, for its route: light, so the route tree (in the shell) can hold it.
export { type OrgFilters, orgsListSearch } from "./orgs-search";
