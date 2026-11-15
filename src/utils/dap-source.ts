/**
 * The DAP `source` a breakpoint's file is sent to the adapter under (issue
 * #1147). One breakpoint, one form: the launch route (the worker's initial
 * `setBreakpoints`) and the live route (every `setBreakpoints` the session
 * sends afterwards) both build it here, so they cannot differ.
 *
 * They used to. The launch route sent `path.resolve(file)` with a `name`;
 * the live route sent the path as the caller typed it. On Windows that is
 * `C:\x\a.cs` against `C:/x/a.cs`, and netcoredbg matches only the first: a
 * breakpoint set on a running session never bound ("No symbols have been
 * loaded for this document"), while the same path set before the launch did.
 *
 * The form is the launch route's, for a path that is absolute on this host:
 * what the OS itself calls the file. A path that is not is passed as given.
 * It names a file somewhere else (the debuggee's own path in a remote attach,
 * a POSIX path on a Windows server), and `path.resolve` would turn it into a
 * path that exists nowhere: `/app/main.py` became `C:\app\main.py`.
 *
 * This is not path interpretation across systems, which the project does not
 * do: a host path is only ever given the host's own spelling.
 */
import path from 'path';

/** A path this process's OS calls absolute: a drive or UNC path on Windows, a rooted path elsewhere. */
function isAbsoluteOnThisHost(file: string): boolean {
  if (process.platform === 'win32') {
    return /^[a-zA-Z]:[\\/]/.test(file) || /^[\\/]{2}[^\\/]/.test(file);
  }
  return file.startsWith('/');
}

/** The path a breakpoint's file goes to the adapter under. Stable: `dapSourcePath(dapSourcePath(x))` is `dapSourcePath(x)`. */
export function dapSourcePath(file: string): string {
  return isAbsoluteOnThisHost(file) ? path.resolve(file) : file;
}

/** The DAP `source` for a breakpoint's file: its path in that form, and the file's name whichever separator the path uses. */
export function toDapSource(file: string): { path: string; name: string } {
  const sourcePath = dapSourcePath(file);
  const name = sourcePath.split(/[\\/]/).pop();
  return { path: sourcePath, name: name || sourcePath };
}
