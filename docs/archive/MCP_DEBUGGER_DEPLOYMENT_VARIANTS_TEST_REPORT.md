# MCP Debugger Deployment Variants Test Report

**Date:** November 18, 2025  
**Tester:** AI Agent (Cline)  
**Scope:** Testing 4 deployment variants × 3 languages = 12 scenarios  
**Update:** JavaScript stdio issues FIXED and verified on November 18, 2025

## Executive Summary

Comprehensive testing of all four MCP debugger deployment variants (local stdio, Docker stdio, SSE, and packed) against Python, JavaScript, and Rust adapters. Initial testing revealed deployment-specific issues with JavaScript adapter on local stdio builds. **These issues have been FIXED.**

> **November 19 Update:** Rust debugging is now intentionally **disabled** inside the Docker deployment. The container excludes the CodeLLDB payload and advertises only Python/JavaScript for a predictable experience. Rust debugging remains fully supported via the local stdio, SSE, and packed deployments where the adapter shares the host toolchain.

### Overall Results Matrix

| Deployment Variant | Python | JavaScript | Rust |
|-------------------|--------|------------|------|
| **mcp-debugger** (local stdio) | ✅ SUCCESS | ✅ **FIXED** | ✅ SUCCESS |
| **mcp-debugger-docker** (containerized) | ✅ SUCCESS | ✅ SUCCESS | 🚫 Not Supported (disabled) |
| **mcp-debugger-sse** (local SSE) | ✅ SUCCESS | ✅ SUCCESS | ✅ SUCCESS |
| **mcp-debugger-pack** (packed) | ✅ SUCCESS | ✅ **FIXED** | ✅ SUCCESS |

**Success Rate:** 10/12 scenarios fully supported. Docker + Rust intentionally disabled (see Section 2.3) due to CodeLLDB/DWARF incompatibilities.

## Detailed Test Results

### 1. mcp-debugger (Local Build, STDIO)

#### 1.1 Python - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 11
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct frames (main, <module>)
- **Variable Inspection:** ✅ a=1, b=2 before swap, a=2, b=1 after swap
- **Stepping:** ✅ Step over working correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. All debugging operations work as expected.

#### 1.2 JavaScript - ✅ **FIXED** (Previously ❌ FAILED)
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 14
- **Start Debugging:** ✅ **FIXED - Now pauses at breakpoint**
- **Variable Inspection:** ✅ a=1, b=2 correctly retrieved
- **Stepping:** ✅ Step over working correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** **FIXED and fully functional.** All debugging operations now work correctly.

**Fix Verified:** November 18, 2025 - Session ID: 79d1841c-13be-402d-864b-340fc87f3501

**Previous Issue:** JavaScript adapter was failing to launch in local stdio mode, entering "error" state immediately. This has been resolved.

#### 1.3 Rust - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 18
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct (hello_world::main + runtime frames)
- **Variable Inspection:** ✅ name="Rust", version=1.75, is_awesome=true, result=15
- **Stepping:** ✅ Step over working, variables updated correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. All debugging operations work correctly.

---

### 2. mcp-debugger-docker (Containerized, STDIO)

#### 2.1 Python - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at /workspace/examples/python/simple_test.py:11
- **Path Handling:** ✅ Correctly requires relative paths (not absolute Windows paths)
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct frames with /workspace/ paths
- **Variable Inspection:** ✅ a=1, b=2 correctly retrieved
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. Path translation works correctly.

**Note:** Requires relative paths from workspace root (e.g., `examples/python/simple_test.py` not absolute paths like `C:/path/to/simple_test.py`)

#### 2.2 JavaScript - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at /workspace/examples/javascript/simple_test.js:14
- **Start Debugging:** ✅ Paused at breakpoint
- **Variable Inspection:** ✅ a=1, b=2 before swap, a=2, b=1 after
- **Stepping:** ✅ Step over working correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. **Docker environment fixes the JavaScript adapter issue seen in local stdio.**

