# MCP-Debugger Rust Language Testing - Issues Analysis Report

**Test Date:** November 17, 2025  
**Test Environment:** Windows 11, x86_64-pc-windows-gnu/msvc  
**Test Objective:** Identify and categorize issues with Rust debugging using mcp-debugger

## Executive Summary

Testing revealed that mcp-debugger can successfully debug Rust programs on Windows when properly configured. However, there are significant toolchain compatibility and configuration issues that need to be addressed for a reliable setup.

## Test Results Summary

### ✅ What Works

1. **Basic Debugging with GNU Toolchain**
   - Successfully debugged `hello_world` example
   - Breakpoints work correctly (hit at expected lines)
   - Step-over functionality works
   - Stack traces show correct Rust function names and file locations
   - Local variable inspection works (parameters visible in functions)
   - GDB 16.3 successfully interfaces with CodeLLDB

2. **Debug Infrastructure**
   - CodeLLDB is properly vendored at `packages/adapter-rust/vendor/codelldb/win32-x64/`
   - Session creation and management works
   - Breakpoint setting with absolute paths works
   - Debug state transitions (paused/running) work correctly

### ❌ What Doesn't Work

1. **GNU Toolchain Compilation Issues**
   - Cannot build new projects with GNU toolchain
   - Missing MinGW runtime libraries (crt2.o, libkernel32, etc.)
   - dlltool.exe CreateProcess errors
   - x86_64-w64-mingw32-gcc linker failures

2. **MSVC Toolchain Debugging Limitations**
   - CodeLLDB cannot read MSVC PDB debug symbols
   - Variable values show as `<unavailable>`
   - String contents appear corrupted
   - Complex types (Vec, HashMap, async state) missing data
   - Limited to control flow debugging only

3. **Path Resolution Issues**
   - Relative paths for breakpoint files don't work
   - Must use absolute paths for file references

## Issue Categories

### Category 1: Toolchain Issues

| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|------------|
| GNU linker missing libraries | Critical | Cannot build with GNU | MinGW toolchain incomplete |
| MSVC PDB incompatibility | High | No variable inspection | CodeLLDB limitation |
| dlltool CreateProcess error | Critical | Build failures | Path/permission issues |

**Example Error:**
```
ld: cannot find crt2.o: No such file or directory
ld: cannot find -lkernel32: No such file or directory
dlltool.exe: CreateProcess
```

### Category 2: MCP-Debugger Issues

| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|------------|
| Relative path resolution | Medium | Must use absolute paths | Path handling logic |
| No toolchain auto-detection | Low | Manual configuration needed | Missing detection logic |

### Category 3: Environment Configuration

| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|------------|
| MinGW not properly configured | Critical | GNU builds fail | Incomplete MSYS2 setup |
| PATH configuration complex | Medium | Manual setup required | Multiple toolchain paths |

## Detailed Test Log

### Test 1: Hello World (Success with pre-built binary)

```json
{
  "session": "b1ddb7cc-8841-4f12-9bb8-eb9b90feec8f",
  "executable": "hello_world.exe (pre-built)",
  "toolchain": "GNU",
  "result": "SUCCESS",
  "features_tested": [
    "Breakpoint at line 10 - HIT",
    "Step-over - WORKS",
    "Local variables - VISIBLE (name=\"Rust\")",
    "Function parameters - VISIBLE (a=5, b=10)",
    "Stack trace - CORRECT"
  ]
}
```

### Test 2: Async Example (Failed - Toolchain Issues)

```json
{
  "session": "9bfaa185-9874-4f0e-b82f-c6f700fefe61",
  "executable": "async_example.exe",
  "toolchain_attempts": [
    {
      "toolchain": "GNU",
      "result": "BUILD_FAILED",
      "error": "Linker missing libraries"
    },
    {
      "toolchain": "MSVC",
      "result": "BUILD_SUCCESS_DEBUG_LIMITED",
      "error": "PDB symbols unreadable by CodeLLDB"
    }
  ]
}
```

## Root Cause Analysis

### 1. GNU Toolchain Issues
The GNU toolchain on Windows requires a complete MinGW-w64 environment. The current setup has:
- ✅ Rust GNU toolchain installed
- ✅ dlltool.exe available in rustup
- ❌ MinGW runtime libraries missing
- ❌ MSYS2 gcc toolchain incomplete

