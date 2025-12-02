import { describe, it, expect } from 'vitest';
import { JdbParser } from '../../src/utils/jdb-parser.js';

describe('JdbParser', () => {
  describe('parseStoppedEvent', () => {
    it('parses breakpoint hit with quoted thread name', () => {
      const output = 'Breakpoint hit: "thread=main", HelloWorld.main(), line=10 bci=0';
      const event = JdbParser.parseStoppedEvent(output);

      expect(event).not.toBeNull();
      expect(event?.reason).toBe('breakpoint');
      expect(event?.threadName).toBe('main');
      expect(event?.location?.className).toBe('HelloWorld');
      expect(event?.location?.methodName).toBe('main');
      expect(event?.location?.line).toBe(10);
    });

    it('parses breakpoint hit without quotes', () => {
      const output = 'Breakpoint hit: thread=Worker-1, Example.calculate(), line=25';
      const event = JdbParser.parseStoppedEvent(output);

      expect(event).not.toBeNull();
      expect(event?.reason).toBe('breakpoint');
      expect(event?.threadName).toBe('Worker-1');
      expect(event?.location?.className).toBe('Example');
      expect(event?.location?.methodName).toBe('calculate');
      expect(event?.location?.line).toBe(25);
    });

    it('parses step completed event', () => {
      const output = 'Step completed: "thread=main", HelloWorld.main(), line=11';
      const event = JdbParser.parseStoppedEvent(output);

      expect(event).not.toBeNull();
      expect(event?.reason).toBe('step');
      expect(event?.threadName).toBe('main');
      expect(event?.location?.line).toBe(11);
    });

    it('returns null for non-matching output', () => {
      const output = 'Some other jdb output';
      const event = JdbParser.parseStoppedEvent(output);
      expect(event).toBeNull();
    });
  });

  describe('parseStackTrace', () => {
    it('parses stack frames from where command', () => {
      const output = `
  [1] HelloWorld.main (HelloWorld.java:10)
  [2] sun.reflect.NativeMethodAccessorImpl.invoke0 (native method)
  [3] Example.calculate (Example.java:45)
`;
      const frames = JdbParser.parseStackTrace(output);

      expect(frames).toHaveLength(3);
      expect(frames[0].id).toBe(1);
      expect(frames[0].name).toBe('HelloWorld.main');
      expect(frames[0].className).toBe('HelloWorld');
      expect(frames[0].methodName).toBe('main');
      expect(frames[0].file).toBe('HelloWorld.java');
      expect(frames[0].line).toBe(10);

      // Native method
      expect(frames[1].id).toBe(2);
      expect(frames[1].file).toBe('<native>');
      expect(frames[1].line).toBe(0);

      expect(frames[2].id).toBe(3);
      expect(frames[2].line).toBe(45);
    });

    it('returns empty array for non-matching output', () => {
      const output = 'No frames available';
      const frames = JdbParser.parseStackTrace(output);
      expect(frames).toHaveLength(0);
    });
  });

  describe('parseLocals', () => {
    it('parses primitive variables', () => {
      const output = `
Method arguments:
Local variables:
  count = 42
  message = "Hello, World!"
  flag = true
`;
      const variables = JdbParser.parseLocals(output);

      expect(variables).toHaveLength(3);

      expect(variables[0].name).toBe('count');
      expect(variables[0].value).toBe('42');
      expect(variables[0].type).toBe('int');
      expect(variables[0].expandable).toBe(false);

      expect(variables[1].name).toBe('message');
      expect(variables[1].value).toBe('"Hello, World!"');
      expect(variables[1].type).toBe('java.lang.String');
      expect(variables[1].expandable).toBe(false);

      expect(variables[2].name).toBe('flag');
      expect(variables[2].value).toBe('true');
      expect(variables[2].type).toBe('boolean');
      expect(variables[2].expandable).toBe(false);
    });

    it('parses object instances', () => {
      const output = `
Local variables:
  args = instance of java.lang.String[0] (id=123)
  obj = instance of com.example.MyClass (id=456)
`;
      const variables = JdbParser.parseLocals(output);

      expect(variables).toHaveLength(2);

      expect(variables[0].name).toBe('args');
      expect(variables[0].value).toBe('instance of java.lang.String[0]');
      expect(variables[0].type).toBe('java.lang.String[0]');
      expect(variables[0].expandable).toBe(true);
      expect(variables[0].objectId).toBe('123');

      expect(variables[1].name).toBe('obj');
      expect(variables[1].type).toBe('com.example.MyClass');
      expect(variables[1].expandable).toBe(true);
      expect(variables[1].objectId).toBe('456');
    });

    it('parses null values', () => {
      const output = `
Local variables:
  obj = null
`;
      const variables = JdbParser.parseLocals(output);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('obj');
      expect(variables[0].value).toBe('null');
      expect(variables[0].type).toBe('null');
      expect(variables[0].expandable).toBe(false);
    });
  });

  describe('parseThreads', () => {
    it('parses thread list with groups', () => {
      const output = `
Group system:
  (java.lang.ref.Reference$ReferenceHandler)0x1   Reference Handler
  (java.lang.ref.Finalizer$FinalizerThread)0x2    Finalizer
Group main:
  (java.lang.Thread)0x3                            main running
`;
      const threads = JdbParser.parseThreads(output);

      expect(threads).toHaveLength(3);

      expect(threads[0].id).toBe(1);
      expect(threads[0].name).toBe('Reference Handler');
      expect(threads[0].groupName).toBe('system');

      expect(threads[1].id).toBe(2);
      expect(threads[1].name).toBe('Finalizer');

      expect(threads[2].id).toBe(3);
      expect(threads[2].name).toBe('main');
      expect(threads[2].state).toBe('running');
      expect(threads[2].groupName).toBe('main');
    });
  });

  describe('isPrompt', () => {
    it('recognizes main prompt', () => {
      expect(JdbParser.isPrompt('main[1] ')).toBe(true);
      expect(JdbParser.isPrompt('main[2] ')).toBe(true);
    });

    it('recognizes simple prompt', () => {
      expect(JdbParser.isPrompt('> ')).toBe(true);
    });

    it('rejects non-prompt output', () => {
      expect(JdbParser.isPrompt('Breakpoint hit')).toBe(false);
      expect(JdbParser.isPrompt('Some output')).toBe(false);
    });
  });

  describe('extractPrompt', () => {
    it('extracts prompt from output', () => {
      const output = 'Some output\nmain[1] ';
      expect(JdbParser.extractPrompt(output)).toBe('main[1]');
    });

    it('returns null for no prompt', () => {
      const output = 'No prompt here';
      expect(JdbParser.extractPrompt(output)).toBeNull();
    });
  });

  describe('isVMStarted', () => {
    it('detects VM Started message', () => {
      expect(JdbParser.isVMStarted('VM Started: No frames on the current call stack')).toBe(true);
      expect(JdbParser.isVMStarted('VM initialized')).toBe(true);
    });

    it('rejects non-start messages', () => {
      expect(JdbParser.isVMStarted('Breakpoint hit')).toBe(false);
    });
  });

  describe('isTerminated', () => {
    it('detects termination messages', () => {
      expect(JdbParser.isTerminated('The application exited')).toBe(true);
      expect(JdbParser.isTerminated('application exited')).toBe(true);
      expect(JdbParser.isTerminated('VM disconnected')).toBe(true);
    });

    it('rejects non-termination messages', () => {
      expect(JdbParser.isTerminated('Breakpoint hit')).toBe(false);
    });
  });

  describe('parseError', () => {
    it('parses unable to set breakpoint error', () => {
      const output = 'Unable to set breakpoint HelloWorld:10: No code at line 10 in HelloWorld';
      const error = JdbParser.parseError(output);
      expect(error).toContain('Unable to set breakpoint');
    });

    it('parses class not found error', () => {
      const output = 'Class HelloWorld not found';
      const error = JdbParser.parseError(output);
      expect(error).toContain('HelloWorld not found');
    });

    it('returns null for non-error output', () => {
      const output = 'Breakpoint hit: main[1]';
      const error = JdbParser.parseError(output);
      expect(error).toBeNull();
    });
  });

  describe('parseBreakpointSet', () => {
    it('parses breakpoint set confirmation', () => {
      const output = 'Set breakpoint HelloWorld:10';
      const result = JdbParser.parseBreakpointSet(output);

      expect(result).not.toBeNull();
      expect(result?.className).toBe('HelloWorld');
      expect(result?.line).toBe(10);
    });

    it('returns null for non-matching output', () => {
      const output = 'Unable to set breakpoint';
      const result = JdbParser.parseBreakpointSet(output);
      expect(result).toBeNull();
    });
  });

  describe('parseBreakpointCleared', () => {
    it('detects breakpoint cleared confirmation', () => {
      expect(JdbParser.parseBreakpointCleared('Removed: breakpoint HelloWorld:10')).toBe(true);
      expect(JdbParser.parseBreakpointCleared('Cleared breakpoint HelloWorld:10')).toBe(true);
    });

    it('returns false for non-matching output', () => {
      expect(JdbParser.parseBreakpointCleared('Unable to clear')).toBe(false);
    });
  });
});
