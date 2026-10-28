import { Link } from "@qeetrix/react";
import { CodeBlock, type CodeBlockProps } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";

// Sentinel origin for resolving relative links with the browser's own URL parser.
const RELATIVE_BASE = "https://relative.invalid";

/**
 * Returns a link target that is safe to render, or undefined. Targets come from model output,
 * which can echo attacker-controlled tool data, so only http(s), mailto and same-origin paths
 * pass; the URL parser resolves paths, so "//host", "/\host" and other spellings are caught.
 */
export function safeHref(raw: string): string | undefined {
  const href = raw.trim();
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (!href.startsWith("/")) return undefined;
  try {
    const url = new URL(href, RELATIVE_BASE);
    if (url.origin !== RELATIVE_BASE) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

type Block =
  | { kind: "code"; lang?: string; code: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "p"; text: string };

const RE = {
  fenceOpen: /^```(\w+)?\s*$/,
  fenceClose: /^```\s*$/,
  heading: /^(#{1,6})\s+(.*)$/,
  ul: /^\s*[-*+]\s+/,
  ol: /^\s*\d+\.\s+/,
  quote: /^\s*>\s?/,
};

// Every group read through this is non-optional in its pattern, so a successful
// match always captured it. A miss means the pattern and the code disagree.
function capture(match: RegExpMatchArray, group: number): string {
  const value = match[group];
  if (value === undefined) throw new Error(`Markdown pattern did not capture group ${group}`);
  return value;
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  // split() leaves no holes, so lines[i] is undefined exactly when i is past the end.
  // Consumes lines from the cursor while `accept` holds, advancing `i` past them.
  const takeWhile = (accept: (line: string) => boolean): string[] => {
    const taken: string[] = [];
    for (let line = lines[i]; line !== undefined && accept(line); line = lines[i]) {
      taken.push(line);
      i++;
    }
    return taken;
  };

  for (let line = lines[i]; line !== undefined; line = lines[i]) {
    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = line.match(RE.fenceOpen);
    if (fence) {
      i++;
      const code = takeWhile((next) => !RE.fenceClose.test(next));
      i++; // consume the closing fence (or fall off the end mid-stream)
      blocks.push({ kind: "code", lang: fence[1], code: code.join("\n") });
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: capture(heading, 1).length,
        text: capture(heading, 2),
      });
      i++;
      continue;
    }

    if (RE.ul.test(line)) {
      const items = takeWhile((next) => RE.ul.test(next)).map((item) => item.replace(RE.ul, ""));
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (RE.ol.test(line)) {
      const items = takeWhile((next) => RE.ol.test(next)).map((item) => item.replace(RE.ol, ""));
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (RE.quote.test(line)) {
      const quote = takeWhile((next) => RE.quote.test(next)).map((item) =>
        item.replace(RE.quote, ""),
      );
      blocks.push({ kind: "quote", lines: quote });
      continue;
    }

    const paragraph = takeWhile(
      (next) =>
        next.trim() !== "" &&
        !RE.fenceOpen.test(next) &&
        !RE.heading.test(next) &&
        !RE.ul.test(next) &&
        !RE.ol.test(next) &&
        !RE.quote.test(next),
    );
    blocks.push({ kind: "p", text: paragraph.join(" ") });
  }

  return blocks;
}

const INLINE_PATTERNS: { re: RegExp; render: (m: RegExpMatchArray, key: string) => ReactNode }[] = [
  {
    re: /`([^`]+)`/,
    render: (m, key) => (
      <code key={key} className="qai-code">
        {m[1]}
      </code>
    ),
  },
  {
    re: /\*\*([^*]+)\*\*/,
    render: (m, key) => <strong key={key}>{renderInline(capture(m, 1), key)}</strong>,
  },
  {
    re: /__([^_]+)__/,
    render: (m, key) => <strong key={key}>{renderInline(capture(m, 1), key)}</strong>,
  },
  { re: /\*([^*]+)\*/, render: (m, key) => <em key={key}>{renderInline(capture(m, 1), key)}</em> },
  { re: /_([^_]+)_/, render: (m, key) => <em key={key}>{renderInline(capture(m, 1), key)}</em> },
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    render: (m, key) => {
      const href = safeHref(capture(m, 2));
      // Unsafe target: render the label as plain text.
      if (!href) return <span key={key}>{m[1]}</span>;
      // A console page opens in place, beside the panel; a site in a new tab.
      if (href.startsWith("/")) {
        const url = new URL(href, RELATIVE_BASE);
        const to = (
          <RouterLink
            to={url.pathname as never}
            search={Object.fromEntries(url.searchParams) as never}
            hash={url.hash.slice(1) || undefined}
          />
        );
        return (
          <Link key={key} render={to}>
            {m[1]}
          </Link>
        );
      }
      return (
        <Link key={key} href={href} external={!href.startsWith("mailto:")}>
          {m[1]}
        </Link>
      );
    },
  },
];

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;

  while (rest.length > 0) {
    let best: { index: number; length: number; node: ReactNode } | null = null;
    for (const pattern of INLINE_PATTERNS) {
      const m = rest.match(pattern.re);
      if (m && m.index !== undefined && (best === null || m.index < best.index)) {
        best = {
          index: m.index,
          length: m[0].length,
          node: pattern.render(m, `${keyPrefix}-${n}`),
        };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    out.push(best.node);
    rest = rest.slice(best.index + best.length);
    n++;
  }

  return out;
}

// The fence's language, as CodeBlock colours it; anything else (HCL, Go) is plain text.
const LANGUAGES: Record<string, NonNullable<CodeBlockProps["language"]>> = {
  sh: "shell",
  bash: "shell",
  shell: "shell",
  zsh: "shell",
  console: "shell",
  js: "javascript",
  javascript: "javascript",
  jsx: "javascript",
  ts: "typescript",
  typescript: "typescript",
  tsx: "tsx",
  json: "json",
  xml: "xml",
  html: "html",
};

function BlockView({ block, id }: { block: Block; id: string }) {
  switch (block.kind) {
    case "code": {
      const lang = block.lang?.toLowerCase();
      return (
        <CodeBlock
          code={block.code}
          language={(lang && LANGUAGES[lang]) || "text"}
          title={lang && !LANGUAGES[lang] ? lang : undefined}
          wrap
        />
      );
    }
    case "heading": {
      // The panel's title is an h2, so an answer's headings start at h3.
      const Tag = `h${Math.min(block.level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
      return <Tag>{renderInline(block.text, id)}</Tag>;
    }
    case "ul":
      return (
        <ul>
          {block.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: re-parsed text; streaming only appends
            <li key={`${id}-${j}`}>{renderInline(item, `${id}-${j}`)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: re-parsed text; streaming only appends
            <li key={`${id}-${j}`}>{renderInline(item, `${id}-${j}`)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote>
          {block.lines.map((line, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: re-parsed text; streaming only appends
            <p key={`${id}-${j}`}>{renderInline(line, `${id}-${j}`)}</p>
          ))}
        </blockquote>
      );
    default:
      return <p>{renderInline(block.text, id)}</p>;
  }
}

/**
 * Renders streamed assistant Markdown as React elements, never raw HTML, so there is no injection
 * surface. Covers headings, emphasis, code, links, lists and quotes, and tolerates a half-finished
 * document: an unterminated fence renders as an open code block.
 */
export function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <div className="qai-md">
      {blocks.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: content keys would remount on every token
        <BlockView key={`b-${i}`} block={block} id={`b-${i}`} />
      ))}
    </div>
  );
}
