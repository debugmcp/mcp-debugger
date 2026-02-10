# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/nto/neutrino.rs
@source-hash: 2cef6af9943eec59
@generated: 2026-02-09T18:02:48Z

## Purpose
This file provides QNX Neutrino RTOS specific FFI bindings and type definitions for the libc crate. It defines low-level system structures, constants, and function declarations that enable Rust programs to interact with QNX Neutrino kernel services including message passing, threading, synchronization, interrupts, and timing.

## Key Structures

### System Page and Memory Management
- `syspage_entry_info` (L6-9): Entry descriptor for system page components with offset and size
- `syspage_array_info` (L10-14): Array descriptor for system page elements with size information  
- `syspage_entry` (L221-248): Main system page structure with hardware info, timing, and CPU details

### Message Passing and IPC
- `iov_t` (L20-23): I/O vector for scatter-gather operations in message passing
- `_msg_info64` (L30-45): Comprehensive message metadata including node, process, thread IDs and priority
- `_client_info` (L58-64): Client connection information with credentials
- `_client_able` (L66-71): Client capability descriptor with ability flags and ranges
- `nto_channel_config` (L73-79): Channel configuration with event handling and pulse management

### Synchronization and Threading
- `intrspin` (L16-18): Interrupt spinlock structure with volatile value
- `_sighandler_info` (L142-146): Signal handler context with function pointer and state

### Timing and Clocks
- `_itimer` (L25-28): Interval timer with nanosecond precision and interval
- `qtime_entry` (L173-192): System timing information including cycles, adjustments, and timer configuration
- `_clockadjust` (L168-171): Clock adjustment parameters for fine-tuning system time
- `_timer_info` (L202-211): Timer state and configuration information
- `_clockperiod` (L213-216): Clock period configuration

### System Control
- `_sched_info` (L194-200): Scheduler information with priority ranges and intervals
- `_idle_hook` (L153-166): System idle hook configuration for power management

## Constants and Flags

### Process/Thread States (L256-277)
State constants for thread scheduling: `STATE_RUNNING`, `STATE_READY`, `STATE_SEND`, `STATE_RECEIVE`, etc.

### Timeout Flags (L279-289)
Bitmask constants for timeout operations: `_NTO_TIMEOUT_RECEIVE`, `_NTO_TIMEOUT_SEND`, etc.

### Message Info Flags (L291-324)
Various flags for message operations, endianness, capabilities, and process attributes.

### Channel and Connection Flags (L416-456)
Extensive flag definitions for channel creation (`_NTO_CHF_*`) and connection options (`_NTO_COF_*`).

## External Functions

### Message Passing API (L515-910)
Core QNX message passing functions including:
- `ChannelCreate*` family for channel management
- `ConnectAttach*` family for connection establishment  
- `MsgSend*` family for synchronous message operations
- `MsgReceive*` family for message reception
- `MsgReply*` family for response handling

### Signal Handling (L911-986)
Signal management functions: `SignalKill*`, `SignalAction*`, `SignalSuspend*`, etc.

### Thread Management (L987-1021) 
Thread lifecycle functions: `ThreadCreate*`, `ThreadDestroy*`, `ThreadJoin*`, etc.

### Interrupt Handling (L1023-1099)
Interrupt management: `InterruptAttach*`, `InterruptDetach*`, `InterruptWait*`, etc.

### Scheduling (L1101-1146)
Scheduler control: `SchedGet*`, `SchedSet*`, `SchedInfo*`, job management functions.

### Timer Management (L1148-1199)
Timer operations: `TimerCreate*`, `TimerDestroy*`, `TimerSettime*`, etc.

### Synchronization (L1201-1230)
Mutex, condition variable, and semaphore operations: `SyncMutexLock*`, `SyncCondvarWait*`, etc.

### Clock Management (L1232-1257)
Clock control functions: `ClockTime*`, `ClockAdjust*`, `ClockPeriod*`, etc.

## Dependencies
- Imports from `crate::prelude::*` (L1)
- Uses standard libc types: `c_int`, `c_uint`, `c_void`, `size_t`
- References other crate types: `pid_t`, `uid_t`, `gid_t`, `clockid_t`, `timer_t`, `sigevent`, etc.

## Architecture Notes
- Many functions have `_r` variants indicating reentrant/thread-safe versions
- Extensive use of raw pointers for C FFI compatibility
- Some structures contain reserved/padding fields for ABI compatibility
- Architecture-dependent sections noted with reserved space (L242)