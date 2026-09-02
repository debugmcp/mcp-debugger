# MCP Debugger Usage Guide for AI Agents

This guide explains how to correctly use the MCP Debugger tools when testing debugging functionality across all supported languages (Python, Ruby, JavaScript, Rust, Go, Java, .NET/C#, and C/C++).

## Key Concepts

### JavaScript Debugging Behavior

**What to expect:**
- The debugger stops at your breakpoints in user code
- Variables are accessible when stopped at user breakpoints

**How it works:**
- The multi-session architecture properly routes evaluate commands to the active debugging context
- You can immediately evaluate expressions when stopped at breakpoints
- When `stopOnEntry` is false (the **launch** default), the debugger auto-continues past entry breakpoints so execution advances to user code automatically. Attach is the opposite: omitting `stopOnEntry` on `attach_to_process`/`create_debug_session` pauses the target (possibly a little after the response, reported as `pending: true`) — pass `stopOnEntry: false` to attach to a live service without freezing it

### Python Variable Inspection

**What to expect:**
- Variables appear in a hierarchical structure
- You may see "special variables" as a container that needs to be expanded

**How to access variables:**
1. Call `get_variables` with the scope ID (e.g., `scope: 3` for Locals)
2. If you get `{"name":"special variables","variablesReference":5}`, this is a container
3. Call `get_variables` again with `scope: 5` (the variablesReference) to expand it
4. This will reveal the actual variables (`a`, `b`, etc.)

## Step-by-Step Testing Examples

### JavaScript Testing

```javascript
// File: test.js
function compute(a, b) {
    const product = a * b; // Line 3 - set breakpoint here
    return product;
}
compute(5, 10);
```

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="javascript")

# 2. Set breakpoint
set_breakpoint(sessionId=session_id, file="/path/to/test.js", line=3)

# 3. Start debugging
start_debugging(sessionId=session_id, scriptPath="/path/to/test.js")
# Should stop at line 3 if the breakpoint is hit; if the debugger stops at
# a Node.js internal frame first, use continue_execution to advance to user code.

# 4. Get stack trace
get_stack_trace(sessionId=session_id)
# Should show test.js in the stack, not Node.js internals

# 5. Evaluate expressions
evaluate_expression(sessionId=session_id, expression="a")  # Returns: "5"
evaluate_expression(sessionId=session_id, expression="b")  # Returns: "10"
evaluate_expression(sessionId=session_id, expression="typeof compute")  # Returns: "function"

# 6. Step over
step_over(sessionId=session_id)
# Now at line 4

# 7. Evaluate product
evaluate_expression(sessionId=session_id, expression="product")  # Returns: "50"
```

### Python Testing

```python
# File: test.py
def main():
    a = 1      # Line 2
    b = 2      # Line 3 - set breakpoint here
    c = a + b  # Line 4
    return c

if __name__ == "__main__":
    main()
```

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="python")

# 2. Set breakpoint
set_breakpoint(sessionId=session_id, file="/path/to/test.py", line=3)
# Note: Python breakpoints initially report as unverified; they are
# verified asynchronously by debugpy once the module is loaded.

# 3. Start debugging
start_debugging(sessionId=session_id, scriptPath="/path/to/test.py")
# Stops at line 3

# 4. Get scopes (use the actual frame ID from get_stack_trace, not a hardcoded value)
stack = get_stack_trace(sessionId=session_id)
frame_id = stack["stackFrames"][0]["id"]  # Use the top frame's actual ID
scopes = get_scopes(sessionId=session_id, frameId=frame_id)
# Returns: [{"name":"Locals","variablesReference":3}, {"name":"Globals","variablesReference":4}]

# 5. Get variables (first level)
vars = get_variables(sessionId=session_id, scope=3)
# May return: {"name":"special variables","variablesReference":5}

# 6. Expand special variables (if needed)
if vars.get("variablesReference"):
    actual_vars = get_variables(sessionId=session_id, scope=vars["variablesReference"])
    # Now returns: [{"name":"a","value":"1"}, {"name":"b","value":"2"}, ...]

# 7. Evaluate expressions
evaluate_expression(sessionId=session_id, expression="a")  # Returns: "1"
evaluate_expression(sessionId=session_id, expression="a + b")  # Returns: "3"
# Note: expressions can read AND modify program state -- "a = 99" assigns,
# and "obj.method()" runs the call in the debuggee. That is intentional:
# it lets you test a fix in place before editing the source. Results are
# always returned as strings, even for numbers.
```