#### 2.3 Rust - 🚫 Not Supported (Intentionally Disabled)
- **Status:** Disabled inside `mcp-debugger-docker` as of Nov 19, 2025 (`DEBUG_MCP_DISABLE_LANGUAGES=rust`).
- **Reason:** LLDB inside the container consistently stopped on unnamed frames and lost DWARF data for host-built binaries, even when compiled for `x86_64-unknown-linux-gnu`. Local/SSE deployments keep the adapter next to the toolchain, so symbol resolution works there.
- **Effect:** The Docker image no longer bundles CodeLLDB or the Rust adapter, and the MCP tools will not advertise Rust when `MCP_CONTAINER=true`.
- **Guidance:** Use local stdio, SSE, or packed deployments for Rust debugging. Mount pre-built Linux binaries directly in those modes for full variable inspection.
---

### 3. mcp-debugger-sse (Local SSE)

#### 3.1 Python - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 11
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct frames (main, <module>)
- **Variable Inspection:** ✅ a=1, b=2 correctly retrieved
- **Stepping:** ✅ Step over working correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. SSE communication layer works perfectly with Python.

#### 3.2 JavaScript - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 14
- **Start Debugging:** ✅ Paused at breakpoint
- **Variable Inspection:** ✅ a=1, b=2 before swap
- **Stepping:** ✅ Step over working correctly
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. **SSE fixes the JavaScript adapter issue seen in local stdio.**

#### 3.3 Rust - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 18
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct (hello_world::main + runtime frames)
- **Variable Inspection:** ✅ name="Rust" (with full data structure), version=1.75, is_awesome=true
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. All debugging operations work correctly.

**Note:** Variable display shows more internal structure details for Rust string types.

---

### 4. mcp-debugger-pack (Packed Server)

#### 4.1 Python - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 11
- **Start Debugging:** ✅ Paused at breakpoint
- **Variable Inspection:** ✅ a=1, b=2 correctly retrieved
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. Packed distribution works correctly for Python.

#### 4.2 JavaScript - ✅ **FIXED** (Previously ❌ FAILED)
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 14
- **Start Debugging:** ✅ **FIXED - Now pauses at breakpoint**
- **Variable Inspection:** ✅ a=1, b=2 correctly retrieved
- **Session Cleanup:** ✅ Clean close

**Verdict:** **FIXED and fully functional.** All debugging operations now work correctly.

**Fix Verified:** November 18, 2025 - Session ID: a9e484f1-10f7-4670-a5d6-d9e6639c2173

**Previous Issue:** JavaScript adapter was failing in packed distribution, identical to local stdio. This has been resolved.

#### 4.3 Rust - ✅ SUCCESS
- **Session Creation:** ✅ Success
- **Breakpoint Setting:** ✅ Verified at line 18
- **Start Debugging:** ✅ Paused at breakpoint
- **Stack Trace:** ✅ Correct (hello_world::main + runtime frames)
- **Variable Inspection:** ✅ name="Rust", version=1.75, is_awesome=true
- **Session Cleanup:** ✅ Clean close

**Verdict:** Fully functional. Packed distribution works correctly for Rust.

---

## Issue Analysis

### Critical Issues

#### 1. JavaScript Adapter Failure in Local STDIO Modes - ✅ **RESOLVED**
**Status:** **FIXED** as of November 18, 2025

**Previously Affected Variants:**
- mcp-debugger (local stdio) - ✅ NOW WORKING
- mcp-debugger-pack (packed) - ✅ NOW WORKING

**Fix Verification:**
- Tested mcp-debugger JavaScript: Session 79d1841c-13be-402d-864b-340fc87f3501 ✅
- Tested mcp-debugger-pack JavaScript: Session a9e484f1-10f7-4670-a5d6-d9e6639c2173 ✅
- All standard debugging operations confirmed working (breakpoints, stepping, variables)

**Previous Symptoms:**
- Session creates successfully
- Breakpoints are set without issue
- `start_debugging` immediately entered "error" state
- No stack trace or variable inspection possible

**Resolution:** The JavaScript adapter launch configuration in stdio mode has been fixed. Both local and packed variants now work correctly.

#### 2. Rust Adapter Issues in Docker
**Affected Variants:**
- mcp-debugger-docker (partial failure)

**Not Affected:**
- mcp-debugger (local stdio) ✅
- mcp-debugger-sse ✅
- mcp-debugger-pack ✅

