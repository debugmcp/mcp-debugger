/**
 * The server's MCP `instructions` must fit in what the model is shown (issue #1331).
 *
 * The bound is another product's limit: Claude Code puts the first 4,096
 * characters of a server's instructions in front of the model and drops the
 * rest, and lists the tools by name only until the agent searches for one.
 * Measured on 2026-11-28 in the first model request of 20 agent trials
 * against the published 0.27.0 (issue #1331); other clients were not measured.
 * So the whole text, the closing pointer included, has to fit for every
 * value the builder's options admit, and the rules an operator's setting add
 * come before the general ones. The rules that moved into the tool
 * descriptions are checked at the end: each long one is stated once.
 */
import { describe, it, expect } from 'vitest';
import {
  buildServerInstructions,
  SERVER_INSTRUCTIONS_LIMIT,
  type ServerInstructionsOptions
} from '../../../../src/skill-content.js';
import { buildToolDefinitions } from '../../../../src/server/tool-schemas.js';
import { describeIdleWindow } from '../../../../src/session/idle-policy.js';
import { isSnapshotEnabled } from '../../../../src/utils/snapshot-mode.js';
import type { BpAddressingMode } from '../../../../src/utils/bp-addressing.js';

const MODES: readonly BpAddressingMode[] = ['line', 'assert', 'content'];

/**
 * The idle rule quotes the window, which the builder words itself from the
 * ms it is given (describeIdleWindow), so the bound has to hold for every
 * number. describeIdleWindow prints a count of minutes or seconds, and the
 * longest a JS number prints as is 23 characters ("1.7976931348623157e+308";
 * any integer below 1e21 prints in 21 digits at most), so no window is
 * longer than 23 characters plus " min". LONGEST_IDLE_MS reaches that: it is
 * a multiple of 60 000 whose minute count, 3.2610773233404387e+284, prints in
 * 23 characters. The bound is checked with it.
 */
