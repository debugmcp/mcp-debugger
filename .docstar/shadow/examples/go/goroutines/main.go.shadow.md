# examples/go/goroutines/main.go
@source-hash: ea04f5e61defed2b
@generated: 2026-02-09T18:14:31Z

## Purpose
Educational Go program demonstrating three common goroutine patterns: basic concurrent execution, channel-based communication, and worker pool architecture. Designed for debugging and understanding goroutine synchronization mechanisms.

## Key Functions

### main (L9-25)
Entry point orchestrating three goroutine examples with formatted output sections. Sequential execution of demonstration patterns.

### simpleGoroutines (L27-41) 
Basic goroutine pattern using `sync.WaitGroup` for coordination. Spawns 3 concurrent goroutines (L30-38) with closure capturing loop variable. Each goroutine simulates work with 100ms sleep and synchronized completion via `wg.Done()`.

### channelCommunication (L43-65)
Producer-consumer pattern demonstration. Creates buffered channel `messages` (capacity 3) and unbuffered `done` channel. Producer goroutine (L48-53) sends 3 messages then closes channel. Consumer goroutine (L56-62) ranges over messages with 50ms processing delay, signals completion via `done` channel.

### workerPool (L67-97)
Advanced pattern implementing worker pool with job distribution. Constants define 3 workers and 5 jobs (L68-69). Uses buffered channels for `jobs` and `results`. Spawns worker goroutines (L76-79), distributes jobs (L82-85), and collects results with channel range pattern (L94-96). Background goroutine closes results channel after all workers complete (L88-91).

### worker (L99-112)
Worker function processing jobs from channel until closed. Takes worker ID, job input channel (receive-only), results output channel (send-only), and WaitGroup pointer. Simulates processing with 100ms sleep, doubles job value as result, provides detailed logging of job lifecycle.

## Dependencies
- `fmt`: Output formatting and printing
- `sync`: WaitGroup for goroutine coordination
- `time`: Sleep operations for work simulation

## Architectural Patterns
1. **WaitGroup Synchronization**: Used in simple goroutines and worker pool for coordinated completion
2. **Channel Communication**: Buffered channels for job queuing, unbuffered for signaling
3. **Graceful Shutdown**: Proper channel closing and range-based consumption
4. **Worker Pool**: Scalable pattern with configurable worker count and job distribution

## Critical Invariants
- All goroutines must call `wg.Done()` to prevent deadlock
- Channels must be closed by sender to terminate range loops
- Worker pool requires background goroutine to close results channel after workers complete
- Job and result channels are buffered to prevent blocking during job distribution