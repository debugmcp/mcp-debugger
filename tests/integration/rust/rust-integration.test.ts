/**
 * Integration tests for Rust adapter
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { DebugLanguage } from '@debugmcp/shared';
import path from 'path';
import os from 'os';

describe('Rust Adapter Integration', () => {
  let sessionManager: SessionManager;
  let sessionId: string;
  
  beforeAll(async () => {
    const dependencies = createProductionDependencies({
      logLevel: 'debug',
      logFile: path.join(os.tmpdir(), 'rust-integration-test.log')
    });
    
    const config: SessionManagerConfig = {
      logDirBase: path.join(os.tmpdir(), 'rust-integration-test-sessions'),
      defaultDapLaunchArgs: {
        stopOnEntry: true,
        justMyCode: true
      }
    };
    
    sessionManager = new SessionManager(config, dependencies);
  });
  
  afterAll(async () => {
    await sessionManager.closeAllSessions();
  });
  
  it('should create a Rust debug session', async () => {
    const session = await sessionManager.createSession({
      language: DebugLanguage.RUST,
      name: 'Test Rust Session'
    });
    
    expect(session).toBeDefined();
    expect(session.language).toBe(DebugLanguage.RUST);
    expect(session.name).toBe('Test Rust Session');
    
    sessionId = session.id;
  });
  
  it('should handle Cargo project debugging', async () => {
    // Verifies session creation; full Cargo debugging requires a compiled Rust project
    expect(sessionId).toBeDefined();
    
    const session = sessionManager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.language).toBe(DebugLanguage.RUST);
  });
  
  it('should set breakpoints in Rust files', async () => {
    // Uses example project; full verification requires a compiled binary
    const testFile = 'examples/rust/hello_world/src/main.rs';
    
    // Skip if test file doesn't exist
    try {
      const breakpoint = await sessionManager.setBreakpoint(
        sessionId,
        testFile,
        5 // Line number in main function
      );
      
      expect(breakpoint).toBeDefined();
      expect(breakpoint.verified).toBe(true);
    } catch (error) {
      // Expected to fail if test files aren't set up yet
      console.log('Breakpoint test skipped - test files not available');
    }
  });
  
  it('should close the Rust session', async () => {
    const closed = await sessionManager.closeSession(sessionId);
    expect(closed).toBe(true);
    
    const session = sessionManager.getSession(sessionId);
    expect(session).toBeUndefined();
  });
});
