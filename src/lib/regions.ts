// Data-residency regions offered when creating or editing an organization.
// Single source so the create flow and org settings can't drift apart.
export const REGIONS: { value: string; label: string }[] = [
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
];
