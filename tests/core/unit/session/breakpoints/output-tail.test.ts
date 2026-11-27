/**
 * Issue #1277: `exitOutputTail` quotes the program's own last output lines
 * across streams (preserving cause lines at the head of long stderr traces or
 * native fatal-error headers, reclaiming Dart program console lines, and
 * keeping Python's end-of-trace frames), while `readOutputTailLines` keeps
 * serving a failed launch's all-category output quote.
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
  getPolicyForLanguage
} from '@debugmcp/shared';
import {
  OUTPUT_TAIL_LINES,
  exitOutputTail,
  formatOutputTailGapMarker,
  readOutputTailLines
} from '../../../../../src/session/breakpoints/launch-warnings.js';
import { MAX_OUTPUT_ENTRY_CHARS, OutputRingBuffer } from '../../../../../src/session/output-buffer.js';

function bufferOf(...entries: Array<{ category: string; output: string }>): OutputRingBuffer {
  const buf = new OutputRingBuffer();
  for (const entry of entries) {
    buf.push(entry.category, entry.output);
  }
  return buf;
}

describe('exitOutputTail and readOutputTailLines (issue #1277)', () => {
  describe('the three cases from issue #1277 (Windows and Linux)', () => {
    it('JavaScript crash: keeps Error: uncaught on purpose above Node CJS loader frames and drops inspector banners', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: '/home/dev/.nvm/versions/node/v22.22.3/bin/node ./crash.cjs\n' },
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
        { category: 'console', output: '/home/dev/bin/node --experimental-network-inspection ./exit_code_test.js\n' },
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
        { category: 'stderr', output: "libcob: C:\\work\\examples\\cobol\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5\n" },
        { category: 'stderr', output: "note: maximum subscript for 'WS-CELL': 3\n" },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: ' Last statement of "RTERROR" was ADD\n' },
        { category: 'stderr', output: '\t0000-MAIN at C:\\work\\examples\\cobol\\rterror.cob:13\n' },
        { category: 'stderr', output: '\tENTRY RTERROR at C:\\work\\examples\\cobol\\rterror.cob:10\n' },
        { category: 'stderr', output: ' Started by C:\\work\\examples\\cobol\\rterror.exe\n' },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: 'Dump Program-Id RTERROR from C:\\work\\examples\\cobol\\rterror.cob compiled Nov 27 2026 16:01:48\n' },
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
        "libcob: C:\\work\\examples\\cobol\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5",
        "note: maximum subscript for 'WS-CELL': 3",
        'Last statement of "RTERROR" was ADD',
        '0000-MAIN at C:\\work\\examples\\cobol\\rterror.cob:13',
        '... (10 lines omitted)',
        '01        WS-SUM                          000000',
        'END OF DUMP - RTERROR',
        '**********************'
      ]);
    });

    it('COBOL runtime error on Linux (pty-merged stdout with CRLF and split CRLF chunks): recognises libcob fatal error', () => {
      // Measured on Ubuntu (CodeLLDB 1.12.3, GnuCOBOL 3.1.2): 2 stdout entries (CRLF), 1 console entry, 0 stderr entries.
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
  });

  describe('Rule A selection cases from the review', () => {
    it('keeps a stdout failure report that follows an unrelated stderr deprecation warning', () => {
      const jsWarnThenFail = bufferOf(
        { category: 'console', output: '/usr/bin/node ./run-tests.cjs\n' },
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

    it('reclaims Dart developer.log and dart test result lines from console while excluding adapter console and mcp-debugger warnings', () => {
      const dartDevLogBuffer = bufferOf(
        { category: 'console', output: '[mcp-debugger] Warning: runner: dart (no pubspec.yaml above the program or cwd; plain dart)\n' },
        { category: 'console', output: 'Connecting to VM Service at ws://127.0.0.1:56871/Cmr4cD_0T2c=/ws\n' },
        { category: 'console', output: 'Connected to the VM Service.\n' },
        { category: 'stdout', output: 'loading settings\r\n' },
        { category: 'console', output: '[log] default-channel check\n' },
        { category: 'console', output: '[config] settings file is missing a required key: db.url\n' },
        { category: 'console', output: 'plain logpoint value=42\n' },
        { category: 'important', output: '[config] non-console category is ignored\n' },
        { category: 'console', output: '\nExited (2).\n' }
      );

      expect(exitOutputTail({ exitCode: 2, language: DebugLanguage.DART, outputBuffer: dartDevLogBuffer })).toEqual([
        'loading settings',
        '[log] default-channel check',
        '[config] settings file is missing a required key: db.url'
      ]);

      const dartTestBuffer = bufferOf(
        { category: 'console', output: '[mcp-debugger] Warning: runner: dart-test\n' },
        { category: 'console', output: 'Connecting to VM Service at ws://127.0.0.1:56908/tok=/ws\n' },
        { category: 'console', output: 'Connected to the VM Service.\n' },
        { category: 'console', output: '! skipped case\n' },
        { category: 'console', output: '✓ adds numbers\n' },
        { category: 'stderr', output: 'Expected: <3>\n  Actual: <2>\npackage:matcher           expect\ntest\\math_test.dart 13:5  main.<fn>\n' },
        { category: 'console', output: '✖ fails on purpose\n' },
        { category: 'console', output: '\nExited (1).\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.DART, outputBuffer: dartTestBuffer })).toEqual([
        '! skipped case',
        '✓ adds numbers',
        'Expected: <3>',
        'Actual: <2>',
        'package:matcher           expect',
        'test\\math_test.dart 13:5  main.<fn>',
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
      const literalDots = bufferOf(
        { category: 'stdout', output: 'waiting\n...\nfailed to connect\n' }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: literalDots })).toEqual([
        'waiting',
        '...',
        'failed to connect'
      ]);
      expect(formatOutputTailGapMarker(14)).toBe('... (14 lines omitted)');
    });
  });

  describe('chunk joining, truncated entries, and boundary conditions', () => {
    it('joins a line split across chunks even when a console entry arrives between them', () => {
      const outputBuffer = bufferOf(
        { category: 'stderr', output: 'FatalError: connection to ' },
        { category: 'console', output: 'logpoint probe=1\n' },
        { category: 'stderr', output: 'database refused on 127.0.0.1:5432\n' },
        ...Array.from({ length: 7 }, (_, i) => ({ category: 'stderr', output: `  at frame_${i + 1} (app.js:${i + 10})\n` }))
      );

      // 1 joined line + 7 frames = exactly 8 stderr lines: fits verbatim with no gap marker.
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer })).toEqual([
        'FatalError: connection to database refused on 127.0.0.1:5432',
        'at frame_1 (app.js:10)',
        'at frame_2 (app.js:11)',
        'at frame_3 (app.js:12)',
        'at frame_4 (app.js:13)',
        'at frame_5 (app.js:14)',
        'at frame_6 (app.js:15)',
        'at frame_7 (app.js:16)'
      ]);
    });

    it('ends the line after a ring-buffer-truncated entry (8,192 chars) instead of gluing the next chunk onto it', () => {
      const buf = new OutputRingBuffer();
      buf.push('stderr', 'prefix: ');
      const pushed = buf.push('stderr', 'X'.repeat(MAX_OUTPUT_ENTRY_CHARS + 50));
      expect(pushed.truncated).toBe(true);
      buf.push('stderr', 'actual cause on next entry\n');

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

      // Total 10 stderr lines, uninterrupted by program stdout: quotes first 4 + "... (3 lines omitted)" + last 3.
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
        { category: 'console', output: '/usr/bin/node ./silent_exit.js\n' },
        { category: 'stderr', output: 'Debugger attached.\r\n' },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\r\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: jsBannersOnly })).toBeUndefined();

      const javaBannerOnly = bufferOf(
        { category: 'stdout', output: 'Listening for transport dt_socket at address: 57378\n' }
      );
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVA, outputBuffer: javaBannerOnly })).toBeUndefined();
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

      // Specific negative cases for syntax-error and inspector shapes.
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

    it('pins Java stdout JDWP banner and both start and end anchors', () => {
      const isJavaAdapter = JavaAdapterPolicy.programOutput.isAdapterLine!;

      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 5005')).toBe(true);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 127.0.0.1:5005')).toBe(true);
      expect(isJavaAdapter('stderr', 'Listening for transport dt_socket at address: 5005')).toBe(false);
      expect(isJavaAdapter('stdout', 'INFO: Listening for transport dt_socket at address: 5005')).toBe(false);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address: 5005 ready')).toBe(false);
      expect(isJavaAdapter('stdout', 'Listening for transport dt_socket at address:')).toBe(false);
    });

    it('pins Dart console reclamation patterns and anchors', () => {
      const isDartProgramConsole = DartAdapterPolicy.programOutput.isProgramConsoleLine!;

      expect(isDartProgramConsole('[log] hello')).toBe(true);
      expect(isDartProgramConsole('[my.service:db] missing url')).toBe(true);
      expect(isDartProgramConsole('[db]')).toBe(true);
      expect(isDartProgramConsole('✓ adds numbers')).toBe(true);
      expect(isDartProgramConsole('✖ fails on purpose')).toBe(true);
      expect(isDartProgramConsole('! skipped test')).toBe(true);

      expect(isDartProgramConsole('[mcp-debugger] Warning: runner: dart')).toBe(false);
      expect(isDartProgramConsole('[mcp-debugger]')).toBe(false);
      expect(isDartProgramConsole('prefix [log] hello')).toBe(false);
      expect(isDartProgramConsole('[tag]nospace')).toBe(false);
      expect(isDartProgramConsole('[] empty logger')).toBe(false);
      expect(isDartProgramConsole('[unclosed')).toBe(false);
      expect(isDartProgramConsole('✓')).toBe(false);
      expect(isDartProgramConsole('✖')).toBe(false);
      expect(isDartProgramConsole('!')).toBe(false);
      expect(isDartProgramConsole('prefix ✓ adds numbers')).toBe(false);
      expect(isDartProgramConsole('Connecting to VM Service at ws://127.0.0.1:8181/ws')).toBe(false);
      expect(isDartProgramConsole('Exited (2).')).toBe(false);
    });

    it('pins COBOL and C++ fatal-error recognisers and Linux pty fatal-error selection boundaries', () => {
      const isCobolFatal = CobolAdapterPolicy.programOutput.isFatalErrorLine!;
      expect(isCobolFatal("libcob: /work/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5")).toBe(true);
      expect(isCobolFatal("libcob: C:\\work\\rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5")).toBe(true);
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

      expect(PythonAdapterPolicy.programOutput.causeLast).toBe(true);

      // Linux C++ pty buffer: 5 chunks without newline between instance pieces, followed by 9 dump lines on stdout.
      const linuxCppPty = bufferOf(
        { category: 'stdout', output: "terminate called after throwing an instance of '" },
        { category: 'stdout', output: 'std::runtime_error' },
        { category: 'stdout', output: "'\r\n" },
        { category: 'stdout', output: '  what():  ' },
        { category: 'stdout', output: 'uncaught error\r\n' },
        ...Array.from({ length: 8 }, (_, i) => ({ category: 'stdout', output: `frame #${i}: 0x0040${i}\r\n` }))
      );
      // Fatal error is at index 0 (< 10 - 8 = 2): quotes index 0..3 + "... (3 lines omitted)" + last 3.
      expect(exitOutputTail({ exitCode: 134, language: DebugLanguage.CPP, outputBuffer: linuxCppPty })).toEqual([
        "terminate called after throwing an instance of 'std::runtime_error'",
        'what():  uncaught error',
        'frame #0: 0x00400',
        'frame #1: 0x00401',
        '... (3 lines omitted)',
        'frame #5: 0x00405',
        'frame #6: 0x00406',
        'frame #7: 0x00407'
      ]);

      // Boundary: when the LAST fatal-error line is ALREADY among the last 8 (index === length - 8),
      // plain last 8 lines are returned with NO gap marker (even if an earlier fatal-looking line existed at index 0).
      const fatalAlreadyInLast8 = bufferOf(
        { category: 'stdout', output: "libcob: error: earlier handled message\r\n" },
        { category: 'stdout', output: 'step 1\r\n' },
        { category: 'stdout', output: "libcob: /work/rterror.cob:13: error: final crash\r\n" },
        ...Array.from({ length: 7 }, (_, i) => ({ category: 'stdout', output: `dump line ${i + 1}\r\n` }))
      );
      // Total 10 lines; last fatal line is at index 2 === 10 - 8, so it is the first line of the plain last 8.
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer: fatalAlreadyInLast8 })).toEqual([
        'libcob: /work/rterror.cob:13: error: final crash',
        'dump line 1',
        'dump line 2',
        'dump line 3',
        'dump line 4',
        'dump line 5',
        'dump line 6',
        'dump line 7'
      ]);

      // Two fatal lines both above the last 8 (indices 0 and 2 of 12): anchors on the LAST one (index 2).
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
    });

    it('keeps real output when a policy hook throws', () => {
      const spyAdapter = vi
        .spyOn(JsDebugAdapterPolicy.programOutput, 'isAdapterLine')
        .mockImplementationOnce(() => {
          throw new Error('policy bug');
        });
      const spyConsole = vi
        .spyOn(DartAdapterPolicy.programOutput, 'isProgramConsoleLine')
        .mockImplementationOnce(() => {
          throw new Error('console policy bug');
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
        const dartBuf = bufferOf(
          { category: 'console', output: '[config] broken hook\n' },
          { category: 'stdout', output: 'still keeps stdout\n' }
        );
        expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.DART, outputBuffer: dartBuf })).toEqual([
          'still keeps stdout'
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
        spyConsole.mockRestore();
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
        DebugLanguage.CPP
      ];
      const corpora: Array<Array<{ category: string; output: string }>> = [
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
          { category: 'stdout', output: 'exiting\n' }
        ]
      ];

      for (const language of languages) {
        const contract = getPolicyForLanguage(language).programOutput;
        for (const entries of corpora) {
          const outputBuffer = bufferOf(...entries);
          const actual = exitOutputTail({ exitCode: 1, language, outputBuffer }) ?? [];

          // Compute the naive last-8 program lines in arrival order.
          const programLines = entries
            .flatMap(e =>
              e.output
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean)
                .map(text => ({ category: e.category, text }))
            )
            .filter(line => {
              if (line.category === 'stdout' || line.category === 'stderr') {
                return !contract?.isAdapterLine?.(line.category, line.text);
              }
              return line.category === 'console' && contract?.isProgramConsoleLine?.(line.text) === true;
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
