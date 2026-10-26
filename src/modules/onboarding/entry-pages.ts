// The create-organisation page, for its route only. It's on @qeetrix/react, so it has a barrel of
// its own: through index.ts, the dashboard (which reads the onboarding profile) would load it too.
export {
  type CreateOrganizationFrom,
  CreateOrganizationPage,
  SignedInAs,
} from "./components/create-organization-page";
