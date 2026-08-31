/**
 * Shared language-matrix utilities for multi-language e2e suites.
 *
 * Owns the example-script paths, per-language breakpoint lines, toolchain
 * detection, and fixture build steps so that every matrix-style suite
 * (comprehensive tools, breakpoint management, logpoints, restart) shares one
 * definition of "which languages can run on this machine and how to launch
 * them".
 */
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, execSync } from 'child_process';
import { prepareJavaExample } from './java-example-utils.js';
import { prepareCppExample, hasCppToolchain } from './cpp-example-utils.js';
import { prepareRustExample } from './rust-example-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, '../..');

/* ---------- example file paths ---------- */

export const PYTHON_SCRIPT = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
export const JS_SCRIPT = path.resolve(ROOT, 'examples', 'javascript', 'simple_test.js');
export const RUST_SCRIPT = path.resolve(ROOT, 'examples', 'rust', 'hello_world', 'src', 'main.rs');
export const GO_SCRIPT = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
export const DOTNET_SCRIPT = path.resolve(ROOT, 'examples', 'dotnet', 'Program.cs');
export const JAVA_SCRIPT = path.resolve(ROOT, 'examples', 'java', 'HelloWorld.java');
export const JAVA_CLASS_DIR = path.resolve(ROOT, 'examples', 'java');
export const RUBY_SCRIPT = path.resolve(ROOT, 'examples', 'ruby', 'fizzbuzz.rb');
export const CPP_SCRIPT = path.resolve(ROOT, 'examples', 'cpp', 'hello_world.cpp');

// Breakpoint lines (executable lines in each script — must be AFTER variable
// assignments so that get_variables returns populated locals)
export const PYTHON_BP_LINE = 10;  // print(f"Before swap: a={a}, b={b}")  — a=1, b=2 in scope
export const JS_BP_LINE = 9;       // let a = 1;
export const RUST_BP_LINE = 19;    // println!("Sum of 5 and 10 is: {}", result)
export const GO_BP_LINE = 13;      // fmt.Println(message)  — message in scope
export const DOTNET_BP_LINE = 15;  // int y = 20;  — x=10 in scope
export const JAVA_BP_LINE = 24;    // int sum = add(x, y);  — x=10, y=20 in scope
export const RUBY_BP_LINE = 15;    // value = fizzbuzz_for(i)  — first loop iteration
export const CPP_BP_LINE = 17;     // int answer = compute_answer(count, 4);  — count/greeting/values in scope

// A second executable line strictly after the bp line in the same file, for
// suites that need two breakpoints in one run (e.g. live removal).
export const PYTHON_LATER_LINE = 12;  // print(f"After swap: ...")
export const JS_LATER_LINE = 15;      // console.log(`After swap: ...`)
export const RUST_LATER_LINE = 27;    // println!("{}", message)
export const GO_LATER_LINE = 13;      // fmt.Println(message)
export const DOTNET_LATER_LINE = 18;  // Console.WriteLine(msg)
export const JAVA_LATER_LINE = 27;    // System.out.println("Sum: " + sum)
export const RUBY_LATER_LINE = 17;    // puts "#{i}: #{value}"  (same loop body)
export const CPP_LATER_LINE = 18;     // std::cout << "CPP_DEBUG_MARKER: ..."

/* ---------- toolchain detection ---------- */

export function hasCommand(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const hasRust = hasCommand('rustc --version');
export const hasGo = hasCommand('go version') && hasCommand('dlv version');
export const hasRuby = hasCommand('ruby --version') && hasCommand('rdbg --version');
export const hasDotnet = (() => {
  if (!hasCommand('dotnet --version')) return false;
  if (process.env.NETCOREDBG_PATH && existsSync(process.env.NETCOREDBG_PATH)) return true;
  return hasCommand('netcoredbg --version');
})();
export const hasJava = hasCommand('java -version') && hasCommand('javac -version');
export const hasCpp = hasCppToolchain();

/* ---------- pre-compilation helpers ---------- */

export function ensureGoBuild(): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const binary = path.resolve(ROOT, 'examples', 'go', `hello_world_test${ext}`);
  execFileSync('go', ['build', '-gcflags=all=-N -l', '-o', binary, GO_SCRIPT], {
    cwd: path.dirname(GO_SCRIPT),
    stdio: 'pipe',
  });
  return binary;
}

export function ensureDotnetBuild(): string {
  const projectDir = path.resolve(ROOT, 'examples', 'dotnet');
  const possibleTfms = ['net10.0', 'net9.0', 'net8.0', 'net7.0', 'net6.0'];
  for (const tfm of possibleTfms) {
    const dllPath = path.join(projectDir, 'bin', 'Debug', tfm, 'dotnet.dll');
    if (existsSync(dllPath)) return dllPath;
  }
  execSync('dotnet build -c Debug', { cwd: projectDir, stdio: 'pipe', timeout: 60000 });
  for (const tfm of possibleTfms) {
    const dllPath = path.join(projectDir, 'bin', 'Debug', tfm, 'dotnet.dll');
    if (existsSync(dllPath)) return dllPath;
  }
  throw new Error('Failed to find built dotnet.dll');
}

export function ensureJavaBuild(): void {
  prepareJavaExample('HelloWorld');
}

export function ensureCppBuild(): string {
  return prepareCppExample('hello_world').binaryPath;
}

export async function ensureRustBuild(): Promise<string> {
  return (await prepareRustExample('hello_world')).binaryPath;
}