### 2. MSVC Toolchain Limitations
CodeLLDB (the Rust debug adapter) is built on LLDB, which has limited support for Microsoft's PDB format:
- LLDB primarily supports DWARF debug format (used by GNU)
- PDB support is incomplete in LLDB
- This is a known upstream limitation

### 3. Configuration Complexity
The Windows Rust debugging setup requires coordinating multiple components:
- Rust toolchain (GNU vs MSVC)
- Debug adapter (CodeLLDB)
- System debugger (GDB for GNU, CDB for MSVC)
- Runtime libraries (MinGW for GNU, Visual C++ for MSVC)

## Recommended Solution

### For Reliable Rust Debugging on Windows

#### Option 1: Complete GNU Setup (Recommended)
```powershell
# 1. Install MSYS2 (if not present)
winget install MSYS2.MSYS2

# 2. Install MinGW toolchain
pacman -S mingw-w64-ucrt-x86_64-toolchain

# 3. Add to PATH
$env:PATH = "C:\msys64\ucrt64\bin;$env:PATH"

# 4. Set dlltool
$env:DLLTOOL = "$env:USERPROFILE\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained\dlltool.exe"

# 5. Use GNU toolchain
rustup default stable-x86_64-pc-windows-gnu
cargo build
```

#### Option 2: Use Pre-built Binaries
- Build on a properly configured system
- Distribute debug binaries
- Debug without rebuilding

#### Option 3: WSL2 Environment
- Use Linux debugging tools
- Avoid Windows-specific issues
- Full GNU toolchain support

## Configuration Validation Checklist

```bash
# Check GNU toolchain
rustup show | grep gnu

# Check GDB
gdb --version

# Check MinGW GCC
x86_64-w64-mingw32-gcc --version

# Check dlltool
echo $env:DLLTOOL

# Check CodeLLDB
ls packages/adapter-rust/vendor/codelldb/

# Test build
cargo +stable-gnu build --target x86_64-pc-windows-gnu

# Test debug
mcp-debugger create rust session
```

## Known Workarounds

1. **For Path Issues:**
   - Always use absolute paths for files
   - Use forward slashes or escaped backslashes

2. **For GNU Build Issues:**
   - Pre-build binaries on configured system
   - Use Docker/WSL for consistent environment

3. **For MSVC Debug Issues:**
   - Use Visual Studio or VS Code C++ extension
   - Accept limited debugging (breakpoints only)

## Future Improvements

1. **MCP-Debugger Enhancements:**
   - Add toolchain detection and validation
   - Improve path resolution
   - Add setup validation command
   - Better error messages for missing dependencies

2. **Documentation:**
   - Windows-specific setup guide
   - Troubleshooting decision tree
   - Video tutorials for setup

3. **Automation:**
   - PowerShell setup script improvements
   - Automated dependency installation
   - CI/CD for Windows testing

## Conclusion

The mcp-debugger works well for Rust debugging when properly configured, but Windows users face significant setup challenges. The primary issues stem from toolchain incompatibilities and missing dependencies rather than mcp-debugger bugs. A properly configured GNU toolchain provides the best debugging experience, while MSVC toolchain users face inherent limitations due to CodeLLDB's incomplete PDB support.

## Appendix: Error Messages

### GNU Linker Errors
```
ld: cannot find crt2.o: No such file or directory
ld: cannot find crtbegin.o: No such file or directory
ld: cannot find -lkernel32: No such file or directory
ld: cannot find -lntdll: No such file or directory
ld: cannot find -luserenv: No such file or directory
ld: cannot find -lws2_32: No such file or directory
ld: cannot find -ldbghelp: No such file or directory
ld: cannot find -lgcc_eh: No such file or directory
ld: cannot find -l:libpthread.a: No such file or directory
ld: cannot find -lmsvcrt: No such file or directory
ld: cannot find -lmingwex: No such file or directory
ld: cannot find -lmingw32: No such file or directory
ld: cannot find -lgcc: No such file or directory
ld: cannot find -luser32: No such file or directory
ld: cannot find crtend.o: No such file or directory
```

### MSVC Debugging Warning
```
MSVC toolchain detected - limited debugging support.
This Rust binary was compiled with the MSVC toolchain. CodeLLDB cannot fully
read MSVC PDB debug symbols, which causes:
  - Variable values to appear as <unavailable>
  - Corrupted string contents
  - Missing data for complex types (Vec, HashMap, async state)
