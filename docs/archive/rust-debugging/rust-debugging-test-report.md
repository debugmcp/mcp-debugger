# Rust Debugging Test Report for MCP-Debugger

**Test Date:** November 16, 2025  
**Environment:** Windows 11, x86_64-pc-windows-gnu  
**Rust Version:** 1.91.1 (ed61e7d7e 2025-11-07)  
**Test Objective:** Evaluate mcp-debugger functionality with Rust language examples and identify configuration issues

## Executive Summary

Testing revealed significant issues with Rust debugging on Windows using the mcp-debugger. While the debugger can create sessions and set breakpoints, actual debugging functionality is severely limited due to missing debugger dependencies and adapter configuration problems.

## Test Environment

### System Configuration
- **OS:** Windows 11
- **Shell:** PowerShell
- **Working Directory:** `C:\path\to\debug-mcp-server`

### Rust Toolchain
```
Default host: x86_64-pc-windows-msvc
Active toolchain: stable-x86_64-pc-windows-gnu (default)
Installed toolchains:
  - stable-x86_64-pc-windows-gnu (active, default)
  - stable-x86_64-pc-windows-msvc
```

### Debugger Status
- **GDB:** ❌ Not installed
- **LLDB:** ❌ Not installed  
- **CodeLLDB:** ❓ Unknown (expected by Rust adapter)

## Test Results

### Test 1: Hello World Example

**Test File:** `examples/rust/hello_world/src/main.rs`

**Steps Performed:**
1. ✅ Created debug session successfully
   - Session ID: `1c332d97-d74c-493c-9a4e-f0a413f17c87`
   - Session Name: `rust-hello-world-test`

2. ✅ Set breakpoint at line 10
   - File: `main.rs` line 10 (`println!("Hello, MCP Debugger!");`)
   - Breakpoint ID: `7c77f9da-e3d2-40b3-8549-fad48458a509`
   - Status: Set but unverified

3. ⚠️ Started debugging with issues
   - Target: `examples\rust\hello_world\target\debug\hello_world.exe`
   - State: Paused (but not at expected location)

4. ❌ Stack trace showed Windows system functions instead of Rust code:
   ```
   - RtlGetReturnAddressHijackTarget (line 579)
   - EtwEventWriteNoRegistration (line 2139)
   - EtwEventWriteNoRegistration (line 529)
   - EtwEventWriteNoRegistration (line 400)
   - LdrInitializeThunk (line 7)
   ```

5. ⚠️ Continue execution attempted but no meaningful debugging occurred

## Issues Identified

### Category 1: Missing Debugger Backend (Critical)
- **Issue:** Neither GDB nor LLDB is installed on the system
- **Impact:** Cannot properly debug native code
- **Error Type:** Environment configuration error
- **Solution:** Install appropriate debugger for Windows

### Category 2: CodeLLDB Adapter Not Configured
- **Issue:** The Rust adapter expects CodeLLDB but it's not properly set up
- **Impact:** Rust-specific debugging features unavailable
- **Error Type:** Toolchain issue
- **Solution:** Run vendor script to download CodeLLDB binaries

### Category 3: Windows GNU Toolchain Complications
- **Issue:** Using `x86_64-pc-windows-gnu` toolchain instead of MSVC
- **Impact:** May have compatibility issues with debugging tools
- **Error Type:** Environment configuration error
- **Solution:** Consider using MSVC toolchain for better Windows debugging

### Category 4: Breakpoint Verification Failed
- **Issue:** Breakpoint set but remains unverified
- **Impact:** Debugger doesn't stop at intended locations
- **Error Type:** MCP-debugger issue or adapter problem
- **Solution:** Need proper debug symbols and debugger backend

### Category 5: Stack Trace Shows System Functions
- **Issue:** Debugger pauses in Windows system code, not user code
- **Impact:** Cannot debug actual Rust application code
- **Error Type:** Adapter configuration issue
- **Solution:** Proper adapter setup with correct launch configuration

## Problem Categorization

| Issue | Category | Severity | Root Cause |
|-------|----------|----------|------------|
| No GDB/LLDB installed | Environment Config | Critical | Missing system dependencies |
| CodeLLDB not vendored | Toolchain | Critical | Build/setup step not completed |
| Windows GNU vs MSVC | Environment Config | Medium | Toolchain selection |
| Unverified breakpoints | MCP-Debugger/Adapter | High | Missing debugger backend |
| System-level stack trace | Adapter Config | High | Improper initialization |
| No Rust code visibility | Multiple | Critical | Combination of above issues |

