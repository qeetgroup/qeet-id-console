import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SegmentedControl,
  SegmentedControlItem,
} from "@qeetrix/ui";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { setBuilderDoc } from "../store/authz-store";
import {
  POLICY_TEMPLATES,
  type PolicyTemplate,
  TEMPLATE_CATEGORIES,
} from "../utils/policy-template";

/** Renders the policy templates, each opening in the builder. */
export function PolicyTemplatesPage() {
  const { t, i18n } = useTranslation("authorization");
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("all");

  const filtered =
    category === "all"
      ? POLICY_TEMPLATES
      : POLICY_TEMPLATES.filter((tpl) => tpl.category === category);

  function use(tpl: PolicyTemplate) {
    setBuilderDoc(tpl.build());
    navigate({ to: "/authorization/builder" });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("policyTemplatesPage.startFromABattle")} />

      <SegmentedControl
        value={category}
        onValueChange={setCategory}
        aria-label={t("policyTemplatesPage.category")}
      >
        <SegmentedControlItem value="all">{t("policyTemplatesPage.all")}</SegmentedControlItem>
        {TEMPLATE_CATEGORIES.map((c) => (
          <SegmentedControlItem key={c} value={c}>
            {t(`policyTemplatesPage.categories.${c}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tpl) => (
          <Card key={tpl.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">
                  {"vendor" in tpl.source ? tpl.source.vendor : i18n.t(tpl.source.sector)}
                </Badge>
                <Badge variant="muted">{t(`policyTemplatesPage.categories.${tpl.category}`)}</Badge>
              </div>
              <CardTitle className="text-base">{i18n.t(tpl.name)}</CardTitle>
              <CardDescription>{i18n.t(tpl.description)}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-3">
              <div className="flex flex-wrap gap-1">
                {tpl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Button variant="outline" size="sm" className="self-start" onClick={() => use(tpl)}>
                {t("policyTemplatesPage.useTemplate")} <ArrowRightIcon />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
