# tests/unit/proxy/minimal-dap.test.ts
@source-hash: 6140744ebd903e19
@generated: 2026-02-09T18:15:05Z

## Test Suite: MinimalDapClient Unit Tests

**Primary Purpose:** Comprehensive unit test suite for the `MinimalDapClient` class, covering DAP (Debug Adapter Protocol) communication, message parsing, request/response handling, child session management, and error scenarios.

### Test Structure & Setup

**Main Test File:** `tests/unit/proxy/minimal-dap.test.ts`
- **Testing Framework:** Vitest with mocking capabilities (L1)
- **Test Subject:** `MinimalDapClient` from `../../../src/proxy/minimal-dap.js` (L5)
- **Key Dependencies:** net, fs, EventEmitter, DebugProtocol, JsDebugAdapterPolicy (L2-8)

**Mock Infrastructure:**
- **Network Module Mock:** `vi.mock('net')` (L12) - mocks TCP socket creation
- **Logger Mock:** Hoisted logger instances tracking (L22-36) with info/error/debug/warn methods
- **Socket Mock Factory:** `createMockSocket()` (L63-75) - creates EventEmitter-based mock sockets
- **Child Session Manager Stub:** `createChildSessionManagerStub()` (L51-60) - mocks child session lifecycle

### Core Test Categories

#### 1. Connection Management (L119-191)
- **Connection Success:** Validates TCP connection establishment to `localhost:5678` (L120-128)
- **Connection Error Handling:** Tests error propagation during connection phase without triggering error handlers (L130-154)
- **Socket Event Handling:** Close and error events after successful connection (L156-190)

#### 2. Message Parsing (L193-340)
- **DAP Message Format:** `createDapMessage()` helper (L78-82) creates proper Content-Length headers
- **Partial Message Assembly:** Multi-chunk message reconstruction (L213-234)
- **Multiple Messages:** Single data event containing multiple DAP messages (L236-262)
- **Malformed Data Handling:** Invalid headers, JSON parsing errors, zero/negative Content-Length (L264-323)
- **Buffer Management:** `splitBuffer()` utility (L85-96) for testing fragmented messages

#### 3. Request/Response Handling (L342-513)
- **Request Formatting:** Validates DAP request structure with seq/type/command/arguments (L343-369)
- **Response Correlation:** Maps responses to pending requests via request_seq (L371-391)
- **Concurrent Requests:** Out-of-order response handling (L412-456)
- **Timeout Management:** 30-second request timeout with deterministic timer mocking (L458-490)
- **Error Responses:** Failed requests with success:false (L393-410)

#### 4. Event Handling (L515-576)
- **DAP Event Emission:** Specific event handlers (output, stopped, thread) and generic 'event' handler (L516-575)
- **Event Body Extraction:** Emits event.body for specific handlers, full event for generic (L536-537)

#### 5. Child Session Integration (L870-1133)
- **Child Lifecycle Tracking:** Handles childCreated, childEvent, childClosed events from ChildSessionManager (L871-902)
- **Request Routing:** Routes child-scoped commands to active child session when policy requires (L1021-1057)
- **Child Session Waiting:** Polls for child readiness with timeout for adoption-dependent commands (L1059-1102)
- **Breakpoint Mirroring:** Stores breakpoints in ChildSessionManager during setBreakpoints (L975-1019)

#### 6. Reverse Request Handling (L1135-1328)
- **Policy Delegation:** Routes reverse requests (runInTerminal, startDebugging) to adapter policy handlers (L1172-1200)
- **Child Session Creation:** Creates child sessions based on policy decisions with configuration deferral (L1202-1240)
- **Error Resilience:** Falls back to default responses when policy handlers fail (L1242-1265)

#### 7. Configuration Management (L809-868)
- **Configuration Deferral:** Delays configurationDone requests when `deferParentConfigDoneActive` is true (L810-867)
- **Timeout Handling:** 1500ms timeout for deferred configuration with immediate execution in tests

#### 8. Error Handling & Resilience (L1356-1405)
- **Socket Write Failures:** Rejects requests and clears pending entries when write fails (L1357-1374)
- **Missing Socket Detection:** Proper error messages when socket is unavailable (L1376-1383)
- **Graceful Degradation:** Logs errors without crashing on invalid operations (L1385-1404)

### Testing Utilities

**Message Creation:**
- `createDapMessage(content)` (L78-82): Creates properly formatted DAP messages with Content-Length headers
- `splitBuffer(buffer, chunkSizes)` (L85-96): Fragments messages for partial delivery testing

**Mock Management:**
- `beforeEach()` (L98-109): Resets mocks and creates fresh client instance
- `afterEach()` (L111-117): Shuts down client and restores mocks

**Timer Mocking:**
- Deterministic timeout handling for 30-second request timeouts (L461-472)
- Configuration deferral timeout simulation (L813-832)

### Key Behavioral Patterns

1. **Request Lifecycle:** seq counter increment → pending request storage → timeout setup → response correlation → promise resolution
2. **Child Session Routing:** Policy consultation → child availability check → request delegation or parent fallback
3. **Error Propagation:** Connection-phase errors reject promises; post-connection errors emit events
4. **Message Buffering:** Raw data accumulation → header parsing → content extraction → JSON deserialization → protocol message handling