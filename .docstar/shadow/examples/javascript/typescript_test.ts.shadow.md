# examples/javascript/typescript_test.ts
@source-hash: 65709a1a6276d582
@generated: 2026-02-10T00:41:44Z

## Primary Purpose

TypeScript test file specifically designed for MCP debugger testing. Provides comprehensive scenarios for testing source map resolution, breakpoints, variable inspection, and TypeScript-specific debugging features.

## Key Types and Interfaces

- `Person` (L7-11): Basic interface with optional email field for type inspection testing
- `TodoStatus` (L60): Union type representing todo item states
- `Todo` (L62-68): Complex interface with nested metadata using Record type

## Core Classes

- `Calculator` (L14-32): Test class for method stepping and private field inspection
  - `history` field for state tracking
  - `add()` method (L17-21): Addition with breakpoint at L18
  - `multiply()` method (L23-27): Multiplication with breakpoint at L24
  - `getHistory()` method (L29-31): Returns readonly array view

## Key Functions

- `swap<T>()` (L35-41): Generic function for testing generic type handling and variable swapping, includes console logging and breakpoint at L37
- `fetchData()` (L44-57): Async function simulating API calls, returns Promise<Person>, breakpoint at L50 for object creation
- `throwTestError()` (L138-140): Error throwing function for stack trace testing
- `main()` (L71-136): Orchestrates all test scenarios in sequence

## Test Scenarios

1. **Class Testing** (L75-80): Calculator instantiation and method calls, breakpoint at L77
2. **Generic Functions** (L83-87): Tests swap function with different types
3. **Async Operations** (L90-93): Multiple async calls for Promise debugging
4. **Complex Data** (L96-126): Todo array with nested objects, breakpoint at L122 in loop
5. **Error Handling** (L129-133): Exception throwing and catching, breakpoint at L132

## Strategic Breakpoint Locations

- L18: Method execution and result calculation
- L24: Alternative method path
- L37: Generic function variable assignment  
- L50: Async object construction
- L77: Class method invocation
- L122: Loop iteration with complex data
- L132: Exception handling

## Dependencies

- Uses native TypeScript features: generics, interfaces, async/await
- Console API for logging
- Promise API for async simulation
- Date API for metadata timestamps

## Architectural Decisions

- Structured as progressive complexity: simple types → classes → generics → async → complex data → errors
- Each test section isolated with clear console output
- Breakpoint comments explicitly mark intended debugging points
- Uses TypeScript-specific features (readonly, optional properties, union types) for comprehensive testing