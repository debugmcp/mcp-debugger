/**
 * A .NET launch whose program is a source file (issue #959).
 *
 * netcoredbg launches a compiled assembly. Handed a `.cs` it accepts the
 * `launch` request, then refuses `configurationDone` with a bare 0x800700c1
 * (ERROR_BAD_EXE_FORMAT) and exits. The core falls back to `scriptPath` when
 * the launch config carries no `program`, and for .NET `scriptPath` is
 * usually the source, so the mistake is an omitted `dapLaunchArgs.program`.
 * The adapter refuses it before anything is spawned, with a sentence that
 * names the convention and, when it is unambiguous, the assembly to use.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_FILE = /\.(cs|fs|vb)$/i;
const PROJECT_FILE = /\.(cs|fs|vb)proj$/i;

/** Whether a launch program is a C#, F# or VB source file rather than an assembly. */
export function isDotnetSourceFile(program: string): boolean {
  return SOURCE_FILE.test(program);
}

function listDirectory(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * The assembly `dotnet build` wrote for the project a source file belongs to,
 * when there is exactly one: the nearest folder above the source holding a
 * single project file, then `bin/<configuration>/<framework>/<Project>.dll`.
 * Undefined when there is no project, more than one project in that folder,
 * no build output, or more than one (Debug and Release, two frameworks): the
 * caller then names the convention without guessing. A project whose
 * `<AssemblyName>` differs from its file name is missed rather than matched
 * against some other DLL (a test host, a reference assembly). A relative
 * source resolves against `baseDir`, the launch's cwd, when given.
 */
export function findBuiltAssembly(sourcePath: string, baseDir?: string): string | undefined {
  let dir = path.dirname(baseDir ? path.resolve(baseDir, sourcePath) : path.resolve(sourcePath));
  for (;;) {
    const projects = listDirectory(dir).filter((entry) => entry.isFile() && PROJECT_FILE.test(entry.name));
    if (projects.length > 0) {
      if (projects.length > 1) {
        return undefined;
      }
      const assemblyName = `${path.parse(projects[0]!.name).name}.dll`;
      const bin = path.join(dir, 'bin');
      const candidates: string[] = [];
      for (const configuration of listDirectory(bin).filter((entry) => entry.isDirectory())) {
        for (const framework of listDirectory(path.join(bin, configuration.name)).filter((entry) => entry.isDirectory())) {
          const candidate = path.join(bin, configuration.name, framework.name, assemblyName);
          if (fs.existsSync(candidate)) {
            candidates.push(candidate);
          }
        }
      }
      return candidates.length === 1 ? candidates[0] : undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/** The refusal for a source file passed as the program. */
export function describeSourceProgram(program: string, baseDir?: string): string {
  const found = findBuiltAssembly(program, baseDir);
  return (
    `The .NET program must be the compiled assembly, not the source file ${path.basename(program)}: ` +
    `pass the .dll as dapLaunchArgs.program (dotnet build writes it to bin/Debug/<framework>/<Project>.dll, ` +
    `for example bin/Debug/net8.0/MyApp.dll); scriptPath can stay the source file.` +
    (found ? ` Found one: ${found}` : '')
  );
}
