# packages/shared/tests/
@generated: 2026-02-09T18:16:36Z

## Purpose
This directory provides comprehensive testing infrastructure for the debugmcp shared library, specifically focused on validating debug adapter policy implementations and their compliance with the Debug Adapter Protocol (DAP). It ensures robust, reliable debug adapter integrations across multiple programming languages through systematic unit testing.

## Key Components

### Test Organization
- **unit/**: Contains language-specific unit tests for debug adapter policies
  - JavaScript/Node.js debug adapter policy validation
  - Rust/CodeLLDB debug adapter policy validation
- Comprehensive mock infrastructure for external dependencies
- Cross-platform testing capabilities with environment simulation

### Testing Architecture
The directory implements a layered testing approach:

**Core Policy Validation**:
- Variable extraction and filtering logic
- Debug adapter state management and lifecycle tracking
- DAP command queuing and execution sequencing
- Platform-specific configuration and executable validation

**Integration Testing**:
- DAP client communication patterns
- Session management and readiness determination
- Reverse request handling and response processing
- Multi-language adapter compatibility

## Public API Surface

### Test Entry Points
- Language-specific test suites accessible via standard test runners
- Mock utilities for simulating debug environments
- Helper functions for creating test data structures
- Platform simulation capabilities for cross-platform validation

### Testing Patterns
The directory exposes consistent testing patterns that can be extended for additional language support:
- Structured mock creation for DAP components
- Environment isolation and restoration
- State validation utilities
- Cross-platform behavior verification

## Internal Organization

### Data Flow
Tests follow a standardized execution pattern:
1. **Environment Setup**: Mock external dependencies (filesystem, process spawning, DAP clients)
2. **Test Isolation**: Clean state between test cases with mock resets
3. **Policy Validation**: Exercise adapter methods with controlled test data
4. **Assertion Verification**: Validate behavior through mock interactions and state inspection
5. **Cleanup**: Restore original environment and clear modifications

### Mock Infrastructure
Comprehensive mocking system covering:
- File system operations for executable validation
- Process management for adapter spawning
- DAP protocol structures and communication
- Platform-specific behavior simulation

### Language-Specific Considerations
The testing framework accommodates different adapter policy behaviors:
- **JavaScript**: Complex initialization flows, command queueing, child session support
- **Rust**: Direct execution patterns, platform-specific toolchain integration
- **Extensible Design**: Framework supports addition of new language adapters

## Important Patterns

### Test Data Management
- Hierarchical mock structures mimicking real debug sessions
- Consistent naming patterns for stack frames, variables, and scopes
- Platform-agnostic test data with runtime adaptation

### Validation Strategies
- Type-safe internal state access and validation
- Mock interaction verification for dependency tracking
- Before/after state comparisons for mutation testing
- Cross-platform behavior consistency checks

This testing infrastructure ensures the debugmcp shared library maintains high reliability and correctness across diverse debugging scenarios and programming language integrations.