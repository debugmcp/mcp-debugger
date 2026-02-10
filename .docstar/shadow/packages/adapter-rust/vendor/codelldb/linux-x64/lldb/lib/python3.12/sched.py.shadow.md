# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sched.py
@source-hash: 56588f00a68ef953
@generated: 2026-02-09T18:09:54Z

## Purpose
Python event scheduler implementation providing priority-based event queuing with customizable time and delay functions. Part of the standard library, supporting both real-time and simulated time scheduling.

## Core Components

**Event namedtuple (L35-47)**
- Fields: `time`, `priority`, `action`, `argument`, `kwargs`, `sequence`
- Represents scheduled events with execution metadata
- Lower priority numbers = higher execution priority
- Sequence number ensures deterministic ordering for same time/priority

**scheduler class (L51-167)**
Primary scheduler managing event queue with thread-safe operations.

### Key Methods

**__init__(L53-60)**
- Accepts `timefunc` (default: `time.monotonic`) and `delayfunc` (default: `time.sleep`)
- Initializes thread-safe queue using `threading.RLock()`
- Creates sequence generator for event ordering

**enterabs(L62-76)** and **enter(L78-85)**
- `enterabs`: Schedule event at absolute time
- `enter`: Schedule event with relative delay (more common interface)
- Both return Event object as cancellation ID
- Thread-safe using heapq for priority queue management

**cancel(L87-96)**
- Removes event from queue using Event object as ID
- Rebuilds heap after removal
- Raises ValueError if event not found

**run(L103-152)**
- Main execution loop with blocking/non-blocking modes
- Non-blocking returns time until next event
- Executes events when their time arrives
- Includes "questionable hack" - 0-delay after each event to yield CPU to other threads
- Localizes variables for performance and thread safety

**queue property (L154-167)**
- Returns ordered list of upcoming events
- Uses heapq.heappop for proper ordering (maintains heap invariant)

## Architecture

- Uses `heapq` for efficient priority queue operations
- Thread-safe with RLock protecting queue operations
- Pluggable time/delay functions enable real-time or simulated scheduling
- Events stored as immutable namedtuples for safety
- Sequence numbers prevent non-deterministic behavior

## Dependencies
- `heapq`: Priority queue implementation
- `threading`: RLock for thread safety
- `time`: Default time functions
- `collections.namedtuple`: Event structure
- `itertools.count`: Sequence generation

## Critical Invariants
- Queue maintained as min-heap (earliest time at index 0)
- All queue modifications protected by lock
- Event IDs (returned objects) must be used for cancellation
- Delay function may modify queue during execution