## Common Issues and Solutions

### Issue: JavaScript shows Node.js internals in stack trace
**Solution:** Use `continue_execution` to move past internal frames. Stack trace filtering hides internal frames by default for supported languages.

### Issue: Python shows "special variables" instead of actual variables
**Solution:** This is normal hierarchical organization. Use the `variablesReference` to expand:
```python
# Step 1: Get initial scope
vars = get_variables(scope=3)  # Returns special variables container

# Step 2: Expand using variablesReference
if "variablesReference" in vars:
    actual_vars = get_variables(scope=vars["variablesReference"])
```

### Issue: "variable is not defined" errors
**Possible causes:**
1. **Wrong scope:** Ensure you're evaluating in the correct frame context
2. **Not yet defined:** Variable hasn't been executed yet - step to after its assignment
3. **Out of scope:** Variable is in a different function or scope

**Solution:**
- Use `get_stack_trace()` to see current location
- Step over assignment lines before evaluating variables
- Check the current frame ID and use it in evaluate_expression

## Best Practices

1. **Always check session state** before operations:
   - Must be `PAUSED` for: evaluate, step operations, get variables
   - For `set_breakpoint`: session must not be `TERMINATED` (breakpoints can be set in any non-terminated state, including before debugging starts)

2. **Use absolute paths** for file references to avoid ambiguity

3. **Wait for proper state** after operations:
   - After `start_debugging`: Wait for `PAUSED` state if breakpoint set
   - After `continue_execution`: Session becomes `RUNNING`
   - After `step_*`: Wait for `PAUSED` state

4. **Handle variable hierarchies** in Python:
   - Always check for `variablesReference` in responses
   - Recursively expand containers to access nested variables

5. **Frame context matters**:
   - If `evaluate_expression` fails, check you're using the correct frame
   - Use `get_stack_trace` to find the right frame ID -- use the `id` field from the stack frame object, not the array index
   - The top frame (first element in the `stackFrames` array) is usually what you want, but its `id` is assigned by the debug adapter and is NOT necessarily 0

## Testing Checklist

- [ ] Session created successfully
- [ ] Breakpoints set and verified
- [ ] Debugging starts without timeout
- [ ] Stops at user breakpoints (not internals)
- [ ] Stack trace shows user code
- [ ] Variables are accessible (after expanding containers if needed)
- [ ] Expressions evaluate correctly
- [ ] Step operations work as expected
- [ ] Continue execution resumes properly
- [ ] Session closes cleanly

## Rust Debugging

**Prerequisites**: Rust toolchain (rustc, cargo) installed. CodeLLDB is vendored automatically during `pnpm install` -- the root `postinstall` hook runs `pnpm vendor:adapters`. Re-vendor at any time with `pnpm vendor:adapters` (or just the LLDB copy: `pnpm --filter @debugmcp/codelldb-common run build:adapter`), or point `CODELLDB_PATH` at an existing CodeLLDB **executable** -- the resolver uses the value verbatim as the adapter path, so a directory will not work.

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="rust")

# 2. Set breakpoint (use absolute path to the source file)
set_breakpoint(sessionId=session_id, file="/path/to/src/main.rs", line=5)

# 3. Start debugging (scriptPath is the source file; the adapter resolves the
#    enclosing Cargo project and may build/locate the binary before debugging)
start_debugging(sessionId=session_id, scriptPath="/path/to/src/main.rs")

# 4. Get stack trace and use actual frame IDs
stack = get_stack_trace(sessionId=session_id)
frame_id = stack["stackFrames"][0]["id"]

# 5. Inspect variables
get_local_variables(sessionId=session_id)
```

## Ruby Debugging

**Prerequisites**: Ruby 2.7+ installed. `rdbg` must be available through the standard `debug` gem.

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="ruby")

# 2. Set breakpoint
set_breakpoint(sessionId=session_id, file="/path/to/app.rb", line=12)

# 3. Start debugging
start_debugging(sessionId=session_id, scriptPath="/path/to/app.rb")

# 4. Inspect variables
get_local_variables(sessionId=session_id)
```

