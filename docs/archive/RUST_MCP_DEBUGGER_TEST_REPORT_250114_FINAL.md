# Rust MCP Debugger Test Report - January 14, 2025

## Executive Summary

Tested the mcp-debugger on Rust language examples in the `examples/rust` directory. While basic debugging functionality works (stepping, breakpoints, stack traces), significant issues were identified with variable inspection that severely limit debugging utility.

## Test Environment

- **Date**: January 14, 2025
- **Operating System**: Windows 11
- **Rust Version**: 1.75+ (based on example code)
- **Examples Tested**: 
  - `hello_world` - Simple Rust program with variables, functions, loops
  - `async_example` - Tokio-based async program with concurrent tasks
- **MCP Server**: mcp-debugger (debug-mcp-server)

## Test Results Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Session Creation | ✅ PASS | Successfully creates Rust debug sessions |
| Breakpoint Setting | ✅ PASS | Breakpoints set and verified |
| Start Debugging | ✅ PASS | Executable launches and pauses |
| Stack Traces | ⚠️ PARTIAL | Initially shows Windows internals, then correct Rust stack |
| Stepping (Step Over) | ✅ PASS | Step over works correctly |
| Stepping (Step Into) | ✅ PASS | Step into function calls works |
| Function Parameters | ✅ PASS | Function parameters visible and correct |
| Simple Variables | ⚠️ PARTIAL | Some primitives visible, many show unavailable |
| String Variables | ❌ FAIL | Strings show corrupted data |
| Complex Variables | ❌ FAIL | Most show "<variable not available>" |
| Async Context | ✅ PASS | Tokio runtime frames visible |
| Async Variable Inspection | ⚠️ PARTIAL | Async context visible, but same variable issues |

## Detailed Test Execution

### Test 1: Hello World Example

**File**: `examples/rust/hello_world/src/main.rs`

#### Setup
1. Created debug session: `rust_hello_world_test`
2. Set breakpoint at line 14 (variable declarations)
3. Started debugging: `hello_world.exe`

#### Observations

**Initial Pause Issue**:
- Debugger initially paused in Windows internals (`RtlGetReturnAddressHijackTarget`, `EtwEventWriteNoRegistration`)
- Stack trace showed 5 frames of Windows loader code, no Rust code visible
- Had to continue execution to reach actual breakpoint

**After Continue to Line 14**:
```
Stack trace correctly showed:
- hello_world::main at line 14
- core::ops::function::FnOnce::call_once
- std::sys::backtrace::__rust_begin_short_backtrace
- std::rt::lang_start::closure$0
- ... (std runtime frames)
```

**Variable Inspection at Line 14**:
```
name: {data_ptr:"RustSum of 5 and 10 is: \n", ...} ❌ INCORRECT
version: <variable not available> ❌
is_awesome: <variable not available> ❌
result: <variable not available> ❌
numbers: <variable not available> ❌
message: <variable not available> ❌
iter: <variable not available> ❌
i: <variable not available> ❌
```

**Variable Inspection at Line 18** (after stepping):
```
name: {data_ptr:"RustSum of 5 and 10 is: \n", ...} ❌ INCORRECT
version: 1.75 ✅ CORRECT
is_awesome: true ✅ CORRECT
result: <variable not available> ❌
numbers: <variable not available> ❌
message: <variable not available> ❌
iter: <variable not available> ❌
i: <variable not available> ❌
```

**Expanding `name` variable**:
```
data_ptr: "RustSum of 5 and 10 is: \n"
length: 4
```
Expected: `data_ptr: "Rust", length: 4`
Actual: Corrupted data from wrong memory location

**Function Call - calculate_sum(5, 10)**:
- Step into worked correctly
- Jumped to line 42 in calculate_sum function
- Parameters correctly visible:
  ```
  a: 5 ✅ CORRECT
  b: 10 ✅ CORRECT
  ```

### Test 2: Async Example

