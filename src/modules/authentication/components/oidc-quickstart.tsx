// Integration quickstart for a registered OIDC application: a sign-in snippet per framework,
// pre-filled with the app's real values, and a "Test login" that opens the hosted authorize flow.

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SegmentedControl,
  SegmentedControlItem,
} from "@qeetrix/ui";
import { CheckIcon, CopyIcon, ExternalLinkIcon, PlayIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { getApiBaseUrl } from "@/platform/api/client";
import type { OidcClient } from "../api/oidc-clients";
import i18n from "@/i18n";

// The issuer is the API origin, where SDKs find /.well-known/openid-configuration. Resolved per
// call because the API origin is runtime configuration.
const issuer = () => new URL(getApiBaseUrl()).origin;

type Framework = "config" | "nextjs" | "react" | "go";

const FRAMEWORKS: Framework[] = ["config", "nextjs", "react", "go"];

// Framework names stay untranslated; "config" is the plain endpoint list, named through i18n.
const FRAMEWORK_NAMES: Record<Exclude<Framework, "config">, string> = {
  nextjs: "Next.js",
  react: "React SPA",
  go: "Go",
};

function buildSnippet(fw: Framework, client: OidcClient): string {
  const redirect = client.redirect_uris[0] ?? "http://localhost:3000/callback";
  const scopes = (client.scopes.length ? client.scopes : ["openid", "profile", "email"]).join(" ");
  const confidential = client.type === "confidential";

  switch (fw) {
    case "config":
      return [
        `Issuer / Authority   ${issuer()}`,
        `Discovery            ${issuer()}/.well-known/openid-configuration`,
        `Authorization        ${issuer()}/v1/oauth/authorize`,
        `Token                ${issuer()}/v1/oauth/token-code`,
        `UserInfo             ${issuer()}/v1/oauth/userinfo`,
        `JWKS                 ${issuer()}/.well-known/jwks.json`,
        `Client ID            ${client.client_id}`,
        `Client type          ${client.type}`,
        `Redirect URI         ${redirect}`,
        `Scopes               ${scopes}`,
        `PKCE                 required (S256)`,
        `Nonce                required with openid`,
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
        `      issuer: "${issuer()}",`,
        `      clientId: "${client.client_id}",`,
        confidential
          ? `      clientSecret: process.env.QEETID_CLIENT_SECRET, // shown once on creation`
          : `      // public client — no client secret`,
        `      authorization: { params: { scope: "${scopes}" } },`,
        `      checks: ["pkce", "state", "nonce"],`,
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
        `  authority: "${issuer()}",`,
        `  client_id: "${client.client_id}",`,
        `  redirect_uri: "${redirect}",`,
        `  scope: "${scopes}",`,
        `  response_type: "code", // PKCE is automatic in oidc-client-ts`,
        `};`,
        `// Qeet ID also requires a nonce with openid: pass a fresh one to signinRedirect({ nonce }).`,
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
        `provider, err := oidc.NewProvider(ctx, "${issuer()}")`,
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
        `// verifier := oauth2.GenerateVerifier(); nonce := <random per sign-in>`,
        `// Redirect to conf.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oidc.Nonce(nonce)),`,
        `// then check the ID token's nonce claim after the exchange.`,
      ].join("\n");
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Opens the hosted authorize flow with a fresh PKCE challenge. The console never completes the
// exchange: the point is to prove sign-in works and land on the app's own redirect URI.
async function testLogin(client: OidcClient) {
  const redirectUri = client.redirect_uris[0];
  if (!redirectUri) {
    toast.error(i18n.t("oidc:quickstart.noRedirectTitle"), {
      description: i18n.t("oidc:quickstart.noRedirectText"),
    });
    return;
  }
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(digest));
  const scopes = (client.scopes.length ? client.scopes : ["openid", "profile", "email"]).join(" ");

  const url = new URL(`${issuer()}/v1/oauth/authorize`);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", crypto.randomUUID());
  // Every app must send a nonce with openid, and a proof key.
  url.searchParams.set("nonce", base64url(crypto.getRandomValues(new Uint8Array(16))));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.open(url.toString(), "_blank", "noopener");
}

function CodeBlock({ code }: { code: string }) {
  const { t } = useTranslation("oidc");
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
        aria-label={t("quickstart.copySnippet")}
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
          toast.success(t("quickstart.copied"));
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </Button>
    </div>
  );
}

/**
 * Renders the integration quickstart for one client. The snippet reads the client secret from an
 * env var; right after creation, the caller shows the one-time secret in a OneTimeSecret.
 */
export function OidcQuickstart({ client }: { client: OidcClient }) {
  const { t } = useTranslation("oidc");
  const [fw, setFw] = useState<Framework>("config");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("quickstart.title")}</CardTitle>
        <CardDescription>{t("quickstart.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SegmentedControl
          value={fw}
          onValueChange={(v) => setFw(v as Framework)}
          aria-label={t("quickstart.framework")}
        >
          {FRAMEWORKS.map((f) => (
            <SegmentedControlItem key={f} value={f}>
              {f === "config" ? t("quickstart.endpoints") : FRAMEWORK_NAMES[f]}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>

        <CodeBlock code={buildSnippet(fw, client)} />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => testLogin(client)}>
            <PlayIcon className="size-4" /> {t("quickstart.testLogin")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(`${issuer()}/.well-known/openid-configuration`, "_blank", "noopener")
            }
          >
            <ExternalLinkIcon className="size-4" /> {t("quickstart.discovery")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {client.redirect_uris[0]
            ? t("quickstart.testLoginHelp", { uri: client.redirect_uris[0] })
            : t("quickstart.testLoginHelpNone")}
        </p>
      </CardContent>
    </Card>
  );
}
