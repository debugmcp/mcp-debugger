# Java Debugging with Debug MCP Server

The Debug MCP Server provides Java debugging through a JDI bridge (`JdiDapServer.java`) — a single Java file that implements DAP over TCP using JDI (`com.sun.jdi.*`) directly. JDI ships with every JDK, so there are zero external dependencies.

## Architecture

```
MCP Client → MCP Server → ProxyManager → TCP → JdiDapServer (JVM)
                                                    ↓
                                              JDI (com.sun.jdi.*)
                                                    ↓
                                              Target JVM (via JDWP)
```

JdiDapServer is a ~1000-line Java program that:
- Accepts DAP requests over TCP (Content-Length framed JSON)
- Uses JDI to launch or attach to a target JVM
- Handles deferred breakpoints via `ClassPrepareRequest` for classes not yet loaded
- Maps JDI events (breakpoints, steps, thread events) to DAP events
- Compiles with `javac --release 11` (no external dependencies)

## Prerequisites

1. **JDK 11 or higher** installed from [adoptium.net](https://adoptium.net/) or your OS package manager
2. **`java` and `javac` on your PATH**, or `JAVA_HOME` set

Verify your installation:
```bash
java -version    # Should show JDK 11+
javac -version   # Should show matching version
```

### Compilation Requirements

**You must compile target code with `javac -g`** (full debug info). Without `-g`, javac omits the `LocalVariableTable` from `.class` files, and the debugger will return empty variable lists even when stopped at a breakpoint.

```bash
# Correct: includes LocalVariableTable for variable inspection
javac -g MyProgram.java

# Wrong: variables will be empty in the debugger
javac MyProgram.java
```

If you use a build tool:
- **Gradle**: Debug info is included by default (`-g` is the default for `compileJava`)
- **Maven**: Debug info is included by default (`maven-compiler-plugin` uses `-g` by default)

## Debugging Modes

### Launch Mode

JDI bridge spawns the JVM and connects via JDI. Pass `mainClass` and `classpath` directly.

```
use_mcp_tool(
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/MyProgram.java",
    "dapLaunchArgs": {
      "mainClass": "MyProgram",
      "classpath": "/path/to/classes",
      "cwd": "/path/to/project",
      "stopOnEntry": false
    }
  }
)
```

Key launch arguments:
- `mainClass` (required): Fully qualified class name with `main()` method
- `classpath` (required): Directory or classpath containing compiled `.class` files
- `cwd`: Working directory for the launched JVM
- `stopOnEntry`: Whether to pause at the first line of `main()`

### Attach Mode

Connect to a running JVM that was started with JDWP agent.

Start your JVM with JDWP enabled:
```bash
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y \
     -cp . MyProgram
```

- `suspend=y` pauses the JVM until a debugger attaches (recommended for debugging from the start)
- `suspend=n` lets the JVM run immediately (useful for attaching to running servers)

```
use_mcp_tool(
  tool_name="attach_to_process",
  arguments={
    "sessionId": "your-session-id",
    "port": 5005,
    "host": "127.0.0.1",
    "sourcePaths": ["/path/to/source"]
  }
)
```

Key attach arguments:
- `port` (required): JDWP debug port
- `host`: Target hostname (default: `127.0.0.1`)
- `sourcePaths`: Directories containing `.java` source files for source mapping

## Debugging Workflow

### 1. Create a Debug Session

```
use_mcp_tool(
  tool_name="create_debug_session",
  arguments={
    "language": "java",
    "name": "My Java Debug Session"
  }
)
```

### 2. Set Breakpoints

Set breakpoints before starting/attaching. Breakpoints must be on executable lines (assignments, method calls, conditionals) — not on blank lines, comments, or declarations.

```
use_mcp_tool(
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/MyProgram.java",
    "line": 15
  }
)
```

### 3. Start or Attach

Use `start_debugging` for launch mode or `attach_to_process` for attach mode (see above).

### 4. Control Execution

When paused at a breakpoint:

```
# Step over (execute current line)
use_mcp_tool(tool_name="step_over", arguments={"sessionId": "..."})

# Step into (enter function calls)
use_mcp_tool(tool_name="step_into", arguments={"sessionId": "..."})

# Step out (return from current function)
use_mcp_tool(tool_name="step_out", arguments={"sessionId": "..."})

# Continue (run until next breakpoint)
use_mcp_tool(tool_name="continue_execution", arguments={"sessionId": "..."})
```

### 5. Examine Program State

```
# Get local variables in current frame
use_mcp_tool(tool_name="get_local_variables", arguments={"sessionId": "..."})

# Get call stack
use_mcp_tool(tool_name="get_stack_trace", arguments={"sessionId": "..."})

# Evaluate an expression
use_mcp_tool(
  tool_name="evaluate_expression",
  arguments={"sessionId": "...", "expression": "x + y"}
)
```

### 6. Close the Session

```
use_mcp_tool(tool_name="close_debug_session", arguments={"sessionId": "..."})
```

## Deferred Breakpoints

JDI bridge handles deferred breakpoints natively via `ClassPrepareRequest`. When you set a breakpoint on a class that hasn't been loaded yet:

1. JdiDapServer registers a `ClassPrepareRequest` filter for the class name
2. When the JVM loads the class, JDI fires a `ClassPrepareEvent`
3. JdiDapServer resolves the breakpoint location and sets a `BreakpointRequest`
4. A `breakpoint(verified=true)` event is sent to the client

No manual breakpoint re-sends are needed — this works transparently in both launch and attach modes.

## Example: Launch Mode

```java
// Calculator.java
public class Calculator {
    static int add(int a, int b) {
        int result = a + b;   // Set breakpoint here (line 4)
        return result;
    }

    public static void main(String[] args) {
        int sum = add(10, 20);
        System.out.println("Sum: " + sum);
    }
}
```

```bash
# Compile with debug info
javac -g Calculator.java
```

1. Create debug session with `language: "java"`
2. Set breakpoint at line 4
3. Start debugging with `mainClass: "Calculator"`, `classpath: "."`
4. When stopped at breakpoint, inspect variables: `a=10`, `b=20`

## Example: Attach Mode

```bash
# Terminal 1: Start JVM with JDWP
javac -g MyServer.java
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y \
     -cp . MyServer
# Output: "Listening for transport dt_socket at address: 5005"
```

1. Create debug session with `language: "java"`
2. Set breakpoints on desired lines
3. Attach with `port: 5005`, `host: "127.0.0.1"`, `sourcePaths: ["."]`
4. Continue execution to resume the suspended JVM
5. Wait for breakpoint to fire, then inspect variables

## Troubleshooting

### Empty variables list
- Compile with `javac -g` to include `LocalVariableTable`
- Verify you're paused at an executable line, not a declaration or comment
- Check that the source file matches the compiled class (recompile after edits)

### Breakpoints not firing
- Ensure the breakpoint is on an executable line (not a comment, blank line, or import)
- Verify the class name in the source path matches what the JVM loads
- In attach mode with `suspend=y`, you must `continue_execution` after attaching to let the program run to the breakpoint

### "Java not found" error
- Ensure JDK 11+ is installed: `java -version`
- Set `JAVA_HOME` or ensure `java` is on your PATH

### Connection timeout (attach mode)
- Verify the JDWP port is correct and the JVM is listening
- Check for firewall rules blocking the port
- Ensure `server=y` is set in the JDWP agent string

## Additional Resources

- [Java Debug Interface (JDI)](https://docs.oracle.com/en/java/javase/17/docs/api/jdk.jdi/module-summary.html) — JVM debugging API
- [JDWP Reference](https://docs.oracle.com/en/java/javase/17/docs/specs/jdwp/jdwp-spec.html) — Wire protocol specification
- [DAP Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