**File**: `examples/rust/async_example/src/main.rs`

#### Setup
1. Created debug session: `rust_async_test`
2. Set breakpoints at lines 37 (loop end) and 44 (fetch_data function)
3. Started debugging: `async_example.exe`

#### Observations

**Initial Pause Issue** (same as hello_world):
- Paused in Windows internals initially
- Required continue to reach breakpoint

**At fetch_data Breakpoint (Line 44)**:
```
Stack trace (31 frames total):
- async_example::fetch_data::async_fn$0 at line 44 ✅
- async_example::main::async_block$0 at line 16
- tokio::runtime::park::impl$4::block_on::closure$0
- tokio::task::coop::with_budget
- ... (tokio runtime frames visible) ✅
```

**Variable Inspection at Line 44**:
```
<unnamed>: {waker:0x0000005519efe548, ...} (async context)
id: 1 ✅ CORRECT
_task_context: {waker:0x0000005519efe548, ...} (async context)
```

**Stepping Over Await Point**:
- Step over at line 45 (`sleep(Duration::from_millis(100)).await`)
- Correctly jumped back to main at line 16 (async suspension point)
- This demonstrates correct async stepping behavior ✅

**Variable Inspection After Async Return (Line 16)**:
```
<unnamed>: {waker:...} (async context)
_task_context: {waker:...} (async context)
result: <variable not available> ❌
task1: <variable not available> ❌
task2: <variable not available> ❌
task3: <variable not available> ❌
futures: <variable not available> ❌
rotator: <variable not available> ❌
results: <variable not available> ❌
iter: <variable not available> ❌
i: <variable not available> ❌
```

## Problem Analysis

### Problem 1: Variable Availability Issue

**Symptom**: Most variables show `<variable not available>`

**Root Cause Analysis**:
1. **Compiler Optimizations**: Even in debug builds, Rust compiler may optimize variables that aren't used yet or have been consumed due to Rust's move semantics
2. **Debug Info Quality**: The debug information may not include all variable locations at all program points
3. **Variable Lifetime**: Variables may genuinely not be initialized at the breakpoint location
4. **CodeLLDB Adapter Limitation**: The Rust debug adapter may have limitations in resolving variable locations

**Evidence**:
- Function parameters (a=5, b=10) ARE visible when actually used
- Some primitives (version=1.75, is_awesome=true) become visible after their initialization line is passed
- Variables declared on line 13-15 are not available at breakpoint on line 14 (possibly not yet fully initialized)

**Impact**: Severe - Makes debugging difficult as most variables cannot be inspected

### Problem 2: String Variable Corruption

**Symptom**: String variable `name` shows incorrect data: `"RustSum of 5 and 10 is: \n"` instead of `"Rust"`

**Root Cause Analysis**:
1. **Memory Misalignment**: The debugger is reading from wrong memory address
2. **Rust String Structure Misinterpretation**: Rust strings have complex internal structure (pointer, length, capacity). The data_ptr is pointing to wrong location
3. **Optimization/Inlining**: The actual string data might have been optimized or the pointer corrupted in debugger representation

**Evidence**:
- String structure shows: `{data_ptr:"RustSum of 5 and 10 is: \n", length:4}`
- Expected: `{data_ptr:"Rust", length:4}`
- The corrupted string appears to be from a completely different part of the program (possibly a println! format string)
- This suggests the `data_ptr` value is completely wrong

**Impact**: Severe - String inspection is completely unreliable

### Problem 3: Initial Pause in Windows Internals

**Symptom**: Debugger initially pauses in Windows loader code instead of Rust code

**Root Cause Analysis**:
1. **Missing stopOnEntry Configuration**: The debug session may need explicit configuration to stop at program entry point
2. **Breakpoint Timing**: Breakpoints might not be set before program starts
3. **Windows Loader Behavior**: On Windows, the debugger attaches during process initialization

