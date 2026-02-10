# tests/unit/proxy/minimal-dap.test.ts
@source-hash: 6140744ebd903e19
@generated: 2026-02-10T00:41:43Z

# MinimalDapClient Test Suite

## Overview
Comprehensive test suite for `MinimalDapClient` class, focusing on DAP (Debug Adapter Protocol) communication, message handling, and child session management. Uses Vitest framework with extensive mocking of network and logging dependencies.

## Key Components

### Test Infrastructure (L1-117)
- **Mock Setup**: Network (`net` module L12), logger (`createLogger` L25-36), and socket creation (L63-75)
- **Logger Tracking**: Hoisted storage for mock logger instances (L15-22) to enable assertions across test boundaries
- **Helper Functions**: 
  - `createDapMessage()` (L78-82): Creates properly formatted DAP protocol messages with Content-Length headers
  - `splitBuffer()` (L85-96): Splits messages into chunks for partial message testing
  - `createMockSocket()` (L63-75): Creates EventEmitter-based socket mocks with write/end/destroy methods

### Connection Management Tests (L119-191)
- **Basic Connection**: Socket creation with host/port configuration (L120-128)
- **Error Handling**: Connection errors don't trigger event handlers during connection phase (L130-154)
- **Lifecycle Events**: Close and error event propagation after successful connection (L156-190)

### Message Parsing Tests (L193-340)
- **Complete Messages**: Full DAP message parsing with proper JSON extraction (L194-211)
- **Partial Messages**: Multi-chunk message assembly across data events (L213-234)  
- **Multiple Messages**: Single data event containing multiple DAP messages (L236-262)
- **Error Resilience**: Malformed headers (L264-272), invalid JSON (L274-283), and invalid Content-Length handling (L285-323)
- **Edge Cases**: Incomplete message bodies and data reconstruction (L325-339)

### Request/Response Handling Tests (L342-513)
- **Request Formatting**: Proper DAP request structure with sequence numbers (L343-369)
- **Response Correlation**: Matching responses to requests via sequence numbers (L371-391)
- **Error Responses**: Failed request handling with error messages (L393-410)
- **Concurrency**: Multiple simultaneous requests with out-of-order responses (L412-456)
- **Timeout Behavior**: 30-second request timeout with deterministic timer mocking (L458-490)
- **Unknown Responses**: Graceful handling of orphaned response sequences (L492-505)

### Event Handling Tests (L515-576)
- **Event Emission**: DAP events forwarded to client event handlers (L516-538)
- **Multiple Event Types**: Different DAP event types (stopped, thread, output) (L540-575)

### Child Session Integration Tests (L870-1133)
- **Child Session Manager**: Mock `ChildSessionManager` stub creation (L42-60, L871-902)
- **Lifecycle Tracking**: Child creation, event forwarding, and cleanup (L871-902)
- **Request Routing**: Commands routed to active child sessions based on policy (L1021-1057)
- **Adoption Waiting**: Polling for child session readiness with timeout handling (L1059-1132)
- **Breakpoint Mirroring**: Breakpoint synchronization to child sessions (L975-1019)

### Reverse Request Handling Tests (L1135-1328)
- **Policy Delegation**: Reverse request handling via `DapClientBehavior.handleReverseRequest` (L1172-1200)
- **Child Creation**: Child session creation triggered by policy decisions (L1202-1240)
- **Configuration Deferral**: Parent configuration deferral during child adoption (L1202-1240)
- **Error Resilience**: Fallback to default responses when policy handlers fail (L1242-1265)

## Key Dependencies
- **External**: `@vscode/debugprotocol` for DAP types, `@debugmcp/shared` for policies
- **Internal**: `MinimalDapClient` (L5), `ChildSessionManager` (L6), logger utilities (L25)

## Test Patterns
- **Mock Socket Strategy**: EventEmitter-based sockets with write callback simulation
- **Timer Manipulation**: Deterministic timeout testing with custom timer implementations
- **Error Injection**: Strategic error injection for resilience testing
- **Async Coordination**: Promise-based test coordination for concurrent scenarios