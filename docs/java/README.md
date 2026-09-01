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

JdiDapServer is a single-file Java program that:
- Accepts DAP requests over TCP (Content-Length framed JSON)
- Uses JDI to launch or attach to a target JVM
- Handles deferred breakpoints via `ClassPrepareRequest` for classes not yet loaded
- Maps JDI events (breakpoints, steps, thread events) to DAP events
- Compiles with `javac --release 21` (no external dependencies)

## Prerequisites

1. **JDK 21+ recommended** (installed from [adoptium.net](https://adoptium.net/) or your OS package manager). The adapter factory emits a warning for JDK versions below 21 but does not block execution; lower versions may work in practice.
2. **`java` on your PATH** (or `JAVA_HOME` set) for running the JDI bridge; **`javac`** is additionally needed to compile the bridge on first use and to compile your target Java sources with debug info

Verify your installation:
```bash
java -version    # Should show JDK 21+
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

JDI bridge spawns the JVM and connects via JDI. The adapter derives `mainClass` from the `program` field in the launch configuration and forwards `classpath`, `vmArgs`, `javaPath`, and the program `args`.

Put the Java-specific keys in `start_debugging`'s `adapterLaunchConfig` — the parameter reserved for adapter-specific overrides — and leave standard DAP keys such as `stopOnEntry` in `dapLaunchArgs`. Both objects are merged into the one launch config the adapter transforms, so either container reaches the bridge; `adapterLaunchConfig` is the documented home (see [tool reference](../tool-reference.md#start_debugging)).

```text
start_debugging { "sessionId": "your-session-id",
                  "scriptPath": "/path/to/MyProgram.java",
                  "args": ["--verbose"],
                  "adapterLaunchConfig": { "classpath": "/path/to/classes" },
                  "dapLaunchArgs": { "stopOnEntry": true } }
```

Key launch arguments:
- `mainClass` is **derived, not passed**: the adapter reads the launch config's `program` (which defaults to `scriptPath`) and turns a `.java` path into its base name — `/path/to/MyProgram.java` yields `MyProgram`. Any other `program` value is used verbatim, so `"adapterLaunchConfig": {"program": "com.example.Main"}` names a fully-qualified class that does not match the file name. A `mainClass` key you pass yourself is overwritten by this derivation.
- `classpath`: Directory or classpath containing compiled `.class` files (default: `'.'`; typically needed — the JVM will not find your classes without it). Make it **absolute**: the bridge launches the JVM in its own working directory, so a relative classpath resolves against the server's cwd, not your project.
- `stopOnEntry`: Whether to pause at the first line of `main()`. **Through `start_debugging` the
  effective default is `false`** — the session layer merges `{ stopOnEntry: false, justMyCode: true }`
  underneath your `dapLaunchArgs` (`src/session/session-manager-core.ts:198`), so the Java adapter's
  own `?? true` fallback never fires on this path. Pass `"stopOnEntry": true` explicitly to pause at
  entry. (The adapter-level default of `true` is real but only observable when calling
  `transformLaunchConfig` directly, as the unit tests do.)
- `javaPath`: Path to the `java` executable (overrides auto-detection)
- `vmArgs`: Additional JVM arguments as one space-separated string (e.g., `"-Xmx512m"`)
- Program arguments come from `start_debugging`'s top-level `args` array and are appended after the main class

### Attach Mode

Connect to a running JVM that was started with JDWP agent.

Start your JVM with JDWP enabled:
```bash
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y \
     -cp . MyProgram
```

- `suspend=y` pauses the JVM until a debugger attaches (recommended for debugging from the start)
- `suspend=n` lets the JVM run immediately (useful for attaching to running servers)

```text
attach_to_process { "sessionId": "your-session-id", "host": "localhost", "port": 5005 }
```

Key attach arguments:
- `port` (required): JDWP debug port
- `host`: Target hostname (default: `localhost`; `hostName` is accepted as an alias)
- `stopOnEntry`: asks the bridge to suspend the VM on attach. The bridge's own default for this
  argument is `false` (`JdiDapServer.java:342`), but you will normally see the session paused
  anyway: `JavaAdapterPolicy` declares `getAttachBehavior: () => ({ pauseAfterAttach: true,
  pauseAllThreads: true })`, so mcp-debugger issues a pause of its own once the attach is verified.

Those three are the only keys the JDI bridge's **attach handler** reads. That is a statement about
the bridge, not about `attach_to_process` as a whole — `verifyTimeout`, `breakOnExceptions` and
`adapterConfig` are consumed by mcp-debugger's own attach controller before the bridge is
involved, and never reach it. There is no source-path list to configure: breakpoints resolve
classes from the `file` you give `set_breakpoint`, which may be a path or a fully-qualified
class name.

## Debugging Workflow

### 1. Create a Debug Session

```text
create_debug_session { "language": "java", "name": "My Java Debug Session" }
```

### 2. Set Breakpoints

Set breakpoints before starting/attaching. Breakpoints must be on executable lines (assignments, method calls, conditionals) — not on blank lines, comments, or declarations. Conditional breakpoints (with a `condition` expression) and exception breakpoints are also supported by the JDI bridge. On an exception stop the bridge answers the DAP `exceptionInfo` request, so `lastStop.exceptionInfo` (exception class, break mode, message, stack trace) is populated shortly after the pause.

```text
set_breakpoint { "sessionId": "your-session-id", "file": "/path/to/MyProgram.java", "line": 15 }
```

### 3. Start or Attach

Use `start_debugging` for launch mode or `attach_to_process` for attach mode (see above).

### 4. Control Execution

When paused at a breakpoint:

```text
# Step over (execute current line)
step_over { "sessionId": "..." }

# Step into (enter function calls)
step_into { "sessionId": "..." }

# Step out (return from current function)
step_out { "sessionId": "..." }

# Continue (run until next breakpoint)
continue_execution { "sessionId": "..." }
```

### 5. Examine Program State

```text
# Get local variables in current frame
get_local_variables { "sessionId": "..." }

# Get call stack
get_stack_trace { "sessionId": "..." }

# Evaluate an expression (frameId is optional; defaults to top frame)
# The evaluator supports field access, method calls, arithmetic, and string concatenation
evaluate_expression { "sessionId": "...", "expression": "x + y", "frameId": 0 }
```

### 6. Close the Session

```text
close_debug_session { "sessionId": "..." }
```

## Deferred Breakpoints

JDI bridge handles deferred breakpoints natively via `ClassPrepareRequest`. When you set a breakpoint on a class that hasn't been loaded yet:

1. JdiDapServer registers a `ClassPrepareRequest` filter for the class name
2. When the JVM loads the class, JDI fires a `ClassPrepareEvent`
3. JdiDapServer resolves the breakpoint location and sets a `BreakpointRequest`
4. A `breakpoint(verified=true)` event is sent to the client

No manual breakpoint re-sends are needed — this works transparently in both launch and attach modes.

## Function Breakpoints

`set_breakpoint {function: "name"}` breaks on entry to a method by name — no file or line (issue #292). The bridge plants a `BreakpointRequest` at each concrete overload's entry location (the same technique jdb's `stop in` uses — full speed, no `MethodEntryRequest` overhead).

- **Name forms**: bare `helper`, class-qualified `Foo.helper` / `com.example.Foo.helper` / `Outer.Inner.helper`, constructors `Foo.<init>`. The rightmost dot always splits class from method (method names cannot contain dots).
- **Overloads**: every concrete overload binds; abstract and native methods are skipped (no bytecode). The response reports the first bound location as `boundLine`. An inherited method binds at the superclass's bytecode, so it also fires for sibling subclasses.
- **Deferral**: at launch no user classes are loaded yet, so binding normally happens on `ClassPrepareEvent` — the breakpoint reports pending in the response, then flips to verified via a breakpoint `changed` event. Qualified names register narrow class-prepare filters; bare names share one unfiltered watch that excludes JDK internals (`java.*`, `javax.*`, `sun.*`, `jdk.*`, `com.sun.*`), which also means a bare name cannot target a JDK method — qualify the class if you need that. While any bare-name function breakpoint exists, each non-JDK class load costs one suspend/resume round-trip (same class of overhead as deferred line breakpoints).
- **Conditions**: `condition` works exactly like line-breakpoint conditions (evaluated on hit; evaluation errors default to breaking).
- Stops report `reason: "function breakpoint"`.

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
3. Start debugging with `scriptPath: "/abs/path/Calculator.java"` and `adapterLaunchConfig: {"classpath": "/abs/path"}` (the directory holding `Calculator.class`)
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
3. Attach with `port: 5005`, `host: "localhost"`
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
- Ensure JDK 21+ is installed: `java -version`
- Set `JAVA_HOME` or ensure `java` is on your PATH

### Connection timeout (attach mode)
- Verify the JDWP port is correct and the JVM is listening
- Check for firewall rules blocking the port
- Ensure `server=y` is set in the JDWP agent string

## Hot Reload (redefine_classes)

The `redefine_classes` MCP tool hot-swaps changed Java classes into a running JVM using JDI's `VirtualMachine.redefineClasses()`. This enables edit-compile-reload workflows without restarting the debug session.

### Workflow

1. **Attach** to a running JVM (or launch a debug session)
2. **Edit** your Java source files
3. **Recompile** with `javac -g` to produce updated `.class` files
4. **Call `redefine_classes`** with the classes directory:
   ```json
   {
     "sessionId": "your-session-id",
     "classesDir": "/project/build/classes/java/main",
     "sinceTimestamp": 0
   }
   ```
5. The tool scans for `.class` files, matches them against loaded classes, and redefines them
6. Use the returned `newestTimestamp` as `sinceTimestamp` on subsequent calls for incremental updates

### Limitations

- **No schema changes**: Adding or removing methods, fields, or interfaces will fail for the affected class (reported in the `failed` array). Other classes in the same call are still redefined successfully.
- **Class must be loaded**: Only classes already loaded by the JVM can be redefined. Unloaded classes are silently skipped (reported in `skippedNotLoaded`).
- **JVM support**: Requires a JVM that supports class redefinition (HotSpot does; some minimal JVMs may not).
- **Java only**: This tool is specific to Java debug sessions — it relies on JDI, which is a JVM-specific API.

### Example Output

```json
{
  "redefined": ["com.example.Foo", "com.example.Bar"],
  "redefinedCount": 2,
  "skippedNotLoaded": 5,
  "failedCount": 1,
  "failed": [{"fqcn": "com.example.Baz", "error": "UnsupportedOperationException: schema change"}],
  "scannedFiles": 8,
  "newestTimestamp": 1711500000000
}
```

## Additional Resources

- [Java Debug Interface (JDI)](https://docs.oracle.com/en/java/javase/17/docs/api/jdk.jdi/module-summary.html) — JVM debugging API
- [JDWP Reference](https://docs.oracle.com/en/java/javase/17/docs/specs/jdwp/jdwp-spec.html) — Wire protocol specification
- [DAP Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
