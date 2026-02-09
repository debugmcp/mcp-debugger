# Rust MCP Debugger Test Report

**Date**: January 14, 2025  
**Tester**: AI Assistant  
**Environment**: Windows 11, Visual Studio Code  
**MCP Debugger Version**: Latest (from repository)  
**Test Scope**: Rust language examples in examples/rust directory

## Executive Summary

Testing of the MCP debugger with Rust examples revealed **critical issues** that prevent effective debugging of Rust programs on Windows. The debugger successfully launches and connects to Rust executables, but consistently stops at Windows internal functions rather than user code, making it impossible to debug Rust applications effectively.

## Test Environment

- **OS**: Windows 11
- **Shell**: cmd.exe
- **Working Directory**: `C:/path/to/debug-mcp-server`
- **Examples Tested**:
  - `examples/rust/hello_world/` - Simple Rust program with basic debugging features
  - `examples/rust/async_example/` - Async Rust program using Tokio

## Examples Overview

### Hello World Example
- **Purpose**: Demonstrates basic Rust debugging features
- **Features**: Variable inspection, function calls, control flow, loops
- **Executable**: `examples/rust/hello_world/target/debug/hello_world.exe`
- **Source**: `examples/rust/hello_world/src/main.rs`

### Async Example
- **Purpose**: Demonstrates async Rust debugging with Tokio
- **Features**: Async/await, concurrent tasks, Tokio runtime
- **Executable**: `examples/rust/async_example/target/debug/async_example.exe`
- **Source**: `examples/rust/async_example/src/main.rs`

## Test Results

### Test 1: Hello World Basic Debugging

**Steps Executed**:
1. Created debug session: `create_debug_session --language rust --name rust-hello-world-test`
   - ✅ **SUCCESS**: Session created with ID `583a7b71-9500-497b-9ff0-85accaf79aa9`

2. Set breakpoint at line 16 (after variable declarations)
   - ✅ **SUCCESS**: Breakpoint set but marked as `verified: false`
   - ⚠️ **WARNING**: Breakpoint on blank line (line 16 is empty)

3. Started debugging: `start_debugging --scriptPath hello_world.exe`
   - ✅ **SUCCESS**: Debugging started, state: `paused`, reason: `breakpoint`
   - ❌ **ISSUE**: Did not stop at user breakpoint

4. Got stack trace
   - ❌ **CRITICAL ISSUE**: Stack shows only Windows internal functions:
     ```
     - RtlGetReturnAddressHijackTarget
     - EtwEventWriteNoRegistration (multiple frames)
     - LdrInitializeThunk
     ```
   - No user code (main.rs) in stack trace

5. Got local variables
   - ❌ **ISSUE**: No variables available (empty scope)
   - This is expected since we're in Windows internals, not user code

6. Continued execution
   - ✅ Command succeeded
   - ❌ **CRITICAL ISSUE**: Session immediately terminated
   - Unable to reach user code

### Test 2: Async Example Debugging

**Steps Executed**:
1. Created debug session: `create_debug_session --language rust --name rust-async-test`
   - ✅ **SUCCESS**: Session created with ID `23ae2a6a-3e04-45a4-b416-b5b4c0b423d5`

2. Set breakpoint at line 35 (async loop)
   - ✅ **SUCCESS**: Breakpoint set but marked as `verified: false`

3. Started debugging: `start_debugging --scriptPath async_example.exe`
   - ✅ **SUCCESS**: Debugging started, state: `paused`, reason: `breakpoint`
   - ❌ **ISSUE**: Did not stop at user breakpoint

4. Got stack trace
   - ❌ **CRITICAL ISSUE**: Same Windows internal functions as Test 1:
     ```
     - RtlGetReturnAddressHijackTarget
     - EtwEventWriteNoRegistration (multiple frames)
     - LdrInitializeThunk
     ```

5. Continued execution
   - ✅ Command succeeded
   - ❌ **CRITICAL ISSUE**: Session immediately terminated

### Test 3: Stop on Entry Behavior

**Steps Executed**:
1. Created debug session: `create_debug_session --language rust --name rust-stopOnEntry-test`
   - ✅ **SUCCESS**: Session created with ID `06f868de-420e-4dda-9f39-77a05526155b`

2. Started debugging with `stopOnEntry: true`
   - ✅ **SUCCESS**: Debugging started, `stopOnEntrySuccessful: true`
   - ❌ **ISSUE**: Stopped at Windows internals, not at user code entry point

3. Got stack trace
   - ❌ **CRITICAL ISSUE**: Same Windows internal functions
   - Expected to stop at `main()` function in main.rs

4. Stepped over
   - ✅ Command succeeded
   - ❌ **ISSUE**: Advanced to line 580 in `@RtlGetReturnAddressHijackTarget`
   - Still stuck in Windows internals, not advancing to user code

