# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/coop_budget.rs
@source-hash: 941352b3456e7f76
@generated: 2026-02-09T18:12:11Z

**Primary Purpose**: Test suite for Tokio's cooperative scheduling budget functionality using UDP sockets and budget management APIs.

**Platform Requirements**: Linux-only tests (`target_os = "linux"`) requiring "full" feature flag. Uses Linux loopback interface behavior for predictable network stack interactions.

**Key Constants**:
- `BUDGET` (L9): Cooperative scheduling budget size of 128 operations
- Test packet constants (L32-33): 12-byte "Hello, world" test payload

**Main Test Function - `coop_budget_udp_send_recv` (L27-80)**:
Validates cooperative scheduling works correctly with UDP socket operations by:
1. Creating connected UDP socket pair on localhost (L42-46)
2. Spawning background counter task that yields repeatedly (L54-60)
3. Performing 1024 send/recv cycles in tight loop (L62-77)
4. Asserting expected yield count based on budget exhaustion (L79)

**Test Logic**: Exploits Linux loopback interface behavior where packets traverse entire network stack during send syscall, preventing EWOULDBLOCK. Only cooperative budgeting forces yields. Each packet involves 2 budget events (send + recv), so yields should occur every 64 packets (128/2).

**Budget API Test - `test_has_budget_remaining` (L82-93)**:
Simple validation of budget query and depletion APIs:
- Confirms budget initially available
- Exhausts budget through 128 `consume_budget()` calls
- Verifies budget exhaustion detection

**Dependencies**:
- `tokio::net::UdpSocket`: Async UDP networking
- `tokio::task::coop`: Budget management APIs (`consume_budget`, `has_budget_remaining`)
- `std::sync::atomic`: Thread-safe counter for yield tracking

**Architecture Notes**:
- Tests rely on specific Linux networking behavior for determinism
- Background task pattern used to measure cooperative scheduling effectiveness
- Atomic operations ensure thread-safe yield counting across tasks