/**
 * Issue #1277: `exitOutputTail` quotes the program's own last output lines
 * across streams (preserving cause lines at native fatal-error headers or the
 * head of long stderr traces, reclaiming Dart's explicit-category console
 * output while excluding category-less logpoints/lifecycle lines, and keeping
 * Python's end-of-trace frames), while `readOutputTailLines` keeps serving a
 * failed launch's all-category output quote.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  CobolAdapterPolicy,
  CppAdapterPolicy,
  DartAdapterPolicy,
  DebugLanguage,
  JavaAdapterPolicy,
  JsDebugAdapterPolicy,
  PythonAdapterPolicy,
  RustAdapterPolicy,
  getPolicyForLanguage
} from '@debugmcp/shared';
import {
  OUTPUT_TAIL_LINES,
  exitOutputTail,
  formatOutputTailGapMarker,
  readOutputTailLines
} from '../../../../../src/session/breakpoints/launch-warnings.js';
import { MAX_OUTPUT_ENTRY_CHARS, OutputRingBuffer } from '../../../../../src/session/output-buffer.js';

function bufferOf(
  ...entries: Array<{ category: string; output: string; categoryOmitted?: boolean }>
): OutputRingBuffer {
  const buf = new OutputRingBuffer();
  for (const entry of entries) {
    buf.push(
      entry.category,
      entry.output,
      undefined,
      entry.categoryOmitted ? { categoryOmitted: true } : undefined
    );
  }
  return buf;
}

describe('exitOutputTail and readOutputTailLines (issue #1277)', () => {
  describe('the issue #1277 cases and recorded Linux pty buffers', () => {
    it('JavaScript crash: keeps Error: uncaught on purpose above Node CJS loader frames and drops inspector banners', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: '/home/user/.nvm/versions/node/v22.22.3/bin/node ./crash.cjs\n' },
        { category: 'stderr', output: 'Debugger attached.\n' },
        {
          category: 'stderr',
          output:
            '/work/crash.cjs:2\n' +
            'throw new Error("uncaught on purpose");\n' +
            '^\n' +
            '\n' +
            'Error: uncaught on purpose\n' +
            '    at Object.<anonymous> (/work/crash.cjs:2:7)\n' +
            '    at Module._compile (node:internal/modules/cjs/loader:1781:14)\n' +
            '    at Object..js (node:internal/modules/cjs/loader:1914:10)\n' +
            '    at Module.load (node:internal/modules/cjs/loader:1481:32)\n' +
            '    at Function._load (node:internal/modules/cjs/loader:1300:12)\n' +
            '    at wrapModuleLoad (node:internal/modules/cjs/loader:245:19)\n' +
            '    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)\n' +
            '    at node:internal/main/run_main_module:36:49\n' +
            '\n' +
            'Node.js v22.22.3\n'
        },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\n' }
      );

      const tail = exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer });

      expect(tail).toEqual([
        '/work/crash.cjs:2',
        'throw new Error("uncaught on purpose");',
        '^',
        'Error: uncaught on purpose',
        '... (6 lines omitted)',
        'at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)',
        'at node:internal/main/run_main_module:36:49',
        'Node.js v22.22.3'
      ]);
    });

    it('JavaScript plain non-zero exit (exit_code_test.js): drops js-debug console and inspector stderr lines, keeping the stdout line', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: '/home/user/bin/node --experimental-network-inspection ./exit_code_test.js\n' },
        { category: 'stderr', output: 'Debugger attached.\r\n' },
        { category: 'stdout', output: 'exit_code_test: exiting with status 7\n' },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\r\n' }
      );

      expect(exitOutputTail({ exitCode: 7, language: DebugLanguage.JAVASCRIPT, outputBuffer })).toEqual([
        'exit_code_test: exiting with status 7'
      ]);
    });

    it('COBOL runtime error on Windows (separate stderr): keeps libcob subscript error above the storage dump', () => {
      const outputBuffer = bufferOf(
        { category: 'stdout', output: 'about to index 0005\n' },
        { category: 'stderr', output: "libcob: C:\\path\\to\\examples\\cobol\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5\n" },
        { category: 'stderr', output: "note: maximum subscript for 'WS-CELL': 3\n" },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: ' Last statement of "RTERROR" was ADD\n' },
        { category: 'stderr', output: '\t0000-MAIN at C:\\path\\to\\examples\\cobol\\rterror.cob:13\n' },
        { category: 'stderr', output: '\tENTRY RTERROR at C:\\path\\to\\examples\\cobol\\rterror.cob:10\n' },
        { category: 'stderr', output: ' Started by C:\\path\\to\\examples\\cobol\\rterror.exe\n' },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: 'Dump Program-Id RTERROR from C:\\path\\to\\examples\\cobol\\rterror.cob compiled Nov 27 2026 16:01:48\n' },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: 'WORKING-STORAGE\n' },
        { category: 'stderr', output: '**********************\n' },
        { category: 'stderr', output: '77        RETURN-CODE                     +000000000\n' },
        { category: 'stderr', output: '01        WS-TABLE.\n' },
        { category: 'stderr', output: '  05      WS-CELL (1)                     007\n' },
        { category: 'stderr', output: '  05      WS-CELL (2..3) same as (1)\n' },
        { category: 'stderr', output: '01        WS-IDX                          0005\n' },
        { category: 'stderr', output: '01        WS-SUM                          000000\n' },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: 'END OF DUMP - RTERROR\n' },
        { category: 'stderr', output: '**********************\n' },
        { category: 'stderr', output: '\n' },
        { category: 'console', output: 'Process exited with code 1.\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer })).toEqual([
        "libcob: C:\\path\\to\\examples\\cobol\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5",
        "note: maximum subscript for 'WS-CELL': 3",
        'Last statement of "RTERROR" was ADD',
        '0000-MAIN at C:\\path\\to\\examples\\cobol\\rterror.cob:13',
        '... (10 lines omitted)',
        '01        WS-SUM                          000000',
        'END OF DUMP - RTERROR',
        '**********************'
      ]);
    });

    it('COBOL runtime error on Windows with DISPLAY UPON SYSERR lines ahead of libcob: fatal line wins over stderr block start (N21)', () => {
      const outputBuffer = bufferOf(
        { category: 'stderr', output: 'syserr pre-check 1\n' },
        { category: 'stderr', output: 'syserr pre-check 2\n' },
        { category: 'stderr', output: 'syserr pre-check 3\n' },
        { category: 'stderr', output: 'syserr pre-check 4\n' },
        { category: 'stderr', output: 'syserr pre-check 5\n' },
        { category: 'stderr', output: "libcob: C:\\path\\to\\rterror.cob:18: error: subscript of 'WS-CELL' out of bounds: 5\n" },
        { category: 'stderr', output: "note: maximum subscript for 'WS-CELL': 3\n" },
        { category: 'stderr', output: ' Last statement of "RTERRORSYS" was ADD\n' },
        { category: 'stderr', output: '\t0000-MAIN at C:\\path\\to\\rterror.cob:18\n' },
        ...Array.from({ length: 10 }, (_, i) => ({ category: 'stderr', output: `dump body line ${i + 1}\n` })),
        { category: 'stderr', output: '01        WS-SUM                          000000\n' },
        { category: 'stderr', output: 'END OF DUMP - RTERRORSYS\n' },
        { category: 'stderr', output: '**********************\n' },
        { category: 'console', output: 'Process exited with code 1.\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer })).toEqual([
        "libcob: C:\\path\\to\\rterror.cob:18: error: subscript of 'WS-CELL' out of bounds: 5",
        "note: maximum subscript for 'WS-CELL': 3",
        'Last statement of "RTERRORSYS" was ADD',
        '0000-MAIN at C:\\path\\to\\rterror.cob:18',
        '... (10 lines omitted)',
        '01        WS-SUM                          000000',
        'END OF DUMP - RTERRORSYS',
        '**********************'
      ]);
    });

    it('COBOL runtime error on Linux (pty-merged stdout with CRLF and split CRLF chunks): recognises libcob fatal error', () => {
      const linuxCobolBuffer = bufferOf(
        {
          category: 'stdout',
          output:
            'about to index 0005\r\n' +
            "libcob: /work/examples/cobol/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5\r\n" +
            "note: maximum subscript for 'WS-CELL': 3\r"
        },
        {
          category: 'stdout',
          output:
            '\n\r\n' +
            ' Last statement of "RTERROR" was ADD\r\n' +
            '\t0000-MAIN at /work/examples/cobol/rterror.cob:13\r\n' +
            '\tENTRY RTERROR at /work/examples/cobol/rterror.cob:10\r\n' +
            ' Started by /work/examples/cobol/.debug-mcp/cobol/linux-x64/rterror/rterror\r\n' +
            '\r\n' +
            'Dump Program-Id RTERROR from /work/examples/cobol/rterror.cob compiled Nov 27 2026 16:01:48\r\n' +
            '\r\n' +
            'WORKING-STORAGE\r\n' +
            '**********************\r\n' +
            '77        RETURN-CODE                     +000000000\r\n' +
            '01        WS-TABLE.\r\n' +
            '  05      WS-CELL (1)                     007\r\n' +
            '  05      WS-CELL (2..3) same as (1)\r\n' +
            '01        WS-IDX                          0005\r\n' +
            '01        WS-SUM                          000000\r\n' +
            '\r\n' +
            'END OF DUMP - RTERROR\r\n' +
            '**********************\r\n'
        },
        { category: 'console', output: 'Process exited with code 1.\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: linuxCobolBuffer })).toEqual([
        "libcob: /work/examples/cobol/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5",
        "note: maximum subscript for 'WS-CELL': 3",
        'Last statement of "RTERROR" was ADD',
        '0000-MAIN at /work/examples/cobol/rterror.cob:13',
        '... (10 lines omitted)',
        '01        WS-SUM                          000000',
        'END OF DUMP - RTERROR',
        '**********************'
      ]);
    });

    it('C++ crash on Linux (pty-merged stdout chunks + CodeLLDB Stop reason: signal SIGABRT on stderr): keeps terminate header and drops Stop reason', () => {
      const linuxCppBuffer = bufferOf(
        { category: 'stdout', output: 'caught: caught error\r\n' },
        { category: 'stdout', output: "terminate called after throwing an instance of '" },
        { category: 'stdout', output: 'std::runtime_error' },
        { category: 'stdout', output: "'\r\n" },
        { category: 'stdout', output: '  what():  ' },
        { category: 'stdout', output: 'uncaught error\r\n' },
        { category: 'stderr', output: 'Stop reason: signal SIGABRT\n' },
        { category: 'console', output: 'Process exited with code 134.\n' }
      );

      expect(exitOutputTail({ exitCode: 134, language: DebugLanguage.CPP, outputBuffer: linuxCppBuffer })).toEqual([
        'caught: caught error',
        "terminate called after throwing an instance of 'std::runtime_error'",
        'what():  uncaught error'
      ]);
    });

    it('Rust panic on Linux (pty-merged stdout with RUST_BACKTRACE=1, exit 101): keeps thread panicked header above backtrace and drops Stop reason', () => {
      const linuxRustBuffer = bufferOf(
        {
          category: 'stdout',
          output:
            'panic_example: starting\r\n' +
            'panic_example: validating ticket 42 at pre-flight (3 attempts)\r\n' +
            "thread 'main' panicked at src/main.rs:18:5:\r\n" +
            'intentional panic for mcp-debugger tests (ticket 42)\r\n' +
            'stack backtrace:\r\n' +
            '   0: rust_begin_unwind\r\n' +
            '             at /rustc/hash/library/std/src/panicking.rs:665:5\r\n' +
            '   1: core::panicking::panic_fmt\r\n' +
            '             at /rustc/hash/library/core/src/panicking.rs:76:14\r\n' +
            '   2: panic_example::validate\r\n' +
            '             at ./src/main.rs:18:5\r\n' +
            '   3: panic_example::main\r\n' +
            '             at ./src/main.rs:10:19\r\n' +
            '   4: core::ops::function::FnOnce::call_once\r\n' +
            '             at /rustc/hash/library/core/src/ops/function.rs:250:5\r\n' +
            'note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.\r\n'
        },
        { category: 'stderr', output: 'Stop reason: signal SIGABRT\n' },
        { category: 'console', output: 'Process exited with code 101.\n' }
      );

      expect(exitOutputTail({ exitCode: 101, language: DebugLanguage.RUST, outputBuffer: linuxRustBuffer })).toEqual([
        "thread 'main' panicked at src/main.rs:18:5:",
        'intentional panic for mcp-debugger tests (ticket 42)',
        'stack backtrace:',
        '0: rust_begin_unwind',
        '... (7 lines omitted)',
        '4: core::ops::function::FnOnce::call_once',
        'at /rustc/hash/library/core/src/ops/function.rs:250:5',
        'note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.'
      ]);
    });

    it('Go debug launch (examples/go/exit_code): does not glue Delve newline-less Building stdout chunk across console onto program stdout', () => {
      const goDebugBuffer = bufferOf(
        { category: 'stdout', output: 'Building C:\\path\\to\\examples\\go\\exit_code' },
        { category: 'console', output: "Type 'dlv help' for list of commands.\n" },
        { category: 'stdout', output: 'exit_code fixture: exiting with status 7\n' },
        { category: 'console', output: 'Process 32200 has exited with status 7\n' },
        { category: 'console', output: 'Detaching\n' }
      );

      expect(exitOutputTail({ exitCode: 7, language: DebugLanguage.GO, outputBuffer: goDebugBuffer })).toEqual([
        'Building C:\\path\\to\\examples\\go\\exit_code',
        'exit_code fixture: exiting with status 7'
      ]);
    });
  });

  describe('Rule A selection cases and Dart explicit-category console handling', () => {
    it('keeps a stdout failure report that follows an unrelated stderr deprecation warning', () => {
      const jsWarnThenFail = bufferOf(
        { category: 'console', output: '/home/user/bin/node ./run-tests.cjs\n' },
        { category: 'stderr', output: 'Debugger attached.\r\n' },
        {
          category: 'stderr',
          output:
            '(node:24596) DeprecationWarning: legacy config flag used\n' +
            '(Use `node --trace-deprecation ...` to show where the warning was created)\n'
        },
        { category: 'stdout', output: 'FAIL suite/auth.spec.js: expected 200, got 401\n' },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\r\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: jsWarnThenFail })).toEqual([
        '(node:24596) DeprecationWarning: legacy config flag used',
        '(Use `node --trace-deprecation ...` to show where the warning was created)',
        'FAIL suite/auth.spec.js: expected 200, got 401'
      ]);
    });

    it('keeps both a multi-line stdout explanation and a trailing stderr summary line in arrival order', () => {
      const stdoutThenOneStderr = bufferOf(
        { category: 'stdout', output: 'Running migration 004_users.sql\n' },
        { category: 'stdout', output: 'Column "email_verified" already exists in table "users"\n' },
        { category: 'stdout', output: 'Rolling back transaction\n' },
        { category: 'stderr', output: 'migrate: failed with exit status 1\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.GO, outputBuffer: stdoutThenOneStderr })).toEqual([
        'Running migration 004_users.sql',
        'Column "email_verified" already exists in table "users"',
        'Rolling back transaction',
        'migrate: failed with exit status 1'
      ]);
    });

    it('keeps stdout last words after a long stderr block (known limit: trace head is not kept)', () => {
      const longStderrThenStdout = bufferOf(
        {
          category: 'stderr',
          output: Array.from({ length: 12 }, (_, i) =>
            i === 0 ? 'Error: request failed' : `  at frame_${i} (client.js:${i * 10})`
          ).join('\n') + '\n'
        },
        { category: 'stdout', output: '1 failed, 14 passed\nSummary: auth suite failed\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: longStderrThenStdout })).toEqual([
        'at frame_6 (client.js:60)',
        'at frame_7 (client.js:70)',
        'at frame_8 (client.js:80)',
        'at frame_9 (client.js:90)',
        'at frame_10 (client.js:100)',
        'at frame_11 (client.js:110)',
        '1 failed, 14 passed',
        'Summary: auth suite failed'
      ]);
    });

    it('Dart: excludes category-less logpoints shaped like [loop] ..., keeps multi-line developer.log continuations and dart test results, and never leaks categoryOmitted', () => {
      const dartBuffer = bufferOf(
        { category: 'console', categoryOmitted: true, output: '[mcp-debugger] Warning: runner: dart\n' },
        { category: 'console', categoryOmitted: true, output: 'Connecting to VM Service at ws://127.0.0.1:56871/tok=/ws\n' },
        { category: 'console', categoryOmitted: true, output: 'Connected to the VM Service.' },
        { category: 'stdout', output: 'loading settings\r\n' },
        // Logpoint with bracketed text — omitted category in DAP, so excluded.
        { category: 'console', categoryOmitted: true, output: '[loop] i=1 total=0\n' },
        { category: 'console', categoryOmitted: true, output: '! logpoint starting with bang\n' },
        // Multi-line developer.log record — explicit category: 'console', indented continuation lines have no [name] prefix.
        {
          category: 'console',
          output: '[config] settings file is missing required keys:\n  - db.url\n  - db.password\n'
        },
        { category: 'important', output: '[config] non-console category is ignored\n' },
        { category: 'console', categoryOmitted: true, output: '\nExited (2).\n' }
      );

      expect(exitOutputTail({ exitCode: 2, language: DebugLanguage.DART, outputBuffer: dartBuffer })).toEqual([
        'loading settings',
        '[config] settings file is missing required keys:',
        '- db.url',
        '- db.password'
      ]);

      // Verify internal `categoryOmitted` never appears on push() or read().entries (`get_output`).
      const ring = new OutputRingBuffer();
      const pushedOmitted = ring.push('console', '[loop] i=1\n', 1234, { categoryOmitted: true });
      const pushedExplicit = ring.push('console', '✓ adds numbers\n', 1235);
      expect('categoryOmitted' in pushedOmitted).toBe(false);
      expect('categoryOmitted' in pushedExplicit).toBe(false);
      expect(Object.keys(pushedOmitted).sort()).toEqual(['category', 'output', 'seq', 'timestamp']);
      const page = ring.read(0, 10).entries;
      expect(page).toHaveLength(2);
      expect('categoryOmitted' in page[0]).toBe(false);
      expect('categoryOmitted' in page[1]).toBe(false);
      expect(JSON.stringify(page)).not.toContain('categoryOmitted');

      // Also verify omitted console followed immediately by explicit console never merges into one run.
      const adjacentConsoleOrigins = bufferOf(
        { category: 'console', categoryOmitted: true, output: 'omitted without newline' },
        { category: 'console', output: '[log] explicit line\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.DART, outputBuffer: adjacentConsoleOrigins })).toEqual([
        '[log] explicit line'
      ]);
    });

    it('Dart: a reclaimed explicit console line interrupts a stderr block (kills N08 and N18)', () => {
      // 5 stderr lines, then 1 reclaimed console line, then 8 stderr lines:
      // trailing stderr block is 8 lines (not > 8), so plain last 8 lines are returned without a gap marker.
      const interruptedStderr = bufferOf(
        ...Array.from({ length: 5 }, (_, i) => ({ category: 'stderr', output: `early_err_${i + 1}\n` })),
        { category: 'console', output: '[log] checkpoint between stderr batches\n' },
        ...Array.from({ length: 8 }, (_, i) => ({ category: 'stderr', output: `late_err_${i + 1}\n` }))
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.DART, outputBuffer: interruptedStderr })).toEqual([
        'late_err_1',
        'late_err_2',
        'late_err_3',
        'late_err_4',
        'late_err_5',
        'late_err_6',
        'late_err_7',
        'late_err_8'
      ]);

      // 10 stderr lines followed by a trailing explicit console line (`✖ fails on purpose`):
      // last 8 lines end with `console`, so plain last 8 lines are returned without a gap marker.
      const stderrThenTestFailConsole = bufferOf(
        ...Array.from({ length: 10 }, (_, i) => ({ category: 'stderr', output: `frame_${i + 1}\n` })),
        { category: 'console', output: '✖ fails on purpose\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.DART, outputBuffer: stderrThenTestFailConsole })).toEqual([
        'frame_4',
        'frame_5',
        'frame_6',
        'frame_7',
        'frame_8',
        'frame_9',
        'frame_10',
        '✖ fails on purpose'
      ]);
    });

    it('keeps the user File and line on a Python 3.11+ crash with caret lines (causeLast: true)', () => {
      const pythonCaretCrash = bufferOf({
        category: 'stderr',
        output:
          'Traceback (most recent call last):\n' +
          '  File "/usr/lib/python3.13/runpy.py", line 198, in _run_module_as_main\n' +
          '    return _run_code(code, main_globals, None,\n' +
          '                     "__main__", mod_spec)\n' +
          '  File "/usr/lib/python3.13/runpy.py", line 88, in _run_code\n' +
          '    exec(code, run_globals)\n' +
          '    ~~~~^^^^^^^^^^^^^^^^^^^\n' +
          '  File "/venv/lib/debugpy/__main__.py", line 71, in <module>\n' +
          '    cli.main()\n' +
          '    ~~~~~~~~^^\n' +
          '  File "/venv/lib/debugpy/server/cli.py", line 361, in run_file\n' +
          '    runpy.run_path(target, run_name="__main__")\n' +
          '    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n' +
          '  File "/venv/lib/pydevd_runpy.py", line 118, in _run_code\n' +
          '    exec(code, run_globals)\n' +
          '    ~~~~^^^^^^^^^^^^^^^^^^^\n' +
          '  File "/work/app/ratios.py", line 5, in <module>\n' +
          '    compute_ratio(41, 0)\n' +
          '    ~~~~~~~~~~~~~^^^^^^^\n' +
          '  File "/work/app/ratios.py", line 2, in compute_ratio\n' +
          '    return numerator / denominator\n' +
          '           ~~~~~~~~~~^~~~~~~~~~~~~\n' +
          'ZeroDivisionError: division by zero\n'
      });

      const tail = exitOutputTail({ exitCode: 1, language: DebugLanguage.PYTHON, outputBuffer: pythonCaretCrash });

      expect(tail).toEqual([
        '~~~~^^^^^^^^^^^^^^^^^^^',
        'File "/work/app/ratios.py", line 5, in <module>',
        'compute_ratio(41, 0)',
        '~~~~~~~~~~~~~^^^^^^^',
        'File "/work/app/ratios.py", line 2, in compute_ratio',
        'return numerator / denominator',
        '~~~~~~~~~~^~~~~~~~~~~~~',
        'ZeroDivisionError: division by zero'
      ]);
    });

    it('keeps a program line that is literally "..." distinct from the counted gap marker', () => {
      const literalDots = bufferOf({ category: 'stdout', output: 'waiting\n...\nfailed to connect\n' });

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: literalDots })).toEqual([
        'waiting',
        '...',
        'failed to connect'
      ]);
      expect(formatOutputTailGapMarker(14)).toBe('... (14 lines omitted)');
    });
  });

  describe('consecutive chunk joining, truncated entries, and boundary conditions', () => {
    it('joins consecutive chunks of the same category, while keeping chunks separated by a console entry as two lines', () => {
      const consecutiveChunks = bufferOf(
        { category: 'stderr', output: 'FatalError: connection to ' },
        { category: 'stderr', output: 'database refused on 127.0.0.1:5432\n' },
        ...Array.from({ length: 7 }, (_, i) => ({ category: 'stderr', output: `  at frame_${i + 1} (app.js:${i + 10})\n` }))
      );

      // 1 joined line + 7 frames = 8 stderr lines verbatim.
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: consecutiveChunks })).toEqual([
        'FatalError: connection to database refused on 127.0.0.1:5432',
        'at frame_1 (app.js:10)',
        'at frame_2 (app.js:11)',
        'at frame_3 (app.js:12)',
        'at frame_4 (app.js:13)',
        'at frame_5 (app.js:14)',
        'at frame_6 (app.js:15)',
        'at frame_7 (app.js:16)'
      ]);

      // Documented limit: a console entry between two chunks ends the first run.
      const separatedByConsole = bufferOf(
        { category: 'stderr', output: 'FatalError: connection to' },
        { category: 'console', output: 'logpoint probe=1\n' },
        { category: 'stderr', output: 'database refused\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: separatedByConsole })).toEqual([
        'FatalError: connection to',
        'database refused'
      ]);
    });

    it('ends the line after a ring-buffer-truncated entry (8,192 chars) while still joining non-truncated chunks after it', () => {
      const buf = new OutputRingBuffer();
      buf.push('stderr', 'prefix: ');
      const pushed = buf.push('stderr', 'X'.repeat(MAX_OUTPUT_ENTRY_CHARS + 50));
      expect(pushed.truncated).toBe(true);
      buf.push('stderr', 'actual cause ');
      buf.push('stderr', 'on next entry\n');

      const expectedTruncatedLine = `${'prefix: '}${'X'.repeat(300 - 'prefix: '.length)}…`;
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.GO, outputBuffer: buf })).toEqual([
        expectedTruncatedLine,
        'actual cause on next entry'
      ]);
      expect(readOutputTailLines(buf)).toEqual([
        expectedTruncatedLine,
        'actual cause on next entry'
      ]);
    });

    it('bounds lines strictly above 300 characters: 300 stays whole, 301 gets a single ellipsis', () => {
      const exact300 = 'a'.repeat(300);
      const over301 = 'b'.repeat(301);
      const outputBuffer = bufferOf(
        { category: 'stdout', output: `${exact300}\n` },
        { category: 'stdout', output: `${over301}\n` }
      );

      const tail = exitOutputTail({ exitCode: 1, language: DebugLanguage.GO, outputBuffer });
      expect(tail).toEqual([exact300, `${'b'.repeat(300)}…`]);
      expect(tail?.[0]).toHaveLength(300);
      expect(tail?.[1]).toHaveLength(301);
    });

    it('does not let blank stdout runs or adapter-banner stdout runs split a contiguous stderr block', () => {
      const outputBuffer = bufferOf(
        { category: 'stderr', output: 'Exception in thread "main" java.lang.IllegalStateException: bad config\n' },
        { category: 'stderr', output: '\tat com.acme.App.load(App.java:14)\n' },
        { category: 'stdout', output: 'Listening for transport dt_socket at address: 5005\n' },
        { category: 'stdout', output: '   \r\n\t\n' },
        { category: 'console', output: '[mcp-debugger] notice\n' },
        {
          category: 'stderr',
          output: Array.from({ length: 8 }, (_, i) => `\tat com.acme.Runner.step${i + 1}(Runner.java:${20 + i})`).join('\n') + '\n'
        }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVA, outputBuffer })).toEqual([
        'Exception in thread "main" java.lang.IllegalStateException: bad config',
        'at com.acme.App.load(App.java:14)',
        'at com.acme.Runner.step1(Runner.java:20)',
        'at com.acme.Runner.step2(Runner.java:21)',
        '... (3 lines omitted)',
        'at com.acme.Runner.step6(Runner.java:25)',
        'at com.acme.Runner.step7(Runner.java:26)',
        'at com.acme.Runner.step8(Runner.java:27)'
      ]);
    });

    it('pins the exact 8-line vs 9-line stderr block boundary after an earlier stdout line', () => {
      const eightStderrAfterStdout = bufferOf(
        { category: 'stdout', output: 'booting service\n' },
        ...Array.from({ length: 8 }, (_, i) => ({ category: 'stderr', output: `err_${i + 1}\n` }))
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: eightStderrAfterStdout })).toEqual([
        'err_1',
        'err_2',
        'err_3',
        'err_4',
        'err_5',
        'err_6',
        'err_7',
        'err_8'
      ]);

      const nineStderrAfterStdout = bufferOf(
        { category: 'stdout', output: 'booting service\n' },
        ...Array.from({ length: 9 }, (_, i) => ({ category: 'stderr', output: `err_${i + 1}\n` }))
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: nineStderrAfterStdout })).toEqual([
        'err_1',
        'err_2',
        'err_3',
        'err_4',
        '... (2 lines omitted)',
        'err_7',
        'err_8',
        'err_9'
      ]);
    });

    it('returns undefined when exitCode is 0, unreported, or only banners/console were captured, and works without language', () => {
      const nonEmpty = bufferOf({ category: 'stderr', output: 'boom\n' });
      expect(exitOutputTail({ exitCode: 0, language: DebugLanguage.GO, outputBuffer: nonEmpty })).toBeUndefined();
      expect(exitOutputTail({ exitCode: undefined, language: DebugLanguage.GO, outputBuffer: nonEmpty })).toBeUndefined();
      expect(exitOutputTail({ exitCode: 1 })).toBeUndefined();
      expect(exitOutputTail({ exitCode: 1, outputBuffer: nonEmpty })).toEqual(['boom']);

      const jsBannersOnly = bufferOf(
        { category: 'console', output: '/home/user/bin/node ./silent_exit.js\n' },
        { category: 'stderr', output: 'Debugger attached.\r\n' },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\r\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: jsBannersOnly })).toBeUndefined();

      const javaBannerOnly = bufferOf(
        { category: 'stdout', output: 'Listening for transport dt_socket at address: 57378\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVA, outputBuffer: javaBannerOnly })).toBeUndefined();

      const lldbStopReasonOnly = bufferOf(
        { category: 'stderr', output: 'Stop reason: signal SIGABRT\n' },
        { category: 'console', output: 'Process exited with code 134.\n' }
      );
      expect(exitOutputTail({ exitCode: 134, language: DebugLanguage.CPP, outputBuffer: lldbStopReasonOnly })).toBeUndefined();
    });

    it('readOutputTailLines still quotes console and cross-category lines for failed launches without gluing categories', () => {
      const launchFailureBuffer = bufferOf(
        { category: 'stdout', output: 'Building /proj/exit_code' },
        { category: 'stderr', output: 'Build Error: go build ' },
        { category: 'stderr', output: 'cannot find package\n' },
        { category: 'console', output: 'adapter diagnostic on console\n' }
      );

      expect(readOutputTailLines(launchFailureBuffer)).toEqual([
        'Building /proj/exit_code',
        'Build Error: go build cannot find package',
        'adapter diagnostic on console'
      ]);
      expect(readOutputTailLines(undefined)).toBeUndefined();
      expect(readOutputTailLines(new OutputRingBuffer())).toBeUndefined();
    });
  });

  describe('policy programOutput patterns, anchors, fatal-error recognisers, and error safety', () => {
    it('pins every JavaScript stderr banner pattern and both start and end anchors', () => {
      const isJsAdapter = JsDebugAdapterPolicy.programOutput.isAdapterLine!;

      const validStderrBanners = [
        'Debugger attached.',
        'Waiting for the debugger to disconnect...',
        'Debugger listening on ws://127.0.0.1:9229/0f1e2d3c-4b5a',
        'Debugger ending on ws://127.0.0.1:9229/0f1e2d3c-4b5a',
        'For help, see: https://nodejs.org/en/docs/inspector',
        'Syntax error setting breakpoint with condition "a >=" on line 6: Unexpected token \';\'',
        'Syntax error setting breakpoint with condition {0} on line 7: Invalid or unexpected token',
        'Syntax error setting breakpoint with condition "x on line 2: y" on line 12: Unexpected end of input'
      ];
      for (const line of validStderrBanners) {
        expect(isJsAdapter('stderr', line), line).toBe(true);
        expect(isJsAdapter('stdout', line), `stdout: ${line}`).toBe(false);
        expect(isJsAdapter('stderr', `prefix ${line}`), `prefix: ${line}`).toBe(false);
        expect(isJsAdapter('stderr', `${line} trailing`), `trailing: ${line}`).toBe(line.startsWith('Syntax error '));
      }

      expect(isJsAdapter('stderr', 'Debugger attached. Connection lost')).toBe(false);
      expect(isJsAdapter('stderr', 'Waiting for the debugger to disconnect... timed out')).toBe(false);
      expect(isJsAdapter('stderr', 'Debugger listening on ws://127.0.0.1:9229/id extra')).toBe(false);
      expect(isJsAdapter('stderr', 'Debugger paused on ws://127.0.0.1:9229/id')).toBe(false);
      expect(isJsAdapter('stderr', 'For help, see: https://nodejs.org/en/docs/inspector/extra')).toBe(false);
      expect(isJsAdapter('stderr', 'Syntax error setting breakpoint with condition  on line 6: Unexpected token')).toBe(false);
      expect(isJsAdapter('stderr', 'Syntax error setting breakpoint with condition "x": Unexpected token')).toBe(false);
      expect(isJsAdapter('stderr', 'Syntax error setting breakpoint with condition "x" on line 6: ')).toBe(false);
      expect(isJsAdapter('stderr', 'Syntax error setting breakpoint with condition "x" on line 6:')).toBe(false);
      expect(isJsAdapter('stderr', 'Syntax error setting breakpoint with condition "x" on line six: bad')).toBe(false);
    });

    it('pins Java stdout JDWP banner and CodeLLDB stderr Stop reason banner with both anchors', () => {
      const isJavaAdapter = JavaAdapterPolicy.programOutput.isAdapterLine!;
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 5005')).toBe(true);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 127.0.0.1:5005')).toBe(true);
      expect(isJavaAdapter('stderr', 'Listening for transport dt_socket at address: 5005')).toBe(false);
      expect(isJavaAdapter('stdout', 'INFO: Listening for transport dt_socket at address: 5005')).toBe(false);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 5005 ready')).toBe(false);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address:')).toBe(false);

      for (const policy of [CobolAdapterPolicy, CppAdapterPolicy, RustAdapterPolicy]) {
        const isLldbAdapter = policy.programOutput.isAdapterLine!;
        expect(isLldbAdapter('stderr', 'Stop reason: signal SIGABRT')).toBe(true);
        expect(isLldbAdapter('stderr', 'Stop reason: Exception 0xc0000005')).toBe(true);
        expect(isLldbAdapter('stdout', 'Stop reason: signal SIGABRT')).toBe(false);
        expect(isLldbAdapter('stderr', 'prefix Stop reason: signal SIGABRT')).toBe(false);
        expect(isLldbAdapter('stderr', 'Stop reason:')).toBe(false);
        expect(isLldbAdapter('stderr', 'Stop reason: ')).toBe(false);
      }

      expect(DartAdapterPolicy.programOutput.explicitConsoleIsProgram).toBe(true);
      expect(PythonAdapterPolicy.programOutput.causeLast).toBe(true);
    });

    it('pins COBOL, C++, and Rust fatal-error recognisers and fatal-vs-stderr-block boundaries', () => {
      const isCobolFatal = CobolAdapterPolicy.programOutput.isFatalErrorLine!;
      expect(isCobolFatal("libcob: /work/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5")).toBe(true);
      expect(isCobolFatal("libcob: C:\\path\\to\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5")).toBe(true);
      expect(isCobolFatal("libcob: error: module 'MISSING' not found")).toBe(true);
      expect(isCobolFatal('libcob: error: ')).toBe(false);
      expect(isCobolFatal('libcob: /work/rterror.cob:13: error: ')).toBe(false);
      expect(isCobolFatal('libcob: : error: missing file')).toBe(false);
      expect(isCobolFatal('libcob: /work/rterror.cob:13: warning: numericelen')).toBe(false);
      expect(isCobolFatal("note: maximum subscript for 'WS-CELL': 3")).toBe(false);
      expect(isCobolFatal("prefix libcob: error: module 'MISSING' not found")).toBe(false);

      const isCppFatal = CppAdapterPolicy.programOutput.isFatalErrorLine!;
      expect(isCppFatal("terminate called after throwing an instance of 'std::runtime_error'")).toBe(true);
      expect(isCppFatal("terminate called after throwing an instance of 'std::runtime_error'  what():  uncaught error")).toBe(true);
      expect(isCppFatal('terminate called after throwing a foreign exception')).toBe(true);
      expect(isCppFatal('terminate called without an active exception')).toBe(true);
      expect(isCppFatal('terminate called recursively')).toBe(true);
      expect(isCppFatal("terminate called after throwing an instance of ''")).toBe(false);
      expect(isCppFatal('prefix terminate called without an active exception')).toBe(false);
      expect(isCppFatal('terminate called without an active exception trailing')).toBe(false);
      expect(isCppFatal('terminate called my cleanup handler')).toBe(false);

      const isRustFatal = RustAdapterPolicy.programOutput.isFatalErrorLine!;
      expect(isRustFatal("thread 'main' panicked at src/main.rs:18:5:")).toBe(true);
      expect(isRustFatal("thread 'main' panicked at 'intentional panic', src/main.rs:18:5")).toBe(true);
      expect(isRustFatal("thread '' panicked at src/lib.rs:1:1:")).toBe(true);
      expect(isRustFatal("thread 'worker-1' has overflowed its stack")).toBe(true);
      expect(isRustFatal('fatal runtime error: stack overflow')).toBe(false);
      expect(isRustFatal("prefix thread 'main' panicked at src/main.rs:18:5:")).toBe(false);
      expect(isRustFatal("thread 'main' has overflowed its stack extra")).toBe(false);
      expect(isRustFatal("thread 'main' exited normally")).toBe(false);

      // Rust stack overflow: `fatal runtime error: stack overflow` follows `has overflowed its stack`
      // and must NOT steal the anchor away from `thread 'main' has overflowed its stack`.
      const rustStackOverflow = bufferOf(
        { category: 'stdout', output: "thread 'main' has overflowed its stack\r\n" },
        { category: 'stdout', output: 'fatal runtime error: stack overflow, aborting\r\n' },
        ...Array.from({ length: 9 }, (_, i) => ({ category: 'stdout', output: `frame ${i + 1}\r\n` }))
      );
      expect(exitOutputTail({ exitCode: 134, language: DebugLanguage.RUST, outputBuffer: rustStackOverflow })).toEqual([
        "thread 'main' has overflowed its stack",
        'fatal runtime error: stack overflow, aborting',
        'frame 1',
        'frame 2',
        '... (4 lines omitted)',
        'frame 7',
        'frame 8',
        'frame 9'
      ]);

      // When a recognised fatal line IS already among the last 8 (even on a >8-line stderr stream!),
      // plain last 8 lines are returned rather than falling back to stderrBlockStart = 0 and dropping the fatal line.
      const fatalInLast8OnLongStderr = bufferOf(
        ...Array.from({ length: 6 }, (_, i) => ({ category: 'stderr', output: `syserr warn ${i + 1}\n` })),
        { category: 'stderr', output: 'libcob: /work/rterror.cob:13: error: final crash\n' },
        { category: 'stderr', output: 'dump line 1\n' },
        { category: 'stderr', output: 'dump line 2\n' },
        { category: 'stderr', output: 'dump line 3\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: fatalInLast8OnLongStderr })).toEqual([
        'syserr warn 3',
        'syserr warn 4',
        'syserr warn 5',
        'syserr warn 6',
        'libcob: /work/rterror.cob:13: error: final crash',
        'dump line 1',
        'dump line 2',
        'dump line 3'
      ]);

      // Boundary: fatal line at exact index === length - 8 on stdout (also already in last 8).
      const fatalAtExactCutoff = bufferOf(
        { category: 'stdout', output: 'libcob: error: earlier handled message\r\n' },
        { category: 'stdout', output: 'step 1\r\n' },
        { category: 'stdout', output: 'libcob: /work/rterror.cob:13: error: final crash\r\n' },
        ...Array.from({ length: 7 }, (_, i) => ({ category: 'stdout', output: `dump line ${i + 1}\r\n` }))
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: fatalAtExactCutoff })).toEqual([
        'libcob: /work/rterror.cob:13: error: final crash',
        'dump line 1',
        'dump line 2',
        'dump line 3',
        'dump line 4',
        'dump line 5',
        'dump line 6',
        'dump line 7'
      ]);

      // Two fatal lines both above the last 8: anchors on the LAST one.
      const twoFatalAboveCut = bufferOf(
        { category: 'stdout', output: 'libcob: error: first\r\n' },
        { category: 'stdout', output: 'between\r\n' },
        { category: 'stdout', output: 'libcob: error: second\r\n' },
        ...Array.from({ length: 9 }, (_, i) => ({ category: 'stdout', output: `dump ${i + 1}\r\n` }))
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: twoFatalAboveCut })).toEqual([
        'libcob: error: second',
        'dump 1',
        'dump 2',
        'dump 3',
        '... (3 lines omitted)',
        'dump 7',
        'dump 8',
        'dump 9'
      ]);

      // C assert on separate stderr (CppAdapterPolicy has isFatalErrorLine, which returns false):
      // falls through to the trailing long stderr block rule.
      const cAssertOnStderr = bufferOf(
        { category: 'stderr', output: 'Assertion failed: idx < len, file check.c, line 9\n' },
        ...Array.from({ length: 9 }, (_, i) => ({ category: 'stderr', output: `backtrace #${i + 1}\n` }))
      );
      expect(exitOutputTail({ exitCode: 3, language: DebugLanguage.CPP, outputBuffer: cAssertOnStderr })).toEqual([
        'Assertion failed: idx < len, file check.c, line 9',
        'backtrace #1',
        'backtrace #2',
        'backtrace #3',
        '... (3 lines omitted)',
        'backtrace #7',
        'backtrace #8',
        'backtrace #9'
      ]);
    });

    it('keeps real output when a policy hook throws', () => {
      const spyAdapter = vi
        .spyOn(JsDebugAdapterPolicy.programOutput, 'isAdapterLine')
        .mockImplementationOnce(() => {
          throw new Error('policy bug');
        });
      const spyFatal = vi
        .spyOn(CobolAdapterPolicy.programOutput, 'isFatalErrorLine')
        .mockImplementationOnce(() => {
          throw new Error('fatal policy bug');
        });
      try {
        const buf = bufferOf({ category: 'stderr', output: 'real error\n' });
        expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: buf })).toEqual([
          'real error'
        ]);
        const cobolBuf = bufferOf(
          ...Array.from({ length: 10 }, (_, i) => ({ category: 'stdout', output: `line ${i + 1}\n` }))
        );
        expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: cobolBuf })).toEqual([
          'line 3',
          'line 4',
          'line 5',
          'line 6',
          'line 7',
          'line 8',
          'line 9',
          'line 10'
        ]);
      } finally {
        spyAdapter.mockRestore();
        spyFatal.mockRestore();
      }
    });
  });

  describe('Rule A invariant across multi-stream corpora', () => {
    it('never drops a program line the naive last-8 program tail had, except to make room for the head of the same long stderr block or fatal error', () => {
      const languages: DebugLanguage[] = [
        DebugLanguage.JAVASCRIPT,
        DebugLanguage.PYTHON,
        DebugLanguage.GO,
        DebugLanguage.JAVA,
        DebugLanguage.DART,
        DebugLanguage.RUBY,
        DebugLanguage.COBOL,
        DebugLanguage.CPP,
        DebugLanguage.RUST
      ];
      const corpora: Array<Array<{ category: string; output: string; categoryOmitted?: boolean }>> = [
        [{ category: 'stderr', output: 'warn 1\n' }, { category: 'stdout', output: 'fail 1\nfail 2\n' }],
        [
          ...Array.from({ length: 6 }, (_, i) => ({ category: 'stdout', output: `out ${i}\n` })),
          ...Array.from({ length: 5 }, (_, i) => ({ category: 'stderr', output: `err ${i}\n` }))
        ],
        [
          ...Array.from({ length: 12 }, (_, i) => ({ category: 'stderr', output: `trace ${i}\n` })),
          { category: 'stdout', output: 'final summary\n' }
        ],
        Array.from({ length: 14 }, (_, i) => ({ category: 'stderr', output: `pure_stderr_${i}\n` })),
        [
          { category: 'stdout', output: 'step 1\n' },
          ...Array.from({ length: 8 }, (_, i) => ({ category: 'stderr', output: `eight_stderr_${i}\n` }))
        ],
        [
          { category: 'stdout', output: 'step 1\n' },
          ...Array.from({ length: 9 }, (_, i) => ({ category: 'stderr', output: `nine_stderr_${i}\n` }))
        ],
        [
          { category: 'console', output: '[config] bad key\n' },
          { category: 'console', categoryOmitted: true, output: '[loop] logpoint\n' },
          { category: 'stdout', output: 'exiting\n' }
        ]
      ];

      for (const language of languages) {
        const contract = getPolicyForLanguage(language).programOutput;
        for (const entries of corpora) {
          const outputBuffer = bufferOf(...entries);
          const actual = exitOutputTail({ exitCode: 1, language, outputBuffer }) ?? [];

          const programLines = entries
            .flatMap(e =>
              e.output
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean)
                .map(text => ({ category: e.category, categoryOmitted: e.categoryOmitted === true, text }))
            )
            .filter(line => {
              if (line.category === 'stdout' || line.category === 'stderr') {
                return !contract?.isAdapterLine?.(line.category, line.text);
              }
              return line.category === 'console' && contract?.explicitConsoleIsProgram === true && !line.categoryOmitted;
            });
          const naiveLast8 = programLines.slice(-OUTPUT_TAIL_LINES).map(l => l.text);

          const hasGapMarker = actual.some(line => /^\.\.\. \(\d+ lines omitted\)$/.test(line));
          if (!hasGapMarker) {
            expect(actual).toEqual(naiveLast8);
          } else {
            expect(contract?.causeLast).not.toBe(true);
            expect(actual).toHaveLength(OUTPUT_TAIL_LINES);
            expect(actual.slice(-3)).toEqual(naiveLast8.slice(-3));
          }
        }
      }
    });
  });
});