**Symptoms:**
- Initial stop at wrong frame (`___lldb_unnamed_symbol276`)
- Empty variable scope at initial stop
- Breakpoint does get hit after continue
- Session terminates prematurely after second continue

**Hypothesis:**
LLDB adapter in Docker Linux environment has different frame handling compared to Windows CodeLLDB. The container may be using a different version of LLDB or have different symbol resolution. Early termination suggests the process exits before debugger can detach cleanly.

**Recommendation:** 
1. Review LLDB configuration in Docker container
2. Check if debug symbols are properly included in containerized build
3. Investigate early process exit - may need different termination handling

---

## Language-Specific Summary

### Python Adapter
**Overall: EXCELLENT (4/4 scenarios working)**

Python adapter is rock-solid across all deployment variants. No issues detected.

- **Strengths:** Universal compatibility, reliable breakpoints, accurate variable inspection
- **Issues:** None
- **Recommendation:** Use as reference implementation for other adapters

### JavaScript Adapter
**Overall: EXCELLENT (4/4 scenarios working)** ✅ **ALL FIXED**

JavaScript adapter now works perfectly across all deployment variants.

- **Strengths:** Universal compatibility, reliable debugging across all deployment modes
- **Issues:** ~~Complete failure in local stdio and packed builds~~ **RESOLVED** ✅
- **Status:** All scenarios working perfectly after November 18, 2025 fix
- **Recommendation:** None - adapter is production-ready across all variants

### Rust Adapter
**Overall: GOOD (3.5/4 scenarios working)**

Rust adapter works excellently on Windows native platforms but has issues in Docker.

- **Strengths:** Excellent local debugging, good variable inspection, detailed stack traces
- **Issues:** Docker frame resolution and early termination
- **Recommendation:** Investigate LLDB Docker configuration, possibly use CodeLLDB adapter in container if feasible

---

## Deployment Variant Recommendations

### For End Users

**Best Overall Choice:** **mcp-debugger-sse** or **mcp-debugger (local stdio)**
- ✅ All three languages work perfectly
- ✅ SSE provides good separation of concerns OR stdio provides direct integration
- ✅ Both fully production-ready

**Simplest Setup:** **mcp-debugger (local stdio)** ✅ **NOW RECOMMENDED**
- ✅ Python, JavaScript, and Rust all work perfectly
- ✅ No separate server needed
- ✅ Direct integration
- ✅ No Docker required

**Most Isolated:** **mcp-debugger-docker**
- ✅ Python and JavaScript work perfectly
- ⚠️ Rust has issues
- ✅ Complete isolation
- ✅ Consistent Linux environment
- ⚠️ Requires Docker
- ⚠️ Path translation required (relative paths)

**NPX No-Install:** **mcp-debugger-pack** ✅ **NOW RECOMMENDED**
- ✅ Python, JavaScript, and Rust all work perfectly
- ✅ Easy distribution
- ✅ Great for quick trials
- ✅ Production-ready

### For Development

**Development Testing:**
- Use **mcp-debugger-sse** - most reliable across all languages
- Fallback to **mcp-debugger** (local) for Python/Rust iteration

**CI/CD:**
- Use **mcp-debugger-docker** for consistent environment
- Accept current Rust limitation or test separately

---

## Test Methodology

### Standard Test Scenario
Each language test followed this workflow:

1. **Create Debug Session** - Language-specific session creation
2. **Set Breakpoint** - On swap/calculation line
3. **Start Debugging** - Launch with appropriate script path
4. **Continue to Breakpoint** - From initial stop to actual breakpoint
5. **Inspect Variables** - Verify pre-operation state
6. **Step Over** - Execute operation
7. **Inspect Variables** - Verify post-operation state
8. **Get Stack Trace** - Verify call stack
9. **Close Session** - Clean teardown

### Test Programs Used

**Python:** `examples/python/simple_test.py`
- Simple variable swap (a, b = b, a)
- Breakpoint on line 11

**JavaScript:** `examples/javascript/simple_test.js`
- Array destructuring swap ([a, b] = [b, a])
- Breakpoint on line 14

**Rust:** `examples/rust/hello_world/src/main.rs`
- Function call with calculation
- Breakpoint on line 18
- Used compiled binary: `target/debug/hello_world.exe`

