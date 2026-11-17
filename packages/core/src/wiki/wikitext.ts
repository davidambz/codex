// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Just enough wikitext to read the Warframe Wiki's "Acquisition" text as
// plain sentences. Not a parser: links become their label, templates
// their most readable argument, everything else is dropped.

/** Templates whose argument is an amount of something. */
const AMOUNT_TEMPLATES: Record<string, string> = {
  sc: "Standing",
  cc: "Credits",
  pc: "Platinum",
  pp: "Platinum",
  ec: "Endo",
};

/**
 * The current "how to get it" paragraphs of a Warframe's wiki page, as
 * plain text. Pages put them either in an {{Acquisition|...}} template
 * (followed by more paragraphs) or under an "==Acquisition==" heading;
 * either way they run until the next heading, which on the wiki is where
 * history ("Prior to Update 19...") starts.
 */
export function extractAcquisition(wikitext: string, maxParagraphs = 3): string[] {
  let body: string | undefined;

  const template = findTemplate(wikitext, "Acquisition");
  if (template) {
    const args = splitArgs(wikitext.slice(template.start + 2, template.end - 2)).slice(1);
    const text = args.filter((a) => !/^\s*[\w-]+\s*=/.test(a)).at(-1) ?? "";
    const rest = wikitext.slice(template.end);
    body = `${text}\n\n${rest.slice(0, nextHeading(rest))}`;
  } else {
    const heading = /^==\s*Acquisition\s*==[ \t]*$/m.exec(wikitext);
    if (heading) {
      const rest = wikitext.slice(heading.index + heading[0].length);
      body = rest.slice(0, nextHeading(rest));
    }
  }
  if (body === undefined) return [];

  return body
    .replace(/^\{\|[\s\S]*?^\|\}/gm, "") // tables
    .split(/\n\s*\n/)
    .map((p) => toPlainText(p))
    // Past ways of getting it ("Prior to Update 19, ...") are history, not advice.
    .filter((p) => p.length > 0 && !/^Prior to\b/.test(p))
    .slice(0, maxParagraphs);
}

export function toPlainText(wikitext: string): string {
  let text = wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "");

  // Innermost templates first, so arguments are already plain text.
  for (let guard = 0; guard < 50; guard++) {
    const next = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => renderTemplate(inner));
    if (next === text) break;
    text = next;
  }

  text = text
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, (_, target: string) => target.replace(/#.*$/, ""))
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/^[*#:;]+\s*/gm, "")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/\s{2,}/g, " ")
    // "{{sc|5,000}} Standing" -> "5,000 Standing Standing" -> "5,000 Standing".
    .replace(/\b(Standing|Credits|Platinum|Endo) \1\b/g, "$1");
  return decodeEntities(text).trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  lt: "<",
  gt: ">",
  times: "\u00d7",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

function renderTemplate(inner: string): string {
  const [rawName = "", ...args] = splitArgs(inner);
  const name = rawName.trim();
  const positional = args.filter((a) => !/^\s*[\w-]+\s*=/.test(a)).map((a) => a.trim());
  const lower = name.toLowerCase();
  if (lower in AMOUNT_TEMPLATES && positional[0]) return `${positional[0]} ${AMOUNT_TEMPLATES[lower]}`;
  if (lower === "ver" && positional[0]) return `Update ${positional[0]}`;
  if (positional.length === 0) return "";
  // {{Resource|Vainthorn|Vainthorns}}, {{D|Slow|Slowing}}: the last one is the label.
  return positional.at(-1) ?? "";
}

/** Splits template arguments on top-level pipes (not those inside [[links]] or nested {{...}}). */
function splitArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
    } else if ((two === "}}" || two === "]]") && depth > 0) {
      depth--;
      current += two;
      i++;
    } else if (inner[i] === "|" && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += inner[i];
    }
  }
  args.push(current);
  return args;
}

/** The first {{name|...}} call, with balanced braces. */
function findTemplate(wikitext: string, name: string): { start: number; end: number } | undefined {
  const open = new RegExp(`\\{\\{\\s*${name}\\s*\\|`, "i").exec(wikitext);
  if (!open) return undefined;
  let depth = 0;
  for (let i = open.index; i < wikitext.length - 1; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      i++;
    } else if (two === "}}") {
      depth--;
      i++;
      if (depth === 0) return { start: open.index, end: i + 1 };
    }
  }
  return undefined;
}

function nextHeading(text: string): number {
  const match = /^=+[^=\n].*=+[ \t]*$/m.exec(text);
  return match ? match.index : text.length;
}
