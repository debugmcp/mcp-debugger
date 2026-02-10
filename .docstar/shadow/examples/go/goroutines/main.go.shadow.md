# examples/go/goroutines/main.go
@source-hash: ea04f5e61defed2b
@generated: 2026-02-10T00:41:23Z

## Purpose
Educational demonstration of Go goroutine patterns and debugging scenarios. Presents three progressively complex concurrency examples: basic goroutines with WaitGroup, channel communication, and worker pool architecture.

## Key Functions

### main (L9-25)
Entry point that sequentially executes three goroutine examples with descriptive output formatting. Orchestrates the demonstration flow.

### simpleGoroutines (L27-41)
Basic goroutine example using `sync.WaitGroup` for synchronization. Creates 3 concurrent goroutines that simulate work with 100ms sleep. Demonstrates proper goroutine lifecycle management with defer pattern for WaitGroup cleanup.

### channelCommunication (L43-65)
Producer-consumer pattern using buffered and unbuffered channels. Producer goroutine (L48-53) sends 3 messages to buffered channel then closes it. Consumer goroutine (L56-62) ranges over messages with 50ms processing delay. Uses done channel for final synchronization.

### workerPool (L67-97)
Advanced worker pool implementation with 3 workers processing 5 jobs. Uses buffered channels for job distribution and result collection. Employs WaitGroup for worker lifecycle management and separate goroutine (L88-91) to close results channel after all workers complete.

### worker (L99-112)
Worker function that processes jobs from channel, simulates work (job * 2 calculation), and sends results. Takes worker ID, job/result channels, and WaitGroup pointer. Uses channel ranging pattern for job consumption.

## Dependencies
- `sync.WaitGroup`: Goroutine synchronization
- `time`: Sleep simulation for work delays
- `fmt`: Output formatting

## Architectural Patterns
- **WaitGroup Pattern**: Used in simple goroutines and worker pool for coordinated completion
- **Producer-Consumer**: Channel-based message passing with proper channel closure
- **Worker Pool**: Scalable job processing with bounded concurrency
- **Channel Direction**: Uses directional channels in worker function for type safety

## Critical Design Points
- All goroutines properly synchronized to prevent premature main function exit
- Channels are correctly closed by producers to enable range-based consumption
- WaitGroup incremented before goroutine creation to avoid race conditions
- Buffered channels sized appropriately for workload (3 messages, 5 jobs)
- Results channel closed asynchronously after worker completion to prevent deadlock