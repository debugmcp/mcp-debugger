# src/implementations/process-manager-impl.ts
@source-hash: 5605097425cb62b3
@generated: 2026-02-09T18:15:02Z

## ProcessManagerImpl

**Primary Purpose**: Concrete implementation of IProcessManager interface that wraps Node.js child_process module for spawning and executing processes.

**Key Components**:
- **ProcessManagerImpl class (L10)**: Main implementation class
- **spawn method (L11-14)**: Creates child processes using Node.js spawn, returns IChildProcess interface
- **exec method (L16-41)**: Executes commands and returns stdout/stderr, handles multiple return type scenarios
- **execAsync constant (L8)**: Promisified version of Node.js exec function

**Architecture & Dependencies**:
- Implements `IProcessManager` interface from `@debugmcp/shared` package
- Direct dependency on Node.js `child_process` module
- Uses `promisify` utility for async/await pattern with exec
- Type casting from Node.js ChildProcess to IChildProcess interface (L13)

**Critical Logic Patterns**:
The exec method implements robust handling for different execution environments:
1. **Standard Node.js behavior (L21-23)**: Handles normal promisified exec result objects
2. **Array-based mocks (L26-28)**: Accommodates test mocks returning [stdout, stderr] arrays  
3. **String-only mocks (L31-33)**: Handles simplified mocks returning only stdout
4. **Fallback handling (L39-40)**: Warning + type casting for unexpected result types

**Type Safety Considerations**:
- Uses type assertion (`as unknown as IChildProcess`) for spawn return value
- Multiple type guards in exec method to handle runtime type variations
- Fallback type casting with console warning for unexpected scenarios

**Testing Accommodation**: 
The exec method's multi-case handling specifically accounts for different mocking strategies in test environments, making it resilient to various testing frameworks and mock implementations.