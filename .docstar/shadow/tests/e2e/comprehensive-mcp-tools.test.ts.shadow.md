# tests/e2e/comprehensive-mcp-tools.test.ts
@source-hash: d852b625423a6506
@generated: 2026-02-11T20:15:09Z

## Comprehensive MCP Debugger E2E Test Suite

This file implements a comprehensive end-to-end test matrix that validates all 19 MCP debugger tools across 5 supported languages (Python, JavaScript, Rust, Go, Mock).

### Core Purpose
- **Matrix Testing**: Tests every MCP tool against every available language adapter
- **Result Tracking**: Generates detailed PASS/FAIL/SKIP matrix with timing metrics
- **Comprehensive Coverage**: Validates complete debug workflow from session creation to closure

### Key Components

**Result Tracking System (L25-41)**
- `ToolResult` interface defines test outcome structure with tool, language, status, detail, and duration
- `record()` function (L37-41) logs results with colored console output and timing
- Global `results` array accumulates all test outcomes for final reporting

**Language Configuration (L70-84)**
- `LangDef` interface defines language test parameters including script paths and breakpoint lines
- `LANGUAGES` array (L78-84) configures 5 languages with availability detection
- Toolchain detection via `hasCommand()` (L57-64) for Rust/Go availability

**Test Infrastructure (L112-158)**
- MCP client setup with stdio transport to debugger server
- Session state management with `currentSessionId` tracking
- Automatic session cleanup in `afterEach` hook

### Test Structure

**Language-Agnostic Tools (L163-195)**
- `list_supported_languages` - validates available language adapters
- `list_debug_sessions` - tests session enumeration

**Per-Language Test Matrix (L201-668)**
- Dynamic test generation for each language in `LANGUAGES` array
- Conditional skipping for unavailable toolchains (Rust/Go)
- Session lifecycle tests for basic tools (create, set breakpoint, get source context)

**Full Debug Workflow Tests (L310-501)**
For real languages (non-mock):
- Complete debug session lifecycle: create → set breakpoint → start → inspect → step → continue → close
- Stack frame inspection with `get_stack_trace` (L349-363)
- Variable inspection via `get_scopes`/`get_variables`/`get_local_variables` (L365-418)
- Expression evaluation testing simple arithmetic (L420-434)
- Stepping operations: step_over, step_into, step_out (L436-475)
- Execution control: continue_execution (L477-487)

**Mock Adapter Testing (L502-574)**
- Simplified lifecycle testing without real process execution
- Tests basic tool responses for mock debugging scenarios

**Process Attachment Tools (L576-666)**
- `pause_execution` - expects "not implemented" response
- `attach_to_process` - tests connection attempt (expects failure)
- `detach_from_process` - tests graceful detachment

### Reporting System

**Matrix Summary (L672-715)**
- `printSummary()` generates comprehensive results matrix
- Console output with tool×language grid showing PASS/FAIL/SKIP status
- JSON report generation for external tooling integration
- Statistical summary with totals by status

### Test Execution Parameters
- Individual tool timeout: 15-30 seconds
- Full workflow timeout: 90 seconds
- Process attachment timeout: 45 seconds
- Built-in delays for debugger state transitions (2-4 seconds)

### Key Dependencies
- MCP SDK client components for server communication
- Utility functions from `smoke-test-utils.js` for safe tool calling
- Example scripts in `examples/` directory for each language
- Vitest framework for test execution and assertions