5. Closed session
   - ✅ **SUCCESS**: Session closed cleanly

## Critical Issues Identified

### Issue 1: Debugger Stops at Windows Internals Instead of User Code
**Severity**: CRITICAL  
**Impact**: Makes Rust debugging completely unusable

**Description**:
When debugging Rust programs on Windows, the debugger consistently stops at Windows internal functions (RtlGetReturnAddressHijackTarget, EtwEventWriteNoRegistration, LdrInitializeThunk) instead of user code. This occurs regardless of:
- Whether breakpoints are set
- Whether `stopOnEntry` is enabled
- Which example program is being debugged

**Observed Behavior**:
- Initial stop after `start_debugging` shows Windows system functions in stack trace
- No frames from user code (main.rs or any Rust source files)
- Local variables are empty (correct for system code, but wrong location)
- Stepping operations remain trapped in Windows internals

**Expected Behavior**:
- With `stopOnEntry: true`, should stop at the first line of `main()` function
- With breakpoints set, should skip system code and stop at user breakpoints
- Stack traces should show Rust source files and function names

### Issue 2: Session Terminates Immediately After Continue
**Severity**: CRITICAL  
**Impact**: Cannot debug past initial stop point

**Description**:
When `continue_execution` is called from the initial stop at Windows internals, the debug session terminates immediately rather than continuing to user code or set breakpoints.

**Observed Behavior**:
- `continue_execution` returns success
- Next tool call fails with "Session is terminated"
- Program appears to run to completion without stopping at user breakpoints

**Expected Behavior**:
- Should continue execution and stop at next breakpoint in user code
- Should allow inspection of variables and stepping through user code
- Session should remain active until program completes or explicit close

### Issue 3: Breakpoints Not Verified
**Severity**: HIGH  
**Impact**: Unreliable breakpoint behavior

**Description**:
All breakpoints set before starting debugging show `verified: false`. This suggests the debugger cannot resolve source file paths or line numbers until the program is launched.

**Observed Behavior**:
```json
{
  "verified": false,
  "message": "Breakpoint set at ...",
  "line": 16
}
```

**Expected Behavior**:
- Breakpoints should be verified during initialization
- If paths are incorrect, should provide actionable error messages
- Should indicate if debug symbols are missing or mismatched

## Root Cause Analysis

### Probable Root Cause 1: Entry Point Configuration
The Rust adapter may be configuring CodeLLDB to stop at the process entry point (which is in Windows system code) rather than at the Rust program's entry point (the `main()` function). 

**Evidence**:
- Stops at `LdrInitializeThunk` which is the Windows loader entry point
- This happens before Rust runtime initialization
- Both `stopOnEntry: true` and regular breakpoints exhibit same behavior

**Potential Fix**:
- Configure CodeLLDB with proper entry point settings for Rust
- Use `"stopOnEntry": false` in launch config and rely on breakpoints
- Add configuration to skip Windows system frames

### Probable Root Cause 2: Source Path Resolution
The debugger may not be correctly mapping source file paths to the compiled executable's debug symbols.

**Evidence**:
- Breakpoints marked as `verified: false`
- No user source files appear in stack traces
- Using absolute Windows paths: `c:/Users/user/.../main.rs`

**Potential Fix**:
- Verify debug symbols are embedded in executables
- Check source path configuration in CodeLLDB adapter
- Ensure `sourceMap` or similar settings are correct

### Probable Root Cause 3: JustMyCode Setting
The `justMyCode` setting may not be working correctly for Rust on Windows, causing the debugger to stop at system code.

**Evidence**:
- Default behavior should skip non-user code
- Stops at Windows internal functions
- Cannot step into user code

**Potential Fix**:
- Explicitly set `justMyCode: true` in launch configuration
- Configure exception filters for Rust
- Add source filters to skip system code

### Probable Root Cause 4: CodeLLDB Windows Compatibility
The CodeLLDB adapter may have Windows-specific issues with Rust debugging.

**Evidence**:
- Consistent failure across different examples
- Windows internal function names suggest Windows-specific behavior
- May work differently on Linux/macOS

**Potential Fix**:
- Check CodeLLDB version and Windows compatibility
- Review CodeLLDB issue tracker for similar Windows/Rust issues
- Consider alternative Rust debugger adapters for Windows

## Comparison with Other Language Adapters

Based on this testing and previous reports:

| Language   | Status      | Notes                                    |
|------------|-------------|------------------------------------------|
| Python     | ✅ Working  | Reliable debugging on Windows            |
| JavaScript | ✅ Working  | Node.js debugging functional             |
| Rust       | ❌ Broken   | Cannot reach user code on Windows        |
| Mock       | ✅ Working  | Test adapter for development             |

