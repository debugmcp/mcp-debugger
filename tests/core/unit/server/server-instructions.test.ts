/**
 * The server's MCP `instructions` must fit in what the model is shown (issue #1331).
 *
 * The bound is another product's limit: Claude Code puts the first 4,096
 * characters of a server's instructions in front of the model and drops the
 * rest, and lists the tools by name only until the agent searches for one.
 * Measured on 2026-11-28 in the first model request of 20 agent trials
 * against the published 0.27.0 (issue #1331); other clients were not measured.
 * So the whole text, the closing pointer included, has to fit for every
 * combination of the options the builder takes, and the rules an operator's
 * setting adds come before the general ones.
 */
import { describe, it, expect } from 'vitest';
import {
  buildServerInstructions,
  SERVER_INSTRUCTIONS_LIMIT,
  type ServerInstructionsOptions
} from '../../../../src/skill-content.js';
import { describeIdleWindow } from '../../../../src/session/idle-policy.js';
import type { BpAddressingMode } from '../../../../src/utils/bp-addressing.js';

const MODES: readonly BpAddressingMode[] = ['line', 'assert', 'content'];

/**
 * The idle rule quotes the window, whose length varies. describeIdleWindow
 * prints an integer count of minutes or seconds, and the longest a finite
 * double prints as is 23 characters ("1.7976931348623157e+308"; any integer
 * below 1e21 prints in 21 digits at most), so no window is longer than 23
 * digits plus " min": that string is the margin the bound is checked with.
 */
const LONGEST_IDLE_WINDOW = `${'9'.repeat(23)} min`;
const IDLE_WINDOWS: ReadonlyArray<string | undefined> = [
  undefined,
  describeIdleWindow(5 * 60_000),
  describeIdleWindow(90_500),
  describeIdleWindow(Number.MAX_VALUE),
  LONGEST_IDLE_WINDOW
];

interface Combination {
  mode: BpAddressingMode;
  opts: ServerInstructionsOptions;
  label: string;
}

function* combinations(): Generator<Combination> {
  for (const mode of MODES) {
    for (const redactionEnabled of [true, false]) {
      for (const variableAccessMode of ['open', 'explicit'] as const) {
        for (const snapshotEnabled of [true, false]) {
          for (const containerMode of [false, true]) {
            for (const idleWindow of IDLE_WINDOWS) {
              const opts: ServerInstructionsOptions = {
                redactionEnabled,
                variableAccessMode,
                snapshotEnabled,
                containerMode,
                ...(idleWindow !== undefined ? { idleWindow } : {})
              };
              yield {
                mode,
                opts,
                label: `${mode} redaction=${redactionEnabled} access=${variableAccessMode} snapshot=${snapshotEnabled} container=${containerMode} idle=${idleWindow ?? 'off'}`
              };
            }
          }
        }
      }
    }
  }
}

const ALL = [...combinations()];