## Go Debugging

**Prerequisites**: Go 1.18+ installed. Delve debugger must be installed: `go install github.com/go-delve/delve/cmd/dlv@latest`.

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="go")

# 2. Set breakpoint
set_breakpoint(sessionId=session_id, file="/path/to/main.go", line=10)

# 3. Start debugging
start_debugging(sessionId=session_id, scriptPath="/path/to/main.go")

# 4. Inspect variables
get_local_variables(sessionId=session_id)
```

## Java Debugging

**Prerequisites**: JDK 21+ installed. Uses JDI bridge -- the adapter attempts to locate pre-compiled bridge classes and may compile them on demand at command-build time if not found.

**Key notes:**
- Compile target code with `javac -g` for full variable inspection
- For breakpoints, you can use a fully-qualified class name (e.g., `"com.example.MyClass"`) instead of a file path
- `mainClass` is **derived, not passed**: the adapter reads the launch config's `program` (which defaults to `scriptPath`) and turns a `.java` path into its base name, so `/path/to/Main.java` yields `Main`. Any other `program` value is used verbatim -- pass `adapterLaunchConfig: {"program": "com.example.Main"}` when the class name does not match the file name. A `mainClass` key you pass yourself is overwritten by this derivation
- `classpath` goes through `dapLaunchArgs` (or `adapterLaunchConfig`) and becomes the JVM's `-cp`; absolute is safest -- since #642 the JVM runs in the launch config's `cwd` (which the session layer defaults to the script's directory when you pass none), so a relative classpath resolves against that, not against the server's install directory. The program's `args` come from `start_debugging`'s top-level `args`. The launch keys the JDI bridge actually reads are `mainClass`, `classpath`, `stopOnEntry`, `javaPath`, `vmArgs`, `args`, `cwd` (applied as the JVM's working directory; a non-directory fails the launch loudly), and `env` (merged into the JVM's environment; a JSON `null` value removes the variable) -- `sourcePath` is forwarded to the bridge but never read

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="java")

# 2. Set breakpoint (using FQCN)
set_breakpoint(sessionId=session_id, file="com.example.Main", line=10)

# 3. Start debugging with adapter-specific config
start_debugging(
    sessionId=session_id,
    scriptPath="/path/to/Main.java",
    dapLaunchArgs={"classpath": "/path/to/classes"},
    # mainClass comes from `program`; override it when the FQCN differs
    # from the file name:
    adapterLaunchConfig={"program": "com.example.Main"}
)

# 4. Inspect variables
get_local_variables(sessionId=session_id)
```

## .NET/C# Debugging

**Prerequisites**: netcoredbg must be installed (set `NETCOREDBG_PATH` or add to PATH). A .NET SDK is needed to compile your target application.

**Key notes:**
- PDB symbols must be in Portable format (compile with `/debug:portable`)
- Uses TCP-to-stdio bridge on all platforms

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="dotnet")

# 2. Set breakpoint
set_breakpoint(sessionId=session_id, file="/path/to/Program.cs", line=10)

# 3. Start debugging (pass compiled target, not source file)
start_debugging(
    sessionId=session_id,
    scriptPath="/path/to/bin/Debug/net8.0/YourApp.dll",
    dapLaunchArgs={"program": "/path/to/bin/Debug/net8.0/YourApp.dll"}
)

