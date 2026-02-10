# tests/core/unit/server/dynamic-tool-documentation.test.ts
@source-hash: 86be00225deb9e7e
@generated: 2026-02-09T18:14:20Z

**Unit test suite for dynamic tool documentation in the Debug MCP Server**

Primary purpose: Validates that the DebugMcpServer provides generic, environment-agnostic documentation for file path parameters across debugging tools, avoiding hard-coded paths that could mislead AI agents.

## Key Components

### Test Utilities
- `getToolsFromServer()` (L60-109): Complex helper function that extracts tool definitions from DebugMcpServer by intercepting and capturing the ListTools handler. Uses spy techniques to access private server internals and execute tool registration.

### Test Structure
Two main describe blocks:

#### "Hands-off Path Approach" Tests (L117-238)
- **Purpose**: Ensures tool documentation uses generic path guidance instead of environment-specific paths
- **Key validation points**:
  - `set_breakpoint` tool file parameter description (L140-150)
  - `start_debugging` tool scriptPath parameter description (L152-162)  
  - `get_source_context` tool file parameter description (L164-174)
  - Absence of specific directory paths like C:\, /home/, /workspace (L176-195)
  - Consistent terminology usage (L197-210)
  - Simple, clear guidance without complex examples (L212-237)

#### "MCP Response Serialization" Tests (L240-287)
- **Purpose**: Validates proper serialization of generic descriptions in MCP protocol responses
- Focuses on response structure and string type validation for path descriptions

## Dependencies & Mocking

### External Dependencies (L2-3)
- DebugMcpServer from main application
- External dependency interfaces (ILogger, IFileSystem, IEnvironment)

### Mock Configuration (L6-54)
- **Production dependencies mock** (L6-35): Comprehensive mock of all external dependencies including logger, fileSystem, environment, processLauncher, networkManager, processManager, commandFinder
- **SessionManager mock** (L37-54): Complete mock of debugging session management functionality

### MCP SDK Integration (L57)
- Imports ListToolsRequestSchema for protocol compliance testing

## Architecture Patterns

1. **Spy-based Tool Extraction**: Uses Vitest spies to intercept server internals for testing private functionality
2. **Generic Documentation Validation**: Ensures AI-friendly, environment-agnostic tool descriptions
3. **Protocol Compliance**: Validates MCP standard response formatting
4. **Comprehensive Mocking**: Isolates unit under test through extensive dependency mocking

## Critical Constraints
- Tests expect specific wording in tool descriptions: "Use absolute paths or paths relative to your current working directory"
- Tool descriptions must avoid environment-specific path examples
- Consistent terminology: "source file" vs "script" based on context
- All path descriptions must be non-empty strings