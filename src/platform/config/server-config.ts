// Checked once at production startup, so a bad value stops the server instead of failing each
// request or falling back to localhost. Fallbacks match the readers; private http backends are
// allowed (container networks). Problems name the variable, never its value.
import { env } from "@/platform/config/env";

const MIN_SESSION_SECRET_LENGTH = 32;

type Source = Record<string, string | undefined>;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns every reason the environment can't run a production server; empty when it can. */
export function productionConfigProblems(
  source: Source = process.env,
  buildTimeApiUrl: string | undefined = env.VITE_API_URL,
): string[] {
  const problems: string[] = [];

  const secret = source.SESSION_SECRET;
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    problems.push(
      `SESSION_SECRET must be set to at least ${MIN_SESSION_SECRET_LENGTH} characters.`,
    );
  }

  const backend = source.SERVER_URL || source.VITE_API_URL;
  if (!backend) problems.push("SERVER_URL (or VITE_API_URL) must be set.");
  else if (!isHttpUrl(backend)) problems.push("SERVER_URL must be an absolute http(s) URL.");

  const publicApi = source.PUBLIC_API_URL || buildTimeApiUrl;
  if (!publicApi) problems.push("PUBLIC_API_URL (or a build-time VITE_API_URL) must be set.");
  else if (!isHttpUrl(publicApi)) problems.push("PUBLIC_API_URL must be an absolute http(s) URL.");

  return problems;
}

/** Throws, refusing to start, when the production configuration is incomplete. */
export function assertProductionConfig(source?: Source, buildTimeApiUrl?: string): void {
  const problems = productionConfigProblems(source, buildTimeApiUrl);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to start: invalid production configuration.\n- ${problems.join("\n- ")}`,
    );
  }
}
