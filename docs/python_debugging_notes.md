# Python Debugging with `debugpy` - Integration Notes

This document outlines key findings and specific behaviors encountered while integrating the `debug-mcp-server` with `debugpy.adapter` for Python debugging using the Debug Adapter Protocol (DAP).

## `debugpy.adapter` DAP Message Sequence

The most critical aspect for successful integration was understanding the specific DAP message sequence expected by `debugpy.adapter`. While the DAP specification allows for some flexibility, `debugpy` has a particular order for initialization and configuration:

1.  **`initialize` Request**: The client (our `dap-proxy.ts`) sends an `initialize` request to `debugpy.adapter`.
2.  **`initialize` Response**: `debugpy.adapter` responds, indicating its capabilities.
3.  **`launch` Request**: The client **must** send a `launch` (or `attach`) request *before* `debugpy.adapter` considers itself fully initialized for further configuration. This request includes the script to run, `stopOnEntry` flags, etc.
4.  **`initialized` Event**: After processing the `launch` request and the debuggee (Python script) has started (and potentially paused at entry), `debugpy.adapter` sends an `initialized` event back to the client. This event signals that the adapter is now ready for breakpoint configuration and other setup.
5.  **`setBreakpoints` Request(s)**: Upon receiving the `initialized` event, the client can now send `setBreakpoints` requests for any pending breakpoints.
6.  **`configurationDone` Request**: After breakpoints are set (if any), the client sends a `configurationDone` request.
    *   **Important**: Attempting to send `configurationDone` *before* the `launch` request (and subsequent `initialized` event) will result in a DAP error from `debugpy.adapter` stating that `configurationDone` is only allowed during the handling of a `launch` or `attach` request.
7.  **Debugging Commences**: The debugging session is now fully active. The script might be paused (e.g., at `stopOnEntry` or an early breakpoint), and the client can send further DAP commands (step, continue, get variables, etc.).

This sequence is implemented across the refactored proxy modules: `src/proxy/dap-proxy-worker.ts` handles the proxy worker lifecycle, `src/proxy/dap-proxy-core.ts` contains the core DAP message processing logic, and `src/proxy/dap-proxy-connection-manager.ts` manages the adapter connection. Event handling follows the policy-based approach via `AdapterPolicy` (defined in `packages/shared/src/interfaces/adapter-policy.ts`), where each language adapter provides a policy that governs initialization sequencing, command queueing, and state transitions.

## Scope Resolution and Variable Inspection

When inspecting variables, the following DAP flow is used:

1.  **`get_stack_trace`**: Retrieves the current call stack. Each `StackFrame` in the response has an `id` (referred to as `frameId`).
2.  **`get_scopes`**: Called with a `frameId` from the stack trace. `debugpy.adapter` responds with a list of available scopes for that frame (e.g., "Locals", "Globals"), each having its own `variablesReference`.
3.  **`get_variables`**: Called with a `variablesReference` obtained from a specific scope (e.g., the "Locals" scope's `variablesReference`) to retrieve the variables within that scope.

**Observations with `debugpy` for Simple Scripts:**

*   For simple Python scripts with a shallow call stack (e.g., a top-level script calling a single function defined at the module level, like `debug_test_simple.py`), `debugpy.adapter`'s `stackTrace` response may not report a distinct, named stack frame for the currently executing function. Instead, it might only show the top-level `<module>` frame, even if execution is paused inside the function.
*   In such cases, the `variablesReference` for the "Locals" scope associated with this `<module>` frame typically points to module-level local/global variables, not the local variables defined within the function that is currently executing.
*   To reliably inspect local variables of a specific function, it's often necessary that `debugpy` reports a distinct stack frame for that function. This is more likely to occur with deeper call stacks or more complex program structures. When a distinct frame for the function *is* reported, using its `frameId` with `get_scopes` will yield a "Locals" `variablesReference` that correctly resolves to the function's local variables (e.g., `a` and `b` in `sample_function` when paused at line 14 of `debug_test_simple.py` after a `continue` from `stopOnEntry`).

These notes should help future development and troubleshooting related to Python debugging via `debugpy`.
