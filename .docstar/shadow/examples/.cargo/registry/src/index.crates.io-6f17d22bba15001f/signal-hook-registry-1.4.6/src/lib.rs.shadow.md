# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/signal-hook-registry-1.4.6/src/lib.rs
@source-hash: e904c181a1edb114
@generated: 2026-02-09T18:11:59Z

**Purpose**: Low-level signal multiplexing registry for Unix/Windows signal handling. Provides minimal async-signal-safe API that allows multiple callbacks per signal while maintaining compatibility across different versions of higher-level signal-handling crates.

**Architecture**: Uses RCU (Read-Copy-Update) pattern with atomic pointers and half-locks to enable signal handlers to read data structures without allocation/deallocation inside signal context.

## Core Data Structures

**SigId (L129-133)**: Public handle for registered signal actions, contains signal number and internal ActionId for removal.

**ActionId (L122-123)**: Internal u128 identifier for actions, assigned incrementally to maintain insertion order.

**Slot (L140-146)**: Per-signal container holding previous handler and ordered action callbacks (BTreeMap ensures execution order).

**SignalData (L208-212)**: Global state containing all signal slots and next ID counter.

**GlobalData (L283-297)**: Singleton containing thread-safe signal data and race condition fallback storage.

## Key Registration Functions

**register() (L541-546)**: Safe wrapper that registers simple closure without siginfo parameter. Checks forbidden signals list.

**register_sigaction() (L558-563)** [Unix only]: Registers action with siginfo_t parameter for detailed signal information.

**register_unchecked() (L607-612)** [Unix only]: Bypasses forbidden signal checks, allows registering dangerous signals like SIGSEGV.

**register_unchecked_impl() (L614-660)**: Core implementation handling signal handler installation, previous handler preservation, and action storage.

## Signal Handlers

**handler() (L328-370)** [Windows]: Signal handler that re-registers itself due to Windows CRT behavior, executes previous handler then registered actions.

**handler() (L372-409)** [Unix]: Signal handler receiving siginfo_t, handles null pointer safety, executes chained handlers.

## Management Functions

**unregister() (L679-691)**: Removes specific action by SigId, returns success status. Does not restore default handler when last action removed.

**GlobalData::ensure() (L312-325)**: Lazy initialization using std::sync::Once, creates singleton instance.

## Platform Differences

**Windows Limitations**:
- No siginfo_t support (L48-51)
- Race conditions due to lack of signal blocking (L52-53) 
- Handler auto-reset requiring re-registration (L56-60)

**Forbidden Signals**:
- Unix: SIGKILL, SIGSTOP, SIGILL, SIGFPE, SIGSEGV (L422-423)
- Windows: SIGILL, SIGFPE, SIGSEGV (L420-421)

## Safety Constraints

All registered actions must be async-signal-safe (no allocation, no standard synchronization primitives, no panicking). Library handles RCU synchronization internally but callbacks must follow signal handler restrictions.

## Race Condition Mitigation

Uses fallback storage (L646-649) to handle race between signal handler installation and data structure updates, though small window remains for concurrent handler replacement.