# Coverage Analysis Report (Detailed)

Generated: 6/5/2025, 10:42:53 AM
Current Overall Coverage (Lines): **32.7%** 🟡
Target Coverage: **80%**
Gap to Target: **47.3%**

## Executive Summary
- **10** files need tests to reach 80% coverage.
- **0** quick wins identified (high gain for low effort).
- **4** critical path components require immediate attention (coverage < 30%).

Coverage Distribution:
0-20%   : █████████████        8 files 🔴
21-40%  :                      0 files 🟡
41-60%  : ██                   1 files 🟡
61-80%  : ██                   1 files 🟢
81-100% : ████████████████████ 12 files ✅

## Priority 1: Critical Business Logic (Coverage 0-30%)

### 1. `src/proxy/dap-proxy.ts` 🔴
- **Current Coverage (Lines/Proxy)**: 0.0%
- Statements: 0.0%, Functions: 0.0%, Branches: 0.0%
- Impact: Core debugging functionality (Assumed - requires manual review)
- **Untested Methods**:
  - `(anonymous_0)` (line 2)
  - `(anonymous_1)` (line 5)
  - `(anonymous_2)` (line 8)
  - `(anonymous_3)` (line 11)
  - `processParentMessage` (line 68)
  - `(anonymous_5)` (line 97)
  - `(anonymous_6)` (line 117)
  - `sendToParent` (line 121)
  - `handleCommandFromParent` (line 146)
  - `startDebugpyAdapterAndSequence` (line 203)
  - `(anonymous_10)` (line 216)
  - `(anonymous_11)` (line 295)
  - `(anonymous_12)` (line 299)
  - `(anonymous_13)` (line 308)
  - `(anonymous_14)` (line 315)
  - `(anonymous_15)` (line 351)
  - `setupDapEventHandlers` (line 393)
  - `(anonymous_17)` (line 394)
  - `(anonymous_18)` (line 408)
  - `(anonymous_19)` (line 435)
  - `(anonymous_20)` (line 440)
  - `(anonymous_21)` (line 445)
  - `(anonymous_22)` (line 450)
  - `(anonymous_23)` (line 455)
  - `(anonymous_24)` (line 460)
  - `(anonymous_25)` (line 465)
  - `(anonymous_26)` (line 469)
  - `shutdown` (line 477)
  - `(anonymous_28)` (line 506)
  - `(anonymous_29)` (line 506)
  - `(anonymous_30)` (line 536)
  - `(anonymous_31)` (line 567)
  - `(anonymous_32)` (line 570)
  - `(anonymous_33)` (line 573)
  - `(anonymous_34)` (line 576)
  - `(anonymous_35)` (line 579)
  - `(anonymous_36)` (line 584)
- **Untested Branches** (Top 5):
  - Line 3 (type: binary-expr, path 0): Branch path 0 at line 3 (type: binary-expr) not taken.
  - Line 3 (type: binary-expr, path 1): Branch path 1 at line 3 (type: binary-expr) not taken.
  - Line 4 (type: binary-expr, path 0): Branch path 0 at line 4 (type: binary-expr) not taken.
  - Line 4 (type: binary-expr, path 1): Branch path 1 at line 4 (type: binary-expr) not taken.
  - Line 9 (type: binary-expr, path 0): Branch path 0 at line 9 (type: binary-expr) not taken.
  - ... and 155 more.
- **Test File Location (Suggested)**: `tests/unit/proxy/dap-proxy.ts` (adjust path as needed, e.g. .test.ts)
- **Mocks Required**: (To be determined based on dependencies)
- **Estimated Effort**: ~197 tests (rough estimate)

