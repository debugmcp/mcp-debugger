import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../../packages/adapter-javascript/src/javascript-debug-adapter.js';
import { DebugFeature } from '@debugmcp/shared';

const mockDetectRunners = vi.fn();
const mockDetectBinary = vi.fn();

vi.mock('../../../packages/adapter-javascript/src/utils/config-transformer.js', () => ({
  determineOutFiles: vi.fn(),
  isESMProject: vi.fn().mockReturnValue(true),
  hasTsConfigPaths: vi.fn().mockReturnValue(true)
}));

vi.mock('../../../packages/adapter-javascript/src/utils/typescript-detector.js', () => ({
  detectTsRunners: (...args: unknown[]) => mockDetectRunners(...args),
  detectBinary: (...args: unknown[]) => mockDetectBinary(...args)
}));

const createDependencies = () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  fileSystem: {},
  environment: {},
  processLauncher: {} as unknown,
  networkManager: {} as unknown
});

describe('JavascriptDebugAdapter runtime helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectBinary.mockReturnValue(undefined);
  });

  it('deduplicates ts-node runtime hooks when computing runtime arguments', async () => {
    mockDetectRunners.mockResolvedValue({ tsNode: 'ts-node', tsx: undefined });
    const adapter = new JavascriptDebugAdapter(createDependencies());
    vi.spyOn(adapter as any, 'detectTypeScriptRunners').mockResolvedValue({ tsNode: 'ts-node' });

    const args = await (adapter as any).determineRuntimeArgs(true, {
      program: '/workspace/app.ts',
      cwd: '/workspace',
      runtimeArgs: ['-r', 'ts-node/register'],
      runtimeExecutable: 'node'
    });

    const tsNodeRegisterCount = args.filter((entry: string) => entry === 'ts-node/register').length;
    expect(tsNodeRegisterCount).toBe(1);
    expect(args).toContain('ts-node/register/transpile-only');
    expect(args).toContain('--loader');
  });

  it('translates ENOENT errors into actionable guidance', () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    const message = adapter.translateErrorMessage(new Error('ENOENT: spawn node ENOENT'));
    expect(message).toContain('Node.js runtime not found');
  });

  it('supports key debugging features while declining unsupported ones', () => {
    const adapter = new JavascriptDebugAdapter(createDependencies());
    expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.EVALUATE_FOR_HOVERS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
  });
});
