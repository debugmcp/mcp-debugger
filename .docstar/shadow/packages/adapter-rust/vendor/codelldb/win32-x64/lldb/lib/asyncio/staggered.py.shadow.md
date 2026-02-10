# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/staggered.py
@source-hash: c707d294e5002fd2
@generated: 2026-02-09T18:12:24Z

## Primary Purpose
Implements a staggered racing algorithm for asyncio coroutines, running multiple coroutines with time-delayed starts and returning the first successful result. Part of the asyncio library's staggered execution utilities.

## Key Functions

### `staggered_race(coro_fns, delay, *, loop=None)` (L13-138)
Main entry point that orchestrates the staggered execution pattern. Takes an iterable of coroutine functions and executes them with staggered timing, cancelling all others when one succeeds.

**Parameters:**
- `coro_fns`: Iterable of coroutine functions (not coroutines themselves)
- `delay`: Time in seconds between starting each coroutine (None for sequential)
- `loop`: Optional event loop (defaults to current running loop)

**Returns:** Tuple of `(winner_result, winner_index, exceptions)`

### `run_one_coro(previous_failed)` (L72-118)
Inner async function implementing the core staggered logic. Recursively creates tasks for subsequent coroutines, managing timing delays and failure propagation.

**Key behaviors:**
- Waits for previous coroutine failure or delay timeout (L74-80)
- Creates next task before starting current coroutine (L87-89)
- Uses Event signaling for failure propagation (L101)
- Cancels all remaining tasks on success (L115-117)

## Dependencies
- `asyncio.events` for event loop management
- `asyncio.exceptions` for TimeoutError handling  
- `asyncio.locks.Event` for inter-coroutine signaling
- `asyncio.tasks` for task creation and waiting

## Architecture Patterns
- **Recursive task spawning**: Each coroutine creates the next task before starting execution
- **Event-driven failure propagation**: Uses `locks.Event` to signal failures and trigger next coroutine
- **Poor man's task group**: Manual task lifecycle management with cancellation cleanup (L122-127, L136-138)

## Critical Invariants
- `len(running_tasks) == this_index + 2` (L90) - ensures task list matches enumeration
- `len(exceptions) == this_index + 1` (L93) - maintains exception list alignment
- Only one winner allowed (`assert winner_index is None` L105)
- All tasks cancelled on exit regardless of completion state (L136-138)

## Notable Implementation Details
- Handles `SystemExit` and `KeyboardInterrupt` specially by re-raising (L97-98)
- Uses `contextlib.suppress(TimeoutError)` for delay timing (L75)
- Debug mode validation checks for unhandled task exceptions (L130-133)
- Avoids self-cancellation edge case documented in Python bug #30048 (L108-114)