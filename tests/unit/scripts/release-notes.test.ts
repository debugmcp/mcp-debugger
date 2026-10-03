import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_LIMIT,
  extractHighlights,
  extractSection,
  headingAnchor,
  normalizeVersion,
  selectReleaseNotes
} from '../../../scripts/release-notes.mjs';

const SCRIPT = path.resolve(__dirname, '../../../scripts/release-notes.mjs');

/** A changelog shaped like the real one: an empty [Unreleased] above released sections. */
function changelog(releaseBody: string, version = '0.25.0'): string {
  return [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    `## [${version}] - 2026-09-29`,
    '',
    releaseBody,
    '',
    '## [0.24.2] - 2026-08-19',
    '',
    '### Fixed',
    '- an older fix (#390)',
    ''
  ].join('\n');
}

const HIGHLIGHTS = [
  '### Highlights',
  '- **CodeLLDB per-platform packages** — native debugging works out of the box',
  '- **COBOL adapter** — GnuCOBOL + CodeLLDB',
  ''
].join('\n');

/** `count` fixed entries of roughly 200 characters each. */
function fixedEntries(count: number): string {
  const entries = Array.from({ length: count }, (_, i) => `- fix number ${i} ${'x'.repeat(180)} (#${1000 + i})`);
  return ['### Fixed', ...entries].join('\n');
}

