# tests/e2e/test-sse-timing.js
@source-hash: 5b4a6571a13517ce
@generated: 2026-02-09T18:15:12Z

**Purpose:** End-to-end test for reproducing SSE timing issues in Python debugging session initialization. Specifically tests the scenario where `get_stack_trace` is requested immediately after session pause, which can cause request routing problems in production.

**Key Configuration (L15-24):**
- SSE_PORT: 3001 (L16)
- SSE_URL: localhost endpoint (L17) 
- LOG_FILE: writes to `../../logs/sse-timing-test.log` (L18)
- Creates log directory recursively if missing (L22-24)

**Core Functions:**

**log() (L27-35):** Simple logging utility that outputs timestamped messages to both console and log file with optional JSON data formatting.

**makeRequest() (L38-79):** HTTP client for JSON-RPC requests to SSE server. Constructs JSON-RPC 2.0 payloads, handles optional sessionId query parameter, returns parsed JSON response. Uses Node's native HTTP module.

**connectSSE() (L82-128):** Establishes SSE connection and extracts sessionId from initial server response. Parses streaming SSE data format (`data: {...}`), returns both sessionId and connection object. Has 5-second timeout protection.

**checkServerRunning() (L249-261):** Health check utility that tests if SSE server is accessible on configured port via `/health` endpoint. Returns boolean, used for pre-flight validation.

**testPythonDebugTiming() (L131-246):** Main test scenario implementation:
- Creates SSE connection and initializes protocol (L137-148)
- Creates Python debug session (L151-160)  
- Generates temporary test script with breakpoint target (L163-177)
- Sets breakpoint at line 5 of generated script (L180-185)
- Starts debugging with `stopOnEntry: false` (L188-195)
- **Critical timing test:** Immediately requests stack trace after session start (L201-205)
- Validates stack trace response format and content (L208-217)
- Continues execution and cleans up session (L220-227)
- Handles cleanup of temporary files and connections (L235-245)

**main() (L264-283):** Test orchestrator that validates server availability, runs the timing test, and exits with appropriate status codes.

**Architecture Notes:**
- Uses Node.js native HTTP module instead of external dependencies
- Implements custom SSE parsing for session establishment
- Creates temporary Python script dynamically for consistent test conditions
- Focuses on reproducing specific production timing issue where rapid requests after session initialization cause routing problems

**Critical Test Pattern:** The core issue being tested is at L201-205 where `get_stack_trace` is called immediately after `start_debugging`, mimicking production scenarios where SSE timing can cause request misrouting during session initialization phases.