/* ---------- language matrix ---------- */

export interface MatrixLangDef {
  language: string;
  script: string;          // source file (for breakpoints and get_source_context)
  launchScript?: string;   // path passed to start_debugging (defaults to script)
  bpLine: number;
  laterLine: number;       // second executable line after bpLine in the same file
  available: boolean;
  skipReason?: string;
  dapLaunchArgs?: Record<string, unknown>;
}

/**
 * Fresh language matrix for a suite. Returns a new array each call so suites
 * can mutate availability/launchScript during their own build steps.
 */
export function createLanguageMatrix(): MatrixLangDef[] {
  return [
    { language: 'python', script: PYTHON_SCRIPT, bpLine: PYTHON_BP_LINE, laterLine: PYTHON_LATER_LINE, available: true },
    { language: 'javascript', script: JS_SCRIPT, bpLine: JS_BP_LINE, laterLine: JS_LATER_LINE, available: true },
    { language: 'mock', script: PYTHON_SCRIPT, bpLine: PYTHON_BP_LINE, laterLine: PYTHON_LATER_LINE, available: true },
    { language: 'rust', script: RUST_SCRIPT, bpLine: RUST_BP_LINE, laterLine: RUST_LATER_LINE, available: hasRust, skipReason: hasRust ? undefined : 'Rust toolchain not installed' },
    { language: 'ruby', script: RUBY_SCRIPT, bpLine: RUBY_BP_LINE, laterLine: RUBY_LATER_LINE, available: hasRuby, skipReason: hasRuby ? undefined : 'Ruby/rdbg not installed' },
    // go: hello_world.go's main has only two executable lines, so the matrix
    // breaks at 12 (message := ...) with 13 (fmt.Println) as the later line —
    // suites needing "message in scope" should use GO_BP_LINE (13) directly.
    { language: 'go', script: GO_SCRIPT, bpLine: 12, laterLine: GO_LATER_LINE, available: hasGo, skipReason: hasGo ? undefined : 'Go/Delve not installed',
      dapLaunchArgs: { mode: 'exec' } },
    { language: 'dotnet', script: DOTNET_SCRIPT, bpLine: DOTNET_BP_LINE, laterLine: DOTNET_LATER_LINE, available: hasDotnet, skipReason: hasDotnet ? undefined : '.NET/netcoredbg not installed',
      dapLaunchArgs: { justMyCode: true } },
    { language: 'java', script: JAVA_SCRIPT, bpLine: JAVA_BP_LINE, laterLine: JAVA_LATER_LINE, available: hasJava, skipReason: hasJava ? undefined : 'JDK not installed',
      dapLaunchArgs: { mainClass: 'HelloWorld', classpath: JAVA_CLASS_DIR, cwd: JAVA_CLASS_DIR } },
    { language: 'cpp', script: CPP_SCRIPT, bpLine: CPP_BP_LINE, laterLine: CPP_LATER_LINE, available: hasCpp, skipReason: hasCpp ? undefined : 'C/C++ compiler not installed' },
  ];
}

/**
 * Run the per-language build steps (go binary, dotnet dll, java classes),
 * updating launchScript/availability in place. Call from a suite's beforeAll.
 */
export async function prepareLanguageMatrix(languages: MatrixLangDef[], log: (msg: string) => void = console.log): Promise<void> {
  const rustLang = languages.find(l => l.language === 'rust');
  if (rustLang?.available) {
    try {
      rustLang.launchScript = await ensureRustBuild();
      log(`[Setup] Rust binary compiled: ${rustLang.launchScript}`);
    } catch (err) {
      log(`[Setup] Rust build failed: ${err}`);
      rustLang.available = false;
      rustLang.skipReason = 'Rust build failed';
    }
  }

  const goLang = languages.find(l => l.language === 'go');
  if (goLang?.available) {
    try {
      goLang.launchScript = ensureGoBuild();
      log(`[Setup] Go binary compiled: ${goLang.launchScript}`);
    } catch (err) {
      log(`[Setup] Go build failed: ${err}`);
      goLang.available = false;
      goLang.skipReason = 'Go build failed';
    }
  }

  const dotnetLang = languages.find(l => l.language === 'dotnet');
  if (dotnetLang?.available) {
    try {
      dotnetLang.launchScript = ensureDotnetBuild();
      log(`[Setup] .NET DLL built: ${dotnetLang.launchScript}`);
    } catch (err) {
      log(`[Setup] .NET build failed: ${err}`);
      dotnetLang.available = false;
      dotnetLang.skipReason = '.NET build failed';
    }
  }

  const javaLang = languages.find(l => l.language === 'java');
  if (javaLang?.available) {
    try {
      ensureJavaBuild();
      log(`[Setup] Java compiled: ${JAVA_CLASS_DIR}`);
    } catch (err) {
      log(`[Setup] Java build failed: ${err}`);
      javaLang.available = false;
      javaLang.skipReason = 'Java build failed';
    }
  }

  const cppLang = languages.find(l => l.language === 'cpp');
  if (cppLang?.available) {
    try {
      cppLang.launchScript = ensureCppBuild();
      log(`[Setup] C++ binary compiled: ${cppLang.launchScript}`);
    } catch (err) {
      log(`[Setup] C++ build failed: ${err}`);
      cppLang.available = false;
      cppLang.skipReason = 'C++ build failed';
    }
  }
}
