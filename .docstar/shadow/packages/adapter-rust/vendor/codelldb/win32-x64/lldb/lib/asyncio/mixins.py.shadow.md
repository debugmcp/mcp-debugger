# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/mixins.py
@source-hash: 8f4a3e16eca845eb
@generated: 2026-02-09T18:10:15Z

## Purpose
Provides thread-safe event loop binding mixins for asyncio objects that need to be bound to a specific event loop instance.

## Key Components

### `_global_lock` (L6)
Threading lock used for thread-safe double-checked locking pattern when binding to event loops.

### `_LoopBoundMixin` (L9-21)
Mixin class that provides event loop binding functionality with lazy initialization:
- `_loop` (L10): Class attribute storing the bound event loop instance (initially None)
- `_get_loop()` (L12-21): Core method implementing thread-safe loop binding with validation

#### Loop Binding Logic
1. Gets currently running event loop via `events._get_running_loop()` (L13)
2. Uses double-checked locking pattern (L15-18) to lazily bind to first encountered loop
3. Validates that current loop matches bound loop, raising `RuntimeError` if different (L19-20)
4. Returns the validated loop instance (L21)

## Dependencies
- `threading`: For thread synchronization primitives
- Local `events` module: For accessing running event loop

## Architectural Patterns
- **Mixin Design**: Provides reusable loop-binding behavior for composition
- **Double-Checked Locking**: Thread-safe lazy initialization without performance penalty
- **Loop Affinity**: Ensures objects remain bound to their originating event loop

## Critical Invariants
- Once bound, an object cannot be used with a different event loop
- Binding occurs on first `_get_loop()` call in a thread-safe manner
- All subsequent calls must occur within the same event loop context