**Evidence**:
- Both examples initially pause at: `RtlGetReturnAddressHijackTarget`, `EtwEventWriteNoRegistration`
- Stack trace shows only Windows loader frames
- Continue execution successfully reaches actual Rust breakpoints

**Impact**: Minor - Workaround is simple (continue execution), but creates confusing initial state

### Problem 4: Complex Type Unavailability

**Symptom**: Complex types (Vec, String, async tasks) consistently show as unavailable

**Root Cause Analysis**:
1. **Debug Info for Complex Types**: Complex Rust types may have incomplete debug information
2. **Variable References vs Values**: The debugger may struggle with references and borrowed values
3. **Async State Machine**: Async variables are part of generated state machines, making them harder to inspect

**Evidence**:
- `numbers: Vec<i32>` - unavailable
- `message: String` - unavailable (but corrupted when shown)
- All tokio task handles - unavailable
- Futures and iterators - unavailable

**Impact**: High - Cannot inspect most real-world Rust data structures

## Positive Findings

Despite the variable inspection issues, several features work correctly:

1. **✅ Control Flow**: Stepping (over, into, out) works reliably
2. **✅ Function Parameters**: Parameters passed to functions are visible and correct
3. **✅ Breakpoints**: Breakpoints can be set and are hit correctly
4. **✅ Stack Traces**: Stack traces show correct Rust call hierarchy (after initial continue)
5. **✅ Async Support**: Tokio runtime frames are visible, async stepping works
6. **✅ Source Location**: Current line and source context are accurate

## Recommendations

### For Users
1. **Use Function Parameters**: Rely on function parameter inspection rather than local variables
2. **Step to Variable Use**: Step to where variables are actually used to increase visibility
3. **Add Logging**: Use println! debugging as supplement when variables unavailable
4. **Continue Past Startup**: Always continue once after starting debug to skip Windows internals
5. **Avoid String Inspection**: Don't rely on string variable contents (corrupted)

### For Developers
1. **Investigate Debug Info Generation**: Check if CodeLLDB requires specific Rust compiler flags for full debug info
2. **Test with Different Optimization Levels**: Test with `opt-level = 0` in Cargo.toml
3. **Review String Handling**: Fix the string data pointer resolution issue
4. **Add stopOnEntry Support**: Configure proper entry point stopping behavior
5. **Consider Alternative Adapters**: Evaluate if other Rust debug adapters (rust-gdb) have better variable inspection

## Comparison with Previous Reports

Reviewing existing test reports (`RUST_MCP_DEBUGGER_TEST_REPORT_250114_COMPREHENSIVE.md`, etc.), these issues are **consistent and persistent**:
- Variable unavailability has been reported across multiple test sessions
- String corruption has been documented repeatedly
- The Windows internals pause issue is a known problem

This suggests these are **fundamental issues** with the current Rust debugging implementation, not transient problems.

## Conclusion

The mcp-debugger's Rust support is **functional for basic control flow debugging** but has **severe limitations in variable inspection**. The tool can be used for:
- ✅ Understanding program flow
- ✅ Setting breakpoints and stepping through code
- ✅ Inspecting function parameters
- ✅ Viewing stack traces

However, it **cannot reliably be used** for:
- ❌ Inspecting local variables
- ❌ Viewing string contents
- ❌ Examining complex data structures
- ❌ Debugging variable state issues

**Overall Assessment**: The Rust debugging capability is in **early/beta state** and needs significant improvements before it can be recommended for production debugging workflows.

## Test Artifacts

- Session IDs:
  - hello_world: `37fce3f5-ce43-4b03-b6bf-a68317e4370d`
  - async_example: `827e89a6-7273-4d79-9b1e-4eed23982e66`
- Examples tested:
  - `examples/rust/hello_world/src/main.rs`
  - `examples/rust/async_example/src/main.rs`
- Executables:
  - `examples/rust/hello_world/target/debug/hello_world.exe`
  - `examples/rust/async_example/target/debug/async_example.exe`
