# tests\exploratory\results-local-sse.json
@source-hash: f18bc8c1aa01351b
@generated: 2026-02-24T01:54:06Z

Test results JSON file containing outcomes from local Server-Sent Events (SSE) exploratory testing session.

**Primary Purpose:** Records test execution results for debugging/development tool validation with 15 test cases covering core functionality and edge cases.

**Structure:**
- Summary metrics (L2-4): total/passed/failed counts showing 100% pass rate
- Results array (L5-81): detailed test case outcomes with names, status, and duration

**Test Coverage Areas:**
- **Tool enumeration** (L7-9): Basic tool listing and count verification
- **Language support** (L12-14): Supported programming languages query
- **Session management** (L17-19, L67-69, L72-74): Debug session lifecycle and cleanup
- **Multi-language debugging** (L22-35): Full debug workflows for Python, JavaScript, and Go
- **Edge case handling** (L37-59): Error conditions, invalid operations, syntax errors, concurrent sessions
- **Source context** (L62-64): File content retrieval functionality  
- **Path handling** (L77-79): Special characters and spaces in file paths

**Performance Insights:**
- Quick operations (2-39ms): tool listing, language queries, basic validation
- Medium operations (1-13s): full debug workflows, session cleanup
- Heavy operations (37s): edge case testing with program termination

**Test Environment:** Local SSE implementation, likely part of a debugging service or IDE integration testing suite.