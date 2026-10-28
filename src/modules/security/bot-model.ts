// The bot log as Threats › Bots reads it: the server's last 50 scored sign-ins (it keeps those
// scoring 0.30 or more), grouped into one row per client and address, and what kind of client
// each score means (internal/access/threat/bot: Score).

import type { BotEvent } from "./api/bots";

export const VERDICTS = ["blocked", "challenged", "allowed"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The list's address: `?q=…&verdict=blocked`. */
export type BotFilters = { q?: string; verdict?: Verdict };

/**
 * The server's scores, by what they mean: 0.95 a script's signature, 0.90 no user agent, 0.55 not
 * a browser. It stores them as 32-bit floats (0.95 reads back as 0.9499…), so each kind is told
 * by the midpoint to the next.
 */
export const CLIENT_KINDS = ["script", "none", "app"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export function clientKind(score: number): ClientKind {
  if (score >= 0.925) return "script";
  if (score >= 0.725) return "none";
  return "app";
}

export function verdictOf(v: string): Verdict {
  return v === "blocked" || v === "challenged" ? v : "allowed";
}

export type BotClient = {
  id: string;
  name: string;
  userAgent: string;
  ip: string;
  count: number;
  verdict: Verdict;
  score: number;
  last: string;
};

const OS: [RegExp, string][] = [
  [/Android (\d+)/, "Android $1"],
  [/iPhone|iPad/, "iOS"],
  [/Windows NT/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/X11; Linux|Linux x86_64/, "Linux"],
];
const CLIENTS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/HeadlessChrome\/(\d+)/, (m) => `Headless Chrome ${m[1]}`],
  [/Microsoft Outlook (\d+)|Microsoft Office\/(\d+)/, (m) => `Outlook ${m[1] ?? m[2]}`],
  [/Dalvik\/[\d.]+/, () => "Android app"],
  [/^curl\/([\d.]+)/, (m) => `curl ${m[1]}`],
  [/^Wget\/([\d.]+)/, (m) => `Wget ${m[1]}`],
  [/^python-requests\/(\d+\.\d+)/i, (m) => `Python Requests ${m[1]}`],
  [/^python-urllib3\/(\d+\.\d+)/i, (m) => `Python urllib3 ${m[1]}`],
  [/^python-urllib\/(\d+\.\d+)/i, (m) => `Python urllib ${m[1]}`],
  [/^Go-http-client\/([\d.]+)/, (m) => `Go HTTP client ${m[1]}`],
  [/^okhttp\/(\d+\.\d+)/, (m) => `OkHttp ${m[1]}`],
  [/^axios\/(\d+\.\d+)/, (m) => `Axios ${m[1]}`],
  [/^PostmanRuntime\/(\d+\.\d+)/, (m) => `Postman ${m[1]}`],
  [/Selenium|Playwright|Puppeteer|PhantomJS/i, (m) => m[0]],
];

/**
 * "Headless Chrome 153 · Linux" from a raw user agent; "" for an empty one (the page says "No
 * user agent"). Product names, so not translated.
 */
export function clientName(ua: string): string {
  if (!ua.trim()) return "";
  let name = ua.split(/[ /]/)[0] ?? ua;
  for (const [re, f] of CLIENTS) {
    const m = ua.match(re);
    if (m) {
      name = f(m);
      break;
    }
  }
  for (const [re, label] of OS) {
    const m = ua.match(re);
    if (m) return `${name} · ${label.replace("$1", m[1] ?? "")}`;
  }
  return name;
}

/** One row per client and address, newest first, each with how many sign-ins it made. */
export function groupClients(events: readonly BotEvent[]): BotClient[] {
  const by = new Map<string, BotClient>();
  for (const e of events) {
    const ip = e.ip ?? "";
    const key = `${ip}|${e.user_agent}`;
    const c = by.get(key);
    if (c) {
      c.count++;
      if (e.created_at > c.last) {
        c.last = e.created_at;
        c.verdict = verdictOf(e.verdict);
        c.score = e.score;
      }
    } else {
      by.set(key, {
        id: key,
        name: clientName(e.user_agent),
        userAgent: e.user_agent,
        ip,
        count: 1,
        verdict: verdictOf(e.verdict),
        score: e.score,
        last: e.created_at,
      });
    }
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

export function matchesClient(c: BotClient, filters: BotFilters): boolean {
  if (filters.verdict && c.verdict !== filters.verdict) return false;
  const q = filters.q?.trim().toLowerCase();
  if (q && !`${c.ip} ${c.name} ${c.userAgent}`.toLowerCase().includes(q)) return false;
  return true;
}

/** True for a loopback address: someone testing on the server's own machine. */
export function isLocal(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.");
}
