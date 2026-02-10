# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sched.py
@source-hash: 56588f00a68ef953
@generated: 2026-02-09T18:07:58Z

## Purpose
Single-threaded event scheduler implementing a priority queue for timed execution of functions. Provides thread-safe access to the queue but expects single-threaded event execution.

## Core Components

### Event Structure (L35-47)
- `Event` namedtuple with fields: `time`, `priority`, `sequence`, `action`, `argument`, `kwargs`
- Lower priority numbers indicate higher priority (UNIX-style)
- Sequence number provides deterministic ordering for events with identical time/priority

### scheduler Class (L51-167)

#### Initialization (L53-60)
- `timefunc`: Function to get current time (defaults to `time.monotonic`)
- `delayfunc`: Function to implement delays (defaults to `time.sleep`)
- `_queue`: Heap-ordered list of Event objects
- `_lock`: RLock for thread-safe queue operations
- `_sequence_generator`: Incrementing counter for event ordering

#### Key Methods

**enterabs(time, priority, action, argument, kwargs) → Event** (L62-76)
- Schedules event at absolute time
- Returns Event object as cancellation ID
- Thread-safe with lock protection

**enter(delay, priority, action, argument, kwargs) → Event** (L78-85)
- Schedules event relative to current time
- More commonly used interface than `enterabs`

**cancel(event)** (L87-96)
- Removes event from queue using Event object as ID
- Raises ValueError if event not found
- Requires heap rebalancing after removal

**run(blocking=True)** (L103-152)
- Main execution loop processing events in time/priority order
- If `blocking=False`: executes ready events and returns delay to next event
- If `blocking=True`: runs until queue empty
- Includes thread cooperation via `delayfunc(0)` after each event
- Localizes variables for performance and thread safety

**queue property** (L154-167)
- Returns sorted list of upcoming events
- Uses heapq for correct ordering of simultaneous events

## Dependencies
- `heapq`: Priority queue implementation
- `threading.RLock`: Thread synchronization
- `time.monotonic`: Default time source
- `collections.namedtuple`: Event structure

## Architecture Patterns
- Template Method: Pluggable time/delay functions for different scheduling contexts
- Priority Queue: Events ordered by (time, priority, sequence) tuple
- Thread-safe but single-threaded execution model
- Graceful exception handling preserves scheduler state