# MCP Debugger Usage Guide for AI Agents

This guide explains how to correctly use the MCP Debugger tools when testing debugging functionality across all supported languages (Python, JavaScript, Rust, Go, Java, .NET/C#).

## Key Concepts

### JavaScript Debugging Behavior

**What to expect:**
- The debugger stops at your breakpoints in user code
- Variables are accessible when stopped at user breakpoints

**How it works:**
- The multi-session architecture properly routes evaluate commands to the active debugging context
- You can immediately evaluate expressions when stopped at breakpoints
- Note: auto-continue on entry is currently a placeholder and may not skip Node.js internals automatically; you may need to use `continue_execution` if stopped at an internal location

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
# Will stop at line 3 automatically - no Node.js internals!

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
# Note: Expressions may mutate program state (e.g., "x = 5" may work in some
# debugpy contexts). The server does not reject statements, but the debug
# adapter may impose its own limitations.
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
   - Must be `RUNNING` or `PAUSED` for: set breakpoint

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

**Prerequisites**: Rust toolchain (rustc, cargo) installed. CodeLLDB debug adapter is vendored automatically during `pnpm install`.

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

**Prerequisites**: JDK 21+ installed. Uses JDI bridge (compiled automatically on first use).

**Key notes:**
- Compile target code with `javac -g` for full variable inspection
- For breakpoints, you can use a fully-qualified class name (e.g., `"com.example.MyClass"`) instead of a file path
- Use `adapterLaunchConfig` to pass `mainClass` and `classpath`

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
    adapterLaunchConfig={"mainClass": "com.example.Main", "classpath": "/path/to/classes"}
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

## Summary

The MCP Debugger is fully functional for Python, JavaScript, Rust, Go, Java, and .NET/C#. The key insights are:
- **JavaScript**: Stack trace filtering hides internal frames; may need `continue_execution` if initially stopped at internals
- **Python**: Use variablesReference to expand variable containers
- **Rust**: CodeLLDB adapter is vendored; supports both MSVC and GNU toolchains
- **Go**: Uses Delve's native DAP support
- **Java**: Use FQCN for breakpoints, pass `mainClass`/`classpath` via `adapterLaunchConfig`
- **.NET**: Requires netcoredbg; uses TCP-to-stdio bridge
- **All languages**: Use actual frame IDs from `get_stack_trace` (not hardcoded 0), and ensure proper state and context for operations

Following this guide will help you successfully test and use all debugging features without encountering the previously reported issues.
