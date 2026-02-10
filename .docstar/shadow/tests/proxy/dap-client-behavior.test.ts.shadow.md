# tests/proxy/dap-client-behavior.test.ts
@source-hash: a0e5af43495c6591
@generated: 2026-02-09T18:15:11Z

## Test Suite for DAP Client Behavior Implementations

**Primary Purpose:** Comprehensive test suite validating DAP (Debug Adapter Protocol) client behavior implementations across different adapter policies. Tests proxy-side handling of reverse requests, command routing, and policy-specific configurations.

### Test Structure

**Main Test Suite (L15-242):** `DapClientBehavior` with shared mock context setup
- **Mock Context Setup (L16-25):** Creates `DapClientContext` with mocked functions for sendResponse, createChildSession, and tracking collections

### JavaScript Debug Adapter Policy Tests (L27-139)

**Reverse Request Handling (L30-103):**
- Tests `startDebugging` request with valid `__pendingTargetId` (L31-53)
- Validates child session creation and configuration extraction
- Tests duplicate target adoption prevention (L55-75) 
- Tests `runInTerminal` request handling (L77-89)
- Tests unknown command rejection (L91-102)

**Command Routing Tests (L105-121):**
- Verifies debuggee-scoped commands route to child sessions (L106-114)
- Ensures initialization commands remain parent-scoped (L116-120)

**Configuration Tests (L123-138):**
- Validates JavaScript-specific behavior flags (L124-130)
- Tests adapter ID normalization from 'javascript' to 'pwa-node' (L132-137)

### Python Adapter Policy Tests (L141-183)

**Reverse Request Handling (L144-171):**
- Tests `runInTerminal` support (L145-157)
- Validates `startDebugging` rejection (L159-170)

**Configuration Tests (L173-182):**
- Verifies Python-specific settings and disabled child session features

### Mock and Default Policy Tests (L185-207)

**MockAdapterPolicy (L185-197):** Tests minimal behavior implementation
**DefaultAdapterPolicy (L199-207):** Validates empty behavior object

### Policy Comparison Tests (L209-241)

**Feature Comparison (L210-226):** Validates that only JavaScript policy supports child sessions and breakpoint mirroring
**Policy Uniqueness (L228-240):** Ensures all adapter policies have distinct names

### Key Dependencies
- Vitest testing framework with mocking capabilities
- @vscode/debugprotocol for DAP types
- @debugmcp/shared for adapter policy implementations and context types

### Architecture Notes
- Tests validate behavior objects returned by static `getDapClientBehavior()` methods
- JavaScript policy uniquely supports child session creation for multi-target debugging
- Each policy implements different timeout values and feature flags
- Reverse request handling enables debugger-to-client communication flow