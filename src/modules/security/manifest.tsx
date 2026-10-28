// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  ArchiveIcon,
  FileDownIcon,
  GaugeIcon,
  MonitorSmartphoneIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "security",
  nav: [
    {
      id: "authentication.devices",
      group: "authentication",
      order: 60,
      title: "security:nav.authentication.devices.title",
      description: "security:nav.authentication.devices.description",
      url: "/security/device-authorizations",
      icon: <MonitorSmartphoneIcon />,
      capability: "connection.read",
    },
    {
      id: "security.threats",
      group: "security",
      order: 20,
      title: "security:nav.security.threats.title",
      // Threats opens on Anomalies (redesign-findings, Threat protection).
      url: "/security/threats/anomalies",
      icon: <ShieldAlertIcon />,
      capability: "policy.read",
    },
    {
      id: "security.anomalies",
      group: "security",
      parent: "security.threats",
      order: 10,
      title: "security:nav.security.anomalies.title",
      url: "/security/threats/anomalies",
      // The server lists anomalies under policy.read (bootstrap/permissions.go).
      capability: "policy.read",
    },
    {
      id: "security.bots",
      group: "security",
      parent: "security.threats",
      order: 20,
      title: "security:nav.security.bots.title",
      url: "/security/threats/bots",
      capability: "policy.read",
    },
    {
      id: "security.risk",
      group: "security",
      parent: "security.threats",
      order: 30,
      title: "security:nav.security.risk.title",
      url: "/security/threats/risk-settings",
      capability: "policy.read",
    },
    {
      id: "security.ipRules",
      group: "security",
      parent: "security.threats",
      order: 40,
      title: "security:nav.security.ipRules.title",
      url: "/security/threats/ip-allowlist",
      capability: "policy.read",
    },
    {
      id: "security.rateLimits",
      group: "security",
      order: 30,
      title: "security:nav.security.rateLimits.title",
      url: "/security/rate-limits",
      icon: <GaugeIcon />,
      capability: "policy.read",
    },
    {
      id: "security.monitoring",
      group: "security",
      order: 40,
      title: "security:nav.security.monitoring.title",
      url: "/security/audit-logs",
      icon: <ScrollTextIcon />,
      capability: "audit.read",
    },
    {
      id: "security.auditLogs",
      group: "security",
      parent: "security.monitoring",
      order: 10,
      title: "security:nav.security.auditLogs.title",
      url: "/security/audit-logs",
      capability: "audit.read",
    },
    {
      id: "security.logStreams",
      group: "security",
      parent: "security.monitoring",
      order: 30,
      title: "security:nav.security.logStreams.title",
      url: "/security/log-streaming",
      capability: "audit.read",
    },
  ],
  commands: [
    {
      id: "cmd.navigate.audit-logs",
      text: "security:commands.auditLogs",
      icon: <ArchiveIcon />,
      to: "/security/audit-logs",
      capability: "audit.read",
    },
    {
      id: "cmd.navigate.export-audit",
      text: "security:commands.exportAudit",
      icon: <FileDownIcon />,
      to: "/security/audit-logs",
      capability: "audit.read",
    },
  ],
  shortcuts: [
    {
      key: "a",
      description: "security:shortcuts.auditLogs",
      to: "/security/audit-logs",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      "/security/audit-logs": [
        {
          type: "tool",
          toolName: "search_audit_logs",
          label: "security:qeetaiSuggestions.labels.searchAuditLogs",
          requiredCapability: "audit.read",
        },
        {
          type: "prompt",
          label: "security:qeetaiSuggestions.labels.summarizeAnomalies",
          text: "security:qeetaiSuggestions.prompts.summarizeAnomalies",
          requiredCapability: "audit.read",
        },
        {
          type: "prompt",
          label: "security:qeetaiSuggestions.labels.failedLogins",
          text: "security:qeetaiSuggestions.prompts.failedLogins",
          requiredCapability: "audit.read",
        },
        {
          type: "prompt",
          label: "security:qeetaiSuggestions.labels.adminActions",
          text: "security:qeetaiSuggestions.prompts.adminActions",
          requiredCapability: "audit.read",
        },
      ],
      "/security/*": [
        {
          type: "tool",
          toolName: "search_audit_logs",
          label: "security:qeetaiSuggestions.labels.searchAuditLogs",
          requiredCapability: "audit.read",
        },
        {
          type: "tool",
          toolName: "set_strict_mfa",
          label: "security:qeetaiSuggestions.labels.strictMfaPolicy",
          requiredCapability: "policy.write",
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    security: typeof import("./locales/en/security.json");
  }
}
