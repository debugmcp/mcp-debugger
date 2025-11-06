/**
 * Tests for DapClientBehavior implementations in adapter policies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { DapClientContext, ReverseRequestResult } from '@debugmcp/shared';
import {
  JsDebugAdapterPolicy,
  PythonAdapterPolicy,
  MockAdapterPolicy,
  DefaultAdapterPolicy
} from '@debugmcp/shared';

describe('DapClientBehavior', () => {
  let mockContext: DapClientContext;
  
  beforeEach(() => {
    mockContext = {
      sendResponse: vi.fn(),
      createChildSession: vi.fn(),
      activeChildren: new Map(),
      adoptedTargets: new Set()
    };
  });
  
  describe('JsDebugAdapterPolicy', () => {
    const behavior = JsDebugAdapterPolicy.getDapClientBehavior();
    
    describe('handleReverseRequest', () => {
      it('should handle startDebugging request with valid pendingTargetId', async () => {
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'startDebugging',
          arguments: {
            configuration: {
              __pendingTargetId: 'test-pending-1',
              type: 'pwa-node',
              host: 'localhost',
              port: 9229
            }
          }
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(true);
        expect(result.createChildSession).toBe(true);
        expect(result.childConfig).toBeDefined();
        expect(result.childConfig?.pendingId).toBe('test-pending-1');
        expect(mockContext.sendResponse).toHaveBeenCalledWith(request, {});
      });
      
      it('should not create child session for already adopted target', async () => {
        mockContext.adoptedTargets.add('already-adopted');
        
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'startDebugging',
          arguments: {
            configuration: {
              __pendingTargetId: 'already-adopted',
              type: 'pwa-node'
            }
          }
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(true);
        expect(result.createChildSession).toBeUndefined();
        expect(mockContext.sendResponse).toHaveBeenCalled();
      });
      
      it('should handle runInTerminal request', async () => {
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'runInTerminal',
          arguments: {}
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(true);
        expect(mockContext.sendResponse).toHaveBeenCalledWith(request, {});
      });
      
      it('should not handle unknown requests', async () => {
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'unknownCommand',
          arguments: {}
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(false);
      });
    });
    
    describe('command routing', () => {
      it('should route debuggee-scoped commands to child', () => {
        expect(behavior.childRoutedCommands?.has('threads')).toBe(true);
        expect(behavior.childRoutedCommands?.has('pause')).toBe(true);
        expect(behavior.childRoutedCommands?.has('continue')).toBe(true);
        expect(behavior.childRoutedCommands?.has('stackTrace')).toBe(true);
        expect(behavior.childRoutedCommands?.has('scopes')).toBe(true);
        expect(behavior.childRoutedCommands?.has('variables')).toBe(true);
        expect(behavior.childRoutedCommands?.has('evaluate')).toBe(true);
      });
      
      it('should not route initialization commands to child', () => {
        expect(behavior.childRoutedCommands?.has('initialize')).toBe(false);
        expect(behavior.childRoutedCommands?.has('launch')).toBe(false);
        expect(behavior.childRoutedCommands?.has('attach')).toBe(false);
      });
    });
    
    describe('configuration', () => {
      it('should have JavaScript-specific settings', () => {
        expect(behavior.mirrorBreakpointsToChild).toBe(true);
        expect(behavior.deferParentConfigDone).toBe(true);
        expect(behavior.pauseAfterChildAttach).toBe(true);
        expect(behavior.childInitTimeout).toBe(12000);
        expect(behavior.suppressPostAttachConfigDone).toBe(false); // Child needs configurationDone
      });
      
      it('should normalize adapter ID from javascript to pwa-node', () => {
        expect(behavior.normalizeAdapterId?.('javascript')).toBe('pwa-node');
        expect(behavior.normalizeAdapterId?.('JavaScript')).toBe('pwa-node');
        expect(behavior.normalizeAdapterId?.('pwa-node')).toBe('pwa-node');
        expect(behavior.normalizeAdapterId?.('other')).toBe('other');
      });
    });
  });
  
  describe('PythonAdapterPolicy', () => {
    const behavior = PythonAdapterPolicy.getDapClientBehavior();
    
    describe('handleReverseRequest', () => {
      it('should handle runInTerminal request', async () => {
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'runInTerminal',
          arguments: {}
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(true);
        expect(mockContext.sendResponse).toHaveBeenCalledWith(request, {});
      });
      
      it('should not handle startDebugging request', async () => {
        const request: DebugProtocol.Request = {
          type: 'request',
          seq: 1,
          command: 'startDebugging',
          arguments: {}
        } as DebugProtocol.Request;
        
        const result = await behavior.handleReverseRequest!(request, mockContext);
        
        expect(result.handled).toBe(false);
      });
    });
    
    describe('configuration', () => {
      it('should have Python-specific settings', () => {
        expect(behavior.childRoutedCommands).toBeUndefined();
        expect(behavior.mirrorBreakpointsToChild).toBe(false);
        expect(behavior.deferParentConfigDone).toBe(false);
        expect(behavior.pauseAfterChildAttach).toBe(false);
        expect(behavior.normalizeAdapterId).toBeUndefined();
        expect(behavior.childInitTimeout).toBe(5000);
      });
    });
  });
  
  describe('MockAdapterPolicy', () => {
    const behavior = MockAdapterPolicy.getDapClientBehavior();
    
    it('should provide minimal behavior', () => {
      expect(behavior.handleReverseRequest).toBeUndefined();
      expect(behavior.childRoutedCommands).toBeUndefined();
      expect(behavior.mirrorBreakpointsToChild).toBe(false);
      expect(behavior.deferParentConfigDone).toBe(false);
      expect(behavior.pauseAfterChildAttach).toBe(false);
      expect(behavior.normalizeAdapterId).toBeUndefined();
      expect(behavior.childInitTimeout).toBe(1000);
    });
  });
  
  describe('DefaultAdapterPolicy', () => {
    const behavior = DefaultAdapterPolicy.getDapClientBehavior();
    
    it('should provide empty behavior object', () => {
      expect(behavior).toEqual({});
      expect(behavior.handleReverseRequest).toBeUndefined();
      expect(behavior.childRoutedCommands).toBeUndefined();
    });
  });
  
  describe('Policy comparison', () => {
    it('JavaScript should be the only policy with child session support', () => {
      const jsBehavior = JsDebugAdapterPolicy.getDapClientBehavior();
      const pyBehavior = PythonAdapterPolicy.getDapClientBehavior();
      const mockBehavior = MockAdapterPolicy.getDapClientBehavior();
      const defaultBehavior = DefaultAdapterPolicy.getDapClientBehavior();
      
      // Only JavaScript has child routing
      expect(jsBehavior.childRoutedCommands?.size).toBeGreaterThan(0);
      expect(pyBehavior.childRoutedCommands).toBeUndefined();
      expect(mockBehavior.childRoutedCommands).toBeUndefined();
      expect(defaultBehavior.childRoutedCommands).toBeUndefined();
      
      // Only JavaScript mirrors breakpoints
      expect(jsBehavior.mirrorBreakpointsToChild).toBe(true);
      expect(pyBehavior.mirrorBreakpointsToChild).toBe(false);
      expect(mockBehavior.mirrorBreakpointsToChild).toBe(false);
    });
    
    it('all policies should be distinct', () => {
      const policies = [
        JsDebugAdapterPolicy,
        PythonAdapterPolicy,
        MockAdapterPolicy,
        DefaultAdapterPolicy
      ];
      
      const names = policies.map(p => p.name);
      const uniqueNames = new Set(names);
      
      expect(uniqueNames.size).toBe(policies.length);
    });
  });
});