### 2. `src/proxy/minimal-dap.ts` 🔴
- **Current Coverage (Lines/Proxy)**: 0.0%
- Statements: 0.0%, Functions: 0.0%, Branches: 0.0%
- Impact: Core debugging functionality (Assumed - requires manual review)
- **Untested Methods**:
  - `(anonymous_0)` (line 18)
  - `(anonymous_1)` (line 24)
  - `(anonymous_2)` (line 25)
  - `(anonymous_3)` (line 27)
  - `(anonymous_4)` (line 32)
  - `(anonymous_5)` (line 33)
  - `(anonymous_6)` (line 38)
  - `(anonymous_7)` (line 45)
  - `(anonymous_8)` (line 124)
  - `(anonymous_9)` (line 142)
  - `(anonymous_10)` (line 145)
  - `(anonymous_11)` (line 154)
  - `(anonymous_12)` (line 163)
  - `(anonymous_13)` (line 177)
- **Untested Branches** (Top 5):
  - Line 50 (type: if, path 0): Branch path 0 at line 50 (type: if) not taken.
  - Line 50 (type: if, path 1): Branch path 1 at line 50 (type: if) not taken.
  - Line 57 (type: if, path 0): Branch path 0 at line 57 (type: if) not taken.
  - Line 57 (type: if, path 1): Branch path 1 at line 57 (type: if) not taken.
  - Line 66 (type: if, path 0): Branch path 0 at line 66 (type: if) not taken.
  - ... and 31 more.
- **Test File Location (Suggested)**: `tests/unit/proxy/minimal-dap.ts` (adjust path as needed, e.g. .test.ts)
- **Mocks Required**: (To be determined based on dependencies)
- **Estimated Effort**: ~50 tests (rough estimate)

### 3. `src/proxy/proxy-manager.ts` 🔴
- **Current Coverage (Lines/Proxy)**: 0.0%
- Statements: 0.0%, Functions: 0.0%, Branches: 0.0%
- Impact: Core debugging functionality (Assumed - requires manual review)
- **Untested Methods**:
  - `(anonymous_0)` (line 136)
  - `(anonymous_1)` (line 144)
  - `(anonymous_2)` (line 201)
  - `(anonymous_3)` (line 202)
  - `(anonymous_4)` (line 206)
  - `(anonymous_5)` (line 214)
  - `(anonymous_6)` (line 220)
  - `(anonymous_7)` (line 225)
  - `(anonymous_8)` (line 230)
  - `(anonymous_9)` (line 247)
  - `(anonymous_10)` (line 262)
  - `(anonymous_11)` (line 263)
  - `(anonymous_12)` (line 269)
  - `(anonymous_13)` (line 276)
  - `(anonymous_14)` (line 295)
  - `(anonymous_15)` (line 310)
  - `(anonymous_16)` (line 319)
  - `(anonymous_17)` (line 323)
  - `(anonymous_18)` (line 327)
  - `(anonymous_19)` (line 348)
  - `(anonymous_20)` (line 356)
  - `(anonymous_21)` (line 360)
  - `(anonymous_22)` (line 365)
  - `(anonymous_23)` (line 370)
  - `(anonymous_24)` (line 376)
  - `(anonymous_25)` (line 383)
  - `(anonymous_26)` (line 441)
  - `(anonymous_27)` (line 457)
  - `(anonymous_28)` (line 488)
  - `(anonymous_29)` (line 519)
  - `(anonymous_30)` (line 521)
  - `(anonymous_31)` (line 533)
- **Untested Branches** (Top 5):
  - Line 145 (type: if, path 0): Branch path 0 at line 145 (type: if) not taken.
  - Line 145 (type: if, path 1): Branch path 1 at line 145 (type: if) not taken.
  - Line 175 (type: if, path 0): Branch path 0 at line 175 (type: if) not taken.
  - Line 175 (type: if, path 1): Branch path 1 at line 175 (type: if) not taken.
  - Line 175 (type: binary-expr, path 0): Branch path 0 at line 175 (type: binary-expr) not taken.
  - ... and 70 more.