## Recommendations

### Immediate Actions
1. **Do Not Use Rust Debugger on Windows** - Current state is completely non-functional
2. **Investigate CodeLLDB Configuration** - Review how CodeLLDB is being initialized for Rust
3. **Test on Linux** - Determine if issue is Windows-specific
4. **Review Debug Symbol Generation** - Verify Rust compiler is generating correct debug info

### Short-term Fixes
1. Configure CodeLLDB to skip Windows system code automatically
2. Implement better breakpoint verification before launch
3. Add error handling for failed breakpoint resolution
4. Provide clear error messages when stopping at wrong location

### Long-term Improvements
1. Add platform-specific adapter configuration
2. Implement automatic detection of debug build vs release build
3. Add troubleshooting guide for Rust debugging
4. Consider Windows-specific Rust debugging tools (e.g., WinDbg integration)

## Files Examined

### Source Files
- `examples/rust/README.md` - Documentation for Rust examples
- `examples/rust/hello_world/src/main.rs` - Simple Rust program (45 lines)
- `examples/rust/async_example/src/main.rs` - Async Rust program (56 lines)

### Executables
- `examples/rust/hello_world/target/debug/hello_world.exe` - Compiled hello world
- `examples/rust/async_example/target/debug/async_example.exe` - Compiled async example

### Build Artifacts
Both examples have complete build artifacts in `target/debug/` including:
- `.pdb` files (debug symbols)
- `.d` files (dependency info)
- Incremental compilation cache

## Detailed Test Logs

### Session 1: hello_world Basic Test
```
Session ID: 583a7b71-9500-497b-9ff0-85accaf79aa9
Language: rust
Name: rust-hello-world-test

1. set_breakpoint(line 16)
   Result: Breakpoint set, verified=false

2. start_debugging(hello_world.exe)
   Result: Paused at Windows internals
   
3. get_stack_trace()
   Result:
   - RtlGetReturnAddressHijackTarget @ line 579
   - EtwEventWriteNoRegistration @ line 2139
   - EtwEventWriteNoRegistration @ line 529
   - EtwEventWriteNoRegistration @ line 400
   - LdrInitializeThunk @ line 7

4. get_local_variables()
   Result: Empty (0 variables)

5. continue_execution()
   Result: Session terminated
```

### Session 2: async_example Test
```
Session ID: 23ae2a6a-3e04-45a4-b416-b5b4c0b423d5
Language: rust
Name: rust-async-test

1. set_breakpoint(line 35)
   Result: Breakpoint set, verified=false

2. start_debugging(async_example.exe)
   Result: Paused at Windows internals (identical to Session 1)

3. get_stack_trace()
   Result: Same Windows internal functions

4. continue_execution()
   Result: Session terminated
```

### Session 3: stopOnEntry Test
```
Session ID: 06f868de-420e-4dda-9f39-77a05526155b
Language: rust
Name: rust-stopOnEntry-test

1. start_debugging(hello_world.exe, stopOnEntry=true)
   Result: Paused, stopOnEntrySuccessful=true
   BUT: Still at Windows internals, not user code

2. get_stack_trace()
   Result: Same Windows internal functions

3. step_over()
   Result: Moved to line 580 in RtlGetReturnAddressHijackTarget
   Still trapped in Windows code

4. close_debug_session()
   Result: Success
```

## Conclusion

The Rust debugging functionality in the MCP debugger is **currently non-functional on Windows** due to critical issues with stopping at Windows internal functions instead of user code. The debugger successfully launches and connects to Rust executables, but:

1. ❌ Cannot stop at user-set breakpoints
2. ❌ Cannot inspect user variables
3. ❌ Cannot step through user code
4. ❌ Sessions terminate immediately after attempting to continue
5. ❌ `stopOnEntry` stops at Windows internals, not user entry point

**Status**: 🔴 **BLOCKED** - Rust debugging cannot be used in its current state

**Next Steps**: 
- Investigate CodeLLDB adapter configuration for Windows
- Test on Linux to determine if issue is platform-specific
- Review Rust debug symbol generation
- Consider alternative debugging approaches for Rust on Windows

## Appendix: Environment Details

**Detected CLI Tools**:
- `cargo` - Rust build tool (available, used to build examples)
- `rustc` - Rust compiler (available)
- Other tools: git, docker, npm, pnpm, python, node, code

**Build Status**:
- Both example projects have been successfully compiled
- Debug builds contain `.pdb` symbol files
- No build errors reported

**MCP Server**:
- Server: `mcp-debugger`
- Command: `node C:/Users/user/.../dist/index.js --log-level debug`
- Status: Running and responsive
- All tool calls succeeded (no server errors)
