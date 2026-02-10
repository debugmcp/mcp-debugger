# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/__main__.py
@source-hash: 2756ebb39309818f
@generated: 2026-02-09T18:10:18Z

## Purpose
This module implements an asyncio-enabled interactive Python REPL (Read-Eval-Print Loop) that allows direct use of `await` statements without wrapping them in `asyncio.run()`. It bridges synchronous console interaction with asynchronous code execution.

## Key Classes

### AsyncIOInteractiveConsole (L14-65)
Custom interactive console that extends `code.InteractiveConsole` to support top-level await statements.

**Key Methods:**
- `__init__(locals, loop)` (L16-19): Configures compiler flags to allow top-level await and stores event loop reference
- `runcode(code)` (L21-64): Executes code in asyncio context, handling both sync and async code paths

**Execution Flow:**
1. Creates a `concurrent.futures.Future` for result communication
2. Defines callback that wraps code in function and checks if result is coroutine
3. For coroutines: creates task in event loop and chains to future via `futures._chain_future`
4. For non-coroutines: sets result directly
5. Handles exceptions including `KeyboardInterrupt` with special tracking

### REPLThread (L67-88) 
Daemon thread that runs the interactive console session.

**Key Method:**
- `run()` (L69-88): Displays banner, starts console interaction, and ensures loop cleanup

## Global State Variables
- `repl_future` (L105): Tracks current async task for cancellation
- `repl_future_interrupted` (L106): Flags keyboard interrupt state

## Main Execution (L91-125)
1. Sets up new event loop and makes it current
2. Configures REPL locals with asyncio module and standard variables
3. Creates console and thread instances
4. Attempts to import readline for enhanced input
5. Runs infinite loop with keyboard interrupt handling for task cancellation

## Dependencies
- **Internal**: `futures` module for future chaining
- **Standard Library**: `asyncio`, `code`, `concurrent.futures`, `inspect`, `threading`, `types`, `ast`, `warnings`, `sys`

## Architectural Pattern
Thread-based architecture where:
- Main thread runs asyncio event loop
- Separate daemon thread handles user interaction
- Communication via `call_soon_threadsafe` and futures
- Global variables coordinate interrupt handling between threads

## Critical Invariants
- Event loop runs in main thread only
- REPL interaction occurs in separate daemon thread
- Keyboard interrupts must be properly propagated to cancel running tasks
- Loop cleanup occurs when REPL thread exits