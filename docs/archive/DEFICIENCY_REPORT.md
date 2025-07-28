# MCP Debugger Deficiency Report

## Test: Basic Debugging Workflow
- **Timestamp**: 2025-07-26T11:24:12Z
- **Deployment**: mcp-debugger (local)
- **Test File**: test_basic.py

### Setup
- Created `test_basic.py` and verified its content and line numbers.
- Created debug session: `cb1a28bd-1dcb-4379-bd02-7247d135c79e`
- Set breakpoint at line 6.

### Execution
- `start_debugging` with `sessionId` and `scriptPath`.

### Result
- **Success/Failure**: Failure
- **Error Message**: `Proxy initialization timed out`
- **Session State**: `error`

### Log Entries
*No log entries available yet.*

### Deployment Comparison
| Deployment | Result | Response Time | Notes |
|------------|--------|---------------|--------|
| Local      | FAIL   | ~10s          | Proxy initialization timed out |
| Docker     | FAIL   | ~10s          | Proxy initialization timed out |
| NPX        | SUCCESS| ~12s          | Paused at line 2 (not breakpoint), likely due to implicit `stopOnEntry`. `continue` command correctly stops at breakpoint on line 6. |

## Test: Start Debugging with Non-Existent File
- **Timestamp**: 2025-07-26T11:27:12Z
- **Deployment**: mcp-debugger (local)
- **Test File**: non_existent_file.py

### Setup
- Create debug session.

### Execution
- `start_debugging` with a path to a file that does not exist.

### Result
- **Success/Failure**: PENDING
- **Error Message**: PENDING
- **Session State**: PENDING

### Deployment Comparison
| Deployment | Result | Response Time | Notes |
|------------|--------|---------------|--------|
| Local      | FAIL   | ~10s          | Proxy initialization timed out. The error is the same as with a valid file, suggesting the file path is not the primary cause of failure on this deployment. |
| Docker     | FAIL   | ~10s          | Proxy initialization timed out. The error is the same as with a valid file, suggesting the file path is not the primary cause of failure on this deployment. |
| NPX        | SUCCESS| ~37s          | Returns `success: true` and state `stopped`. Does not hang, but fails to report that the file does not exist. This is a silent failure. |

## Test: Start Debugging with Syntax Error
- **Timestamp**: 2025-07-26T11:31:40Z
- **Deployment**: mcp-debugger (local)
- **Test File**: test_syntax_error.py

### Setup
- Create debug session.

### Execution
- `start_debugging` with a path to a file containing a syntax error.

### Result
- **Success/Failure**: PENDING
- **Error Message**: PENDING
- **Session State**: PENDING

### Deployment Comparison
| Deployment | Result | Response Time | Notes |
|------------|--------|---------------|--------|
| Local      | FAIL   | ~10s          | Proxy initialization timed out. The error is consistent with other failures on this deployment. |
| Docker     | FAIL   | ~10s          | Proxy initialization timed out. The error is consistent with other failures on this deployment. |
| NPX        | SUCCESS| ~38s          | Returns `success: true` and state `stopped`. Fails to report the syntax error in the script. This is a silent failure. |

## Test: Start Debugging with Empty File
- **Timestamp**: 2025-07-26T11:33:48Z
- **Deployment**: mcp-debugger-npx
- **Test File**: test_empty.py

### Setup
- Create debug session.

### Execution
- `start_debugging` with a path to an empty file.

### Result
- **Success/Failure**: PENDING
- **Error Message**: PENDING
- **Session State**: PENDING

### Deployment Comparison
| Deployment | Result | Response Time | Notes |
|------------|--------|---------------|--------|
| Local      | BLOCKED| N/A           | Blocked by proxy timeout issue. |
| Docker     | BLOCKED| N/A           | Blocked by proxy timeout issue. |
| NPX        | SUCCESS| ~8s           | Returns `success: true` and state `paused` with reason `breakpoint`. This is incorrect as there are no breakpoints and no code to execute. The debugger should have completed execution. |

## Test: Session Timeout
- **Timestamp**: 2025-07-26T11:34:36Z
- **Deployment**: mcp-debugger-npx
- **Test File**: N/A

### Setup
- Create debug session.

### Execution
- Wait for a specified duration.
- Attempt to list debug sessions.

### Result
- **Success/Failure**: PENDING
- **Error Message**: PENDING
- **Session State**: PENDING

### Deployment Comparison
| Deployment | Result | Response Time | Notes |
|------------|--------|---------------|--------|
| Local      | BLOCKED| N/A           | Blocked by proxy timeout issue. |
| Docker     | BLOCKED| N/A           | Blocked by proxy timeout issue. |
| NPX        | SUCCESS| N/A           | Session did not time out after 5 minutes of inactivity. All previous test sessions also persisted. This indicates a lack of automatic session cleanup. |
