// Static starter templates for the Policy Builder; there is no template backend. A template the
// engine can't store, one with an RBAC or ReBAC block, opens preview-only (abacSaveBlocker).

import { type CondNode, nid, type Operator } from "../api/abac";
import type { PolicyDoc } from "./policy-codegen";

function leaf(attr: string, op: Operator, value = ""): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr, op, value };
}
// Compares `attr` with another attribute rather than a literal.
function compare(attr: string, op: Operator, other: string): CondNode {
  return { id: nid("leaf"), kind: "leaf", attr, op, value: other, ref: true };
}
function all(children: CondNode[]): CondNode {
  return { id: nid("grp"), kind: "group", combinator: "all", children };
}
function any(children: CondNode[]): CondNode {
  return { id: nid("grp"), kind: "group", combinator: "any", children };
}

function doc(partial: Partial<PolicyDoc>): PolicyDoc {
  return {
    name: "",
    description: "",
    effect: "allow",
    resourceType: "*",
    action: "*",
    requireRole: null,
    condition: null,
    relation: null,
    priority: 10,
    enabled: true,
    ...partial,
  };
}

export const TEMPLATE_CATEGORIES = ["saas", "cloud", "regulated", "baseline"] as const;

/**
 * A starter policy. `name` and `description` are catalogue keys, and the categories read
 * `rbac:policyTemplatesPage.categories.<category>`. The built doc is policy content, so it stays
 * as written.
 */