const LONGEST_WINDOW_LENGTH = 23 + ' min'.length;
const LONGEST_IDLE_MS = 1.956646394004263e+289;
const IDLE_MS: ReadonlyArray<number | undefined> = [
  undefined,
  5 * 60_000,
  90_500,
  Number.MAX_VALUE,
  LONGEST_IDLE_MS
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
            for (const idleMs of IDLE_MS) {
              const opts: ServerInstructionsOptions = {
                redactionEnabled,
                variableAccessMode,
                snapshotEnabled,
                containerMode,
                ...(idleMs !== undefined ? { idleMs } : {})
              };
              yield {
                mode,
                opts,
                label: `${mode} redaction=${redactionEnabled} access=${variableAccessMode} snapshot=${snapshotEnabled} container=${containerMode} idleMs=${idleMs ?? 'off'}`
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
  it('no number words an idle window longer than the one the bound is checked with', () => {
    expect(describeIdleWindow(LONGEST_IDLE_MS)).toBe('3.2610773233404387e+284 min');
    expect(describeIdleWindow(LONGEST_IDLE_MS)).toHaveLength(LONGEST_WINDOW_LENGTH);
    for (const ms of [
      Number.MIN_VALUE, 0.5, 1, 999, 59_999, 60_000, 90_500, Number.MAX_SAFE_INTEGER, 1e21 - 1, 1e21,
      Number.MAX_VALUE, Number.POSITIVE_INFINITY
    ]) {
      expect(describeIdleWindow(ms).length, String(ms)).toBeLessThanOrEqual(LONGEST_WINDOW_LENGTH);
    }
  });

  it('state the idle rule only for a window above 0, for any number the option admits', () => {
    const rule = 'This server closes a debug session tree';
    for (const idleMs of [0, -1, -0, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(buildServerInstructions(undefined, { idleMs }), String(idleMs)).not.toContain(rule);
    }
    for (const idleMs of [Number.MIN_VALUE, 1, 300_000, Number.POSITIVE_INFINITY, LONGEST_IDLE_MS]) {
      const text = buildServerInstructions('content', { variableAccessMode: 'explicit', containerMode: true, idleMs });
      expect(text, String(idleMs)).toContain(rule);
      expect(text.length, String(idleMs)).toBeLessThanOrEqual(SERVER_INSTRUCTIONS_LIMIT);
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
      // A port check from the shell wedges a debugpy listener for the target's
      // life (issue #1305, microsoft/debugpy#1308): agents make one before
      // their first debugger call, so the warning has to be here.
      expect(text, label).toContain('Never test a debugpy port with a bare connection (nc, /dev/tcp): it stops answering for good; attach instead.');
      expect(text, label).toContain('continue_execution returns at once; wait_for_stop blocks');
      expect(text, label).toContain('nothing was cancelled');
      expect(text, label).toContain("its answer's sessionId names the session that stopped");
      expect(text, label).toContain('logMessage');
      expect(text, label).toContain('Java, .NET and Ruby refuse logpoints');
      expect(text, label).toContain('close_debug_session, even after a failure: it requests the end of a launched program, or a detach that leaves an attached one running');
    }
  });

  describe('the rules an operator setting adds', () => {
    const idle = 'This server closes a debug session tree that no tool call has named for';
    const explicit = 'least-privilege (DEBUG_MCP_VARIABLE_ACCESS=explicit)';
    const noSnapshot = 'Stop snapshots are off on this server (DEBUG_MCP_NO_SNAPSHOT)';

    it('are present when their setting is on, and come before the general rules', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        const launchAt = text.indexOf('Launch: ');
        const present: Array<[string, boolean]> = [
          [idle, opts.idleMs !== undefined],
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

    // The sweep closes a tree with the close_debug_session call, so the rule
    // points there for what that does to the program (round-2 review finding
    // 1); only the HTTP transport tells the sweep that a client holds a
    // notification stream open (finding 3: over stdio an open stream holds
    // nothing).
    it('the idle rule names the window, the HTTP-only exemption, the close it does, and expiresInMs', () => {
      const text = buildServerInstructions(undefined, { idleMs: 5 * 60_000 });
      expect(text).toContain(`${idle} 5 min`);
      expect(text).toContain('not while an HTTP client holds a notification stream open');
      expect(text).toContain('as close_debug_session does');
      expect(text).not.toContain('a launched program is ended');
      expect(text).toContain('expiresInMs');
      expect(buildServerInstructions(undefined, { idleMs: LONGEST_IDLE_MS })).toContain(describeIdleWindow(LONGEST_IDLE_MS));
    });

    it('the explicit rule says names are required and the snapshot carries no locals', () => {
      const text = buildServerInstructions(undefined, { variableAccessMode: 'explicit' });
      expect(text).toContain('require names: ["..."]');
      expect(text).toContain('stop snapshots carry no locals');
      // Nothing else in the text may promise the locals that mode withholds.
      expect(text).not.toContain('the locals of');
      expect(text).not.toContain('changedVariables');
    });

    // A stop with no frame has no location (stop-location.ts): the rule
    // promises none (finding 4).
    it('the no-snapshot rule promises no location', () => {
      const text = buildServerInstructions(undefined, { snapshotEnabled: false });
      expect(text).toContain(noSnapshot);
      expect(text).not.toMatch(/location/);
    });
  });

  // Round 2 of the review: each of these sentences promised an outcome the
  // runtime does not guarantee. Each now says what is requested, or may
  // happen, and where the answer says what did.
  describe('say what is requested, not an outcome the runtime does not guarantee', () => {
    it('closing a session requests the end or the detach, and a live attach answer says which happened (finding 1)', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        expect(text, label).not.toContain('released and left running');
        expect(text, label).toContain("for a live attach, the answer's released, processEnded or warning says which happened");
      }
    });

    it('attaching requests a pause, unless stopOnEntry is false or the target has not answered its breakpoints (finding 2)', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        expect(text, label).not.toContain('Attaching pauses the target');
        expect(text, label).toContain(
          "Attaching requests a pause unless stopOnEntry is false or the target has not answered its breakpoints; the answer's state and warning say if it paused."
        );
      }
    });

    it('the snapshot, its locals, the exception fields and the diff are what an answer may carry (finding 4)', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        if (opts.snapshotEnabled === false) continue;
        expect(text, label).toContain('An answer that reports a stop (not an entry stop) may carry snapshot:');
        expect(text, label).toContain("An exception's type and message are in the answer when the debugger reports them.");
        expect(text, label).not.toMatch(/\bcarries snapshot\b/);
        if (opts.variableAccessMode !== 'explicit') {
          expect(text, label).toContain('when they can be read, the locals of the first of them that has any');
          expect(text, label).toContain('A later stop in the same frame may carry changedVariables');
        }
      }
    });

    it('an attach applies no default exception filter, which is not a promise that it never stops at one (finding 6)', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        expect(text, label).toContain('an attach applies no default.');
        expect(text, label).not.toContain('an attach does not');
      }
    });

    it('a Java breakpoint may name a class instead of a path, on a host and in a container (finding 7)', () => {
      for (const { mode, opts, label } of ALL) {
        expect(buildServerInstructions(mode, opts), label).toContain('(for Java, file may be a class name)');
      }
    });

    // Issue #1333: with the pytest preset a passing test can pause at an
    // exception it expects, where the exception leaves one of the program's
    // frames into generated or library code (a dataclass's __post_init__
    // inside pytest.raises).
    it('a passing pytest test is not promised to run to completion (issue #1333)', () => {
      for (const { mode, opts, label } of ALL) {
        const text = buildServerInstructions(mode, opts);
        expect(text, label).not.toContain('runs to completion');
        expect(text, label).not.toContain('exit code 0');
        expect(text, label).toContain(
          'It can also pause at an exception handled after all (a raise in a dataclass\'s __post_init__ inside pytest.raises): continue_execution goes on; breakOnExceptions: "none" turns exception stops off.'
        );
      }
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
      expect(text.includes('may carry snapshot:'), label).toBe(opts.snapshotEnabled !== false);
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

describe('the rules that moved into the tool descriptions (issue #1331)', () => {
  const toolsFor = (variableAccess: 'open' | 'explicit'): ReturnType<typeof buildToolDefinitions> =>
    buildToolDefinitions({
      supportedLanguages: ['python'],
      environment: { get: (key: string) => (key === 'DEBUG_MCP_VARIABLE_ACCESS' ? variableAccess : undefined) } as never
    });
  const descriptionOf = (tools: ReturnType<typeof buildToolDefinitions>, name: string): string =>
    tools.find((tool) => tool.name === name)?.description ?? '';
  const STOP_TOOLS = ['step_over', 'step_into', 'step_out', 'pause_execution'];

  it('state the snapshot rule once, in wait_for_stop, as what an answer may carry', () => {
    const tools = toolsFor('open');
    const wait = descriptionOf(tools, 'wait_for_stop');
    expect(wait).toContain('When snapshots are on (the default; DEBUG_MCP_NO_SNAPSHOT=1 or true turns them off), an answer at a stop other than an entry stop may carry snapshot:');
    expect(wait).toContain('up to 3 top frames and, when they can be read, the capped locals of the first of them that has any');
    expect(wait).toContain('A later stop in the same frame may carry changedVariables in place of locals');
    expect(wait).toContain("An exception's type and message are in lastStop when the debugger reports them.");
    const withShapes = tools.filter((tool) => (tool.description ?? '').includes('{before, gone: true}')).map((tool) => tool.name);
    expect(withShapes).toEqual(['wait_for_stop']);
    for (const name of STOP_TOOLS) {
      expect(descriptionOf(tools, name), name).toContain('Read any snapshot in the answer first (what it carries: see wait_for_stop');
    }
    for (const tool of tools) {
      expect(tool.description ?? '', tool.name).not.toContain('Unless the server runs with DEBUG_MCP_NO_SNAPSHOT=1');
      expect(tool.description ?? '', tool.name).not.toMatch(/\bcarries snapshot\b/);
    }
  });

  it('withhold the locals and the diff from the snapshot rule in least-privilege mode', () => {
    const wait = descriptionOf(toolsFor('explicit'), 'wait_for_stop');
    expect(wait).toContain('this server withholds the locals (least-privilege mode), and snapshot.note says so');
    expect(wait).not.toContain('changedVariables');
  });

  // The descriptions name 1 and true because both turn the snapshot off.
  it('name the values the snapshot switch accepts', () => {
    for (const value of ['1', 'true', ' TRUE ']) {
      expect(isSnapshotEnabled({ get: (key) => (key === 'DEBUG_MCP_NO_SNAPSHOT' ? value : undefined) }), value).toBe(false);
    }
  });

  it('say what a close or a detach requests, and where the answer says what became of the process (finding 1)', () => {
    const tools = toolsFor('open');
    const close = descriptionOf(tools, 'close_debug_session');
    expect(close).toContain('The debugger is asked to end a program the session launched, and to detach from a process it attached to and leave it running.');
    expect(close).toContain('While the session is still attached, the answer says what became of the process');
    expect(close).not.toContain('is released and keeps running');
    const detach = descriptionOf(tools, 'detach_from_process');
    expect(detach).toContain("asking the debugger to leave it running; the answer's released, processEnded or warning says what became of it");
    expect(detach).not.toContain(', leaving it running.');
  });

  it('say that attaching requests a pause, and where the answer says whether one was requested (finding 2)', () => {
    const tools = toolsFor('open');
    const create = tools.find((tool) => tool.name === 'create_debug_session');
    expect(create?.description).toContain("Attaching requests a pause by default (stopOnEntry, see attach_to_process); the answer's state and warning say whether one was requested and whether it landed");
    expect(create?.description).not.toContain('Attaching pauses the target');
    const attach = tools.find((tool) => tool.name === 'attach_to_process');
    const stopOnEntry = (attach?.inputSchema.properties as Record<string, { description?: string }>).stopOnEntry.description;
    expect(stopOnEntry).toContain('which is not sent when the target has not answered the breakpoint request');
  });

  // Issue #1333: the pytest preset's filters also pause at an exception that
  // is handled after all.
  it('do not promise that a passing pytest test runs to completion (issue #1333)', () => {
    const start = toolsFor('open').find((tool) => tool.name === 'start_debugging');
    const testRunner = (start?.inputSchema.properties as Record<string, { description?: string }>).testRunner.description ?? '';
    expect(testRunner).not.toContain('a passing test runs to completion');
    expect(testRunner).toContain("a raise in a dataclass's __post_init__, or an attrs post-init or validator, inside pytest.raises is the common case");
    expect(testRunner).toContain('at pytest.skip()');
    expect(testRunner).toContain('continue_execution goes on; breakOnExceptions: "none" turns off every exception stop');
  });
});
