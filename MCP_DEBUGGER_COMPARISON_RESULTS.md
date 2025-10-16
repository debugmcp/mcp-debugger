# MCP Debugger Comparison: Containerized vs Non-Containerized

## Test Date
October 15, 2025, 9:42 AM

## Test Objective
Compare debugging functionality between the containerized (mcp-debugger-docker) and non-containerized (mcp-debugger) versions to identify differences and potential regressions after refactoring.

## Test Files Used
- Python: `examples/python/simple_test.py`
- JavaScript: `examples/javascript/test-simple.js`

---

## Summary Results

| Feature | Non-Containerized (mcp-debugger) | Containerized (mcp-debugger-docker) |
|---------|-----------------------------------|--------------------------------------|
| **Python Debugging** | ✅ **WORKING** | ✅ **WORKING** |
| **JavaScript Debugging** | ✅ **WORKING** | ❌ **BROKEN** |

---

## Python Debugging Comparison

### Non-Containerized ✅
- **Session Creation**: Success
- **Breakpoint Setting**: Success (requires absolute path)
- **Debugging Start**: Success - paused at breakpoint
- **Stack Trace**: Working correctly
- **Variable Inspection**: Working (a=1, b=2 before swap)
- **Step Operations**: Working
- **Variable Updates**: Correctly shows a=2, b=1 after swap
- **Session Cleanup**: Success

### Containerized ✅
- **Session Creation**: Success
- **Breakpoint Setting**: Success (uses workspace-relative path)
- **Debugging Start**: Success - paused at breakpoint
- **Stack Trace**: Working correctly
- **Variable Inspection**: Working (a=1, b=2 before swap)
- **Step Operations**: Working
- **Variable Updates**: Correctly shows a=2, b=1 after swap
- **Session Cleanup**: Success

### Python Verdict
✅ **Both versions work identically for Python debugging.** The only difference is path handling:
- Non-containerized requires absolute Windows paths
- Containerized uses workspace-relative paths

---

## JavaScript Debugging Comparison

### Non-Containerized ✅
- **Session Creation**: Success
- **Breakpoint Setting**: Success (requires absolute path)
- **Debugging Start**: Success - paused at breakpoint
- **Stack Trace**: Working (shows correct file and line)
- **Variable Inspection**: Working
  - Initially showed empty Local scope (expected for const declarations)
  - Module scope correctly showed x=5, y=10
- **Step Operations**: Working (stepped from line 6 to line 7)
- **Session Cleanup**: Success

### Containerized ❌
- **Session Creation**: Success
- **Breakpoint Setting**: Success
- **Debugging Start**: **FAILED**
  - Error state returned immediately
  - DAP adapter spawns successfully
  - Connection established but drops during launch command
  - Error: "DAP command launch failed: DAP client disconnected"
- **Stack Trace**: Unable to test (debugging failed)
- **Variable Inspection**: Unable to test (debugging failed)
- **Step Operations**: Unable to test (debugging failed)
- **Session Cleanup**: Success (cleanup works even after failure)

### JavaScript Verdict
❌ **Critical regression in containerized JavaScript debugging.** The non-containerized version works perfectly, but the containerized version fails completely during the launch phase.

---

## Key Differences

### 1. Path Handling
- **Non-containerized**: Requires absolute Windows paths (`C:/path/to/user/...`)
- **Containerized**: Uses workspace-relative paths (`examples/...`)
- Both handle their respective path formats correctly

### 2. JavaScript Adapter Behavior
- **Non-containerized**: js-debug adapter launches and maintains connection
- **Containerized**: js-debug adapter launches but connection drops during initialization

### 3. Environment Context
- **Non-containerized**: Runs directly on Windows with native Node.js
- **Containerized**: Runs in Docker container with containerized Node.js

---

## Root Cause Analysis

The JavaScript debugging failure in the containerized environment appears to be related to:

1. **DAP Connection Stability**: The adapter spawns successfully but the DAP connection closes unexpectedly during the launch command
2. **Container-Specific Issues**: 
   - Possible Node.js executable path resolution problems
   - Environment variable differences between container and host
   - js-debug adapter may need special configuration for Docker
3. **Timing Issues**: The connection drops immediately after the setBreakpoints command, suggesting a launch configuration problem

---

## Recommendations

### Immediate Actions
1. **Fix Priority**: JavaScript debugging in Docker is completely broken and needs immediate attention
2. **Debug the Launch Phase**: Add detailed logging to capture why the DAP connection drops
3. **Review Container Configuration**: Check Node.js paths and environment variables in the container
4. **Test js-debug Adapter**: Verify js-debug adapter compatibility with containerized environments

### Investigation Steps
1. Compare the exact launch arguments between containerized and non-containerized versions
2. Check if js-debug requires specific Docker configurations
3. Review recent refactoring changes that might affect JavaScript adapter initialization
4. Test with different Node.js versions in the container

### Testing Improvements
1. Add automated tests for both containerized and non-containerized environments
2. Include JavaScript debugging in CI/CD pipeline
3. Test with multiple JavaScript file types (modules, workers, TypeScript)

---

## Conclusion

The refactoring has maintained Python debugging functionality perfectly in both environments. However, JavaScript debugging has a critical regression in the containerized version that prevents it from working at all.

**Current State:**
- ✅ Python debugging: Fully functional in both versions
- ✅ JavaScript debugging: Works in non-containerized version
- ❌ JavaScript debugging: Completely broken in containerized version

**Recommendation:** Do not deploy the containerized version until JavaScript debugging is fixed, or clearly document that only Python debugging is supported in Docker.
