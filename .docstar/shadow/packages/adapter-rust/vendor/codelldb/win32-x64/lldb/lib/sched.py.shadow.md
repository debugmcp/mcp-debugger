# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sched.py
@source-hash: 56588f00a68ef953
@generated: 2026-02-09T18:13:01Z

## Event Scheduler Implementation

This file implements a priority-based event scheduler that manages a queue of time-ordered events. It provides thread-safe scheduling with customizable timing and delay functions.

### Core Components

**Event NamedTuple (L35-47)**: Represents scheduled events with fields:
- `time`: Absolute execution time (numeric)
- `priority`: Execution order for same-time events (lower = higher priority)
- `sequence`: Auto-incrementing tie-breaker for identical time/priority
- `action`: Callable to execute
- `argument`: Positional arguments tuple for action
- `kwargs`: Keyword arguments dict for action

**scheduler Class (L51-167)**: Main event queue manager with thread-safe operations

### Key Methods

**Initialization (L53-60)**: 
- Accepts `timefunc` (default: `time.monotonic`) and `delayfunc` (default: `time.sleep`)
- Creates empty priority queue (`heapq`), RLock for thread safety, and sequence generator

**Event Scheduling**:
- `enterabs()` (L62-76): Schedules event at absolute time, returns event ID
- `enter()` (L78-85): Schedules event with relative delay (more common interface)

**Queue Management**:
- `cancel()` (L87-96): Removes event by ID, re-heapifies queue
- `empty()` (L98-101): Thread-safe queue emptiness check
- `queue` property (L154-167): Returns ordered list of upcoming events

**Execution Engine**:
- `run()` (L103-152): Main event loop with blocking/non-blocking modes
  - Blocking mode: Executes all events until queue empty
  - Non-blocking mode: Executes ready events, returns next deadline
  - Uses localized variables for performance (L127-133)
  - Includes thread yield mechanism via `delayfunc(0)` after each event (L152)

### Architecture Patterns

- **Priority Queue**: Uses `heapq` for efficient time-ordered event retrieval
- **Thread Safety**: RLock protects all queue operations
- **Dependency Injection**: Pluggable time and delay functions enable real-time or simulated scheduling
- **Event ID System**: Returns event objects as cancellation tokens

### Dependencies
- `heapq`: Priority queue implementation
- `threading`: RLock for thread safety  
- `time`: Default timing functions
- `collections.namedtuple`: Event structure
- `itertools.count`: Sequence generation