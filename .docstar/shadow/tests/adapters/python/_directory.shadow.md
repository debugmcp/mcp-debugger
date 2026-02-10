# tests/adapters/python/
@generated: 2026-02-09T18:16:37Z

## Python Adapter Test Suite

**Overall Purpose**: Comprehensive test infrastructure for the MCP Python debug adapter, providing both unit-level validation of Python environment discovery utilities and integration-level validation of complete debug workflows. This test suite ensures the adapter can reliably locate Python installations and execute debugging sessions across diverse deployment environments.

## Key Components & Architecture

The test directory is organized into two complementary testing layers:

### Unit Testing Layer (`unit/`)
Focused on validating the foundational Python discovery and version detection utilities that underpin the adapter's functionality:
- **Cross-platform Python executable discovery** with sophisticated fallback mechanisms
- **Version detection and parsing** from various Python output formats
- **Command resolution infrastructure** that handles platform-specific executable patterns
- **Environment variable processing** for user overrides and CI/CD integration

Uses advanced mocking strategies to simulate real-world scenarios without external dependencies, including partial child process mocking and event-driven process simulation.

### Integration Testing Layer (`integration/`)
End-to-end validation of complete debug adapter workflows in real environments:
- **Python environment setup** with Windows CI-specific tooling (`env-utils.ts`)
- **Discovery mechanism validation** without mocking to catch environment-specific issues
- **Full debug session lifecycle testing** using MCP SDK communication patterns
- **Breakpoint management, stack inspection, and variable evaluation** workflows

Employs a "no mocking" policy for maximum fidelity to production scenarios, with extensive CI/CD-focused error handling and diagnostics.

## Integration & Data Flow

The test layers work together to provide comprehensive coverage:

1. **Foundation Validation**: Unit tests ensure Python discovery utilities handle edge cases and platform differences correctly
2. **Environment Preparation**: Integration tests use validated discovery mechanisms to establish clean test environments
3. **Workflow Validation**: Complete debug scenarios exercise both discovery and debugging functionality in realistic contexts

**Test Flow Pattern**:
`unit tests validate utilities` → `integration/env-utils prepares environment` → `integration tests execute full workflows` → `MCP communication validates adapter behavior`

## Public API Surface & Entry Points

### Primary Test Coverage Areas
- **`findPythonExecutable()`**: Core Python discovery with platform-aware fallback logic
- **`getPythonVersion()`**: Version extraction and parsing utilities  
- **`create_debug_session`**: MCP debug session initialization
- **`start_debugging`**: Debug execution with dry run capabilities
- **Breakpoint and inspection operations**: Complete debugging workflow validation

### Testing Infrastructure APIs
- **`ensurePythonOnPath()`**: Environment setup for CI reliability (Windows-focused)
- **`setDefaultCommandFinder()`**: Configuration interface for command resolution
- **MCP SDK integration**: StdioClientTransport for realistic adapter communication

## Critical Testing Patterns

**Platform Abstraction**: Systematic cross-platform testing using `describe.each` patterns ensures consistent behavior across Windows, Linux, and macOS environments.

**Environment Isolation**: Comprehensive cleanup of Python environment variables and proper mock lifecycle management prevents test interference.

**CI/CD Optimization**: Windows-specific handling, extensive logging, and failure persistence mechanisms ensure reliable automated testing in continuous integration environments.

**Error Resilience**: Both graceful degradation testing (unit) and real-world error scenarios (integration) validate robust adapter behavior under adverse conditions.

This test directory serves as the quality assurance foundation for the Python debug adapter, ensuring reliable Python environment bootstrapping and debugging functionality across the diverse deployment scenarios encountered in modern development workflows.