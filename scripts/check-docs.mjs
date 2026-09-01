#!/usr/bin/env node
/**
 * Documentation consistency gate.
 *
 * Docs here are hand-maintained -- nothing generates them -- so they drift silently.
 * The v0.25.0 truth pass found the two classes of drift a machine can catch:
 *
 *   1. Relative links that no longer resolve (a doc was moved or deleted).
 *   2. Counts that fell behind the code ("28 tools", "eight languages").
 *
 * Everything else a doc can get wrong needs a human. These two do not, so they
 * should never reach main again.
 *
 * Run: node scripts/check-docs.mjs   (pnpm run check:docs)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Historical by design: these trees record what was true at the time and are
 * deliberately not maintained. Auditing them produces noise no one can act on.
 */
const FROZEN = ['docs/archive/', 'docs/releases/'];

/**
 * Dated records, where a past count is correct and must not be "fixed": CHANGELOG
 * entries say what a release shipped, fragments describe one PR's scope, and case
 * studies narrate a moment in time. Their links are still checked.
 */
const COUNTS_EXEMPT = (f) =>
  f === 'CHANGELOG.md' || f.startsWith('changelog.d/') || f.startsWith('docs/case-studies/');

const problems = [];
const report = (file, line, msg) => problems.push({ file, line, msg });

function trackedMarkdown() {
  const out = execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter((f) => f && !FROZEN.some((p) => f.startsWith(p)));
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source of truth for both counts. Parsed, not imported: this must run without a build. */
function toolNames() {
  const src = read('src/server/tool-schemas.ts');
  const block = src.match(/export const TOOL_NAMES = \[([\s\S]*?)\] as const/);
  if (!block) throw new Error('Could not find TOOL_NAMES in src/server/tool-schemas.ts');
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function adapterLanguages() {
  const dirs = fs
    .readdirSync(path.join(ROOT, 'packages'))
    .filter((d) => d.startsWith('adapter-'))
    .map((d) => d.slice('adapter-'.length));
  return { all: dirs, real: dirs.filter((d) => d !== 'mock') };
}

// --- 1. relative links resolve ------------------------------------------------
// Skips http(s)/mailto/anchor-only targets; a link with a #fragment is checked for
// its file part only (heading anchors are not validated).
function checkLinks(files) {
  const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const file of files) {
    const lines = read(file).split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      // Links inside a fenced block are sample markup, not navigation. Following
      // them reports "dead links" against docs that are merely showing a snippet.
      if (/^\s*(```|~~~)/.test(lines[i])) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      for (const m of lines[i].matchAll(LINK)) {
        const target = m[1];
        if (/^(https?:|mailto:|#|<)/.test(target)) continue;
        const filePart = decodeURIComponent(target.split('#')[0]);
        if (!filePart) continue;
        if (!fs.existsSync(path.resolve(ROOT, path.dirname(file), filePart))) {
          report(file, i + 1, `dead relative link -> ${target}`);
        }
      }
    }
  }
}

// --- 2. counts match the code -------------------------------------------------
function checkCounts(files, tools, langs) {
  const WORD = { seven: 7, eight: 8, nine: 9, ten: 10 };
  const num = (s) => (WORD[s.toLowerCase()] ?? Number(s));

  const TOOLS = /\b(?:all\s+)?\*{0,2}(\d+)\*{0,2}\s+(?:MCP\s+)?tools\b/gi;
  const LANGS = /\b\*{0,2}(seven|eight|nine|ten|\d+)\*{0,2}\s+languages?(?:\s+adapters?)?\b/gi;

  // "these 3 tools" and "the 15 tools that ..." scope a subset, not the whole
  // surface; a line naming a specific past version ("v0.19.0 - 7 language adapters
  // total") is a historical record. Missing a real drift is cheap here -- crying
  // wolf on a correct sentence would train people to ignore this gate.
  const skip = (line, m) => {
    if (/\bv\d+\.\d+\.\d+\b/.test(line)) return true;
    const before = line.slice(0, m.index);
    const after = line.slice(m.index + m[0].length);
    return /\b(these|those)\s+$/i.test(before) || /^\s*(that|which)\b/i.test(after);
  };

  for (const file of files) {
    if (COUNTS_EXEMPT(file)) continue;
    const lines = read(file).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(TOOLS)) {
        if (skip(line, m)) continue;
        if (num(m[1]) !== tools.length) {
          report(file, i + 1, `claims "${m[0].trim()}" but TOOL_NAMES has ${tools.length}`);
        }
      }
      for (const m of line.matchAll(LANGS)) {
        if (skip(line, m)) continue;
        const n = num(m[1]);
        // Both readings are legitimate and both appear on purpose: the marketing
        // count excludes the mock adapter, the architecture count includes it.
        if (n !== langs.real.length && n !== langs.all.length) {
          report(
            file,
            i + 1,
            `claims "${m[0].trim()}" but there are ${langs.real.length} language adapters ` +
              `(${langs.all.length} including mock)`
          );
        }
      }
    }
  }
}

// --- 3. the tool reference and the README table stay in step with TOOL_NAMES ---
// This is the check that would have caught the drift the e2e suite hit, where a
// hand-maintained list fell to 25 of the 28 advertised tools without anyone noticing.
function checkToolCoverage(tools) {
  for (const file of ['docs/tool-reference.md', 'README.md']) {
    const text = read(file);
    const missing = tools.filter((t) => !text.includes(t));
    if (missing.length) {
      report(file, 0, `does not mention ${missing.length} advertised tool(s): ${missing.join(', ')}`);
    }
  }
  // The reverse direction: a tool renamed or removed but still documented.
  const known = new Set(tools);
  for (const m of read('docs/tool-reference.md').matchAll(/^###\s+`?([a-z_]{4,})`?\s*$/gm)) {
    if (!known.has(m[1]) && m[1].includes('_')) {
      report('docs/tool-reference.md', 0, `documents "${m[1]}", which is not in TOOL_NAMES`);
    }
  }
}

function main() {
  const files = trackedMarkdown();
  const tools = toolNames();
  const langs = adapterLanguages();

  checkLinks(files);
  checkCounts(files, tools, langs);
  checkToolCoverage(tools);

  console.log(
    `Checked ${files.length} tracked markdown files against ${tools.length} tools ` +
      `and ${langs.real.length} language adapters (+mock).`
  );

  if (problems.length === 0) {
    console.log('No documentation inconsistencies found.');
    return;
  }

  console.error(`\n${problems.length} documentation problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.file}${p.line ? `:${p.line}` : ''}  ${p.msg}`);
  }
  console.error(
    '\nFix the docs, or -- if the code changed -- update every doc that states the old ' +
      'count. Counts come from TOOL_NAMES in src/server/tool-schemas.ts and from the ' +
      'packages/adapter-* directories.\n'
  );
  process.exit(1);
}

main();