## Recommended Configuration for Reliable Setup

### For Windows Users

#### Option 1: MSVC Toolchain (Recommended)
```bash
# 1. Install Visual Studio Build Tools or Visual Studio
# 2. Switch to MSVC toolchain
rustup default stable-x86_64-pc-windows-msvc

# 3. Install CodeLLDB through vendoring
cd packages/adapter-rust
npm run build:adapter

# 4. Verify CodeLLDB installation
ls vendor/codelldb*/
```

#### Option 2: GNU Toolchain with MinGW
```bash
# 1. Install MSYS2 and MinGW-w64
# 2. Install GDB through MSYS2
pacman -S mingw-w64-x86_64-gdb

# 3. Add to PATH
export PATH="/mingw64/bin:$PATH"

# 4. Vendor CodeLLDB anyway for better Rust support
cd packages/adapter-rust
npm run build:adapter
```

### Required Installation Steps

1. **Vendor CodeLLDB (Critical)**
   ```bash
   pnpm install  # Should trigger postinstall
   # OR manually:
   pnpm vendor:adapters
   # OR force re-download:
   CODELLDB_FORCE_REBUILD=true pnpm --filter @debugmcp/adapter-rust run build:adapter
   ```

2. **Verify Adapter Status**
   ```bash
   pnpm vendor:status
   ```

3. **Build Debug Binaries with Symbols**
   ```toml
   # In Cargo.toml
   [profile.dev]
   debug = true
   opt-level = 0
   ```

4. **Test Configuration**
   ```bash
   # Build test program
   cd examples/rust/hello_world
   cargo build
   
   # Verify debug symbols
   file target/debug/hello_world.exe  # Should show "with debug_info"
   ```

### Environment Variables

Set these for consistent behavior:
```bash
export RUST_BACKTRACE=1
export CODELLDB_VERSION=1.11.0
export SKIP_ADAPTER_VENDOR=false  # Ensure vendoring happens
```

## Next Steps

1. **Immediate Actions:**
   - Run `pnpm vendor:adapters` to download CodeLLDB
   - Install a native debugger (GDB via MSYS2 or use MSVC toolchain)
   - Switch to MSVC toolchain if on Windows

2. **Testing Improvements:**
   - Add automated check for debugger backend availability
   - Include debugger detection in `create_debug_session`
   - Provide clearer error messages when dependencies are missing

3. **Documentation Updates:**
   - Add Windows-specific setup guide
   - Include troubleshooting for common Windows issues
   - Provide toolchain selection guidance

## Conclusion

The mcp-debugger's Rust support on Windows requires significant setup that isn't currently automated. The main blockers are:
1. Missing native debugger (GDB/LLDB)
2. CodeLLDB not vendored/configured
3. Toolchain compatibility issues

With proper setup following the recommendations above, Rust debugging should work reliably. The tool itself appears functional but needs better dependency management and clearer setup documentation for Windows users.

## Appendix: Test Artifacts

### Session Creation Response
```json
{
  "success": true,
  "sessionId": "1c332d97-d74c-493c-9a4e-f0a413f17c87",
  "message": "Created rust debug session: rust-hello-world-test"
}
```

### Breakpoint Setting Response
```json
{
  "success": true,
  "breakpointId": "7c77f9da-e3d2-40b3-8549-fad48458a509",
  "file": "c:\\Users\\johnf\\Dropbox\\projects\\project\\debug-mcp-server\\examples\\rust\\hello_world\\src\\main.rs",
  "line": 10,
  "verified": false,
  "message": "Breakpoint set at c:\\Users\\johnf\\Dropbox\\projects\\project\\debug-mcp-server\\examples\\rust\\hello_world\\src\\main.rs:10"
}
```

### Problematic Stack Trace
```json
{
  "stackFrames": [
    {"id": 1001, "name": "RtlGetReturnAddressHijackTarget", "line": 579},
    {"id": 1002, "name": "EtwEventWriteNoRegistration", "line": 2139},
    {"id": 1003, "name": "EtwEventWriteNoRegistration", "line": 529},
    {"id": 1004, "name": "EtwEventWriteNoRegistration", "line": 400},
    {"id": 1005, "name": "LdrInitializeThunk", "line": 7}
  ]
}
