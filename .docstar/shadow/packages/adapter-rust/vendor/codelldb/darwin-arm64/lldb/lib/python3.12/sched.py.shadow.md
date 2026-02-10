# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sched.py
@source-hash: 56588f00a68ef953
@generated: 2026-02-09T18:07:14Z

## Purpose
Event scheduler implementation providing priority queue-based event scheduling with customizable time and delay functions. Part of Python's standard library for managing timed task execution.

## Key Classes

**scheduler (L51-167)**: Main scheduler class managing a priority queue of events
- Constructor (L53-60): Takes optional `timefunc` (defaults to `time.monotonic`) and `delayfunc` (defaults to `time.sleep`)
- Internal state: `_queue` (heap), `_lock` (RLock), `_sequence_generator` (counter for tie-breaking)

**Event (L35-47)**: Named tuple representing scheduled events with fields:
- `time`: When to execute (absolute timestamp)
- `priority`: Lower numbers = higher priority
- `sequence`: Tie-breaker for same time/priority
- `action`: Callable to execute
- `argument`: Positional args tuple
- `kwargs`: Keyword args dict

## Core Methods

**enterabs (L62-76)**: Schedule event at absolute time
- Returns event object as cancellation ID
- Thread-safe with lock protection
- Uses heap for O(log n) insertion

**enter (L78-85)**: Schedule event with relative delay
- Converts delay to absolute time via `timefunc()`
- Delegates to `enterabs`

**cancel (L87-96)**: Remove event from queue
- Requires event ID from enter/enterabs
- Rebuilds heap after removal (expensive O(n))
- Raises ValueError if event not found

**run (L103-152)**: Main execution loop
- `blocking=True`: Runs until queue empty
- `blocking=False`: Executes due events, returns next deadline
- Handles delays via `delayfunc`
- Calls `delayfunc(0)` after each event for thread cooperation

**empty (L98-101)**: Check if queue is empty (thread-safe)

**queue property (L154-167)**: Returns sorted list of upcoming events

## Dependencies
- `heapq`: Priority queue operations
- `threading`: RLock for thread safety
- `time`: Default timing functions
- `collections.namedtuple`: Event structure
- `itertools.count`: Sequence generation

## Architecture Notes
- Thread-safe design with RLock protection
- Heap-based priority queue for efficient scheduling
- Pluggable time/delay functions for real-time or simulated scheduling
- Event IDs enable cancellation but removal is O(n) due to heap rebuild
- Cooperative threading via zero-delay calls