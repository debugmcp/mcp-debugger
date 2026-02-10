# tests/test-utils/fixtures/python/debug_test_simple.py
@source-hash: 862f2a1fd2683a06
@generated: 2026-02-10T01:18:50Z

**Purpose**: Test fixture script designed for debugging test scenarios, particularly for testing debugger attachment and process monitoring capabilities.

**Core Functionality**:
- Simple debug target with predictable execution flow
- Extended runtime (60-second sleep) to allow external debugging/monitoring
- Basic computation and output for verification

**Key Components**:
- `sample_function()` (L10-14): Simple arithmetic function that adds two numbers and prints result
- Main execution flow (L6-21): Sequential execution with status messages and extended sleep period

**Dependencies**:
- `sys`: For Python version information display
- `time`: For sleep functionality to extend script lifetime

**Execution Pattern**:
1. Display Python version and startup message (L6-7)
2. Execute sample computation function (L17-18)  
3. Enter 60-second sleep period with status messages (L19-21)

**Test Context**: This appears to be a fixture for testing debugger attachment, process monitoring, or test harness behavior with long-running processes. The extended sleep period suggests it's designed to remain active long enough for external tools to attach and interact with it.