# 4. Inspect variables
get_local_variables(sessionId=session_id)
```

## C/C++ Debugging

**Prerequisites**: Nothing extra to debug a **prebuilt** executable -- CodeLLDB is vendored (the same copy the Rust adapter uses). A compiler on PATH (`g++`/`clang++`/`c++`, or `gcc`/`clang`/`cc` for C) is needed only when you hand the adapter a lone source file.

**Key notes:**
- One language id, `cpp`, covers both C and C++
- Compile with **`-gdwarf-4 -O0`**. `-gdwarf-4` matters on Windows: MinGW gcc 11+ defaults to DWARF-5, whose line tables LLDB cannot read out of PE-COFF binaries
- `scriptPath` takes either the compiled executable or a lone `.c`/`.cpp` source file; a source file is auto-compiled into a `.debug-mcp/` directory next to it and rebuilt when stale (`adapterLaunchConfig: {"forceRebuild": true}` forces it)
- Function breakpoints are the sturdiest addressing here -- a bare `main` resolves fine
- On Windows prefer MinGW-w64/MSYS2 g++ (DWARF). MSVC PDB fidelity is partial; `CPP_MSVC_BEHAVIOR` (`warn` default / `error` / `continue`) controls the detection warning
- **Attach is by PID only**: `attach_to_process` with `processId`. Host/port attach is rejected with `UNSUPPORTED_OPERATION`. On Linux, mind `kernel.yama.ptrace_scope`

**Testing sequence:**
```python
# 1. Create session
session_id = create_debug_session(language="cpp")

# 2. Set breakpoint (source file + line, or a function name)
set_breakpoint(sessionId=session_id, file="/path/to/main.cpp", line=12)

# 3. Start debugging (compiled binary, or the .cpp source to auto-compile)
start_debugging(sessionId=session_id, scriptPath="/path/to/myapp")

# 4. Inspect variables
get_local_variables(sessionId=session_id)
```

## Breakpoint Addressing and Management

`set_breakpoint` takes more than `file` + `line`. The content-addressing levers are gated
by `DEBUG_MCP_BP_ADDRESSING` (`content`, the default, exposes everything; `assert` drops
`statement`, `nearLine` **and** `function`, keeping `expectedContent`; `line` drops
`expectedContent` too, leaving plain `file` + `line`) -- read the live `set_breakpoint`
schema rather than assuming.

```text
set_breakpoint {"sessionId": "...", "file": "/abs/app.py", "statement": "total = sum(prices)"}
set_breakpoint {"sessionId": "...", "function": "apply_bulk_discount"}
set_breakpoint {"sessionId": "...", "file": "/abs/app.py", "line": 51,
                "expectedContent": "total = sum(prices)"}
```

- **`statement`** addresses by content, like an Edit-tool match -- a distinctive substring
  is enough, and an exact whole-line match beats substring matches. It can only land on a
  line containing your text, and it survives source edits across `restart_debugging`. If
  the text appears on several lines the error lists every match; add `nearLine` to pick
  one. Pass `statement` **or** `line`, not both.
- **`function`** sets a DAP function breakpoint on entry to a symbol -- no file, no line.
  Supported by the Python, Go, Rust, C/C++, .NET, Java, and JavaScript adapters. It
  composes with `condition` only.
- **`expectedContent`** is an assertion, not addressing: if the target line does not
  contain the text, the breakpoint is **not** set and the error shows what is actually on
  that line and its neighbors -- the cheapest way to catch a stale line number.
- **`logMessage`** turns a breakpoint into a logpoint: it never pauses, and
  `{curly brace}` expressions are interpolated into `get_output` while the program runs at
  full speed. Supported by the Python, JavaScript, Go, Rust, C/C++, and mock adapters;
  **not** by Java, .NET, or Ruby.

Three tools manage breakpoints after they are set. All take effect immediately while the
program is running or paused:

- `list_breakpoints {"sessionId": "..."}` -- verified state and adapter-assigned ids for
  every breakpoint (add `file` to scope it). Session-global function breakpoints appear
  separately as `functionBreakpoints`. Works before launch, during, and after exit.
- `remove_breakpoint {"sessionId": "...", "breakpointId": "..."}` -- or address it by
  `function`, or by `file` + `line` (which removes every breakpoint at that location).
- `clear_breakpoints {"sessionId": "..."}` -- removes all of them, or all in one `file`.
  Clearing zero breakpoints is success, not an error.

## Output, Exceptions, and Restart

**Read the program's own output with `get_output`.** Anything the program prints --
`console.log`, `print`, panics, stack traces, logpoint messages -- lands there, not in the
result of the tool that resumed it:

```text
get_output {"sessionId": "...", "since": 0}
```

It is buffered per launch (last 1000 entries), works while the program is running and
after it exits, and is cursor-based: pass the previous response's `nextSince` as `since`
to fetch only what is new. `hasMore: true` means the `limit` (default 100, max 1000) cut
the page short. The same transcript is also exposed as the MCP resource
`debug://sessions/{id}/output`, which supports `resources/subscribe` if your client would
rather be notified than poll.

