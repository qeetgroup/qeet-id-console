// Integration quickstart for a registered OIDC application: a framework picker
// with a copy-paste "add login" snippet pre-filled with the app's real values
// (issuer, client_id, redirect URI, scopes), plus a one-click "Test login" that
// opens the hosted authorize flow (PKCE S256) against the app's first redirect
// URI. This is the activation surface — time-to-first-login — shown right after
// creation and again on the app's detail page.

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyableSecret,
  SegmentedControl,
  SegmentedControlItem,
} from "@qeetrix/ui";
import { CheckIcon, CopyIcon, ExternalLinkIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { API_BASE_URL } from "@/lib/api";
import type { OidcClient } from "@/lib/oidc-clients";

// The OIDC issuer (authority) is the API origin; SDKs discover the rest at
// {ISSUER}/.well-known/openid-configuration (see the server's discovery handler).
const ISSUER = new URL(API_BASE_URL).origin;

type Framework = "config" | "nextjs" | "react" | "go";

const FRAMEWORKS: { value: Framework; label: string }[] = [
  { value: "config", label: "Endpoints" },
  { value: "nextjs", label: "Next.js" },
  { value: "react", label: "React SPA" },
  { value: "go", label: "Go" },
];

function buildSnippet(fw: Framework, client: OidcClient): string {
  const redirect = client.redirect_uris[0] ?? "http://localhost:3000/callback";
  const scopes = (client.scopes.length ? client.scopes : ["openid", "profile", "email"]).join(" ");
  const confidential = client.type === "confidential";

  switch (fw) {
    case "config":
      return [
        `Issuer / Authority   ${ISSUER}`,
        `Discovery            ${ISSUER}/.well-known/openid-configuration`,
        `Authorization        ${ISSUER}/v1/oauth/authorize`,
        `Token                ${ISSUER}/v1/oauth/token-code`,
        `UserInfo             ${ISSUER}/v1/oauth/userinfo`,
        `JWKS                 ${ISSUER}/.well-known/jwks.json`,
        `Client ID            ${client.client_id}`,
        `Client type          ${client.type}`,
        `Redirect URI         ${redirect}`,
        `Scopes               ${scopes}`,
        `PKCE                 required (S256)`,
      ].join("\n");

    case "nextjs":
      return [
        `// auth.ts — Auth.js v5 (NextAuth)`,
        `import NextAuth from "next-auth";`,
        ``,
        `export const { handlers, auth, signIn, signOut } = NextAuth({`,
        `  providers: [`,
        `    {`,
        `      id: "qeetid",`,
        `      name: "Qeet ID",`,
        `      type: "oidc",`,
        `      issuer: "${ISSUER}",`,
        `      clientId: "${client.client_id}",`,
        confidential
          ? `      clientSecret: process.env.QEETID_CLIENT_SECRET, // shown once on creation`
          : `      // public client — no client secret`,
        `      authorization: { params: { scope: "${scopes}" } },`,
        `      checks: ["pkce", "state"],`,
        `    },`,
        `  ],`,
        `});`,
      ].join("\n");

    case "react":
      return [
        `// main.tsx — react-oidc-context (npm i react-oidc-context oidc-client-ts)`,
        `import { AuthProvider } from "react-oidc-context";`,
        ``,
        `const oidcConfig = {`,
        `  authority: "${ISSUER}",`,
        `  client_id: "${client.client_id}",`,
        `  redirect_uri: "${redirect}",`,
        `  scope: "${scopes}",`,
        `  response_type: "code", // PKCE is automatic in oidc-client-ts`,
        `};`,
        ``,
        `createRoot(document.getElementById("root")!).render(`,
        `  <AuthProvider {...oidcConfig}>`,
        `    <App />`,
        `  </AuthProvider>,`,
        `);`,
      ].join("\n");

    case "go":
      return [
        `// github.com/coreos/go-oidc/v3 + golang.org/x/oauth2`,
        `provider, err := oidc.NewProvider(ctx, "${ISSUER}")`,
        `if err != nil { log.Fatal(err) }`,
        ``,
        `conf := &oauth2.Config{`,
        `    ClientID:     "${client.client_id}",`,
        confidential
          ? `    ClientSecret: os.Getenv("QEETID_CLIENT_SECRET"), // shown once on creation`
          : `    // public client — no client secret`,
        `    RedirectURL:  "${redirect}",`,
        `    Endpoint:     provider.Endpoint(),`,
        `    Scopes:       []string{${(client.scopes.length ? client.scopes : ["openid", "profile", "email"]).map((s) => `"${s}"`).join(", ")}},`,
        `}`,
        `// Redirect the user to conf.AuthCodeURL(state, oidc-generated S256 PKCE params).`,
      ].join("\n");
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Opens the hosted authorize flow for this client with a fresh PKCE challenge.
// We don't complete the exchange in the console — the point is to prove login
// works end-to-end and land on the app's own redirect URI.
async function testLogin(client: OidcClient) {
  const redirectUri = client.redirect_uris[0];
  if (!redirectUri) {
    toast.error("Add a redirect URI first", {
      description: "This app has no redirect URI to return to after login.",
    });
    return;
  }
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  const scopes = (client.scopes.length ? client.scopes : ["openid", "profile", "email"]).join(" ");

  const url = new URL(`${ISSUER}/v1/oauth/authorize`);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", crypto.randomUUID());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.open(url.toString(), "_blank", "noopener");
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 pr-11 font-mono text-xs leading-relaxed whitespace-pre">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        aria-label="Copy snippet"
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
          toast.success("Copied to clipboard");
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </Button>
    </div>
  );
}

/**
 * OidcQuickstart renders the integration quickstart for one client. Pass
 * `secret` right after creation to reveal the one-time client secret alongside
 * the snippet; omit it elsewhere (the snippet references it from an env var).
 */
export function OidcQuickstart({ client, secret }: { client: OidcClient; secret?: string }) {
  const [fw, setFw] = useState<Framework>("config");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integrate this application</CardTitle>
        <CardDescription>
          Drop the snippet into your app to add “Sign in with Qeet ID”, then test the flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {secret && (
          <div className="flex flex-col gap-2 rounded-md border border-emerald-500/40 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
            <p className="text-xs font-medium">
              Copy your credentials now — the secret is shown only once.
            </p>
            <CopyableSecret value={client.client_id} label="client_id=" size="sm" />
            <CopyableSecret value={secret} label="client_secret=" size="sm" />
          </div>
        )}

        <SegmentedControl
          value={fw}
          onValueChange={(v) => setFw(v as Framework)}
          aria-label="Framework"
        >
          {FRAMEWORKS.map((f) => (
            <SegmentedControlItem key={f.value} value={f.value}>
              {f.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>

        <CodeBlock code={buildSnippet(fw, client)} />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => testLogin(client)}>
            <PlayIcon className="size-4" /> Test login
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`${ISSUER}/.well-known/openid-configuration`, "_blank", "noopener")
            }
          >
            <ExternalLinkIcon className="size-4" /> Discovery document
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          “Test login” opens the hosted sign-in for this app and returns to its first redirect URI (
          {client.redirect_uris[0] ?? "none set"}).
        </p>
      </CardContent>
    </Card>
  );
}