describe('server instructions (issue #1331)', () => {
  it('no idle window describeIdleWindow prints is longer than the margin the bound is checked with', () => {
    for (const ms of [1, 999, 59_999, 60_000, 90_500, Number.MAX_SAFE_INTEGER, 1e21 - 1, 1e21, Number.MAX_VALUE]) {
      expect(describeIdleWindow(ms).length, String(ms)).toBeLessThanOrEqual(LONGEST_IDLE_WINDOW.length);
    }
  });

  it(`fit in ${SERVER_INSTRUCTIONS_LIMIT} characters for every option combination`, () => {
    expect(SERVER_INSTRUCTIONS_LIMIT).toBe(4096);
    expect(buildServerInstructions().length).toBeLessThanOrEqual(SERVER_INSTRUCTIONS_LIMIT);
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      expect(text.length, label).toBeLessThanOrEqual(SERVER_INSTRUCTIONS_LIMIT);
      // ASCII, so characters, UTF-16 units and UTF-8 bytes agree: the bound
      // holds whichever a client counts.
      expect(text, label).toMatch(/^[\x20-\x7e\n]*$/);
      expect(Buffer.byteLength(text, 'utf8'), label).toBe(text.length);
    }
  });

  it('keep the opening sentence and end with the pointer to the rest, in every combination', () => {
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      expect(text.startsWith('mcp-debugger drives real step-through debuggers ('), label).toBe(true);
      expect(text.trimEnd().endsWith(
        'request the "debugging-workflow" prompt or install the agent skill from skills/debugging/ in the repo.'
      ), label).toBe(true);
    }
  });

  it('carry the paths for a launch, a failing test and an attach, and how a session ends', () => {
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      expect(text, label).toContain('Launch: create_debug_session {language}');
      expect(text, label).toContain('testRunner: "pytest"');
      expect(text, label).toContain('Attach: create_debug_session {language, host, port}');
      expect(text, label).toContain("Breakpoint paths are resolved on the target's filesystem");
      expect(text, label).toContain('a remote attach takes file and line');
      expect(text, label).toContain('continue_execution returns at once; wait_for_stop blocks');
      expect(text, label).toContain('nothing was cancelled');
      expect(text, label).toContain("its answer's sessionId names the session that stopped");
      expect(text, label).toContain('logMessage');
      expect(text, label).toContain('Java, .NET and Ruby refuse logpoints');
      expect(text, label).toContain('close_debug_session, even after a failure: a launched program is ended, an attached one released');
    }
  });

  describe('the rules an operator setting adds', () => {
    const idle = 'This server closes a debug session tree that no tool call has named for';
    const explicit = 'least-privilege variable access mode (DEBUG_MCP_VARIABLE_ACCESS=explicit)';
    const noSnapshot = 'Stop snapshots are off on this server (DEBUG_MCP_NO_SNAPSHOT)';

    it('are present when their setting is on, and come before the general rules', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        const launchAt = text.indexOf('Launch: ');
        const present: Array<[string, boolean]> = [
          [idle, opts.idleWindow !== undefined],
          [explicit, opts.variableAccessMode === 'explicit'],
          [noSnapshot, opts.snapshotEnabled === false]
        ];
        for (const [rule, on] of present) {
          if (on) {
            expect(text.indexOf(rule), `${label}: ${rule}`).toBeGreaterThan(0);
            expect(text.indexOf(rule), `${label}: ${rule}`).toBeLessThan(launchAt);
          } else {
            expect(text, `${label}: ${rule}`).not.toContain(rule);
          }
        }
      }
    });

    it('the idle rule names the window, what the close does to the program, and expiresInMs', () => {
      const text = buildServerInstructions(undefined, { idleWindow: '5 min' });
      expect(text).toContain(`${idle} 5 min`);
      expect(text).toContain('a launched program is ended, an attached one released');
      expect(text).toContain('expiresInMs');
      expect(buildServerInstructions(undefined, { idleWindow: LONGEST_IDLE_WINDOW })).toContain(LONGEST_IDLE_WINDOW);
    });

    it('the explicit rule says names are required and the snapshot carries no locals', () => {
      const text = buildServerInstructions(undefined, { variableAccessMode: 'explicit' });
      expect(text).toContain('require names: ["..."]');
      expect(text).toContain('stop snapshots carry no locals');
      // Nothing else in the text may promise the locals that mode withholds.
      expect(text).not.toContain("the top frame's locals");
      expect(text).not.toContain('changedVariables');
    });
  });

  it('say ABSOLUTE paths on a host and project-relative paths in a container', () => {
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      if (opts.containerMode) {
        expect(text, label).not.toContain('ABSOLUTE');
        expect(text, label).toContain('relative to the project root');
      } else {
        expect(text, label).toContain('file and scriptPath must be ABSOLUTE paths');
      }
    }
  });

  it('describe the snapshot only when it is on, and redaction only when that is on', () => {
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      expect(text.includes('carries snapshot:'), label).toBe(opts.snapshotEnabled !== false);
      if (opts.redactionEnabled === false || opts.snapshotEnabled === false || opts.variableAccessMode === 'explicit') {
        expect(text, label).not.toMatch(/redact/i);
      } else {
        expect(text, label).toContain('(redacted and capped)');
      }
    }
  });

  it('name content addressing only where the addressing mode serves it (issue #271)', () => {
    for (const { mode, opts, label } of ALL) {
      const text = buildServerInstructions(mode, opts);
      if (mode === 'line') {
        for (const token of ['expectedContent', 'statement', 'nearLine', 'function breakpoint']) {
          expect(text, `${label}: ${token}`).not.toContain(token);
        }
      } else if (mode === 'assert') {
        expect(text, label).toContain('expectedContent');
        for (const token of ['statement', 'nearLine', 'function breakpoint']) {
          expect(text, `${label}: ${token}`).not.toContain(token);
        }
      } else {
        expect(text, label).toContain('statement: "<text of the line>"');
        expect(text, label).toContain('function breakpoint');
      }
    }
  });
});