export interface PolicyTemplate {
  id: string;
  name: string;
  // The product a template mirrors (a brand, shown as written), or a sector's catalogue key.
  source: { vendor: string } | { sector: string };
  category: (typeof TEMPLATE_CATEGORIES)[number];
  description: string;
  tags: string[];
  build: () => PolicyDoc;
}

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "github-repo-admin",
    name: "rbac:policyTemplates.githubRepoAdmin.name",
    source: { vendor: "GitHub" },
    category: "saas",
    description: "rbac:policyTemplates.githubRepoAdmin.description",
    tags: ["rbac", "abac", "repository"],
    build: () =>
      doc({
        name: "github_repo_admin",
        description: "Org members who maintain a repo may administer it.",
        resourceType: "repository",
        action: "admin",
        requireRole: "maintainer",
        condition: all([leaf("subject.org_member", "eq", "true")]),
        priority: 40,
      }),
  },
  {
    id: "organization-hr-profiles",
    name: "rbac:policyTemplates.organizationHrProfiles.name",
    source: { vendor: "Google Organization" },
    category: "saas",
    description: "rbac:policyTemplates.organizationHrProfiles.description",
    tags: ["abac", "department", "read"],
    build: () =>
      doc({
        name: "hr_view_profiles",
        description: "HR department may read employee profiles.",
        resourceType: "employee_profile",
        action: "read",
        condition: all([leaf("subject.department", "eq", "HR")]),
        priority: 30,
      }),
  },
  {
    id: "aws-prod-deploy-window",
    name: "rbac:policyTemplates.awsProdDeployWindow.name",
    source: { vendor: "AWS IAM" },
    category: "cloud",
    description: "rbac:policyTemplates.awsProdDeployWindow.description",
    tags: ["abac", "deny", "time-window"],
    build: () =>
      doc({
        name: "no_after_hours_prod_deploy",
        description: "Production deploys are only permitted during business hours.",
        effect: "deny",
        resourceType: "deployment",
        action: "create",
        condition: all([
          leaf("resource.environment", "eq", "production"),
          any([leaf("context.hour_of_day", "lt", "9"), leaf("context.hour_of_day", "gte", "18")]),
        ]),
        priority: 90,
      }),
  },
  {
    id: "azure-corp-network",
    name: "rbac:policyTemplates.azureCorpNetwork.name",
    source: { vendor: "Azure Entra" },
    category: "cloud",
    description: "rbac:policyTemplates.azureCorpNetwork.description",
    tags: ["abac", "network", "context"],
    build: () =>
      doc({
        name: "corp_network_only",
        description: "Restrict access to requests originating on the corporate network.",
        resourceType: "*",
        action: "*",
        condition: all([leaf("context.network", "eq", "corp")]),
        priority: 50,
      }),
  },
  {
    id: "slack-channel-owner",
    name: "rbac:policyTemplates.slackChannelOwner.name",
    source: { vendor: "Slack" },
    category: "saas",
    description: "rbac:policyTemplates.slackChannelOwner.description",
    tags: ["rebac", "ownership"],
    build: () =>
      doc({
        name: "slack_channel_owner_manage",
        description: "The owner of a channel may manage its members.",
        resourceType: "channel",
        action: "manage_members",
        relation: { object: "channel:", relation: "owner" },
        priority: 40,
      }),
  },
  {
    id: "jira-project-lead",
    name: "rbac:policyTemplates.jiraProjectLead.name",
    source: { vendor: "Jira" },
    category: "saas",
    description: "rbac:policyTemplates.jiraProjectLead.description",
    tags: ["rbac", "abac", "project"],
    build: () =>
      doc({
        name: "jira_lead_edit_issues",
        description: "Project leads may edit issues in projects they lead.",
        resourceType: "issue",
        action: "edit",
        requireRole: "project_lead",
        priority: 35,
      }),
  },
  {
    id: "salesforce-region",
    name: "rbac:policyTemplates.salesforceRegion.name",
    source: { vendor: "Salesforce" },
    category: "saas",
    description: "rbac:policyTemplates.salesforceRegion.description",
    tags: ["abac", "attribute-match"],
    build: () =>
      doc({
        name: "sfdc_region_scoped_accounts",
        description: "Reps read accounts within their own region.",
        resourceType: "account",
        action: "read",
        condition: all([compare("subject.region", "eq", "resource.region")]),
        priority: 30,
      }),
  },
  {
    id: "healthcare-phi",
    name: "rbac:policyTemplates.healthcarePhi.name",
    source: { sector: "rbac:policyTemplates.sectors.healthcare" },
    category: "regulated",
    description: "rbac:policyTemplates.healthcarePhi.description",
    tags: ["abac", "hipaa", "sensitive"],
    build: () =>
      doc({
        name: "phi_care_team_read",
        description: "Clinicians read PHI only for patients on their care team.",
        resourceType: "patient_record",
        action: "read",
        condition: all([
          leaf("subject.role", "eq", "clinician"),
          compare("subject.care_team_ids", "contains", "resource.patient_id"),
        ]),
        priority: 70,
      }),
  },
  {
    id: "finance-sod",
    name: "rbac:policyTemplates.financeSod.name",
    source: { sector: "rbac:policyTemplates.sectors.finance" },
    category: "regulated",
    description: "rbac:policyTemplates.financeSod.description",
    tags: ["abac", "deny", "sox"],
    build: () =>
      doc({
        name: "sox_payment_sod",
        description: "A payment cannot be approved by its creator.",
        effect: "deny",
        resourceType: "payment",
        action: "approve",
        condition: all([compare("subject.id", "eq", "resource.created_by")]),
        priority: 95,
      }),
  },
  {
    id: "gov-clearance",
    name: "rbac:policyTemplates.govClearance.name",
    source: { sector: "rbac:policyTemplates.sectors.government" },
    category: "regulated",
    description: "rbac:policyTemplates.govClearance.description",
    tags: ["abac", "clearance"],
    build: () =>
      doc({
        name: "gov_clearance_gate",
        description: "Subjects access documents at or below their clearance level.",
        resourceType: "document",
        action: "read",
        condition: all([
          compare("subject.clearance_level", "gte", "resource.classification_level"),
        ]),
        priority: 80,
      }),
  },
  {
    id: "baseline-mfa",
    name: "rbac:policyTemplates.baselineMfa.name",
    source: { sector: "rbac:policyTemplates.sectors.baseline" },
    category: "baseline",
    description: "rbac:policyTemplates.baselineMfa.description",
    tags: ["abac", "deny", "mfa"],
    build: () =>
      doc({
        name: "require_mfa_sensitive",
        description: "Sensitive writes require an MFA-verified session.",
        effect: "deny",
        resourceType: "*",
        action: "delete",
        condition: all([leaf("context.mfa", "ne", "true")]),
        priority: 85,
      }),
  },
  {
    id: "baseline-owner",
    name: "rbac:policyTemplates.baselineOwner.name",
    source: { sector: "rbac:policyTemplates.sectors.baseline" },
    category: "baseline",
    description: "rbac:policyTemplates.baselineOwner.description",
    tags: ["rebac", "ownership"],
    build: () =>
      doc({
        name: "owner_full_access",
        description: "The owner of a resource has full access.",
        resourceType: "*",
        action: "*",
        relation: { object: "", relation: "owner" },
        priority: 20,
      }),
  },
];

export function findTemplate(id: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find((t) => t.id === id);
}
