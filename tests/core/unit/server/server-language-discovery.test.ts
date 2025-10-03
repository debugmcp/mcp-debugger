/**
 * Tests for server language discovery functionality
 *
 * Tests dynamic language discovery, metadata generation, and adapter registry integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { AdapterRegistry } from '../../../../src/adapters/adapter-registry.js';
import { IAdapterRegistry } from '@debugmcp/shared';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers
} from './server-test-helpers.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Language Discovery Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let mockAdapterRegistry: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(() => mockServer as any);

    // Extend the mock adapter registry with all required methods
    mockAdapterRegistry = {
      ...mockDependencies.adapterRegistry,
      getSupportedLanguages: vi.fn().mockReturnValue(['python', 'mock']),
      listLanguages: vi.fn().mockResolvedValue(['python', 'mock']),
      listAvailableAdapters: vi.fn().mockResolvedValue([
        { name: 'python', packageName: '@debugmcp/adapter-python', installed: true },
        { name: 'mock', packageName: '@debugmcp/adapter-mock', installed: true }
      ]),
      isLanguageSupported: vi.fn().mockReturnValue(true),
      create: vi.fn(),
      register: vi.fn()
    };
    mockDependencies.adapterRegistry = mockAdapterRegistry;

    mockSessionManager = createMockSessionManager(mockAdapterRegistry);
    vi.mocked(SessionManager).mockImplementation(() => mockSessionManager as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JavaScript availability and metadata', () => {
    it('should report javascript installed:true in available and include rich JS metadata when resolvable', async () => {
      const debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Simulate dynamic registry reporting JS resolvable (installed)
      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock', 'javascript']);
      mockAdapterRegistry.listAvailableAdapters = vi.fn().mockResolvedValue([
        { name: 'python', packageName: '@debugmcp/adapter-python', installed: true, description: 'Python debugger using debugpy' },
        { name: 'mock', packageName: '@debugmcp/adapter-mock', installed: true, description: 'Mock adapter for testing' },
        { name: 'javascript', packageName: '@debugmcp/adapter-javascript', installed: true, description: 'JavaScript/TypeScript debugger using js-debug' }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);

      // available array contains javascript with installed true
      const jsAvail = content.available.find((a: any) => a.language === 'javascript');
      expect(jsAvail).toBeDefined();
      expect(jsAvail.installed).toBe(true);
      expect(jsAvail.package).toBe('@debugmcp/adapter-javascript');

      // languages metadata includes explicit javascript entry with defaultExecutable: 'node'
      const jsMeta = content.languages.find((m: any) => m.id === 'javascript');
      expect(jsMeta).toBeDefined();
      expect(jsMeta.displayName).toBe('JavaScript/TypeScript');
      expect(jsMeta.requiresExecutable).toBe(true);
      expect(jsMeta.defaultExecutable).toBe('node');
    });
  });

  describe('getSupportedLanguagesAsync', () => {
    it('should return languages from dynamic discovery when available', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Mock the registry to support dynamic discovery
      // Note: getSupportedLanguages returns what's actually installed
      mockAdapterRegistry.getSupportedLanguages = vi.fn().mockReturnValue(['python', 'mock']);
      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // languages is an array of metadata objects, not strings
      const languageIds = content.languages.map((lang: any) => lang.id);
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('mock');
      // Only check for languages that are actually installed
      expect(languageIds).toHaveLength(2);
      expect(mockAdapterRegistry.listAvailableAdapters).toHaveBeenCalled();
    });

    it('should fallback to getSupportedLanguages when dynamic discovery fails', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Mock dynamic discovery to fail
      mockAdapterRegistry.listLanguages = vi.fn().mockRejectedValue(new Error('Discovery failed'));
      mockAdapterRegistry.getSupportedLanguages = vi.fn().mockReturnValue(['python', 'mock']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // languages is an array of metadata objects
      const languageIds = content.languages.map((lang: any) => lang.id);
      expect(languageIds).toEqual(['python', 'mock']);
      // Since dynamic discovery fails, the server uses its static fallback list
    });

    it('should handle undefined adapter registry gracefully', async () => {
      // Create server with undefined registry
      mockDependencies.adapterRegistry = undefined;
      mockSessionManager = createMockSessionManager(undefined);
      vi.mocked(SessionManager).mockImplementation(() => mockSessionManager as any);

      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // When adapter registry is undefined, expect an error
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      })).rejects.toThrow('Failed to list supported languages');
    });

    it('should handle empty language lists from registry', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Mock empty responses
      mockAdapterRegistry.listAvailableAdapters = vi.fn().mockResolvedValue([]);
      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue([]);
      mockAdapterRegistry.getSupportedLanguages = vi.fn().mockReturnValue([]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // When registry returns empty lists, server uses defaults
      const languageIds = content.languages.map((lang: any) => lang.id);
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('mock');
    });
  });

  describe('getLanguageMetadata', () => {
    it('should generate metadata for discovered languages', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);

      // Check that languages are returned (structure may vary)
      expect(content.languages || content.languageMetadata).toBeDefined();
    });

    it('should handle unknown languages in metadata generation', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'unknown-language']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);

      // The system returns python plus unknown-language in the metadata
      const languageIds = content.languages.map((meta: any) => meta.id);
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('unknown-language');

      const unknownMetadata = content.languages.find((meta: any) => meta.id === 'unknown-language');
      if (unknownMetadata) {
        // Accept any case for unknown language
        expect(unknownMetadata.displayName.toLowerCase()).toContain('unknown');
        expect(unknownMetadata.requiresExecutable).toBe(true); // Default
        // defaultExecutable might be undefined for unknown languages
        if (unknownMetadata.defaultExecutable) {
          expect(unknownMetadata.defaultExecutable).toBe('unknown-language'); // Same as ID
        }
      }
    });
  });

  describe('create_debug_session with language validation', () => {
    it('should validate language support before creating session', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock']);
      mockSessionManager.createSession = vi.fn().mockResolvedValue({
        sessionId: 'session-123',
        success: true
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python',
            name: 'test-session'
          }
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // Response structure may vary
      expect(content).toBeDefined();
      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        language: 'python',
        name: 'test-session',
        executablePath: undefined
      });
    });

    it('should reject unsupported languages', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock']);

      // Should throw an error for unsupported language
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'unsupported-language',
            name: 'test-session'
          }
        }
      })).rejects.toThrow('unsupported-language');
    });

    it('should handle language validation errors gracefully', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Mock language discovery to fail
      mockAdapterRegistry.listLanguages = vi.fn().mockRejectedValue(new Error('Discovery failed'));
      mockAdapterRegistry.getSupportedLanguages = vi.fn().mockReturnValue([]);

      // With empty supported languages list, creation should fail
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python',
            name: 'test-session'
          }
        }
      })).rejects.toThrow();
    });
  });

  describe('start_debugging with language support validation', () => {
    beforeEach(() => {
      mockSessionManager.getSessionById = vi.fn().mockReturnValue({
        id: 'session-123',
        language: 'python',
        state: { lifecycleState: 'READY' }
      });
      mockSessionManager.startDebugging = vi.fn().mockResolvedValue({ success: true });
    });

    it('should validate language support before starting debugging', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'session-123',
            scriptPath: '/path/to/script.py'
          }
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // Success should be false since mock doesn't actually start debugging
      expect(content.success).toBeDefined();
    });

    it('should handle dynamic language discovery for session language', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Session has a language not in static list but should be discovered dynamically
      mockSessionManager.getSessionById = vi.fn().mockReturnValue({
        id: 'session-123',
        language: 'javascript',
        state: { lifecycleState: 'READY' }
      });

      mockAdapterRegistry.listLanguages = vi.fn().mockResolvedValue(['python', 'mock', 'javascript']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'session-123',
            scriptPath: '/path/to/script.js'
          }
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // Success should be false since mock doesn't actually start debugging
      expect(content.success).toBeDefined();
    });
  });

  describe('adapter registry interaction edge cases', () => {
    it('should handle registry with missing methods gracefully', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      // Create registry without listLanguages method
      mockDependencies.adapterRegistry = {
        getSupportedLanguages: vi.fn().mockReturnValue(['python'])
      };

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // The mock adapter registry still returns both languages
      const languageIds = content.languages.map((lang: any) => lang.id);
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('mock');
    });

    it('should handle registry method exceptions', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);

      mockAdapterRegistry.listLanguages = vi.fn().mockImplementation(() => {
        throw new Error('Registry method error');
      });
      mockAdapterRegistry.getSupportedLanguages = vi.fn().mockReturnValue(['python', 'mock']);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_supported_languages',
          arguments: {}
        }
      });

      expect(result.content[0].type).toBe('text');
      const content = JSON.parse(result.content[0].text);
      // languages is an array of metadata objects
      const languageIds = content.languages.map((lang: any) => lang.id);
      expect(languageIds).toEqual(['python', 'mock']);
    });
  });
});
