# tests\test-utils\helpers/
@generated: 2026-02-12T21:01:06Z

## Purpose
Comprehensive test utility library providing infrastructure for creating isolated test environments, managing test resources, and analyzing test results. This module centralizes all testing utilities to ensure consistent test setup patterns and prevent resource conflicts across the test suite.

## Core Architecture
The module is organized around three primary concerns:
1. **Test Environment Setup** - Factory functions and dependency injection for isolated testing
2. **Resource Management** - Port allocation, process tracking, and cleanup utilities  
3. **Test Analysis & Reporting** - Result parsing, failure analysis, and coverage reporting

## Key Components

### Test Environment Factories (`test-dependencies.ts`, `test-setup.ts`)
**Primary Entry Points:**
- `createTestDependencies()` - Complete dependency container with fake implementations
- `createMockDependencies()` - Vitest spy-based mocks for all interfaces
- `createTestSessionManager()` - Pre-configured SessionManager with mock dependencies
- `createTestServer()` - DebugMcpServer optimized for testing

**Specialized Factories:**
- `createMockProxyManager()` - Proxy lifecycle simulation
- `createFullAdapterRegistry()` - Populated adapter registry for integration tests
- `createMockFileSystemWithDefaults()` - FileSystem with common test behaviors

### Resource Management (`port-manager.ts`, `process-tracker.ts`)
**Port Management:**
- `portManager` singleton - Centralized port allocation preventing test conflicts
- Range-based allocation (unit/integration/e2e) with fallback strategies
- 1000-port search space across dedicated test ranges

**Process Tracking:**
- `processTracker` singleton - Global registry of spawned test processes
- Automatic cleanup on process exit with graceful termination (SIGTERM → SIGKILL)
- Prevents orphaned processes across test suites

### Test Utilities (`test-utils.ts`, `session-helpers.ts`)
**Core Utilities:**
- `waitForCondition()`, `waitForEvent()` - Async test synchronization
- `createMockSession()`, `createMockEventEmitter()` - Standard mock factories
- `createTempTestFile()`, `cleanupTempTestFiles()` - Isolated file system operations
- `setupProxyManagerTest()` - Complete proxy testing environment

**Debug Session Helpers:**
- `getDebugServer()` - Lazy singleton DebugMcpServer for integration tests
- Session lifecycle wrappers: `createDebugSession()`, `startDebugging()`, `closeDebugSession()`
- Debug control flow: `continueExecution()`, `stepOver()`, `setBreakpoint()`

### Result Analysis & Reporting (`test-results-analyzer.js`, `test-coverage-summary.js`, `test-summary.js`, `show-failures.js`)
**Analysis Tools:**
- `TestResultsAnalyzer` class - Multi-level result analysis (summary/failures/detailed)
- Performance profiling with slow test detection (>1s threshold)
- Directory-based test organization with Unicode formatting

**Reporting Scripts:**
- `show-failures.js` - Clean failure output filtering verbose stack traces
- `test-coverage-summary.js` - Minimal coverage reporting with exit codes
- `test-summary.js` - CI-friendly concise test reporting

## Public API Surface

### Primary Factories
```typescript
// Complete test environments
createTestDependencies(): Promise<Dependencies>
createMockDependencies(): Dependencies
createTestSessionManager(overrides?): { manager, deps, mocks }

// Resource managers (singletons)
portManager.getPort(range?): number
processTracker.register(process, name): void
```

### Test Utilities
```typescript
// Synchronization
waitForCondition(condition, timeout?): Promise<void>
waitForEvent(emitter, event, timeout?): Promise<any>

// Mock creation
createMockSession(overrides?): DebugSession
createMockEventEmitter(): MockedEventEmitter
```

### Debug Session Integration
```typescript
// Session management
getDebugServer(): DebugMcpServer
createDebugSession(language, name?, pythonPath?): Promise<DebugSessionInfo>
startDebugging(sessionId, scriptPath, args?, dapArgs?, dryRun?): Promise<void>
```

## Internal Organization
- **Dependency Injection Pattern**: All factories support override merging with sensible defaults
- **Singleton Pattern**: Resource managers (ports, processes) maintain global state
- **Factory Pattern**: Consistent creation interfaces across all utilities
- **Async/Promise**: Heavy use of promises for test synchronization and resource management

## Critical Patterns
- **Test Isolation**: Each factory creates fresh instances preventing pollution
- **Resource Cleanup**: Automatic cleanup on process exit and explicit cleanup utilities  
- **Error Resilience**: Comprehensive error handling with fallbacks and graceful degradation
- **Type Safety**: Full TypeScript interfaces ensuring mock/real implementation compatibility

## Dependencies
- **Vitest**: Mock framework integration (`vi.fn()`, spies)
- **Node.js**: Process management, file system, child processes
- **Internal**: Production interfaces, fake implementations, core server classes
- **External**: Debug adapters for full integration testing

This module serves as the foundation for all test infrastructure, ensuring consistent patterns while preventing common testing issues like resource conflicts and orphaned processes.