# tests/adapters/go/unit/go-adapter-factory.test.ts
@source-hash: 1fd5f417e1c012fd
@generated: 2026-02-10T00:41:18Z

**Purpose & Responsibility**
Unit test suite for GoAdapterFactory, testing the creation, validation, and metadata retrieval functionality of the Go debug adapter factory. Validates environment setup including Go and Delve debugger installation requirements.

**Key Test Structure**

- **Mock Setup (L9-51)**: Comprehensive mocking infrastructure including child_process.spawn for simulating tool execution, and createMockDependencies() factory for AdapterDependencies interface
- **GoAdapterFactory Tests (L53-258)**: Main test suite organized into three core areas:

**createAdapter Tests (L66-76)**
- Validates factory correctly instantiates GoDebugAdapter instances
- Ensures proper language assignment (DebugLanguage.GO)

**getMetadata Tests (L78-99)**  
- Verifies adapter metadata including language, display name, version (0.1.0)
- Validates Delve-related description, .go file extensions
- Tests documentation URL and SVG icon presence

**validate Tests (L101-258)**
- **Success Case (L102-133)**: Mocks successful Go and Delve version checks, validates environment setup
- **Go Not Found (L135-144)**: Tests PATH-based tool discovery failure
- **Old Go Version (L146-173)**: Validates minimum Go 1.18 requirement enforcement  
- **Delve Missing (L175-203)**: Tests Delve debugger availability checks
- **No DAP Support (L205-236)**: Validates Delve DAP (Debug Adapter Protocol) capability
- **Platform Info (L238-257)**: Ensures validation includes platform/architecture details

**Dependencies & Mocking**
- Uses vitest for testing framework with comprehensive mocking
- Mocks child_process.spawn to simulate Go/Delve command execution
- Creates mock EventEmitter processes with stdout/stderr simulation
- Mock file system operations through fs.promises.access

**Key Validation Logic**
The validate() method tests critical environment prerequisites:
- Go binary availability and minimum version (1.18+)
- Delve debugger installation and DAP support
- Platform information collection for debugging context

**Test Patterns**
- Process.nextTick() for async command simulation
- Buffer-based stdout data emission for version parsing
- Exit code handling for success/failure scenarios
- Comprehensive error message validation