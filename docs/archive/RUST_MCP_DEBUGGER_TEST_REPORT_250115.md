# MCP Debugger Rust Language Testing Report
**Date:** January 15, 2025  
**Tester:** Cline AI Assistant  
**MCP Server:** mcp-debugger  
**Test Environment:** Windows 11, Visual Studio Code

## Executive Summary

Testing of the mcp-debugger with Rust language examples revealed several significant issues:

1. **MSVC Toolchain Compatibility**: The debugger correctly detects MSVC-compiled binaries and blocks debugging with a detailed warning
2. **GNU Toolchain Success (Partial)**: Debugging works with GNU-compiled binaries but with string variable corruption issues
3. **Build Tool Dependencies**: The async example cannot be built due to missing dlltool.exe
4. **Variable Inspection Issues**: String types display corrupted data even with GNU toolchain

## Test Cases

### Test Case 1: hello_world with MSVC Toolchain

**Objective:** Test basic debugging of MSVC-compiled Rust binary

**Steps:**
1. Created debug session for Rust language
2. Set breakpoint at line 13 in `examples/rust/hello_world/src/main.rs`
3. Attempted to start debugging with `hello_world.exe` (MSVC build)

**Result:** ❌ FAILED

**Error Details:**
```json
{
  "success": false,
  "state": "created",
  "message": "MSVC_TOOLCHAIN_DETECTED",
  "toolchainValidation": {
    "compatible": false,
    "toolchain": "msvc",
    "message": "Binary: c:\\Users\\johnf\\Dropbox\\projects\\project\\debug-mcp-server\\examples\\rust\\hello_world\\target\\debug\\hello_world.exe\n------------------------------------------------------------\nMSVC toolchain detected - limited debugging support.\n\nThis Rust binary was compiled with the MSVC toolchain. CodeLLDB cannot fully\nread MSVC PDB debug symbols, which causes:\n  - Variable values to appear as <unavailable>\n  - Corrupted string contents\n  - Missing data for complex types (Vec, HashMap, async state)\n\nBreakpoints and stepping continue to work, but variable inspection will be limited."
  }
}
```

**Root Cause Analysis:**
- The debugger uses CodeLLDB which cannot properly parse MSVC PDB debug symbols
- The adapter correctly detects the MSVC toolchain by analyzing the binary format
- Binary analysis revealed: `hasPDB: true`, `hasRSDS: true`, `imports: ["vcruntime140.dll"]`
- The debugger provides appropriate warnings and suggestions to use GNU toolchain

**Severity:** Medium - Documented limitation with clear workarounds provided

---

### Test Case 2: hello_world with GNU Toolchain

**Objective:** Test debugging with GNU-compiled binary

**Steps:**
1. Installed GNU toolchain: `x86_64-pc-windows-gnu` (already installed)
2. Cleaned previous build artifacts
3. Rebuilt with `cargo build --target x86_64-pc-windows-gnu`
4. Created new debug session
5. Set breakpoint at line 13
6. Started debugging with GNU-compiled binary

**Result:** ⚠️ PARTIAL SUCCESS

**Successful Operations:**
- ✅ Debug session created successfully
- ✅ Breakpoint set and verified
- ✅ Debugging started and hit breakpoint
- ✅ Stack trace retrieved correctly
- ✅ Stepping operations (step_over, step_into) worked
- ✅ Integer variables displayed correctly (`version = 1.75`)
- ✅ Boolean variables displayed correctly (`is_awesome = true`)
- ✅ Function parameters inspected correctly (`a = 5`, `b = 10`)

**Issues Found:**
- ❌ String variable corruption: `name` variable showed:
  ```
  {data_ptr:"RustSum of 5 and 10 is: \n", ...}
  ```
  Expected: `"Rust"`

