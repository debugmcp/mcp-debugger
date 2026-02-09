# MCP Debugger - Rust Language Testing Report
**Date:** January 14, 2025  
**Tester:** AI Assistant (via Cline)  
**Test Environment:** Windows 11, Visual Studio Code  
**MCP Debugger Version:** Latest (from C:\path\to\debug-mcp-server)

## Executive Summary

Testing was conducted on two Rust examples in the `examples/rust` directory:
1. `hello_world` - Basic synchronous Rust debugging
2. `async_example` - Async/await Rust debugging with Tokio

While basic debugging functionality works (session creation, breakpoints, stepping), several significant issues were identified that affect the quality of the debugging experience, particularly around variable inspection and stepping behavior.

---

## Test Results

### 1. Hello World Example (`hello_world/src/main.rs`)

#### Test Setup
- **Session ID:** f49ec9f2-6fca-445a-88bd-a75cd568a889
- **Executable:** `examples\rust\hello_world\target\debug\hello_world.exe`
- **Initial Breakpoint:** Line 14 (variable declaration)

#### ✅ Working Features
1. **Session Creation** - Successfully created Rust debug session
2. **Breakpoint Setting** - Breakpoint set at line 14 correctly
3. **Stack Trace** - Stack trace shows correct function names and line numbers once in user code
4. **Function Parameters** - Parameters in `calculate_sum(a, b)` displayed correctly (a=5, b=10)
5. **Primitive Types** - `version` (double) and `is_awesome` (bool) displayed correctly when available
6. **Step Into** - Successfully stepped into `calculate_sum` function
7. **Step Out** - Successfully returned to calling function

#### ❌ Issues Identified

##### Issue 1: String Variable Corruption (CRITICAL)
**Severity:** High  
**Description:** The `name` variable, which should contain the string "Rust", consistently showed corrupted data.

**Expected:**
```
name = "Rust"
```

**Actual:**
```json
{
  "name": "name",
  "value": "{data_ptr:\"RustSum of 5 and 10 is: \\n\", ...}",
  "type": "9277eecd40495f85161460476aacc992"
}
```

**Impact:** String variables cannot be reliably inspected, making debugging string-heavy code nearly impossible.

**Reproducibility:** 100% - occurred on every inspection attempt
- Tested at line 14 (immediately after declaration)
- Tested at line 18 (after several other operations)
- Tested via `evaluate_expression` tool

**Root Cause Analysis:**
The corrupted value shows content from a different variable (`"Sum of 5 and 10 is: \n"`) which appears later in the program. This suggests:
1. Memory address confusion in the debug adapter
2. Incorrect pointer dereferencing for string types
3. Possible issue with Rust's `&str` vs `String` type handling in CodeLLDB

##### Issue 2: Premature Variable Listing
**Severity:** Medium  
**Description:** At line 14, all function-scope variables are listed including those not yet initialized.

**Variables Listed at Line 14:**
```
name, version, is_awesome, result, numbers, message, iter, i
```

