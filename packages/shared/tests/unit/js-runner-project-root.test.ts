import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { jsRunnerProjectRoot } from '../../src/interfaces/js-launch-defaults.js';

describe('jsRunnerProjectRoot', () => {
  const root = path.resolve(path.sep, 'project');
  it.each([
    ['plain', path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), root],
    ['scoped', path.join(root, 'node_modules', '@scope', 'pkg', 'run.js'), root],
    ['pnpm', path.join(root, 'node_modules', '.pnpm', 'pkg@1', 'node_modules', 'pkg', 'run.js'), root],
    ['suffix lookalike', path.join(root, 'node_modules_helper', 'run.js'), undefined],
    ['prefix lookalike', path.join(root, 'x-node_modules', 'run.js'), undefined],
    ['extension lookalike', path.join(root, 'node_modules.bak', 'run.js'), undefined],
    ['different case', path.join(root, 'Node_Modules', 'pkg', 'run.js'), undefined],
    ['relative', path.join('node_modules', 'pkg', 'run.js'), '.'],
    ['parent relative', path.join('..', 'node_modules', 'pkg', 'run.js'), '..'],
    ['drive root', 'C:\\node_modules\\pkg\\run.js', process.platform === 'win32' ? 'C:\\' : undefined],
    ['UNC', '\\\\server\\share\\node_modules\\pkg\\run.js', process.platform === 'win32' ? '\\\\server\\share\\' : undefined],
    ['ordinary', path.join(root, 'src', 'run.js'), undefined],
    ['empty', '', undefined],
    ['missing', undefined, undefined],
    ['non-string', 42, undefined]
  ])('finds only the outermost exact segment: %s', (_name, program, expected) => {
    expect(jsRunnerProjectRoot(program)).toBe(expected);
  });
});