**`breakOnExceptions`** (on both `start_debugging` and `attach_to_process`) decides
whether a throw pauses the session:

- `"uncaught"` -- pause at the crash site instead of letting the session terminate. This
  is the **launch default** (Ruby is the exception: rdbg has no uncaught-only filter, so
  it stays `"none"`).
- `"all"` -- also pause on caught/raised exceptions. Language-dependent, and noisy in code
  that uses exceptions for control flow.
- `"none"` -- let a crashing program run to termination. **Attach always defaults to
  `"none"`**; attach sessions never apply a language default.

**`restart_debugging`** relaunches with the same configuration as the last
`start_debugging` and re-applies every current breakpoint. It works while running, paused,
or after the program exited, and is **not** available for attach sessions or sessions that
were never launched. The output buffer starts fresh, so read from `since: 0` afterwards.
Statement-anchored breakpoints are re-resolved against the edited source, which is what
makes the edit / restart / re-check loop hold up.

## Redaction and IDE Handoff

**Secret redaction is on by default.** Credential-shaped values are masked in
`get_variables`, `get_local_variables`, `evaluate_expression` results, and captured output,
so a token in scope does not land in the transcript:

```json
{ "name": "gh_token", "value": "<redacted:github-pat>", "type": "str", "redacted": true }
```

Two layers do it: known token *shapes* (PATs, `sk-` keys, JWTs, PEM blocks, `Bearer`
credentials, connection-string passwords) and *exact* sensitive variable names
(`password`, `api_key`, ...; matching is exact after normalization, so `tokenCount` is
untouched). Only the display is masked -- the program still holds the real value -- and a
response that masked anything carries a `redaction` field saying so. Start the server with
`DEBUG_MCP_NO_REDACT=1` to turn it off when the credential handling itself is what you are
debugging. A related flag, `DEBUG_MCP_VARIABLE_ACCESS=explicit`, makes `names` required on
`get_variables`/`get_local_variables`; the tool schema says so when it is on.

**`expose_session` hands a live session to a human.** It opens a read-only DAP mirror on
`127.0.0.1` (ephemeral port) and returns a token the IDE must send as `mirrorToken`:

```text
expose_session   {"sessionId": "..."}
unexpose_session {"sessionId": "..."}
```

The IDE can inspect threads, stack, scopes, variables, and evaluate; continue/step/pause
and breakpoint changes are rejected, so execution control stays with the MCP session. It
is idempotent, and closes on `unexpose_session`, `close_debug_session`, restart, or
debuggee exit. Two cautions: the mirror shows **raw, unredacted** values, and DAP
`evaluate` runs arbitrary code in the debuggee -- treat the token as an execution
capability, not a view-only credential.

## Summary

The MCP Debugger is fully functional for Python, Ruby, JavaScript, Rust, Go, Java, .NET/C#, and C/C++. The key insights are:
- **JavaScript**: Stack trace filtering hides internal frames; may need `continue_execution` if initially stopped at internals
- **Python**: Use variablesReference to expand variable containers
- **Ruby**: Supports launch and attach flows through `rdbg`; use Bundler mode for Rails and RSpec-style entrypoints
- **Rust**: CodeLLDB adapter is vendored; the GNU toolchain is required for reliable debugging -- MSVC-built binaries may produce errors with CodeLLDB. Set `RUST_MSVC_BEHAVIOR` env var to control MSVC handling
- **Go**: Uses Delve's native DAP support
- **Java**: Use FQCN for breakpoints; `mainClass` is derived from `program`/`scriptPath`, not passed -- send `classpath` via `dapLaunchArgs`
- **.NET**: Requires netcoredbg; uses TCP-to-stdio bridge
- **C/C++**: One language id (`cpp`) covers both; nothing to install for prebuilt binaries -- compile with `-gdwarf-4 -O0`. Attach is by PID only
- **All languages**: Use actual frame IDs from `get_stack_trace` (not hardcoded 0), and ensure proper state and context for operations

Following this guide will help you successfully test and use all debugging features without encountering the previously reported issues.