**Sample Stack Trace (at breakpoint):**
```json
{
  "stackFrames": [
    {
      "id": 1001,
      "name": "hello_world::main",
      "file": "C:\\Users\\johnf\\Dropbox\\projects\\project\\debug-mcp-server\\examples\\rust\\hello_world\\src\\main.rs",
      "line": 13,
      "column": 16
    },
    // ... additional frames omitted for brevity
  ]
}
```

**Root Cause Analysis:**
- String corruption appears to be a visualization/formatting issue in CodeLLDB
- The string data pointer seems to reference incorrect memory or get misaligned
- Primitive types (int, double, bool) work correctly
- Complex types like strings (&str) have display issues despite GNU toolchain

**Severity:** High - Variable inspection is a critical debugging feature

---

### Test Case 3: async_example Build

**Objective:** Build async_example for debugging

**Steps:**
1. Attempted to build with GNU toolchain: `cargo build --target x86_64-pc-windows-gnu`
2. Attempted to build with default MSVC toolchain: `cargo build`

**Result:** ❌ FAILED (Both attempts)

**Error Details:**
```
error: error calling dlltool 'dlltool.exe': program not found
error: could not compile `parking_lot_core` (lib) due to 1 previous error
error: could not compile `windows-sys` (lib) due to 1 previous error
```

**Dependencies That Failed:**
- `parking_lot_core v0.9.12`
- `windows-sys v0.61.2`
- `windows-sys v0.60.2`

**Root Cause Analysis:**
- Missing `dlltool.exe` in the Windows build environment
- `dlltool` is part of GNU binutils, required for linking GNU-target Windows applications
- The dependency `parking_lot_core` requires this tool for cross-compilation
- The issue affects the async_example because it uses `tokio` which depends on `parking_lot_core`

**Severity:** Critical - Prevents testing of async Rust debugging functionality

**Workaround Suggestions:**
1. Install MinGW-w64 which includes dlltool
2. Add dlltool to system PATH
3. Use MSVC toolchain exclusively (but this brings back the MSVC debugging limitations)

---

## Issue Summary

### Issue 1: MSVC Toolchain Not Supported for Full Debugging

**Category:** Limitation  
**Severity:** Medium  
**Affected Component:** Rust Adapter with CodeLLDB

**Description:**
The debugger correctly identifies and blocks debugging of MSVC-compiled Rust binaries, as CodeLLDB cannot properly read MSVC PDB debug symbols.

**Impact:**
- Users on Windows by default compile with MSVC toolchain
- Full variable inspection is not available
- Requires rebuilding projects with GNU toolchain

**Recommendation:**
1. Document this limitation prominently in Rust debugging guide
2. Add automatic toolchain detection and suggestion during session creation
3. Consider adding support for Windows Debugger (WinDbg/cppvsdbg) as alternative adapter for MSVC builds

---

### Issue 2: String Variable Corruption with GNU Toolchain

**Category:** Bug  
**Severity:** High  
**Affected Component:** Variable Display / CodeLLDB String Formatter

**Description:**
When debugging Rust code compiled with GNU toolchain on Windows, string variables display corrupted data instead of their actual values.

**Observed Behavior:**
```
name = {data_ptr:"RustSum of 5 and 10 is: \n", ...}
```

**Expected Behavior:**
```
name = "Rust"
```

**Impact:**
- Makes string debugging unreliable
- Affects user experience and debugging effectiveness
- Primitive types work correctly, limiting impact

**Technical Details:**
- String representation uses `&str` type
- Data pointer appears misaligned or pointing to wrong memory
- The corrupted data seems to show content from other parts of memory
- Possible issues:
  1. String formatter in CodeLLDB not handling Rust's fat pointer correctly
  2. Memory alignment issues with GNU ABI on Windows
  3. Debug symbol information incomplete or incorrect

**Recommendation:**
1. Investigate CodeLLDB's Rust string formatter implementation
2. Test with different Rust versions to see if issue is version-specific
3. Check if updating CodeLLDB resolves the issue
4. Consider adding custom formatters for Rust string types
5. File bug report with CodeLLDB if issue persists

