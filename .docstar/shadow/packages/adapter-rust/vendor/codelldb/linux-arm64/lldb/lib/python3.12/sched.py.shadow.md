# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sched.py
@source-hash: 56588f00a68ef953
@generated: 2026-02-09T18:09:01Z

## Event Scheduler Module

**Primary Purpose:** Provides a thread-safe event scheduler class for managing time-based task execution with priority queuing.

### Key Components

**Event NamedTuple (L35-47)**
- Structure: `(time, priority, sequence, action, argument, kwargs)`
- `sequence`: Auto-incrementing counter for deterministic ordering when time/priority are equal
- `action`: Callable to execute with `*argument` and `**kwargs`

**scheduler Class (L51-167)**
Core event scheduling engine with heap-based priority queue implementation.

**Constructor (L53-60)**
- `timefunc`: Time source function (defaults to `monotonic`)
- `delayfunc`: Delay implementation function (defaults to `time.sleep`)
- Thread safety via `threading.RLock()`
- Internal heap queue `_queue` and sequence generator

**Key Methods:**
- `enterabs(time, priority, action, argument=(), kwargs=_sentinel)` (L62-76): Schedule event at absolute time
- `enter(delay, priority, action, argument=(), kwargs=_sentinel)` (L78-85): Schedule event with relative delay
- `cancel(event)` (L87-96): Remove event by ID, triggers heap rebalancing
- `empty()` (L98-101): Thread-safe queue emptiness check
- `run(blocking=True)` (L103-152): Main execution loop with optional non-blocking mode
- `queue` property (L154-167): Returns ordered list of pending events

### Architecture Patterns

**Thread Safety:** All queue operations protected by RLock for concurrent access safety.

**Priority Queue:** Uses `heapq` for O(log n) insertion/removal with lower numbers = higher priority.

**Sequence Numbers:** Monotonic counter ensures FIFO ordering for same time/priority events.

**Pluggable Time/Delay:** Dependency injection pattern allows custom time sources and delay implementations.

### Critical Behaviors

**Run Loop (L134-152):**
- Executes ready events immediately
- Delays for future events when blocking=True
- Returns time-to-next-event when blocking=False
- Includes cooperative threading via `delayfunc(0)` after each event

**Event Cancellation:** Requires O(n) linear search in heap, followed by O(n) reheapification.

**Non-blocking Mode:** Returns deadline of next event rather than blocking on delays.

### Dependencies

- `heapq`: Priority queue operations
- `threading`: RLock for thread safety
- `time`: Default delay function and monotonic time source
- `collections.namedtuple`: Event structure definition