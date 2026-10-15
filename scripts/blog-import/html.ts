/**
 * Zero-dependency HTML helpers for the blog importer: entity decoding,
 * a tolerant HTML -> Markdown converter, and image-URL discovery.
 *
 * This is deliberately not a full HTML parser. Blog post bodies from
 * WordPress (content:encoded) and Wix (server-rendered post pages) use a
 * small, predictable set of tags, and anything the converter does not
 * recognise falls through as its inner text -- nothing is ever dropped
 * silently except script/style/svg/noscript content. The original HTML
 * is always archived next to the Markdown, so a better conversion can be
 * re-run later without re-fetching anything.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  sbquo: "‚", bdquo: "„", hellip: "…", copy: "©", reg: "®", trade: "™",
  laquo: "«", raquo: "»", bull: "•", middot: "·", deg: "°", times: "×",
  divide: "÷", prime: "′", Prime: "″", shy: "", zwj: "‍", zwnj: "‌",
  aacute: "á", agrave: "à", acirc: "â", auml: "ä", atilde: "ã", aring: "å",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", iacute: "í", igrave: "ì", icirc: "î", iuml: "ï",
  oacute: "ó", ograve: "ò", ocirc: "ô", ouml: "ö", otilde: "õ", uacute: "ú", ugrave: "ù",
  ucirc: "û", uuml: "ü", ntilde: "ñ", ccedil: "ç", szlig: "ß",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref] ?? match;
  });
}

export function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Tags whose entire content is discarded (never reader-visible prose). */
const SKIP_CONTENT = new Set(["script", "style", "noscript", "svg", "template", "button", "select", "textarea", "head"]);
const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "param", "track"]);
const BLOCK = new Set([
  "p", "div", "section", "article", "main", "header", "footer", "figure", "aside", "nav",
  "table", "thead", "tbody", "tfoot", "dl", "dt", "dd", "address", "details", "summary",
]);

interface Frame {
  tag: string;
  attrs: Record<string, string>;
  out: string;
  listIndex: number;
}

function wrapInline(inner: string, marker: string): string {
  const core = inner.trim();
  if (!core) return inner;
  const lead = inner.match(/^\s*/)![0] ? " " : "";
  const trail = inner.match(/\s*$/)![0] ? " " : "";
  return `${lead}${marker}${core}${marker}${trail}`;
}

function block(inner: string): string {
  const core = inner.trim();
  return core ? `\n\n${core}\n\n` : "";
}

function closeFrame(frame: Frame, parent: Frame, inPre: boolean): string {
  const { tag, attrs, out } = frame;
  if (/^h[1-6]$/.test(tag)) {
    const text = out.replace(/\s*\n\s*/g, " ").trim();
    return text ? `\n\n${"#".repeat(Number(tag[1]))} ${text}\n\n` : "";
  }
  if (BLOCK.has(tag)) return block(out);
  switch (tag) {
    case "strong":
    case "b":
      return wrapInline(out, "**");
    case "em":
    case "i":
    case "cite":
      return wrapInline(out, "*");
    case "a": {
      const href = attrs.href?.trim();
      const text = out.trim();
      if (!href || !text || href.startsWith("javascript:")) return out;
      if (href.startsWith("#")) return out;
      return wrapInline(out, "").replace(text, `[${text}](${href})`);
    }
    case "blockquote": {
      const core = out.trim();
      return core ? `\n\n${core.split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n")}\n\n` : "";
    }
    case "ul":
    case "ol":
      return block(out);
    case "li": {
      const marker = parent.tag === "ol" ? `${++parent.listIndex}.` : "-";
      const lines = out.trim().replace(/\n{3,}/g, "\n\n").split("\n");
      const pad = " ".repeat(marker.length + 1);
      const lead = parent.out === "" || parent.out.endsWith("\n") ? "" : "\n";
      return `${lead}${marker} ${lines.map((l, i) => (i === 0 || !l ? l : pad + l)).join("\n")}\n`;
    }
    case "pre":
      return `\n\n\`\`\`\n${out.replace(/^\n+|\s+$/g, "")}\n\`\`\`\n\n`;
    case "code":
      return inPre ? out : wrapInline(out, "`");
    case "figcaption": {
      const core = out.trim();
      return core ? `\n\n*${core.replace(/\s*\n\s*/g, " ")}*\n\n` : "";
    }
    case "tr":
      return `\n| ${out.trim()}`;
    case "td":
    case "th":
      return `${out.trim().replace(/\s*\n\s*/g, " ")} | `;
    default:
      return out;
  }
}

