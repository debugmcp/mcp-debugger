/**
 * Issue #1147: one breakpoint, one form. A breakpoint set before a launch
 * reached the adapter as `path.resolve(file)` with a `name`; the same
 * breakpoint set on a running session reached it as the caller typed it. On
 * Windows that is `C:\x\a.cs` against `C:/x/a.cs`, and netcoredbg matches
 * only the first: the live breakpoint never bound, and the answer blamed the
 * PDB format. Both routes now build the DAP `source` with this helper.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { dapSourcePath, toDapSource } from '../../../src/utils/dap-source.js';

const onWindows = process.platform === 'win32';

describe('the DAP source a breakpoint is sent under (issue #1147)', () => {
  it.runIf(onWindows)('gives a host path the form the OS uses, whichever way its slashes lean', () => {
    expect(dapSourcePath('C:/proj/src/PauseTest.cs')).toBe('C:\\proj\\src\\PauseTest.cs');
    expect(dapSourcePath('C:\\proj\\src\\PauseTest.cs')).toBe('C:\\proj\\src\\PauseTest.cs');
    expect(dapSourcePath('C:/proj/src/../src/PauseTest.cs')).toBe('C:\\proj\\src\\PauseTest.cs');
    expect(toDapSource('C:/proj/src/PauseTest.cs')).toEqual({ path: 'C:\\proj\\src\\PauseTest.cs', name: 'PauseTest.cs' });
  });

  it.runIf(onWindows)('passes a path of another system through as given: it names a file on the target, not here', () => {
    // A remote attach: the debuggee's own POSIX path. path.resolve would
    // have made it C:\app\src\main.py, a file that exists nowhere.
    expect(dapSourcePath('/app/src/main.py')).toBe('/app/src/main.py');
    expect(toDapSource('/app/src/main.py')).toEqual({ path: '/app/src/main.py', name: 'main.py' });
  });

  it.runIf(!onWindows)('normalises a host path and leaves it rooted where it was', () => {
    expect(dapSourcePath('/proj/src/../src/main.py')).toBe('/proj/src/main.py');
    expect(toDapSource('/proj/src/main.py')).toEqual({ path: '/proj/src/main.py', name: 'main.py' });
  });

  it.runIf(!onWindows)('passes a Windows path through as given, and still names its file', () => {
    expect(dapSourcePath('C:\\proj\\src\\PauseTest.cs')).toBe('C:\\proj\\src\\PauseTest.cs');
    expect(toDapSource('C:\\proj\\src\\PauseTest.cs')).toEqual({ path: 'C:\\proj\\src\\PauseTest.cs', name: 'PauseTest.cs' });
  });

  it('passes a path that is not absolute anywhere through as given', () => {
    expect(dapSourcePath('src/main.py')).toBe('src/main.py');
    expect(toDapSource('src/main.py')).toEqual({ path: 'src/main.py', name: 'main.py' });
  });

  it('is what path.resolve gives for a path of this host, so the launch route sends what it always sent', () => {
    const here = path.resolve('some', 'file.js');
    expect(dapSourcePath(here)).toBe(path.resolve(here));
    expect(toDapSource(here)).toEqual({ path: here, name: 'file.js' });
  });

  it('is stable: the form of a form is itself', () => {
    for (const file of ['C:/proj/a.cs', 'C:\\proj\\a.cs', '/app/a.py', 'a.py', path.resolve('a.py')]) {
      expect(dapSourcePath(dapSourcePath(file))).toBe(dapSourcePath(file));
    }
  });
});
