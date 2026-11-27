/**
 * Issue #1277: `exitOutputTail` keeps the program's failure cause and leaves
 * out adapter housekeeping, while `readOutputTailLines` keeps serving a failed
 * launch's adapter-output quote without splitting mid-line chunks.
 */
import { describe, expect, it } from 'vitest';
import { DebugLanguage, JavaAdapterPolicy, JsDebugAdapterPolicy } from '@debugmcp/shared';
import {
  OUTPUT_TAIL_GAP_MARKER,
  OUTPUT_TAIL_LINES,
  exitOutputTail,
  readOutputTailLines
} from '../../../../../src/session/breakpoints/launch-warnings.js';
import { OutputRingBuffer } from '../../../../../src/session/output-buffer.js';

function bufferOf(...entries: Array<{ category: string; output: string }>): OutputRingBuffer {
  const buf = new OutputRingBuffer();
  for (const entry of entries) {
    buf.push(entry.category, entry.output);
  }
  return buf;
}

describe('exitOutputTail and readOutputTailLines (issue #1277)', () => {
  describe('the three cases from issue #1277', () => {
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
        OUTPUT_TAIL_GAP_MARKER,
        'at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)',
        'at node:internal/main/run_main_module:36:49',
        'Node.js v22.22.3'
      ]);
      expect(tail).toHaveLength(OUTPUT_TAIL_LINES);
    });

    it('JavaScript plain non-zero exit (exit_code_test.js): drops js-debug console and inspector stderr lines, keeping the stdout line', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: '/home/dev/bin/node --experimental-network-inspection ./exit_code_test.js\n' },
        { category: 'stderr', output: 'Debugger attached.\r\n' },
        { category: 'stdout', output: 'exit_code_test: exiting with status 7\n' },
        { category: 'stderr', output: 'Waiting for the debugger to disconnect...\r\n' }
      );

      const tail = exitOutputTail({ exitCode: 7, language: DebugLanguage.JAVASCRIPT, outputBuffer });

      expect(tail).toEqual(['exit_code_test: exiting with status 7']);
    });

    it('COBOL runtime error (rterror.cob): keeps libcob subscript error above the storage dump and drops CodeLLDB exit line', () => {
      // Recorded verbatim from examples/cobol/rterror.cob (runtimeChecks: true, breakOnExceptions: 'none').
      const outputBuffer = bufferOf(
        { category: 'stdout', output: 'about to index 0005\n' },
        { category: 'stderr', output: "libcob: /work/examples/cobol/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5\n" },
        { category: 'stderr', output: "note: maximum subscript for 'WS-CELL': 3\n" },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: ' Last statement of "RTERROR" was ADD\n' },
        { category: 'stderr', output: '\t0000-MAIN at /work/examples/cobol/rterror.cob:13\n' },
        { category: 'stderr', output: '\tENTRY RTERROR at /work/examples/cobol/rterror.cob:10\n' },
        { category: 'stderr', output: ' Started by /work/examples/cobol/.debug-mcp/cobol/linux-x64/rterror/rterror\n' },
        { category: 'stderr', output: '\n' },
        { category: 'stderr', output: 'Dump Program-Id RTERROR from /work/examples/cobol/rterror.cob compiled Nov 27 2026 16:01:48\n' },
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

      const tail = exitOutputTail({ exitCode: 1, language: DebugLanguage.COBOL, outputBuffer });

      expect(tail).toEqual([
        "libcob: /work/examples/cobol/rterror.cob:13: error: subscript of 'WS-CELL' out of bounds: 5",
        "note: maximum subscript for 'WS-CELL': 3",
        'Last statement of "RTERROR" was ADD',
        '0000-MAIN at /work/examples/cobol/rterror.cob:13',
        OUTPUT_TAIL_GAP_MARKER,
        '01        WS-SUM                          000000',
        'END OF DUMP - RTERROR',
        '**********************'
      ]);
      expect(tail).toHaveLength(OUTPUT_TAIL_LINES);
    });
  });

  describe('stream selection, chunk joining, bounds, and adapter banners', () => {
    it('quotes the last 8 lines when a program prints only to stdout', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: 'Type \'dlv help\' for list of commands.\n' },
        ...Array.from({ length: 10 }, (_, i) => ({ category: 'stdout', output: `stdout line ${i + 1}\n` })),
        { category: 'console', output: 'Process 99 has exited with status 2\n' },
        { category: 'console', output: 'Detaching\n' }
      );

      expect(exitOutputTail({ exitCode: 2, language: DebugLanguage.GO, outputBuffer })).toEqual([
        'stdout line 3',
        'stdout line 4',
        'stdout line 5',
        'stdout line 6',
        'stdout line 7',
        'stdout line 8',
        'stdout line 9',
        'stdout line 10'
      ]);
    });

    it('returns undefined when a program prints nothing, even when adapter console or banner lines exist', () => {
      const empty = new OutputRingBuffer();
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.PYTHON, outputBuffer: empty })).toBeUndefined();

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

    it('joins a line split across two consecutive chunks of the same category instead of starting mid-line', () => {
      const outputBuffer = bufferOf(
        { category: 'stderr', output: 'FatalError: connection to ' },
        { category: 'stderr', output: 'database refused on 127.0.0.1:5432\n' },
        ...Array.from({ length: 7 }, (_, i) => ({ category: 'stderr', output: `  at frame_${i + 1} (app.py:${i + 10})\n` }))
      );

      const tail = exitOutputTail({ exitCode: 1, language: DebugLanguage.PYTHON, outputBuffer });

      // Total is 8 lines (1 joined + 7 frames), so all 8 fit verbatim with no mid-line cut and no gap marker.
      expect(tail).toEqual([
        'FatalError: connection to database refused on 127.0.0.1:5432',
        'at frame_1 (app.py:10)',
        'at frame_2 (app.py:11)',
        'at frame_3 (app.py:12)',
        'at frame_4 (app.py:13)',
        'at frame_5 (app.py:14)',
        'at frame_6 (app.py:15)',
        'at frame_7 (app.py:16)'
      ]);
    });

    it('keeps a stderr block shorter than or equal to the tail verbatim without a gap marker', () => {
      const shortStderr = bufferOf(
        { category: 'stdout', output: 'starting runner\n' },
        { category: 'stderr', output: 'runner error: no test files found\n' },
        { category: 'stderr', output: 'exiting with code 3\n' }
      );

      expect(exitOutputTail({ exitCode: 3, language: DebugLanguage.PYTHON, outputBuffer: shortStderr })).toEqual([
        'runner error: no test files found',
        'exiting with code 3'
      ]);
    });

    it('drops logpoint lines and mcp-debugger warnings interleaved with a crash without breaking the contiguous stderr block', () => {
      const outputBuffer = bufferOf(
        { category: 'console', output: 'LP before crash x=1\n' },
        { category: 'stderr', output: 'RuntimeError: invariant violated\n  at step1 (svc.ts:10)\n  at step2 (svc.ts:20)\n' },
        { category: 'console', output: 'LP interleaved x=2\n' },
        { category: 'console', output: '[mcp-debugger] Warning: function breakpoint never bound.\n' },
        {
          category: 'stderr',
          output:
            '  at step3 (svc.ts:30)\n' +
            '  at step4 (svc.ts:40)\n' +
            '  at step5 (svc.ts:50)\n' +
            '  at step6 (svc.ts:60)\n' +
            '  at step7 (svc.ts:70)\n' +
            '  at step8 (svc.ts:80)\n' +
            '  at step9 (svc.ts:90)\n'
        }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer })).toEqual([
        'RuntimeError: invariant violated',
        'at step1 (svc.ts:10)',
        'at step2 (svc.ts:20)',
        'at step3 (svc.ts:30)',
        OUTPUT_TAIL_GAP_MARKER,
        'at step7 (svc.ts:70)',
        'at step8 (svc.ts:80)',
        'at step9 (svc.ts:90)'
      ]);
    });

    it('anchors on the last contiguous stderr block when stdout separates an earlier stderr warning from the crash', () => {
      const outputBuffer = bufferOf(
        { category: 'stderr', output: 'DeprecationWarning: legacy option enabled\n' },
        { category: 'stdout', output: 'processed 42 records\n' },
        {
          category: 'stderr',
          output: Array.from({ length: 10 }, (_, i) =>
            i === 0 ? 'ValueError: negative balance -5' : `  at frame_${i} (ledger.py:${i * 10})`
          ).join('\n') + '\n'
        }
      );

      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.PYTHON, outputBuffer })).toEqual([
        'ValueError: negative balance -5',
        'at frame_1 (ledger.py:10)',
        'at frame_2 (ledger.py:20)',
        'at frame_3 (ledger.py:30)',
        OUTPUT_TAIL_GAP_MARKER,
        'at frame_7 (ledger.py:70)',
        'at frame_8 (ledger.py:80)',
        'at frame_9 (ledger.py:90)'
      ]);
    });

    it('strips Java JDWP banner on stdout only and JS inspector banners on stderr only', () => {
      expect(JavaAdapterPolicy.isAdapterOutputLine('stdout', 'Listening for transport dt_socket at address: 5005')).toBe(true);
      expect(JavaAdapterPolicy.isAdapterOutputLine('stderr', 'Listening for transport dt_socket at address: 5005')).toBe(false);
      expect(JavaAdapterPolicy.isAdapterOutputLine('stdout', 'Listening on port 5005')).toBe(false);

      expect(JsDebugAdapterPolicy.isAdapterOutputLine('stderr', 'Debugger attached.')).toBe(true);
      expect(JsDebugAdapterPolicy.isAdapterOutputLine('stderr', 'Waiting for the debugger to disconnect...')).toBe(true);
      expect(JsDebugAdapterPolicy.isAdapterOutputLine('stdout', 'Debugger attached.')).toBe(false);

      // A program that prints "Debugger attached." to stdout itself keeps its line.
      const programPrintedSameWords = bufferOf({ category: 'stdout', output: 'Debugger attached.\n' });
      expect(exitOutputTail({ exitCode: 1, language: DebugLanguage.JAVASCRIPT, outputBuffer: programPrintedSameWords })).toEqual([
        'Debugger attached.'
      ]);
    });

    it('keeps real output if a custom policy isAdapterOutputLine throws', () => {
      const outputBuffer = bufferOf({ category: 'stderr', output: 'real error\n' });
      const brokenPolicy = {
        isAdapterOutputLine: () => {
          throw new Error('policy bug');
        }
      };
      expect(exitOutputTail({ exitCode: 1, outputBuffer }, brokenPolicy)).toEqual(['real error']);
    });

    it('readOutputTailLines still quotes console and cross-category lines for failed launches while joining split chunks', () => {
      const launchFailureBuffer = bufferOf(
        // Delve's newline-less stdout line ahead of stderr (#1036): must stay separate.
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
    });
  });
});