- **Test File Location (Suggested)**: `tests/unit/proxy/proxy-manager.ts` (adjust path as needed, e.g. .test.ts)
- **Mocks Required**: (To be determined based on dependencies)
- **Estimated Effort**: ~107 tests (rough estimate)

### 4. `src/implementations/process-launcher-impl.ts` 🔴
- **Current Coverage (Lines/Proxy)**: 4.5%
- Statements: 4.5%, Functions: 8.1%, Branches: 0.0%
- Impact: Core debugging functionality (Assumed - requires manual review)
- **Untested Methods**:
  - `(anonymous_0)` (line 27)
  - `(anonymous_1)` (line 31)
  - `(anonymous_2)` (line 37)
  - `(anonymous_3)` (line 41)
  - `(anonymous_4)` (line 45)
  - `(anonymous_5)` (line 49)
  - `(anonymous_6)` (line 54)
  - `(anonymous_7)` (line 58)
  - `(anonymous_8)` (line 62)
  - `(anonymous_9)` (line 66)
  - `(anonymous_10)` (line 70)
  - `(anonymous_11)` (line 74)
  - `(anonymous_12)` (line 78)
  - `(anonymous_13)` (line 82)
  - `(anonymous_14)` (line 86)
  - `(anonymous_16)` (line 97)
  - `(anonymous_18)` (line 112)
  - `(anonymous_19)` (line 139)
  - `(anonymous_20)` (line 140)
  - `(anonymous_21)` (line 146)
  - `(anonymous_22)` (line 150)
  - `(anonymous_23)` (line 170)
  - `(anonymous_24)` (line 177)
  - `(anonymous_25)` (line 183)
  - `(anonymous_26)` (line 197)
  - `(anonymous_27)` (line 206)
  - `(anonymous_28)` (line 211)
  - `(anonymous_29)` (line 218)
  - `(anonymous_30)` (line 219)
  - `(anonymous_32)` (line 231)
  - `(anonymous_33)` (line 272)
  - `(anonymous_34)` (line 277)
  - `(anonymous_35)` (line 281)
  - `(anonymous_36)` (line 286)
- **Untested Branches** (Top 5):
  - Line 115 (type: default-arg, path 0): Branch path 0 at line 115 (type: default-arg) not taken.
  - Line 119 (type: binary-expr, path 0): Branch path 0 at line 119 (type: binary-expr) not taken.
  - Line 119 (type: binary-expr, path 1): Branch path 1 at line 119 (type: binary-expr) not taken.
  - Line 141 (type: if, path 0): Branch path 0 at line 141 (type: if) not taken.
  - Line 141 (type: if, path 1): Branch path 1 at line 141 (type: if) not taken.
  - ... and 18 more.
- **Test File Location (Suggested)**: `tests/unit/implementations/process-launcher-impl.ts` (adjust path as needed, e.g. .test.ts)
- **Mocks Required**: (To be determined based on dependencies)
- **Estimated Effort**: ~57 tests (rough estimate)

## Priority 2: Quick Wins (Coverage 70-90%)

No quick wins identified (files between 70-90% coverage needing few tests for high gain).

## Priority 3: Medium Coverage (Coverage 30-70%)

### 1. `src/server.ts` 🟢
- **Current Coverage (Lines/Proxy)**: 52.3%
- Statements: 52.3%, Functions: 69.6%, Branches: 45.3%
- Untested Functions: `(anonymous_10)` (l254), `(anonymous_14)` (l294), `(anonymous_15)` (l304), `(anonymous_17)` (l328), `(anonymous_18)` (l344), `(anonymous_19)` (l355), `(anonymous_20)` (l366)
- Untested Branches: 35 paths (see coverage-analysis-details.json for specifics)

## Architecture Recommendations

This section requires manual review and domain expertise. Consider:
- Components that are hard to test and may need refactoring for better testability.
- Identifying and resolving circular dependencies that complicate testing.
- Extracting interfaces for complex dependencies to facilitate mocking.

