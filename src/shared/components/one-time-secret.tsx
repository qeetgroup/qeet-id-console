import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyableSecret,
} from "@qeetrix/ui";
import type { ReactNode } from "react";

type OneTimeSecretProps = {
  title: ReactNode;
  description: ReactNode; // must say the value is shown only once
  values: { label?: string; value: string }[]; // e.g. a client id beside its secret
  dismissLabel: string;
  onDismiss: () => void;
  children?: ReactNode; // further guidance, such as a quickstart
};

/**
 * Renders a credential the backend returns only once, each value fully visible with a copy
 * button, until dismissed. Keep the value in component state only, never the query cache or
 * browser storage, and give the mutation that returns it `gcTime: 0`.
 */
export function OneTimeSecret({
  title,
  description,
  values,
  dismissLabel,
  onDismiss,
  children,
}: OneTimeSecretProps) {
  return (
    <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {values.map(({ label, value }) => (
          <CopyableSecret key={label ?? value} label={label} value={value} />
        ))}
        {children}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
