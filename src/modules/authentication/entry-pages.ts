// The entry pages (sign in, sign up, verify email, magic link, forgot and reset password,
// choosing an organisation), for routes only. They're on @qeetrix/react, so they have a barrel of
// their own: in pages.ts, every console auth route would load the new library with them.
export { ForgotPasswordPage } from "./components/forgot-password-page";
export { MagicLinkPage } from "./components/magic-link-page";
export { SelectOrganizationPage } from "./components/select-organization-page";
export { SignInPage } from "./components/sign-in-page";
export { SignUpPage } from "./components/sign-up-page";
export { VerifyEmailPage } from "./components/verify-email-page";
