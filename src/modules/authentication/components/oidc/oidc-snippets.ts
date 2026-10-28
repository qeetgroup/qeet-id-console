// An application's integration: Qeet ID's endpoints, a sign-in snippet per framework filled in
// with the app's own values, and a test sign-in that opens the hosted authorise flow.

import type { OidcClient } from "@/modules/authentication/api/oidc-clients";
import { getApiBaseUrl } from "@/platform/api/client";

/** The issuer is the API origin, where libraries find /.well-known/openid-configuration. */
export const issuer = () => new URL(getApiBaseUrl()).origin;

export const endpoints = () => {
  const base = issuer();
  return {
    issuer: base,
    discovery: `${base}/.well-known/openid-configuration`,
    authorize: `${base}/v1/oauth/authorize`,
    token: `${base}/v1/oauth/token-code`,
    userinfo: `${base}/v1/oauth/userinfo`,
    jwks: `${base}/.well-known/jwks.json`,
  };
};

export const FRAMEWORKS = ["nextjs", "react", "go"] as const;
export type Framework = (typeof FRAMEWORKS)[number];
export const FRAMEWORK_NAMES: Record<Framework, string> = {
  nextjs: "Next.js",
  react: "React",
  go: "Go",
};
export const SNIPPET_FILE: Record<Framework, string> = {
  nextjs: "auth.ts",
  react: "main.tsx",
  go: "main.go",
};

const scopesOf = (client: OidcClient) =>
  client.scopes.length ? client.scopes : ["openid", "profile", "email"];

/** A sign-in for the framework, with this app's issuer, client ID, redirect and scopes. */
export function snippet(fw: Framework, client: OidcClient): string {
  const redirect = client.redirect_uris[0] ?? "http://localhost:3000/callback";
  const scopes = scopesOf(client).join(" ");
  const confidential = client.type === "confidential";
  switch (fw) {
    case "nextjs":
      return [
        "// auth.ts — Auth.js v5 (NextAuth)",
        'import NextAuth from "next-auth";',
        "",
        "export const { handlers, auth, signIn, signOut } = NextAuth({",
        "  providers: [",
        "    {",
        '      id: "qeetid",',
        '      name: "Qeet ID",',
        '      type: "oidc",',
        `      issuer: "${issuer()}",`,
        `      clientId: "${client.client_id}",`,
        confidential
          ? "      clientSecret: process.env.QEETID_CLIENT_SECRET,"
          : "      // a public app has no client secret",
        `      authorization: { params: { scope: "${scopes}" } },`,
        '      checks: ["pkce", "state", "nonce"],',
        "    },",
        "  ],",
        "});",
      ].join("\n");
    case "react":
      return [
        "// main.tsx — react-oidc-context (npm i react-oidc-context oidc-client-ts)",
        'import { AuthProvider } from "react-oidc-context";',
        "",
        "const oidcConfig = {",
        `  authority: "${issuer()}",`,
        `  client_id: "${client.client_id}",`,
        `  redirect_uri: "${redirect}",`,
        `  scope: "${scopes}",`,
        '  response_type: "code", // oidc-client-ts sends the proof key itself',
        "};",
        "// Qeet ID also needs a nonce with openid: pass a fresh one to signinRedirect({ nonce }).",
        "",
        'createRoot(document.getElementById("root")!).render(',
        "  <AuthProvider {...oidcConfig}>",
        "    <App />",
        "  </AuthProvider>,",
        ");",
      ].join("\n");
    case "go":
      return [
        "// github.com/coreos/go-oidc/v3 + golang.org/x/oauth2",
        `provider, err := oidc.NewProvider(ctx, "${issuer()}")`,
        "if err != nil { log.Fatal(err) }",
        "",
        "conf := &oauth2.Config{",
        `    ClientID:     "${client.client_id}",`,
        confidential
          ? '    ClientSecret: os.Getenv("QEETID_CLIENT_SECRET"),'
          : "    // a public app has no client secret",
        `    RedirectURL:  "${redirect}",`,
        "    Endpoint:     provider.Endpoint(),",
        `    Scopes:       []string{${scopesOf(client)
          .map((s) => `"${s}"`)
          .join(", ")}},`,
        "}",
        "// verifier := oauth2.GenerateVerifier(); nonce := <random per sign-in>",
        "// Redirect to conf.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oidc.Nonce(nonce)),",
        "// then check the ID token's nonce claim after the exchange.",
      ].join("\n");
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Opens the hosted sign-in for this app with a fresh proof key and nonce (every app must send
 * both), returning to its first redirect URI. The console never completes the exchange: the point
 * is to see sign-in work and land on the app. False when the app has no redirect URI.
 */
export async function testSignIn(client: OidcClient): Promise<boolean> {
  const redirectUri = client.redirect_uris[0];
  if (!redirectUri) return false;
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const url = new URL(endpoints().authorize);
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopesOf(client).join(" "));
  url.searchParams.set("state", crypto.randomUUID());
  url.searchParams.set("nonce", base64url(crypto.getRandomValues(new Uint8Array(16))));
  url.searchParams.set("code_challenge", base64url(new Uint8Array(digest)));
  url.searchParams.set("code_challenge_method", "S256");
  window.open(url.toString(), "_blank", "noopener");
  return true;
}