---

### Issue 3: Missing dlltool.exe Prevents async_example Compilation

**Category:** Environment/Dependency Issue  
**Severity:** Critical  
**Affected Component:** Build System / GNU Toolchain Dependencies

**Description:**
The async_example cannot be compiled with either GNU or MSVC toolchain due to missing `dlltool.exe`, which is required by the `parking_lot_core` dependency.

**Impact:**
- Cannot test async Rust debugging features
- Blocks comprehensive testing of Rust adapter
- Affects any Rust project using tokio or parking_lot dependencies

**Root Cause:**
- `dlltool.exe` is part of GNU binutils
- Required for creating import libraries when using GNU toolchain on Windows
- Not included in standard Rust toolchain installation
- The MSVC build also failed because the previous GNU build left cached artifacts

**Recommendation:**
1. Document dlltool requirement in setup instructions
2. Add automated check for required build tools
3. Provide clear installation instructions for MinGW-w64
4. Consider providing a pre-built async_example binary for testing
5. Add build environment validation tool

---

## Positive Findings

Despite the issues, several aspects worked well:

1. **Toolchain Detection**: Excellent detection and warning for MSVC binaries
2. **Error Messages**: Clear, informative error messages with actionable suggestions
3. **Basic Debugging Flow**: Breakpoints, stepping, and stack traces work reliably
4. **Primitive Type Inspection**: Integers, floats, and booleans display correctly
5. **Function Parameter Inspection**: Works properly for supported types
6. **Session Management**: Session creation and cleanup work smoothly

---

## Recommendations for Users

### For Windows Users Debugging Rust:

1. **Install GNU Toolchain:**
   ```bash
   rustup target add x86_64-pc-windows-gnu
   ```

2. **Install MinGW-w64 for dlltool:**
   - Download from: https://www.mingw-w64.org/
   - Ensure dlltool.exe is in PATH

3. **Build Projects with GNU Target:**
   ```bash
   cargo clean
   cargo build --target x86_64-pc-windows-gnu
   ```

4. **Be Aware of String Display Issues:**
   - Primitive types work reliably
   - String inspection may show corrupted data
   - Use print statements or evaluate expressions as workaround

### For Developers Improving the Debugger:

1. **Priority 1**: Fix string variable corruption with GNU builds
2. **Priority 2**: Add dlltool availability check and guidance
3. **Priority 3**: Consider alternative debugger backend for MSVC support
4. **Priority 4**: Improve documentation for Windows Rust debugging setup

---

## Test Environment Details

**System Information:**
- OS: Windows 11
- Shell: cmd.exe (PowerShell for some commands)
- Working Directory: `C:\path\to\debug-mcp-server`

**Rust Environment:**
- Toolchains: Both MSVC and GNU (x86_64-pc-windows-gnu) installed
- Cargo: Available and functional
- Default toolchain: MSVC

**Example Files Tested:**
1. `examples/rust/hello_world/src/main.rs` - Simple synchronous Rust program
2. `examples/rust/async_example/src/main.rs` - Tokio-based async program (build failed)

---

## Conclusion

The mcp-debugger's Rust adapter shows promise but has significant limitations on Windows:

1. **MSVC toolchain incompatibility** is correctly handled with appropriate warnings
2. **GNU toolchain works partially** but has critical string variable display issues
3. **Build environment dependencies** (dlltool) are not clearly documented or validated
4. **Basic debugging operations** (breakpoints, stepping) work reliably when environment is properly configured

**Overall Assessment:** Requires improvement before production use on Windows. Linux users likely have better experience with GNU toolchain as default.

**Next Steps:**
1. Test on Linux to compare behavior
2. Investigate string corruption issue with CodeLLDB developers
3. Update documentation with Windows-specific setup requirements
4. Add environment validation checks to prevent common setup issues
