# tests/unit/adapters/javascript-debug-adapter.test.ts
@source-hash: 7200caa00d2263aa
@generated: 2026-02-09T18:14:40Z

## JavaScript Debug Adapter Test Suite

Test suite for the JavascriptDebugAdapter class, focusing on runtime argument configuration, error handling, feature support, and launch coordination mechanisms.

### Test Structure
- **Test Framework**: Vitest with mocking capabilities (L1)
- **Main Subject**: JavascriptDebugAdapter from `@debugmcp/shared` (L2-3)
- **Mock Dependencies**: TypeScript detection utilities and config transformers (L5-17)

### Key Test Utilities
- **createDependencies() (L19-30)**: Factory for mock adapter dependencies including logger, file system, environment, process launcher, and network manager
- **Mock Setup (L5-17)**: Comprehensive mocking of TypeScript detection and configuration utilities

### Test Coverage Areas

#### Runtime Arguments Handling (L38-54)
Tests deduplication of TypeScript runtime hooks (ts-node/register) when computing launch arguments. Verifies that duplicate `-r ts-node/register` flags are consolidated and appropriate transpile-only and loader flags are added.

#### Error Translation (L56-60)
Tests adapter's ability to translate low-level ENOENT errors into user-friendly guidance messages, specifically for missing Node.js runtime scenarios.

#### Feature Support Matrix (L62-67)
Validates which debugging features are supported:
- **Supported**: Conditional breakpoints, evaluate for hovers
- **Unsupported**: Data breakpoints

#### Launch Coordination (L69-85)
Tests the launch barrier mechanism for coordinating debug session startup:
- **Launch Barrier Creation (L69-80)**: Creates barrier for 'launch' commands, tests event handling and readiness waiting
- **Non-Launch Commands (L82-85)**: Verifies barriers are not created for non-launch commands like 'threads'

### Dependencies
- **Primary**: JavascriptDebugAdapter class and DebugFeature enum
- **Mocked**: TypeScript detection utilities, config transformers
- **Test Utilities**: Vitest mocking and assertion framework

### Test Patterns
- Uses beforeEach hook for mock cleanup (L33-36)
- Extensive use of Vitest spies and mocks for isolation
- Async/await patterns for testing promise-based APIs
- Type assertions using `as any` for accessing private methods (L41, L43)