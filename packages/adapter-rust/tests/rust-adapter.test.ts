/**
 * Tests for Rust Debug Adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RustDebugAdapter } from '../src/rust-debug-adapter.js';
import { RustAdapterFactory } from '../src/rust-adapter-factory.js';
import { 
  AdapterState,
  DebugLanguage,
  DebugFeature,
  AdapterDependencies,
  AdapterConfig
} from '@debugmcp/shared';
import * as path from 'path';

// Mock dependencies
const mockDependencies: AdapterDependencies = {
  fileSystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    outputFile: vi.fn(),
    exists: vi.fn(),
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    copy: vi.fn(),
    remove: vi.fn()
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {
    get: vi.fn((key: string) => process.env[key]),
    getAll: vi.fn(() => process.env),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  },
  processLauncher: {
    launch: vi.fn()
  }
};

describe('RustDebugAdapter', () => {
  let adapter: RustDebugAdapter;
  
  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RustDebugAdapter(mockDependencies);
  });
  
  describe('Basic Properties', () => {
    it('should have correct language and name', () => {
      expect(adapter.language).toBe(DebugLanguage.RUST);
      expect(adapter.name).toBe('Rust Debug Adapter');
    });
    
    it('should start in uninitialized state', () => {
      expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
      expect(adapter.isReady()).toBe(false);
    });
  });
  
  describe('Capabilities', () => {
    it('should support Rust-specific features', () => {
      expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.FUNCTION_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.DISASSEMBLE_REQUEST)).toBe(true);
      expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
    });
    
    it('should not support reverse debugging', () => {
      expect(adapter.supportsFeature(DebugFeature.STEP_BACK)).toBe(false);
    });
    
    it('should return comprehensive capabilities', () => {
      const capabilities = adapter.getCapabilities();
      
      expect(capabilities.supportsConfigurationDoneRequest).toBe(true);
      expect(capabilities.supportsConditionalBreakpoints).toBe(true);
      expect(capabilities.supportsFunctionBreakpoints).toBe(true);
      expect(capabilities.supportsDataBreakpoints).toBe(true);
      expect(capabilities.supportsDisassembleRequest).toBe(true);
      expect(capabilities.supportsSteppingGranularity).toBe(true);
      expect(capabilities.supportsStepBack).toBe(false);
    });
  });
  
  describe('buildAdapterCommand', () => {
    it('should build correct command for CodeLLDB TCP mode', () => {
      // Mock resolveCodeLLDBExecutableSync by spying on private method
      const adapterWithMethod = adapter as unknown as { resolveCodeLLDBExecutableSync: () => string | null };
      vi.spyOn(adapterWithMethod, 'resolveCodeLLDBExecutableSync').mockReturnValue('/path/to/codelldb');
      
      const config: AdapterConfig = {
        sessionId: 'test-session',
        executablePath: '/usr/bin/cargo',
        adapterHost: '127.0.0.1',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.rs',
        launchConfig: {}
      };
      
      const command = adapter.buildAdapterCommand(config);
      
      expect(command.command).toBe('/path/to/codelldb');
      expect(command.args).toEqual(['--port', '5678']);
      expect(command.env).toBeDefined();
      
      if (process.platform === 'win32') {
        expect(command.env?.LLDB_USE_NATIVE_PDB_READER).toBe('1');
      }
      expect(command.env?.RUST_BACKTRACE).toBeDefined();
      
      // Restore spy
      vi.restoreAllMocks();
    });
    
    it('should throw error if CodeLLDB not found', () => {
      // Mock to return null
      const adapterWithMethod = adapter as unknown as { resolveCodeLLDBExecutableSync: () => string | null };
      vi.spyOn(adapterWithMethod, 'resolveCodeLLDBExecutableSync').mockReturnValue(null);
      
      const config: AdapterConfig = {
        sessionId: 'test-session',
        executablePath: '/usr/bin/cargo',
        adapterHost: '127.0.0.1',
        adapterPort: 5678,
        logDir: '/tmp/logs',
        scriptPath: 'test.rs',
        launchConfig: {}
      };
      
      expect(() => adapter.buildAdapterCommand(config)).toThrow('CodeLLDB executable not found');
      
      // Restore spy
      vi.restoreAllMocks();
    });
    
    it('should throw error if port is invalid', () => {
      // Mock to return a path
      const adapterWithMethod = adapter as unknown as { resolveCodeLLDBExecutableSync: () => string | null };
      vi.spyOn(adapterWithMethod, 'resolveCodeLLDBExecutableSync').mockReturnValue('/path/to/codelldb');
      
      const config: AdapterConfig = {
        sessionId: 'test-session',
        executablePath: '/usr/bin/cargo',
        adapterHost: '127.0.0.1',
        adapterPort: 0, // Invalid port
        logDir: '/tmp/logs',
        scriptPath: 'test.rs',
        launchConfig: {}
      };
      
      expect(() => adapter.buildAdapterCommand(config)).toThrow('Valid TCP port required');
      
      // Restore spy
      vi.restoreAllMocks();
    });
  });
  
  describe('transformLaunchConfig', () => {
    it('should transform config with explicit program path', () => {
      const config = {
        program: './target/debug/myapp',
        args: ['--verbose'],
        cwd: '/project',
        env: { RUST_LOG: 'debug' },
        stopOnEntry: true
      };
      
      const transformed = adapter.transformLaunchConfig(config);
      
      expect(transformed.type).toBe('lldb');
      expect(transformed.request).toBe('launch');
      expect(transformed.program).toContain('myapp');
      expect(transformed.args).toEqual(['--verbose']);
      expect((transformed.env as Record<string, string>).RUST_LOG).toBe('debug');
      expect(transformed.stopOnEntry).toBe(true);
      expect(transformed.sourceLanguages).toEqual(['rust']);
    });
    
    it('should handle Cargo configuration', () => {
      const config = {
        cargo: {
          bin: 'my_binary',
          release: true,
          build: true
        },
        cwd: '/project'
      };
      
      const transformed = adapter.transformLaunchConfig(config);
      
      expect(transformed.program).toContain(path.join('target', 'release', 'my_binary'));
      if (process.platform === 'win32') {
        expect(transformed.program).toContain('.exe');
      }
      const transformedWithFields = transformed as { cargo?: unknown; sourceLanguages?: string[] };
      expect(transformedWithFields.cargo).toEqual(config.cargo);
      expect(transformedWithFields.sourceLanguages).toEqual(['rust']);
    });
    
    it('should throw error if no program specified', () => {
      const config = {
        args: ['--verbose']
      };
      
      expect(() => adapter.transformLaunchConfig(config)).toThrow('No program specified');
    });
  });
  
  describe('Connection Management', () => {
    it('should handle connect and disconnect', async () => {
      expect(adapter.isConnected()).toBe(false);
      
      await adapter.connect('127.0.0.1', 5678);
      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getState()).toBe(AdapterState.CONNECTED);
      
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    });
  });
  
  describe('Error Messages', () => {
    it('should provide helpful error messages', () => {
      const codeError = new Error('codelldb not found');
      const translated = adapter.translateErrorMessage(codeError);
      expect(translated).toContain('npm run build:adapter');
      
      const cargoError = new Error('cargo not found');
      const cargoTranslated = adapter.translateErrorMessage(cargoError);
      expect(cargoTranslated).toContain('rustup.rs');
    });
  });
});

describe('RustAdapterFactory', () => {
  let factory: RustAdapterFactory;
  
  beforeEach(() => {
    factory = new RustAdapterFactory();
  });
  
  it('should create adapter with dependencies', () => {
    const adapter = factory.createAdapter(mockDependencies);
    expect(adapter).toBeInstanceOf(RustDebugAdapter);
  });
  
  it('should provide correct metadata', () => {
    const metadata = factory.getMetadata();
    
    expect(metadata.language).toBe(DebugLanguage.RUST);
    expect(metadata.displayName).toBe('Rust');
    expect(metadata.fileExtensions).toContain('.rs');
    expect(metadata.description).toContain('CodeLLDB');
  });
  
  it('should validate environment', async () => {
    // This will check for CodeLLDB and Cargo installation
    const result = await factory.validate();
    
    // Result will vary based on actual environment
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result.details).toHaveProperty('platform');
    expect(result.details).toHaveProperty('arch');
  });
});
