/**
 * JDB Output Parser
 *
 * Parses jdb's text-based output into structured data for DAP protocol.
 * jdb outputs unstructured text, so we use regex patterns to extract information.
 *
 * @since 1.0.0
 */

/**
 * Represents a parsed stopped event from jdb
 */
export interface JdbStoppedEvent {
  reason: 'breakpoint' | 'step' | 'pause' | 'entry';
  threadName: string;
  threadId: number;
  location?: {
    className: string;
    methodName: string;
    line: number;
  };
}

/**
 * Represents a parsed stack frame
 */
export interface JdbStackFrame {
  id: number;
  name: string;
  className: string;
  methodName: string;
  file: string;
  line: number;
}

/**
 * Represents a parsed variable
 */
export interface JdbVariable {
  name: string;
  value: string;
  type: string;
  expandable: boolean;
  objectId?: string;
}

/**
 * Represents a parsed thread
 */
export interface JdbThread {
  id: number;
  name: string;
  state: string;
  groupName?: string;
}

/**
 * Parser for jdb text output
 */
export class JdbParser {
  /**
   * Parse a breakpoint hit message from jdb
   *
   * Example input:
   * "Breakpoint hit: "thread=main", HelloWorld.main(), line=10 bci=0"
   * "Breakpoint hit: thread=Thread-1, Worker.run(), line=25"
   */
  static parseStoppedEvent(output: string): JdbStoppedEvent | null {
    // Pattern 1: Breakpoint hit: "thread=main", HelloWorld.main(), line=10 bci=0
    // Also handles: Breakpoint hit: "thread=AWT-EventQueue-0", ClassName.method(), line=189
    const breakpointMatch = output.match(
      /Breakpoint hit:.*"?thread=([^,"]+)"?[,"].*?\s+([\w.]+)\.([\w]+)\(\).*?line=(\d+)/i
    );

    if (breakpointMatch) {
      const [, threadName, className, methodName, lineStr] = breakpointMatch;
      return {
        reason: 'breakpoint',
        threadName: threadName.trim(),
        threadId: this.threadNameToId(threadName.trim()),
        location: {
          className: className.trim(),
          methodName: methodName.trim(),
          line: parseInt(lineStr, 10)
        }
      };
    }

    // Pattern 2: Step completed: "thread=main", HelloWorld.main(), line=11
    const stepMatch = output.match(
      /Step completed:.*"?thread=([^,"]+)"?[,"].*?\s+([\w.]+)\.([\w]+)\(\).*?line=(\d+)/i
    );

    if (stepMatch) {
      const [, threadName, className, methodName, lineStr] = stepMatch;
      return {
        reason: 'step',
        threadName: threadName.trim(),
        threadId: this.threadNameToId(threadName.trim()),
        location: {
          className: className.trim(),
          methodName: methodName.trim(),
          line: parseInt(lineStr, 10)
        }
      };
    }

    return null;
  }

  /**
   * Parse stack trace from jdb 'where' command
   *
   * Example input:
   * "  [1] HelloWorld.main (HelloWorld.java:10)"
   * "  [2] sun.reflect.NativeMethodAccessorImpl.invoke0 (native method)"
   * "  [3] Example.calculate (Example.java:45)"
   */
  static parseStackTrace(output: string): JdbStackFrame[] {
    const frames: JdbStackFrame[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Pattern: [1] HelloWorld.main (HelloWorld.java:10)
      const match = line.match(/\[(\d+)\]\s+([\w.]+)\.([\w]+)\s*\(([^:)]+):(\d+)\)/);

      if (match) {
        const [, idStr, className, methodName, file, lineStr] = match;
        frames.push({
          id: parseInt(idStr, 10),
          name: `${className}.${methodName}`,
          className: className.trim(),
          methodName: methodName.trim(),
          file: file.trim(),
          line: parseInt(lineStr, 10)
        });
      } else {
        // Handle native methods: [2] sun.reflect.NativeMethodAccessorImpl.invoke0 (native method)
        const nativeMatch = line.match(/\[(\d+)\]\s+([\w.]+)\.([\w]+)\s*\(native method\)/);
        if (nativeMatch) {
          const [, idStr, className, methodName] = nativeMatch;
          frames.push({
            id: parseInt(idStr, 10),
            name: `${className}.${methodName}`,
            className: className.trim(),
            methodName: methodName.trim(),
            file: '<native>',
            line: 0
          });
        }
      }
    }

    return frames;
  }

  /**
   * Parse local variables from jdb 'locals' command
   *
   * Example input:
   * "Method arguments:"
   * "  args = instance of java.lang.String[0] (id=123)"
   * "Local variables:"
   * "  count = 42"
   * "  message = "Hello, World!""
   * "  obj = instance of com.example.MyClass (id=456)"
   */
  static parseLocals(output: string): JdbVariable[] {
    const variables: JdbVariable[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Skip section headers
      if (line.match(/^(Method arguments|Local variables):/)) {
        continue;
      }

      // Pattern 1: Primitive or simple value
      // count = 42
      const primitiveMatch = line.match(/^\s+(\w+)\s*=\s*([^(]+?)$/);
      if (primitiveMatch) {
        const [, name, value] = primitiveMatch;
        variables.push({
          name: name.trim(),
          value: value.trim(),
          type: this.inferType(value.trim()),
          expandable: false
        });
        continue;
      }

      // Pattern 2: Object instance
      // args = instance of java.lang.String[0] (id=123)
      const objectMatch = line.match(/^\s+(\w+)\s*=\s*instance of\s+([\w.[\]]+)\s*\(id=(\d+)\)/);
      if (objectMatch) {
        const [, name, type, id] = objectMatch;
        variables.push({
          name: name.trim(),
          value: `instance of ${type}`,
          type: type.trim(),
          expandable: true,
          objectId: id
        });
        continue;
      }

      // Pattern 3: Null value
      // obj = null
      const nullMatch = line.match(/^\s+(\w+)\s*=\s*null/);
      if (nullMatch) {
        const [, name] = nullMatch;
        variables.push({
          name: name.trim(),
          value: 'null',
          type: 'null',
          expandable: false
        });
      }
    }

    return variables;
  }

  /**
   * Parse thread list from jdb 'threads' command
   *
   * Example input:
   * "Group system:"
   * "  (java.lang.ref.Reference$ReferenceHandler)0x1   Reference Handler"
   * "  (java.lang.ref.Finalizer$FinalizerThread)0x2    Finalizer"
   * "Group main:"
   * "  (java.lang.Thread)0x3                            main running"
   */
  static parseThreads(output: string): JdbThread[] {
    const threads: JdbThread[] = [];
    const lines = output.split('\n');
    let currentGroup = '';

    for (const line of lines) {
      // Check for group header
      const groupMatch = line.match(/^Group\s+(.+):$/);
      if (groupMatch) {
        currentGroup = groupMatch[1].trim();
        continue;
      }

      // Parse thread line
      // (java.lang.Thread)1   main running
      // Thread ID can be decimal or hex (0x...)
      const threadMatch = line.match(/\(([^)]+)\)((?:0x)?[\da-fA-F]+)\s+(.+?)(?:\s+(running|waiting|suspended|cond\.\s*waiting))?$/);
      if (threadMatch) {
        const [, _className, threadId, name, state] = threadMatch;
        // Parse as hex if starts with 0x, otherwise decimal
        const id = threadId.startsWith('0x') ? parseInt(threadId, 16) : parseInt(threadId, 10);

        threads.push({
          id,
          name: name.trim(),
          state: state ? state.trim() : 'unknown',
          groupName: currentGroup
        });
      }
    }

    return threads;
  }

  /**
   * Check if output indicates jdb is ready for commands
   * jdb prompts look like: "main[1] " or "> "
   */
  static isPrompt(output: string): boolean {
    // Match patterns like "main[1] " or "> " at the end of any line
    // Use multiline mode to match at end of lines, not just end of string
    return /(>|\w+\[\d+\])\s*$/m.test(output);
  }

  /**
   * Extract the main prompt from jdb output
   */
  static extractPrompt(output: string): string | null {
    const match = output.match(/(>|\w+\[\d+\])\s*$/m);
    return match ? match[1] : null;
  }

  /**
   * Check if output indicates a VM has started
   * Example: "VM Started: No frames on the current call stack"
   */
  static isVMStarted(output: string): boolean {
    return output.includes('VM Started') || output.includes('VM initialized');
  }

  /**
   * Check if output indicates program termination
   * Example: "The application exited"
   */
  static isTerminated(output: string): boolean {
    return output.includes('The application exited') ||
           output.includes('application exited') ||
           output.includes('VM disconnected');
  }

  /**
   * Parse error messages from jdb
   */
  static parseError(output: string): string | null {
    // Common error patterns
    const errorPatterns = [
      /Unable to set breakpoint (.+): (.+)/,
      /No such file or directory: (.+)/,
      /Class (.+) not found/,
      /Invalid command: (.+)/,
      /(.+): No such file or directory/
    ];

    for (const pattern of errorPatterns) {
      const match = output.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // Generic error detection
    if (output.toLowerCase().includes('error') || output.toLowerCase().includes('exception')) {
      return output.trim();
    }

    return null;
  }

  /**
   * Convert thread name to numeric ID (for DAP protocol)
   * This is a simple hash function for consistency
   */
  private static threadNameToId(threadName: string): number {
    let hash = 0;
    for (let i = 0; i < threadName.length; i++) {
      const char = threadName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Infer Java type from value string
   */
  private static inferType(value: string): string {
    // Remove quotes if present
    const trimmed = value.trim();

    // String literal
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return 'java.lang.String';
    }

    // Boolean
    if (trimmed === 'true' || trimmed === 'false') {
      return 'boolean';
    }

    // Null
    if (trimmed === 'null') {
      return 'null';
    }

    // Number (integer)
    if (/^-?\d+$/.test(trimmed)) {
      return 'int';
    }

    // Number (floating point)
    if (/^-?\d+\.\d+$/.test(trimmed)) {
      return 'double';
    }

    // Default to Object
    return 'java.lang.Object';
  }

  /**
   * Parse breakpoint set confirmation
   * Example: "Set breakpoint HelloWorld:10"
   * Example: "Set uncaught java.lang.Throwable"
   */
  static parseBreakpointSet(output: string): { className: string; line: number } | null {
    const match = output.match(/Set breakpoint\s+([^:]+):(\d+)/);
    if (match) {
      return {
        className: match[1].trim(),
        line: parseInt(match[2], 10)
      };
    }
    return null;
  }

  /**
   * Parse breakpoint cleared confirmation
   * Example: "Removed: breakpoint HelloWorld:10"
   */
  static parseBreakpointCleared(output: string): boolean {
    return output.includes('Removed: breakpoint') || output.includes('Cleared breakpoint');
  }
}
