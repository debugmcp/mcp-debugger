# Java Debugging with Debug MCP Server

The Debug MCP Server provides support for Java debugging through [kotlin-debug-adapter](https://github.com/fwcd/kotlin-debug-adapter) (KDA), a JDI-based DAP server. KDA is vendored with the adapter and requires no separate installation. This document explains how to use the Java debugging capabilities and documents KDA-specific behaviors.

## Prerequisites

Before using the Java debugging features, ensure you have:

1. **JDK 11 or higher** installed from [adoptium.net](https://adoptium.net/) or your OS package manager
2. **`java` and `javac` on your PATH**, or `JAVA_HOME` set

Verify your installation:
```bash
java -version    # Should show JDK 11+
javac -version   # Should show matching version
```

### Compilation Requirements

**You must compile with `javac -g`** (full debug info). Without `-g`, javac omits the `LocalVariableTable` from `.class` files, and the debugger will return empty variable lists even when stopped at a breakpoint.

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

Java supports two debugging modes: **launch** (KDA spawns the JVM) and **attach** (connect to a running JVM with JDWP).

### Launch Mode

KDA starts the JVM and manages the debug session. Best for simple programs.

**Important**: KDA resolves the classpath from Gradle/Maven build output directories under `projectRoot`. It looks for compiled classes in:
- `build/classes/java/main/` and `build/classes/kotlin/main/` (Gradle)
- `target/classes/` (Maven)

For standalone `.java` files without a build system, compile into the Gradle-style output directory:
```bash
mkdir -p build/classes/java/main
javac -g -d build/classes/java/main MyProgram.java
```

### Attach Mode

Connect to a running JVM that was started with JDWP agent. Best for applications, servers, and complex projects.

Start your JVM with JDWP enabled:
```bash
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y \
     -cp . MyProgram
```

- `suspend=y` pauses the JVM until a debugger attaches (recommended for debugging from the start)
- `suspend=n` lets the JVM run immediately (useful for attaching to running servers)

## Debugging Workflow

### 1. Create a Debug Session

```
use_mcp_tool(
  server_name="debug-mcp-server",
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
  server_name="debug-mcp-server",
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/MyProgram.java",
    "line": 15
  }
)
```

### 3a. Start Debugging (Launch Mode)

```
use_mcp_tool(
  server_name="debug-mcp-server",
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/MyProgram.java",
    "dapLaunchArgs": {
      "mainClass": "MyProgram",
      "projectRoot": "/path/to/project",
      "stopOnEntry": false
    }
  }
)
```

Key launch arguments:
- `mainClass` (required): Fully qualified class name with `main()` method
- `projectRoot` (required): Root directory of the project (KDA resolves classpath from here)
- `stopOnEntry`: Whether to pause at the first line of `main()`

### 3b. Attach to Process (Attach Mode)

```
use_mcp_tool(
  server_name="debug-mcp-server",
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

## KDA-Specific Behaviors and Limitations

kotlin-debug-adapter (KDA) has several behaviors that differ from other debug adapters. Understanding these helps avoid common pitfalls.

### Classpath Resolution

KDA does **not** accept explicit classpath configuration in launch arguments. It resolves the classpath automatically from `projectRoot` by searching for:
1. Gradle build output (`build/classes/java/main/`, `build/classes/kotlin/main/`)
2. Maven build output (`target/classes/`)
3. Gradle/Maven dependency resolution

**If you get `ClassNotFoundException`**: Your compiled `.class` files are not in a location KDA recognizes. Either use a proper Gradle/Maven project structure, or compile into `build/classes/java/main/` under your `projectRoot`.

### Deferred Breakpoints (Attach Mode)

When attaching to a JVM with `suspend=y`, breakpoints set before the class is loaded report `verified: true` but **may not fire**. KDA's JDI deferred breakpoint implementation is unreliable for classes not yet loaded.

**Workaround**: After attaching and continuing execution, re-send breakpoints once the target class has loaded. If your program has an initial delay (e.g., `Thread.sleep()`), use that window to re-set breakpoints.

### DAP Initialization Ordering

KDA sends the `initialized` event immediately after the `initialize` response, before receiving `launch` or `attach`. It also blocks the `launch`/`attach` response until `configurationDone` is received. The adapter handles this automatically — no user action needed, but it explains why launch/attach may appear to take slightly longer than other languages.

### Stack Frame Line Numbers

KDA may report line number `0` for some stack frames when source mapping is not fully resolved. This is a known KDA limitation. Frame names and file paths are generally reliable.

### Variable Access Requires Debug Info

JDI (Java Debug Interface) requires the `LocalVariableTable` attribute in `.class` files to access local variables. Without it, `get_local_variables` returns an empty list even when the debugger is paused at a breakpoint.

- `javac -g` includes full debug info (source, lines, and local variables)
- `javac` without `-g` only includes source file name and line numbers
- Most build tools (Gradle, Maven) include debug info by default

### JVM Thread Discovery

The main JVM thread is not always thread ID 1. The adapter automatically discovers threads via the DAP `threads` request and selects the `main` thread. This is handled transparently.

## Example: Launch Mode with Standalone File

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
# Compile with debug info into Gradle-style output directory
mkdir -p build/classes/java/main
javac -g -d build/classes/java/main Calculator.java
```

1. Create debug session with `language: "java"`
2. Set breakpoint at line 4
3. Start debugging with `mainClass: "Calculator"`, `projectRoot: "."`
4. When stopped at breakpoint, inspect variables: `a=10`, `b=20`

## Example: Attach Mode with Running JVM

```bash
# Terminal 1: Start JVM with JDWP
javac -g MyServer.java
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y \
     -cp . MyServer
# Output: "Listening for transport dt_socket at address: 5005"
```

1. Create debug session with `language: "java"`
2. Set breakpoints on desired lines
3. Attach with `port: 5005`, `host: "127.0.0.1"`, `sourcePaths: ["/path/to/source"]`
4. Continue execution to resume the suspended JVM
5. Re-send breakpoints after a brief delay (for class loading)
6. Wait for breakpoint to fire, then inspect variables

## Troubleshooting

### "ClassNotFoundException" in launch mode
- KDA resolves classpath from Gradle/Maven build output directories under `projectRoot`
- Compile into `build/classes/java/main/` or use a proper build system
- Verify the `mainClass` name matches the class with `public static void main()`

### Empty variables list
- Compile with `javac -g` to include `LocalVariableTable`
- Verify you're paused at an executable line, not a declaration or comment
- Check that the source file matches the compiled class (recompile after edits)

### Breakpoints not firing (attach mode)
- Re-send breakpoints after the target class is loaded
- Use `suspend=y` and add a delay in your program before the breakpoint target
- Ensure the breakpoint is on an executable line

### "Java not found" error
- Ensure JDK 11+ is installed: `java -version`
- Set `JAVA_HOME` or ensure `java` is on your PATH

### Connection timeout (attach mode)
- Verify the JDWP port is correct and the JVM is listening
- Check for firewall rules blocking the port
- Ensure `server=y` is set in the JDWP agent string

## Additional Resources

- [kotlin-debug-adapter](https://github.com/fwcd/kotlin-debug-adapter) — KDA source and documentation
- [Java Debug Interface (JDI)](https://docs.oracle.com/en/java/javase/17/docs/api/jdk.jdi/module-summary.html) — JVM debugging API
- [JDWP Reference](https://docs.oracle.com/en/java/javase/17/docs/specs/jdwp/jdwp-spec.html) — Wire protocol specification
- [DAP Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
