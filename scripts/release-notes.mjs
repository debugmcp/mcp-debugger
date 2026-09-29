/**
 * GitHub release notes for a tagged version, cut from CHANGELOG.md.
 *
 * The release workflow used to paste the whole `## [x.y.z]` section into the GitHub Release
 * body. GitHub rejects a release body over 125,000 characters, and the v0.25.0 section came to
 * about 123,000 before the workflow's own install and verify text was added. `create-release`
 * runs after npm, Docker and PyPI have published, so that failure would have landed with the
 * release already public.
 *
 * A section that fits is posted whole, as before. A section over the limit posts its
 * `### Highlights` block and a link to the full section in CHANGELOG.md at the tag. The release
 * workflow runs `--check` in build-and-test, which every publishing job waits on, so a section
 * that is missing, or too long without highlights, stops the release before anything ships.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMain } from './lib/is-main.mjs';

/**
 * Longest section posted whole. GitHub's release body limit is 125,000 characters; the rest is
 * headroom for the workflow's heading, install and verify text.
 */
export const DEFAULT_LIMIT = 100_000;

/** Where the full-changelog link points. */
export const DEFAULT_REPO_URL = 'https://github.com/debugmcp/mcp-debugger';

const HIGHLIGHTS_HEADING = /^### Highlights\s*$/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Accept the forms a caller has at hand: `0.25.0`, `v0.25.0` or `refs/tags/v0.25.0`.
 *
 * @param {string} ref
 * @returns {string}
 */
export function normalizeVersion(ref) {
  return ref.trim().replace(/^refs\/tags\//, '').replace(/^v(?=\d)/, '');
}

/**
 * The `## [version]` section, from its heading line up to the next `## [` heading. These are the
 * boundaries the workflow's old `sed` used; the version is matched literally.
 *
 * @param {string} changelog full CHANGELOG.md text
 * @param {string} version e.g. `0.25.0`
 * @returns {{ heading: string, text: string } | null} `null` when there is no such section
 */
export function extractSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\]`);
  const start = lines.findIndex(line => heading.test(line));
  if (start === -1) return null;

  let end = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
  if (end === -1) end = lines.length;

  return { heading: lines[start], text: lines.slice(start, end).join('\n').trimEnd() };
}

/**
 * The `### Highlights` block of a section, heading included, up to the next `##`/`###` heading.
 *
 * @param {string} sectionText
 * @returns {string | null} `null` when the block is absent or has no content
 */
export function extractHighlights(sectionText) {
  const lines = sectionText.split('\n');
  const start = lines.findIndex(line => HIGHLIGHTS_HEADING.test(line));
  if (start === -1) return null;

  let end = lines.findIndex((line, index) => index > start && /^#{2,3} /.test(line));
  if (end === -1) end = lines.length;

  const block = lines.slice(start, end).join('\n').trim();
  return block.split('\n').slice(1).some(line => line.trim() !== '') ? block : null;
}

/**
 * GitHub's anchor for a Markdown heading: lower-cased, punctuation other than `-` and `_`
 * dropped, spaces turned into hyphens. `## [0.25.0] - 2026-09-29` becomes `0250---2026-09-29`.
 *
 * @param {string} heading the heading line, `#` marks included
 * @returns {string}
 */
export function headingAnchor(heading) {
  return heading
    .replace(/^#+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/ /g, '-');
}

/** Top-level bullets in a block of Markdown. */
function countEntries(text) {
  return text.split('\n').filter(line => line.startsWith('- ')).length;
}

/**
 * Choose the release body for a version.
 *
 * @param {string} changelog full CHANGELOG.md text
 * @param {string} version e.g. `0.25.0`
 * @param {{ limit?: number, repoUrl?: string }} [options]
 * @returns {{ mode: 'full' | 'highlights', body: string, sectionLength: number }}
 * @throws {Error} when the section is missing, or over the limit with no usable highlights
 */
export function selectReleaseNotes(changelog, version, { limit = DEFAULT_LIMIT, repoUrl = DEFAULT_REPO_URL } = {}) {
  const section = extractSection(changelog, version);
  if (!section) {
    throw new Error(`CHANGELOG.md has no "## [${version}]" section, so the release would have empty notes.`);
  }

  const sectionLength = section.text.length;
  if (sectionLength <= limit) {
    return { mode: 'full', body: section.text, sectionLength };
  }

  const highlights = extractHighlights(section.text);
  if (!highlights) {
    throw new Error(
      `The "## [${version}]" section is ${sectionLength} characters, over the ${limit}-character ` +
      'release-notes limit (GitHub rejects release bodies over 125,000), and it has no ' +
      '"### Highlights" block to post instead. Add one at the top of the section.'
    );
  }

  const entries = countEntries(section.text) - countEntries(highlights);
  const link = `${repoUrl}/blob/v${version}/CHANGELOG.md#${headingAnchor(section.heading)}`;
  const body = `${section.heading}\n\n${highlights}\n\n` +
    `This release has ${entries} changelog entries, too many for a release page. ` +
    `The full list is in [CHANGELOG.md](${link}).`;

  if (body.length > limit) {
    throw new Error(
      `The "### Highlights" block of "## [${version}]" is itself over the ${limit}-character limit ` +
      `(${body.length} characters with the link). Shorten it.`
    );
  }
  return { mode: 'highlights', body, sectionLength };
}

function usage() {
  return 'Usage: node scripts/release-notes.mjs <version> [--check] [--out <file>] [--changelog <path>]';
}

/** @param {string[]} argv arguments after the script path */
function parseArgs(argv) {
  const options = { version: undefined, check: false, out: undefined, changelog: undefined };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--out') options.out = argv[++index];
    else if (arg === '--changelog') options.changelog = argv[++index];
    else if (!arg.startsWith('--') && options.version === undefined) options.version = arg;
    else throw new Error(`Unexpected argument "${arg}". ${usage()}`);
  }
  if (!options.version) throw new Error(usage());
  if (options.out === undefined && argv.includes('--out')) throw new Error(`--out needs a file. ${usage()}`);
  if (options.changelog === undefined && argv.includes('--changelog')) {
    throw new Error(`--changelog needs a path. ${usage()}`);
  }
  return options;
}

if (isMain(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const changelogPath = options.changelog ?? path.join(root, 'CHANGELOG.md');
    const version = normalizeVersion(options.version);
    const notes = selectReleaseNotes(fs.readFileSync(changelogPath, 'utf-8'), version);

    if (options.out) fs.writeFileSync(options.out, `${notes.body}\n`);
    if (options.check) {
      console.log(notes.mode === 'full'
        ? `Release notes for ${version}: the full section (${notes.sectionLength} characters).`
        : `Release notes for ${version}: Highlights and a link (${notes.body.length} characters); ` +
          `the full section is ${notes.sectionLength} characters.`);
    } else if (!options.out) {
      process.stdout.write(`${notes.body}\n`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
