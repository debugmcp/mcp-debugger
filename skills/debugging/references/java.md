# Java debugging (mcp-debugger)

## Prerequisites

- JDK 21+ recommended (`java` and `javac` on PATH, or `JAVA_HOME` set). Versions below 21 log a warning but may work.
- No external adapter: a single-file JDI bridge (`JdiDapServer.java`, using `com.sun.jdi.*` from the JDK) is **compiled on first use via `javac`** — expect the first session to take a little longer.
- **Compile target code with `javac -g`.** Without `-g` there is no `LocalVariableTable` and variable inspection returns empty lists even at a valid breakpoint. Gradle and Maven include debug info by default.

## Launch quickstart

```json
create_debug_session  {"language": "java", "name": "java-bug-hunt"}
// Breakpoint by fully-qualified class name — no file path needed:
set_breakpoint        {"sessionId": "<id>", "file": "com.example.Main", "line": 10}
start_debugging       {
  "sessionId": "<id>",
  "scriptPath": "/abs/path/src/com/example/Main.java",
  "dapLaunchArgs": {
    "mainClass": "com.example.Main",
    "classpath": "/abs/path/classes",
    "cwd": "/abs/path/project",
    "stopOnEntry": false
  }
}
get_stack_trace       {"sessionId": "<id>"}
get_local_variables   {"sessionId": "<id>"}
evaluate_expression   {"sessionId": "<id>", "expression": "a + b"}
step_over             {"sessionId": "<id>"}
continue_execution    {"sessionId": "<id>"}
close_debug_session   {"sessionId": "<id>"}
```

- `set_breakpoint.file` accepts either an FQCN (`"com.example.Main"`) or an absolute `.java` path. FQCNs skip host file checks entirely.
- `dapLaunchArgs.mainClass` is required; `classpath` defaults to `"."` but is almost always needed. Also supported: `sourcePath`, `env`, `args`, `vmArgs` (e.g. `-Xmx512m`), `javaPath`. For Java, `stopOnEntry` defaults to `true` — set it `false` to run straight to your breakpoints.
- The expression evaluator supports field access, method calls, arithmetic, and string concatenation.

## Attach / remote

Start the target JVM with the JDWP agent (`suspend=y` pauses until a debugger attaches; `suspend=n` for already-running servers):

```bash
java -agentlib:jdwp=transport=dt_socket,server=y,address=5005,suspend=y -cp . MyServer
```

```json
create_debug_session  {"language": "java"}
set_breakpoint        {"sessionId": "<id>", "file": "com.example.MyServer", "line": 42}
attach_to_process     {"sessionId": "<id>", "port": 5005, "host": "localhost", "sourcePaths": ["/abs/path/src"]}
continue_execution    {"sessionId": "<id>"}   // required with suspend=y to let the JVM run to your breakpoint
```

- **Deferred breakpoints work natively:** for classes not yet loaded, the JDI bridge registers a `ClassPrepareRequest` and binds the breakpoint when the JVM loads the class, then reports `verified: true`. Set breakpoints freely before or after attach — no re-sends needed.
- For a busy or warming JVM, raise `verifyTimeout` (ms) on `attach_to_process` — attach fails if no thread is reported within ~5 s by default. Attach sessions skip host-side file checks, so remote paths are fine.

## Quirks

- **`redefine_classes` hot-swap (Java only):** edit → recompile with `javac -g` → call `redefine_classes {"sessionId": "<id>", "classesDir": "/proj/build/classes/java/main", "sinceTimestamp": 0}`. Pass the returned `newestTimestamp` as `sinceTimestamp` next time for incremental swaps. Limits: no schema changes (adding/removing methods/fields fails per class, others still succeed), only already-loaded classes (others land in `skippedNotLoaded`), works paused or running.
- Empty variables almost always mean the class was compiled without `-g`, or the source no longer matches the compiled class — recompile.
- Breakpoints must sit on executable lines (assignments, calls, conditionals) — not blank lines, comments, imports, or bare declarations. Conditional breakpoints (`condition`) and exception breakpoints are supported. Exception stops carry `lastStop.description` ("FQCN: message") and, a moment after the pause, best-effort `lastStop.exceptionInfo` (exceptionId, breakMode, message, adapter-side stack trace).
- `set_breakpoint` accepts a Java-only `suspendPolicy`: `"all"` (default) suspends every thread; `"thread"` suspends only the hitting thread.
- Debuggee stdout/stderr is forwarded — `get_output {"sessionId": "<id>", "since": 0}` works for Java; poll with the returned `nextSince`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Variables list empty at breakpoint | Compiled without `-g`; or stale `.class` | `javac -g`, rebuild, restart session |
| Breakpoint never fires | Non-executable line; wrong class name; JVM never runs it | Move to executable line; match FQCN to the loaded class; check code path |
| Attach connects but nothing happens | JVM started with `suspend=y` still paused | Call `continue_execution` after attach |
| "Java not found" | No JDK on PATH / `JAVA_HOME` unset | Install JDK 21+, set `JAVA_HOME` or fix PATH |
| Attach connection timeout | Wrong port, firewall, or missing `server=y` | Verify the JDWP agent string and that the port is listening |
| `redefine_classes` reports `failed` | Schema change (method/field added or removed) | Restart the session for structural edits; body-only edits hot-swap fine |