**Expected:** Only `name` should be listed (or possibly none, since we're at the declaration line).

**Actual:** All 8 variables from the entire function scope are listed, with most showing `<variable not available>`.

**Impact:** Confusing debugging experience, unclear which variables are actually in scope.

**Root Cause Analysis:**
Rust's compiler optimizations or the debug adapter may be listing all stack-allocated variables for the entire function scope regardless of actual program counter position. This differs from line-by-line variable scope tracking.

##### Issue 3: Variables Showing "Not Available"
**Severity:** Medium  
**Description:** Many variables show `<variable not available>` even when they should have values or should not be listed at all.

**Examples at Line 18:**
```json
{
  "result": "<variable not available>",
  "numbers": "<variable not available>", 
  "message": "<variable not available>",
  "iter": "<variable not available>",
  "i": "<variable not available>"
}
```

**Impact:** Cannot inspect variables that haven't been initialized yet (expected), but also cannot tell which variables are truly in scope.

##### Issue 4: Line Skipping During Step Over
**Severity:** Medium  
**Description:** Stepping over from line 14 jumped directly to line 18, skipping lines 15-17.

**Code Skipped:**
```rust
let version = 1.75;        // Line 14 - stopped here
let is_awesome = true;     // Line 15 - skipped
                           // Line 16 - skipped
// Simple calculation        // Line 17 - skipped
let result = calculate_sum(5, 10);  // Line 18 - landed here
```

**Expected:** Step through each executable line (14 → 15 → 18, treating 16-17 as non-executable).

**Impact:** Cannot examine program state after each statement; multiple operations happen in one "step".

**Root Cause Analysis:**
Likely caused by:
1. Rust compiler optimizations combining multiple variable declarations
2. Debug line information not precise enough
3. Step over treating the entire variable declaration block as a single statement

##### Issue 5: Initial Pause at System Code
**Severity:** Low  
**Description:** Upon starting debugging, the debugger initially paused at Windows system internals rather than at user code.

**Initial Stack Trace:**
```
RtlGetReturnAddressHijackTarget
EtwEventWriteNoRegistration
LdrInitializeThunk
```

**Required Action:** Had to call `continue_execution` to reach the actual user code breakpoint.

**Impact:** Extra step needed; confusing initial state.

**Root Cause Analysis:**
This appears to be default CodeLLDB behavior on Windows. The adapter may be stopping at process initialization before reaching main(). The `stopOnEntry` parameter might need adjustment, or this could be expected Windows loader behavior.

---

### 2. Async Example (`async_example/src/main.rs`)

#### Test Setup
- **Session ID:** 3ed76752-a7c5-4f2a-93d4-eb6197a0e5a8
- **Executable:** `examples\rust\async_example\target\debug\async_example.exe`
- **Initial Breakpoint:** Line 15 (comment line before async call)

#### ✅ Working Features
1. **Session Creation** - Successfully created Rust debug session
2. **Breakpoint Setting** - Breakpoint set correctly
3. **Stack Trace with Tokio** - Stack trace correctly shows async runtime frames:
   ```
   async_example::main::async_block$0
   tokio::runtime::park::impl$4::block_on::closure$0
   tokio::task::coop::with_budget
   ... (Tokio runtime frames)
   ```
4. **Async Context Detection** - Debugger correctly identified we're in an async block

#### ❌ Issues Identified

##### Issue 6: All Variables Show "Not Available" in Async Context
**Severity:** High  
**Description:** In the async example, almost all user-defined variables showed `<variable not available>`.

**Variables at Line 16:**
```json
{
  "result": "<variable not available>",
  "task1": "<variable not available>",
  "task2": "<variable not available>",
  "task3": "<variable not available>",
  "futures": "<variable not available>",
  "rotator": "<variable not available>",
  "results": "<variable not available>",
  "iter": "<variable not available>",
  "i": "<variable not available>"
}
```

**Only Available Variables:**
- `_task_context` - Tokio internal context (waker pointers)
- Anonymous variable with waker information

**Impact:** Cannot effectively debug async Rust code; no visibility into async state or variables.

**Root Cause Analysis:**
Async/await in Rust uses state machines and generators under the hood. Variables in async blocks may be:
1. Stored in a generated state machine struct rather than on the stack
2. Not yet properly supported by CodeLLDB's variable inspection
3. Optimized away by the compiler in debug builds
4. Require special handling that the adapter doesn't implement

##### Issue 7: Step Over Stuck on Await Statement
**Severity:** High  
**Description:** Calling `step_over` on the line `let result = fetch_data(1).await;` did not progress to the next line.

**Expected:** Step over the await and move to line 17.

**Actual:** Remained at line 16.

**Impact:** Cannot effectively step through async code; stepping behavior is broken for await points.

**Root Cause Analysis:**
Await points in async Rust involve:
1. Suspending the current future
2. Potentially switching execution to other tasks
3. Resuming later when the awaited future completes

The debugger may not properly handle these suspension points, or may be treating the await as an incomplete operation.

##### Issue 8: Step Into Goes to Internal Code
**Severity:** Medium  
**Description:** Attempting to `step_into` the `fetch_data(1).await` call went into Rust/async runtime internals rather than the `fetch_data` function.

**Landed In:** `@7ff745a5a652..7ff745a5a6a7` (internal code, no source file)

**Expected:** Step into the `fetch_data` async function at line 38.

**Impact:** Cannot debug into async functions; forced to use breakpoints instead of step-through debugging.

**Root Cause Analysis:**
Async function calls in Rust are more complex than regular calls:
1. They return a Future that gets polled by the runtime
2. The actual function body executes during polling
3. Step into needs to skip the Future construction and go directly to the function body
4. Current implementation doesn't distinguish async function entry points

---

## Summary of Issues by Severity

### Critical Issues (Must Fix)
1. **String Variable Corruption** - Renders string debugging unusable
2. **All Variables Unavailable in Async** - Makes async debugging impossible

### High Issues (Should Fix)
3. **Step Over Stuck on Await** - Breaks async stepping workflow
4. **Step Into Goes to Internals** - Prevents debugging into async functions

### Medium Issues (Nice to Fix)
5. **Line Skipping During Step Over** - Reduces debugging precision
6. **Premature Variable Listing** - Confusing user experience
7. **Variables Showing "Not Available"** - Reduces visibility

### Low Issues (Minor)
8. **Initial Pause at System Code** - Requires extra continue action

---

## Root Cause Analysis Summary

### String Variable Corruption
**Primary Cause:** Memory address or pointer dereferencing issue in CodeLLDB when handling Rust string types.

**Contributing Factors:**
- Rust's string representation (`&str` fat pointer with data pointer and length)
- Potential issue with how CodeLLDB reads string data from the target process
- Possible confusion between string literals and String types

**Recommended Investigation:**
1. Check CodeLLDB version and known issues with Rust string support
2. Verify debug symbols are correctly generated for string types
3. Test with simple standalone Rust strings to isolate the issue
4. Consider if this is Windows-specific (test on Linux if possible)

### Async Debugging Issues
**Primary Cause:** Async/await state machines not fully supported by CodeLLDB.

**Contributing Factors:**
- Rust's async transformation creates complex generated code
- Variables stored in compiler-generated state machine structs
- Debugger expectations don't match async runtime behavior
- Await points are not normal function calls

**Recommended Investigation:**
1. Research CodeLLDB's async/await support status
2. Check if specific debug flags improve async debugging
3. Test with simpler async examples to identify patterns
4. Consider if Tokio-specific runtime affects debugging

### Variable "Not Available" Issues
**Primary Cause:** Compiler optimizations and/or debug info limitations.

**Contributing Factors:**
- Rust's aggressive optimizations even in debug builds
- Variables may be optimized away before use
- Debug information may not accurately track variable lifetime
- Function-scope variable listing instead of line-based scoping

**Recommended Investigation:**
1. Test with different optimization levels
2. Check if `[profile.dev]` settings affect variable visibility
3. Compare with other Rust debuggers (rust-gdb, rust-lldb)
4. Review generated DWARF debug information

---

## Recommendations

### Immediate Actions
1. **File CodeLLDB Issues:**
   - String variable corruption with Rust &str types
   - Async/await stepping and variable inspection support

2. **Document Workarounds:**
   - Use `evaluate_expression` with explicit type casting for strings
   - Set breakpoints instead of stepping through async code
   - Use println! debugging for async variable inspection

3. **Update Documentation:**
   - Add known issues section to Rust debugging guide
   - Warn users about async debugging limitations
   - Provide async debugging best practices

### Long-Term Solutions
1. **Investigate Alternative Adapters:**
   - Test with rust-analyzer's debug adapter
   - Evaluate native LLDB integration
   - Consider contributing fixes to CodeLLDB

2. **Add Diagnostic Tools:**
   - Create test suite specifically for Rust string types
   - Add async debugging smoke tests
   - Implement variable inspection validation

3. **Improve Error Messages:**
   - When variables show "not available", provide more context
   - Detect async context and warn about known limitations
   - Better error messages for corrupted variable data

---

## Test Artifacts

### Test Commands Used
```bash
# Create session
use_mcp_tool: create_debug_session (language: rust)

# Set breakpoint
use_mcp_tool: set_breakpoint (file, line)

# Start debugging
use_mcp_tool: start_debugging (scriptPath)

# Navigation
use_mcp_tool: continue_execution
use_mcp_tool: step_over
use_mcp_tool: step_into
use_mcp_tool: step_out

# Inspection
use_mcp_tool: get_stack_trace
use_mcp_tool: get_local_variables
use_mcp_tool: evaluate_expression
```

### Tested Code Locations
**hello_world:**
- Line 14: `let version = 1.75;`
- Line 18: `let result = calculate_sum(5, 10);`
- Line 42: `let sum = a + b;` (inside calculate_sum)

**async_example:**
- Line 15: Comment before async call
- Line 16: `let result = fetch_data(1).await;`

---

## Conclusion

The MCP debugger's Rust adapter (CodeLLDB) provides basic debugging functionality but has significant limitations:

**Strengths:**
- Session management works well
- Breakpoints are reliable
- Stack traces are accurate
- Basic stepping works for synchronous code
- Function parameter inspection works

**Critical Weaknesses:**
- **String variables are corrupted** - This alone makes the debugger unreliable for real-world Rust programs
- **Async debugging is severely limited** - Variables unavailable, stepping broken
- **Variable inspection is inconsistent** - Many variables show as unavailable

**Overall Assessment:** 
The Rust debugging support is in a "beta" state - usable for basic synchronous code debugging with primitive types, but not reliable for production debugging of typical Rust applications that use strings and async/await.

**Priority Recommendation:** Focus on fixing string variable inspection as the highest priority, as this is the most fundamental debugging requirement.
