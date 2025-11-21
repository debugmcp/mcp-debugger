# MCP Debugger Rust Language Testing Report

**Date:** November 17, 2025  
**Tester:** Cline AI Assistant  
**Test Environment:** Windows 11, VS Code  
**MCP Debugger Version:** Current development version  

## Executive Summary

Comprehensive testing of the MCP debugger with Rust language examples was performed on two Rust programs: a simple hello_world example and an async example using Tokio. The debugger successfully handled Rust debugging operations, though important toolchain compatibility issues were discovered.

## Test Scope

### Examples Tested
1. **hello_world** - Basic Rust program with functions, variables, and control flow
2. **async_example** - Async Rust program using Tokio runtime

### Operations Tested
- Creating debug sessions
- Setting breakpoints
- Starting debugging
- Stepping operations (over, into, out)
- Variable inspection
- Expression evaluation
- Stack trace examination
- Async context debugging

## Key Findings

### 1. Initial Windows System Breakpoints

**Issue:** When starting a debug session, the debugger initially stops at Windows system functions (e.g., `RtlGetReturnAddressHijackTarget`, `EtwEventWriteNoRegistration`) before reaching Rust code.

**Behavior:** 
- Stack trace shows Windows internals initially
- Local variables empty at system breakpoints
- Requires continuing execution to reach actual Rust breakpoints

**Resolution:** After continuing execution, the debugger successfully reaches and stops at user-defined breakpoints in Rust code.

**Impact:** Minor - requires an extra continue command but doesn't affect debugging functionality.

### 2. Toolchain Compatibility Issues

**Issue:** MSVC vs GNU toolchain compatibility with CodeLLDB

**MSVC Toolchain Problems:**
- CodeLLDB cannot fully read MSVC PDB debug symbols
- Results in limited variable inspection capabilities
- Variables may appear as `<unavailable>`
- String contents may be corrupted
- Complex types (Vec, HashMap, async state) have missing data

**GNU Toolchain Success:**
- Full debugging support with GNU toolchain
- All variables properly visible and inspectable
- Async context properly accessible
- Expression evaluation works correctly

**Recommendation:** Use GNU toolchain for Rust debugging with MCP debugger
```bash
rustup target add x86_64-pc-windows-gnu
cargo clean
cargo build --target x86_64-pc-windows-gnu
```

### 3. Path Handling

**Issue:** Executable paths vary based on build target

**Observed Paths:**
- Default build: `target/debug/program.exe` (may not exist)
- MSVC build: `target/x86_64-pc-windows-msvc/debug/program.exe`
- GNU build: `target/x86_64-pc-windows-gnu/debug/program.exe`

**Impact:** Users need to specify the correct path based on their toolchain.

## Successful Operations

### hello_world Example

✅ **Breakpoint Setting:** Successfully set at line 14
```rust
let version = 1.75;
```

✅ **Variable Inspection:** All local variables visible
- `name: "Rust"`
- `version: 1.75`
- `is_awesome: true`

✅ **Step Over:** Advanced from line 14 to line 18 correctly

✅ **Step Into:** Successfully entered `calculate_sum` function

✅ **Function Parameters:** Correctly displayed
- `a: 5`
- `b: 10`

✅ **Expression Evaluation:** 
- Expression: `a + b`
- Result: `15`
- Type: `long long`

✅ **Step Out:** Returned to calling line correctly

### async_example Example

✅ **Async Breakpoint:** Successfully broke in async function `fetch_data`

✅ **Async Context:** Visible in local variables
- `_task_context` with waker information
- Function parameter `id: 1` correctly shown

✅ **Stack Trace:** Full Tokio runtime stack visible
- Shows async closures
- Tokio runtime internals
- Complete call chain from main

## Issues Encountered

### 1. MSVC Toolchain Warning
**Severity:** Medium  
**Description:** When using MSVC-compiled binaries, the debugger provides a detailed warning about limited debugging capabilities.  
**Workaround:** Use GNU toolchain as recommended.

### 2. Initial System Breakpoints
**Severity:** Low  
**Description:** Initial pause at Windows system functions before reaching user code.  
**Workaround:** Continue execution to reach user breakpoints.

### 3. Binary Path Discovery
**Severity:** Low  
**Description:** Need to manually determine correct binary path based on toolchain.  
**Workaround:** Check target directory structure for actual executable location.

## Performance Observations

- Breakpoint hits: Immediate
- Step operations: Responsive (< 1 second)
- Variable inspection: Quick
- Expression evaluation: Fast
- Session creation/closure: Efficient

## Recommendations

1. **Documentation Updates:**
   - Add clear guidance about GNU vs MSVC toolchain
   - Include path examples for different build configurations
   - Document the initial system breakpoint behavior

2. **Toolchain Detection:**
   - Consider auto-detecting binary toolchain and providing suggestions
   - The current warning system for MSVC is excellent

3. **Path Resolution:**
   - Consider searching common Rust build paths automatically
   - Support relative paths from project root

4. **User Experience:**
   - Consider auto-continuing through initial system breakpoints
   - Add a "rust" specific configuration option for common settings

## Test Coverage Summary

| Feature | hello_world | async_example | Status |
|---------|------------|---------------|---------|
| Session Creation | ✅ | ✅ | Pass |
| Breakpoint Setting | ✅ | ✅ | Pass |
| Start Debugging | ✅ | ✅ | Pass |
| Continue Execution | ✅ | ✅ | Pass |
| Step Over | ✅ | N/A | Pass |
| Step Into | ✅ | N/A | Pass |
| Step Out | ✅ | N/A | Pass |
| Variable Inspection | ✅ | ✅ | Pass |
| Expression Evaluation | ✅ | N/A | Pass |
| Stack Trace | ✅ | ✅ | Pass |
| Async Context | N/A | ✅ | Pass |
| GNU Toolchain | ✅ | ✅ | Pass |
| MSVC Toolchain | N/A | ⚠️ | Limited |

## Conclusion

The MCP debugger successfully handles Rust debugging with full functionality when using the GNU toolchain. While MSVC toolchain support is limited due to CodeLLDB's PDB symbol reading limitations, the debugger properly detects and warns about this issue, providing clear guidance to users.

The debugger handles both synchronous and asynchronous Rust code well, with all standard debugging operations working as expected. The initial Windows system breakpoints are a minor inconvenience but don't impact the overall debugging experience.

**Overall Assessment:** ✅ **READY FOR RUST DEBUGGING** (with GNU toolchain recommendation)

## Appendix: Test Commands Used

```bash
# Session creation
create_debug_session(language="rust", name="rust_test_session")

# Breakpoint setting
set_breakpoint(sessionId="...", file="full_path", line=14)

# Start debugging
start_debugging(sessionId="...", scriptPath="path/to/exe")

# Debugging operations
continue_execution(sessionId="...")
step_over(sessionId="...")
step_into(sessionId="...")
step_out(sessionId="...")
get_local_variables(sessionId="...")
evaluate_expression(sessionId="...", expression="a + b")
get_stack_trace(sessionId="...")

# Session cleanup
close_debug_session(sessionId="...")
```

---
*Report generated after comprehensive testing of MCP debugger Rust language support*
