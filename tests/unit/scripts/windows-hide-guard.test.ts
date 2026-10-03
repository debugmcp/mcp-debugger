/**
 * Every child process we start passes `windowsHide: true`.
 *
 * On Windows, a console program started by a process that has no console window of its own gets
 * a brand-new console window, and that window takes focus. A test run or build started from an
 * agent, an IDE task or a git hook has no console, so each spawn without `windowsHide` flashes a
 * window and steals focus for the whole suite (issue #843). The runtime already hides its children
 * (#215, the adapter spawn, ProcessManagerImpl); this guard keeps the build and test tooling the
 * pre-push hook runs in line too.
 *
 * Scope: the runtime sources, every script under scripts/ and packages/<pkg>/scripts/, tools/,
 * and the unit and integration test trees. The e2e and exploratory suites are out of scope: they
 * drive real debuggers whose own children (the debuggee) are outside our control, and the hook
 * does not run them.
 *
 * A call passes when its arguments mention `windowsHide`, when its options argument is a variable
 * whose definition in the same file does, or when the line before carries a
 * `// windows-hide-exempt: <reason>` comment. Files that mock child_process are skipped: their
 * calls never start a process.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

// `:(glob)` makes `**/` match zero or more directories; git's default pathspec matching would
// skip files that sit directly in the named directory (src/server.ts, scripts/foo.js).
const IN_SCOPE = [
  'src/**/*.ts',
  'packages/*/src/**/*.ts', 'packages/*/src/**/*.js', 'packages/*/src/**/*.mjs', 'packages/*/src/**/*.cjs',
  'packages/*/scripts/**/*.js', 'packages/*/scripts/**/*.mjs', 'packages/*/scripts/**/*.cjs',
  'scripts/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.cjs',
  'tools/**/*.js', 'tools/**/*.mjs', 'tools/**/*.cjs',
  'tests/**/*.ts', 'tests/**/*.js', 'tests/**/*.mjs', 'tests/**/*.cjs',
  'packages/*/tests/**/*.ts', 'packages/*/tests/**/*.js', 'packages/*/tests/**/*.mjs'
].map((pattern) => `:(glob)${pattern}`);
const OUT_OF_SCOPE = /^tests\/(e2e|exploratory|manual)\//;

const SPAWNING = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];
const CHILD_PROCESS = /['"](?:node:)?child_process['"]/;

interface Offender {
  file: string;
  line: number;
  call: string;
}

/** Local names the file binds to child_process functions, and namespace aliases for the module. */
function childProcessBindings(text: string): { functions: Map<string, string>; namespaces: Set<string> } {
  const functions = new Map<string, string>();
  const namespaces = new Set<string>();
  const named = /(?:import\s*\{([^}]*)\}\s*from|(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:await\s+import\(|require\())\s*['"](?:node:)?child_process['"]/g;
  for (const m of text.matchAll(named)) {
    for (const part of (m[1] ?? m[2]).split(',')) {
      const [imported, local] = part.trim().split(/\s+as\s+|\s*:\s*/).map((s) => s.trim());
      if (imported && SPAWNING.includes(imported)) functions.set(local || imported, imported);
    }
  }
  const namespace = /(?:import\s+(?:\*\s+as\s+)?(\w+)\s+from|(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+import\(|require\())\s*['"](?:node:)?child_process['"]/g;
  for (const m of text.matchAll(namespace)) namespaces.add(m[1] ?? m[2]);
  // `const execAsync = promisify(exec)` calls exec under another name.
  for (const m of text.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:util\.)?promisify\(\s*(\w+)\s*\)/g)) {
    const target = functions.get(m[2]);
    if (target) functions.set(m[1], target);
  }
  return { functions, namespaces };
}

/** Whether the parenthesised list starting at `open` is a declaration (`name(...) {` or `name(...): T`). */
function isDeclaration(text: string, open: number, args: string): boolean {
  const after = text.slice(open + args.length + 2).match(/^\s*(\S)/);
  return after !== null && (after[1] === '{' || after[1] === ':');
}

/** The text between the call's parentheses, skipping string and template literals. */
function callArguments(text: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** The last top-level argument, when it is a bare identifier (an options variable). */
function trailingIdentifier(args: string): string | null {
  const m = /,\s*([A-Za-z_$][\w$]*)\s*$/.exec(args);
  return m ? m[1] : null;
}

function findOffenders(file: string, text: string): Offender[] {
  if (!CHILD_PROCESS.test(text) || /vi\.mock\(\s*['"](?:node:)?child_process['"]/.test(text)) return [];
  const { functions, namespaces } = childProcessBindings(text);
  const callees = [
    ...[...functions.keys()].map((local) => ({ pattern: `(?<![\\w$.])${local}`, name: functions.get(local)! })),
    ...[...namespaces].flatMap((ns) => SPAWNING.map((fn) => ({ pattern: `\\b${ns}\\.${fn}`, name: fn })))
  ];
  const lines = text.split(/\r?\n/);
  const offenders: Offender[] = [];
  for (const { pattern, name } of callees) {
    for (const m of text.matchAll(new RegExp(`${pattern}\\s*\\(`, 'g'))) {
      const open = m.index! + m[0].length - 1;
      const line = text.slice(0, m.index).split('\n').length;
      const source = lines[line - 1];
      if (/^\s*(\/\/|\*|\/\*)/.test(source)) continue;
      if (/windows-hide-exempt:/.test(lines[line - 2] ?? '') || /windows-hide-exempt:/.test(source)) continue;
      const args = callArguments(text, open);
      if (isDeclaration(text, open, args)) continue;
      if (/windowsHide/.test(args)) continue;
      const optionsVar = trailingIdentifier(args);
      if (optionsVar && new RegExp(`\\b${optionsVar}\\b[^;]*?[=:][\\s\\S]{0,1500}?windowsHide`).test(text)) continue;
      offenders.push({ file, line, call: name });
    }
  }
  return offenders;
}

function inScopeFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '--', ...IN_SCOPE], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  return [...new Set(listed.split('\n').map((f) => f.trim()).filter((f) => f && !OUT_OF_SCOPE.test(f)))];
}

describe('child processes hide their console window on Windows (#843)', () => {
  it('every in-scope spawn passes windowsHide', () => {
    const offenders = inScopeFiles().flatMap((file) =>
      findOffenders(file, readFileSync(path.join(ROOT, file), 'utf8'))
    );
    const report = offenders.map((o) => `  ${o.file}:${o.line} ${o.call}`).join('\n');
    expect(offenders, `child_process calls without windowsHide:\n${report}`).toEqual([]);
  });

  describe('the scanner', () => {
    it('flags a named import called without windowsHide, and passes one that sets it', () => {
      const text = [
        "import { spawn, execSync as run } from 'node:child_process';",
        "spawn('node', ['a.js'], { stdio: 'pipe' });",
        "spawn('node', ['b.js'], { stdio: 'pipe', windowsHide: true });",
        "run('git status');"
      ].join('\n');
      expect(findOffenders('x.ts', text)).toEqual([
        { file: 'x.ts', line: 2, call: 'spawn' },
        { file: 'x.ts', line: 4, call: 'execSync' }
      ]);
    });

    it('follows an options variable to its definition and reads namespace calls', () => {
      const text = [
        "const cp = require('child_process');",
        'const opts = {',
        "  stdio: 'inherit',",
        '  windowsHide: true',
        '};',
        "cp.spawnSync('node', ['a.js'], opts);",
        "cp.execFileSync('git', ['log']);"
      ].join('\n');
      expect(findOffenders('x.cjs', text)).toEqual([{ file: 'x.cjs', line: 7, call: 'execFileSync' }]);
    });

    it('honours an exemption comment and skips files that mock child_process', () => {
      const exempt = [
        "import { spawn } from 'child_process';",
        '// windows-hide-exempt: interactive editor needs a window',
        "spawn('code', ['.']);"
      ].join('\n');
      expect(findOffenders('x.ts', exempt)).toEqual([]);
      const mocked = ["import { spawn } from 'child_process';", "vi.mock('child_process');", "spawn('x');"].join('\n');
      expect(findOffenders('x.test.ts', mocked)).toEqual([]);
    });

    it('skips method definitions and follows a promisify alias', () => {
      const text = [
        "import { spawn, exec } from 'child_process';",
        "import { promisify } from 'util';",
        'const execAsync = promisify(exec);',
        'class Manager {',
        '  spawn(command: string): void {',
        "    spawn(command, [], { windowsHide: true });",
        '  }',
        '  async exec(command: string): Promise<string> {',
        '    return execAsync(command);',
        '  }',
        '}'
      ].join('\n');
      expect(findOffenders('x.ts', text)).toEqual([{ file: 'x.ts', line: 9, call: 'exec' }]);
    });

    it('ignores a parenthesis inside a string argument', () => {
      const text = ["import { exec } from 'child_process';", "exec('echo (hi)', { windowsHide: true });"].join('\n');
      expect(findOffenders('x.ts', text)).toEqual([]);
    });
  });
});