/** Converts an HTML fragment (or document) to readable Markdown. */
export function htmlToMarkdown(html: string): string {
  const stack: Frame[] = [{ tag: "#root", attrs: {}, out: "", listIndex: 0 }];
  const top = () => stack[stack.length - 1];
  const inPre = () => stack.some((f) => f.tag === "pre");
  const tokenRe = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<!doctype[^>]*>|<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(html))) {
    const token = m[0];
    if (token.startsWith("<!--") || /^<!doctype/i.test(token)) continue;
    if (m[1] !== undefined) {
      top().out += m[1];
      continue;
    }
    const name = m[2]?.toLowerCase();
    if (!name) {
      const text = decodeEntities(token);
      top().out += inPre() ? text : text.replace(/\s+/g, " ");
      continue;
    }
    const isClose = token[1] === "/";
    const attrs = isClose ? {} : parseAttributes(m[3] ?? "");

    if (!isClose && SKIP_CONTENT.has(name)) {
      if (token.endsWith("/>")) continue;
      const closeRe = new RegExp(`</${name}\\s*>`, "gi");
      closeRe.lastIndex = tokenRe.lastIndex;
      const close = closeRe.exec(html);
      tokenRe.lastIndex = close ? closeRe.lastIndex : html.length;
      continue;
    }

    if (!isClose && VOID.has(name)) {
      if (name === "br") top().out += "\n";
      else if (name === "hr") top().out += "\n\n---\n\n";
      else if (name === "img") {
        const src = pickImageSource(attrs);
        if (src) top().out += `![${(attrs.alt ?? "").replace(/[[\]]/g, "")}](${src})`;
      }
      continue;
    }
    if (!isClose && name === "iframe") {
      if (attrs.src) top().out += `\n\n[Embedded content](${attrs.src})\n\n`;
      continue;
    }

    if (!isClose) {
      if (token.endsWith("/>")) continue;
      // An unclosed <p>/<li> is implicitly closed by the next sibling.
      if ((name === "p" || name === "li") && top().tag === name) closeTop();
      stack.push({ tag: name, attrs, out: "", listIndex: 0 });
      continue;
    }

    const idx = stack.map((f) => f.tag).lastIndexOf(name);
    if (idx <= 0) continue; // stray close tag
    while (stack.length > idx) closeTop();
  }
  while (stack.length > 1) closeTop();
  return tidyMarkdown(stack[0].out);

  function closeTop() {
    const frame = stack.pop()!;
    const parent = top();
    parent.out += closeFrame(frame, parent, inPre());
  }
}

export function tidyMarkdown(md: string): string {
  return md
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+(?=[^ \t-*>\d|`])/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToPlainText(html: string): string {
  return tidyMarkdown(
    htmlToMarkdown(html)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6} /gm, "")
      .replace(/\*\*|(?<!\w)\*(?!\s)|(?<!\s)\*(?!\w)|`/g, "")
      .replace(/^> ?/gm, "")
  );
}

function pickImageSource(attrs: Record<string, string>): string | null {
  // Lazy-loading plugins keep the real URL in data-* and a placeholder in src.
  const candidates = [attrs["data-orig-file"], attrs["data-src"], attrs["data-lazy-src"], attrs.src];
  for (const c of candidates) {
    if (c && !c.startsWith("data:")) return c.trim();
  }
  return null;
}

/** All distinct image URLs referenced by Markdown image syntax, in order of appearance. */
export function markdownImageUrls(md: string): string[] {
  const urls = [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  return [...new Set(urls)];
}

/**
 * Returns the outer HTML of the first element whose opening tag matches
 * `openTagPattern`, balancing nested elements of the same tag name.
 */
export function extractElement(html: string, openTagPattern: RegExp): string | null {
  const flags = openTagPattern.flags.includes("g") ? openTagPattern.flags : openTagPattern.flags + "g";
  const re = new RegExp(openTagPattern.source, flags);
  const open = re.exec(html);
  if (!open) return null;
  const tagName = open[0].match(/^<([a-zA-Z][a-zA-Z0-9-]*)/)?.[1];
  if (!tagName) return null;
  const tagRe = new RegExp(`<(/?)${tagName}(?=[\\s>/])[^>]*>`, "gi");
  tagRe.lastIndex = open.index + open[0].length;
  let depth = 1;
  let t: RegExpExecArray | null;
  while ((t = tagRe.exec(html))) {
    if (t[1]) depth--;
    else if (!t[0].endsWith("/>")) depth++;
    if (depth === 0) return html.slice(open.index, tagRe.lastIndex);
  }
  return html.slice(open.index);
}

export function metaContent(html: string, key: string): string | null {
  const re = /<meta\s((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = parseAttributes(m[1]);
    if (attrs.property === key || attrs.name === key || attrs.itemprop === key) return attrs.content ?? null;
  }
  return null;
}