describe('release notes', () => {
  describe('extractSection', () => {
    it('returns the heading through the line before the next release heading', () => {
      const section = extractSection(changelog('### Fixed\n- a fix (#1)'), '0.25.0');
      expect(section).toEqual({
        heading: '## [0.25.0] - 2026-09-29',
        text: '## [0.25.0] - 2026-09-29\n\n### Fixed\n- a fix (#1)'
      });
    });

    it('matches the version literally, so a dot never stands in for another character', () => {
      const text = changelog('### Fixed\n- a fix (#1)', '0x25x0');
      expect(extractSection(text, '0.25.0')).toBeNull();
      expect(extractSection(text, '0x25x0')?.heading).toBe('## [0x25x0] - 2026-09-29');
    });

    it('finds a prerelease section and reads a CRLF changelog', () => {
      const text = changelog('### Fixed\n- a fix (#1)', '0.25.0-beta.1').replace(/\n/g, '\r\n');
      expect(extractSection(text, '0.25.0-beta.1')?.text).toBe('## [0.25.0-beta.1] - 2026-09-29\n\n### Fixed\n- a fix (#1)');
      expect(extractSection(text, '0.25.0')).toBeNull();
    });

    it('runs to the end of the file when the section is the last one', () => {
      expect(extractSection(changelog('- x'), '0.24.2')?.text).toBe('## [0.24.2] - 2026-08-19\n\n### Fixed\n- an older fix (#390)');
    });
  });

  describe('extractHighlights', () => {
    it('returns the block up to the next subsection heading', () => {
      const section = `## [0.25.0] - 2026-09-29\n\n${HIGHLIGHTS}\n### Added\n- a feature (#2)`;
      expect(extractHighlights(section)).toBe(HIGHLIGHTS.trim());
    });

    it('returns null when the block is missing or empty', () => {
      expect(extractHighlights('## [0.25.0]\n\n### Fixed\n- a fix')).toBeNull();
      expect(extractHighlights('## [0.25.0]\n\n### Highlights\n\n### Fixed\n- a fix')).toBeNull();
    });
  });

  describe('headingAnchor', () => {
    it("matches GitHub's anchors for release headings", () => {
      expect(headingAnchor('## [0.25.0] - 2026-09-29')).toBe('0250---2026-09-29');
      expect(headingAnchor('## [0.25.0-beta.1] - 2026-09-29')).toBe('0250-beta1---2026-09-29');
    });
  });

  describe('normalizeVersion', () => {
    it('accepts a bare version, a v-tag, or a full tag ref', () => {
      expect(normalizeVersion('0.25.0')).toBe('0.25.0');
      expect(normalizeVersion('v0.25.0-beta.1')).toBe('0.25.0-beta.1');
      expect(normalizeVersion('refs/tags/v0.25.0')).toBe('0.25.0');
    });
  });

  describe('selectReleaseNotes', () => {
    it('posts the whole section when it fits', () => {
      const notes = selectReleaseNotes(changelog(`${HIGHLIGHTS}\n${fixedEntries(3)}`), '0.25.0');
      expect(notes.mode).toBe('full');
      expect(notes.body).toContain('fix number 2');
      expect(notes.body).toContain('### Highlights');
      expect(notes.sectionLength).toBe(notes.body.length);
    });

    it('posts the highlights and a link to the full section when the section is too long', () => {
      const notes = selectReleaseNotes(changelog(`${HIGHLIGHTS}\n${fixedEntries(600)}`), '0.25.0');
      expect(notes.sectionLength).toBeGreaterThan(DEFAULT_LIMIT);
      expect(notes.mode).toBe('highlights');
      expect(notes.body).toContain('## [0.25.0] - 2026-09-29');
      expect(notes.body).toContain('**COBOL adapter**');
      expect(notes.body).not.toContain('fix number');
      expect(notes.body).toContain('This release has 600 changelog entries');
      expect(notes.body).toContain(
        '(https://github.com/debugmcp/mcp-debugger/blob/v0.25.0/CHANGELOG.md#0250---2026-09-29)'
      );
      expect(notes.body.length).toBeLessThan(DEFAULT_LIMIT);
    });

    it('honours a custom limit', () => {
      const text = changelog(`${HIGHLIGHTS}\n${fixedEntries(3)}`);
      const notes = selectReleaseNotes(text, '0.25.0', { limit: 500 });
      expect(notes.sectionLength).toBeGreaterThan(500);
      expect(notes.mode).toBe('highlights');
      expect(notes.body.length).toBeLessThanOrEqual(500);
    });

    it('refuses a section over the limit that has no highlights', () => {
      expect(() => selectReleaseNotes(changelog(fixedEntries(600)), '0.25.0'))
        .toThrow(/over the 100000-character release-notes limit.*"### Highlights"/s);
    });

    it('refuses highlights that are themselves over the limit', () => {
      expect(() => selectReleaseNotes(changelog(`${HIGHLIGHTS}\n${fixedEntries(3)}`), '0.25.0', { limit: 50 }))
        .toThrow(/Highlights" block .* is itself over the 50-character limit/);
    });

    it('refuses a version with no section', () => {
      expect(() => selectReleaseNotes(changelog('- x'), '0.26.0')).toThrow('has no "## [0.26.0]" section');
    });
  });

  describe('command line', () => {
    let dir: string | undefined;

    afterEach(() => {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    });

    function run(body: string, ...args: string[]) {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'));
      const file = path.join(dir, 'CHANGELOG.md');
      fs.writeFileSync(file, changelog(body));
      return spawnSync(process.execPath, [SCRIPT, ...args, '--changelog', file], { windowsHide: true, encoding: 'utf-8' });
    }

    it('--check reports the mode and exits 0 when the notes fit', () => {
      const result = run(`${HIGHLIGHTS}\n${fixedEntries(600)}`, 'refs/tags/v0.25.0', '--check');
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Release notes for 0\.25\.0: Highlights and a link/);
    });

    it('--check exits 1 with the reason when the notes cannot fit', () => {
      const result = run(fixedEntries(600), '0.25.0', '--check');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('"### Highlights"');
    });

    it('--out writes the body to a file and prints nothing', () => {
      const body = `${HIGHLIGHTS}\n${fixedEntries(2)}`;
      const out = path.join(os.tmpdir(), `release-notes-out-${process.pid}-${Date.now()}.md`);
      try {
        const result = run(body, 'v0.25.0', '--out', out);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
        expect(fs.readFileSync(out, 'utf-8')).toBe(`${selectReleaseNotes(changelog(body), '0.25.0').body}\n`);
      } finally {
        fs.rmSync(out, { force: true });
      }
    });

    it('prints usage and exits 1 without a version', () => {
      const result = spawnSync(process.execPath, [SCRIPT], { windowsHide: true, encoding: 'utf-8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Usage: node scripts/release-notes.mjs');
    });
  });
});
