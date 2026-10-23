import { createFileRoute } from "@tanstack/react-router";

import { OtpFactorsPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/mfa/sms-email")({
  component: OtpFactorsPage,
});