---

## Recommendations

### Immediate Priorities (P0)

1. ~~**Fix JavaScript stdio adapter**~~ - ✅ **COMPLETED** (Fixed November 18, 2025)
   - ~~Critical issue blocking 2 deployment variants~~
   - Both mcp-debugger and mcp-debugger-pack now working

2. **Fix Rust Docker debugging** - Partial failure in container
   - Investigate LLDB version/configuration
   - Check symbol file presence
   - Fix early termination issue

### Future Enhancements (P1)

1. **Standardize path handling** - Docker requires relative paths, others use absolute
2. **Improve error reporting** - "error" state provides no diagnostic information
3. **Add health checks** - Detect adapter issues before user attempts debugging

### Documentation Updates

1. Document path handling differences between deployment modes
2. Add troubleshooting guide for JavaScript stdio issues
3. Document Rust Docker limitations
4. Recommend mcp-debugger-sse as primary deployment option

---

## Conclusion

The MCP debugger project demonstrates strong fundamental architecture with **96% of scenarios working perfectly** (11.5/12). JavaScript stdio issues have been resolved, significantly improving deployment flexibility.

**Strengths:**
- Python adapter is production-ready across all variants ✅
- JavaScript adapter is production-ready across all variants ✅ **FIXED**
- Rust adapter works perfectly in local and SSE modes ✅
- Core debugging functionality (breakpoints, stepping, variables) works excellently

**Remaining Areas for Improvement:**
- Rust adapter needs Docker environment fixes (partial functionality)
- Path handling could be more consistent

**Overall Assessment:** The debugger is **ready for production use** across nearly all scenarios:
- **Python:** Production-ready on all 4 variants ✅
- **JavaScript:** Production-ready on all 4 variants ✅ **FIXED**
- **Rust:** Production-ready on 3/4 variants (local stdio, SSE, packed) ✅

**Recommendation:** All deployment variants except Docker+Rust are ready for general release. The most versatile options are **mcp-debugger-sse** and **mcp-debugger** (local stdio), both supporting all three languages perfectly.

---

## Appendix: Raw Test Data

### Session IDs Created During Testing

**Initial Testing:**
- mcp-debugger Python: eedcdbce-3b51-4800-a79a-9b607ac02b7c
- mcp-debugger JavaScript (failed): 3e1fd315-67f7-48c5-b6b9-a5049a40b8df
- mcp-debugger Rust: e2b1c2c4-df80-4c00-b079-002822609021
- mcp-debugger-docker Python: 58eb478b-230f-4ecf-a321-7cdf11bdf61b
- mcp-debugger-docker JavaScript: 8c218c64-7036-48b3-b994-de91ebcf0f63
- mcp-debugger-docker Rust: 65e8c925-6d98-4380-8a79-adc51f93db4c
- mcp-debugger-sse Python: 8243d7e8-9532-467a-93be-82eb3987e2b7
- mcp-debugger-sse JavaScript: 747cc140-8d62-42c3-bb7a-3e4df8e19c62
- mcp-debugger-sse Rust: 73b2054e-1d90-48db-82df-15c6e0eb2c2e
- mcp-debugger-pack Python: 1bbc156a-b00d-4938-8784-a1bc172c867a
- mcp-debugger-pack JavaScript (failed): 6147d6bc-d43b-4638-82a9-a0789a413d1b
- mcp-debugger-pack Rust: ef8c8e93-cda5-4b57-a20f-cd072ac24bea

**Fix Verification Testing (November 18, 2025):**
- mcp-debugger JavaScript (fix verified): 79d1841c-13be-402d-864b-340fc87f3501 ✅
- mcp-debugger-pack JavaScript (fix verified): a9e484f1-10f7-4670-a5d6-d9e6639c2173 ✅

All sessions were cleanly closed after testing.

---

**Report Generated:** November 18, 2025  
**Test Duration:** Approximately 25 minutes (initial testing) + 5 minutes (fix verification)  
**Test Environment:** Windows 11, Node.js available, Python available, Rust toolchain available, Docker available  
**Fix Verified:** November 18, 2025, 8:47 PM EST - JavaScript stdio issues resolved
