# tests\adapters\python/
@generated: 2026-02-12T21:06:03Z

## Test Suite for Python Debug Adapter

**Purpose**: Comprehensive test coverage for the Python debug adapter module, validating both isolated utility functions and complete debugging workflows through a two-tier testing approach. Ensures reliable Python environment discovery and debugging functionality across diverse deployment scenarios, with particular emphasis on challenging Windows CI environments.

### Key Components and Architecture

**Unit Test Layer (`unit/`)**: Focuses on core Python utility functions with extensive cross-platform testing:
- Tests `findPythonExecutable()` with platform-specific command prioritization 
- Validates `getPythonVersion()` for version detection and parsing
- Covers `setDefaultCommandFinder()` for command discovery configuration
- Comprehensive mocking infrastructure for subprocess and environment simulation

**Integration Test Layer (`integration/`)**: Validates real-world functionality through complete debugging workflows:
- Full debug session lifecycle testing via MCP (Model Context Protocol) 
- Python environment discovery and setup for Windows CI scenarios
- End-to-end debugging workflow from session creation to variable inspection
- Real implementation testing without mocking dependencies

### Testing Strategy and Patterns

**Cross-Platform Coverage**: 
- Platform-specific Python command prioritization (Windows: `py → python → python3`, Unix: `python3 → python`)
- Environment variable precedence testing (PYTHON_PATH > PYTHON_EXECUTABLE > platform defaults)
- Windows Store alias rejection and GitHub Actions compatibility

**No-Mocking Integration Philosophy**: Integration tests deliberately use real Python installations to validate actual CI/production behavior, while unit tests employ sophisticated mocking for isolated component testing.

**CI-Focused Design**: Special emphasis on Windows environment challenges including:
- Python off PATH scenarios
- Microsoft Store redirects
- GitHub Actions toolcache integration
- Automatic debugpy installation and management

### Public API Surface and Entry Points

**Core Testing Functions**:
- Unit test validation of Python discovery utilities (`findPythonExecutable`, `getPythonVersion`)
- Integration test suites for complete debugging workflows
- Environment setup utilities for CI scenarios (`ensurePythonOnPath`)

**Test Suite Categories**:
- `Python Discovery - Real Implementation Test`: Validates executable discovery in CI environments
- `Python Debugging Workflow - Integration Test`: Tests complete debug session functionality
- Platform-specific unit tests for Windows, Linux, and macOS behavior

### Internal Organization and Data Flow

**Two-Tier Validation Approach**:
1. **Unit Layer**: Mock-based testing of individual utility functions with comprehensive platform simulation
2. **Integration Layer**: Real implementation testing through MCP communication with actual Python processes

**Communication Patterns**:
- Unit tests use sophisticated child_process mocking with controlled subprocess behavior
- Integration tests communicate via MCP protocol using StdioClientTransport
- Debug server spawned as child process for realistic testing scenarios

**Error Handling and Resilience**:
- Command cascade fallback testing through multiple Python executable candidates
- Spawn error simulation and graceful degradation validation
- Comprehensive failure logging and debugging support for CI environments

### Dependencies and Integration Points

**Test Infrastructure**:
- Vitest framework with extended timeouts for integration scenarios
- MockCommandFinder shared testing utility
- MCP SDK for client and transport communication layers
- VS Code Debug Protocol types for debug session management

**Runtime Requirements**:
- Integration tests tagged with `@requires-python` for actual Python installations
- Target debugging scripts in `tests/fixtures/python/` for validation
- Windows-specific tooling for PATH management and Python installation

This test directory serves as the quality assurance foundation for the Python debug adapter, ensuring reliable functionality across diverse Python installations and deployment environments while maintaining comprehensive coverage from isolated component testing to full workflow validation.