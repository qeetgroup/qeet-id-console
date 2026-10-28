import { createFileRoute } from "@tanstack/react-router";

import { OtpFactorsPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header and the MFA tabs. The signed-in
// person's own numbers and addresses, so it needs no capability.
export const Route = createFileRoute("/_app/auth/mfa/sms-email")({
  staticData: { pageHeader: true },
  component: OtpFactorsPage,
});
