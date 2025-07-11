

# Debug Adapter Protocol (DAP) State Transitions and Debugger Behavior

## 1. DAP Protocol Specification for Termination Events

The Debug Adapter Protocol defines several events related to program execution and termination. The key events are:

* **`stopped` Event:** Indicates the debuggee is *paused* due to some condition (breakpoint hit, step completion, pause request, exception, etc.). This event signals a *break in execution*, not an end-of-program. In a paused state, the program is halted but *still loaded* in memory (e.g. waiting at a breakpoint).

* **`continued` Event:** Indicates the debuggee has resumed execution after being in a stopped state. According to the DAP spec, a `continued` event is typically *not sent* if the resume was explicitly requested by the client (e.g. after a `continue` request). It’s mainly used for spontaneous resumes or to broadcast resume state in multi-threaded scenarios.

* **`exited` Event:** Indicates the debuggee program (the target process) has actually exited, and it carries the exit code of the program. This event corresponds to the *termination of the debuggee process*. It is often sent when a debugged program ends normally or is terminated, allowing the client/UI to know the process ended and to display the exit code if needed.

* **`terminated` Event:** Indicates that the *debugging session* has ended (the adapter is terminating debugging of the debuggee). Importantly, the spec notes this does *not* necessarily mean the debuggee process itself has exited. For example, an adapter could terminate a session by detaching from a running process (in which case debugging ends but the process continues running). In all situations where the debug session is ending (for any reason), the adapter must fire a `terminated` event to notify the client that no further debugging is occurring. The `terminated` event may include an optional `restart` field to signal the client to automatically restart a session (used in some workflows like debugger self-restart).

**Difference between “stopped” and termination events:** A `stopped` event means **paused** in the middle of debugging (e.g. at a breakpoint) – the session is still active and can continue. Termination events (`terminated`/`exited`) mean the debuggee has finished execution or the session is ending. After a program completes execution, the debug session should *not remain in a stopped/paused state*; it should transition to a **terminated** state (session ended). In other words, once the program is done (or the user explicitly stops debugging), the adapter should signal that debugging is over. A general rule (from the DAP overview) is: *if a debug adapter is ending a session, it must send a `terminated` event; if the debuggee actually exits and the adapter knows the exit code, it should send an `exited` event as well* (the exited event is optional but provides the exit code to the client).

Thus, after the program completes execution (naturally or via user stop), the **expected state** is that the debug session is terminated (ended). The UI will typically show the session as ended or removed. For example, in one debugger's documentation: *"A session terminates automatically when the program completes execution."*. The debug adapter signals this via the `terminated` event (and possibly an `exited` event if applicable), after which the client will typically perform cleanup (often sending a `disconnect` request to the adapter to formally end the connection).

## 2. Real Debugger Implementations – Termination Behavior

Different language debug adapters implement these events in practice, sometimes with slight variations or extra steps due to runtime specifics. Below is how a few real-world debuggers handle program termination:

### **Python (debugpy)**

The **debugpy** adapter (used in VS Code for Python) follows the DAP closely: when a debugged Python program finishes, debugpy will send an `exited` event (with the process’s exit code) followed by a `terminated` event. This ensures the IDE knows the program ended and the debugging session is over. In fact, the predecessor to debugpy (PTVSD) explicitly implemented the sequence of sending both events before shutting down: upon a normal disconnect or program end, it would *“send the exited and terminated event, then kill itself”* – a design considered “clean and consistent” by its maintainers. This means the Python debug adapter always tries to report the program’s exit code and then indicate the session is done.

One nuance in Python debugging is handling an abnormal exit or `sys.exit()` calls. For example, if a program calls `sys.exit(1)` (an exit with error code), older PTVSD/debugpy versions treated this as an exception to break on. There was discussion on whether an exit with a non-zero code should be considered an "uncaught exception" or just normal termination (so behavior could vary based on settings). In normal configurations, however, an exit (even with code 1) will simply terminate the program — debugpy will not leave the session in a stopped state but proceed to send the termination events. The debugpy adapter also has a feature to wait for user input on program exit (for console applications) – when enabled, it will delay sending the termination events until the user acknowledges, to keep the console open. Only after that does it send the `terminated` event (and `exited` if applicable). In summary, **debugpy emits**: `exited` (with code) → `terminated` (session ended) in a normal shutdown. This matches the DAP requirement that the session is closed out with a terminated notification to the client.

### **Node.js (vscode-node-debug2)**

The **node-debug2** adapter (Node.js debug adapter used in VS Code before the newer unified js-debug) also sends the standard termination events, but it had to account for Node runtime specifics. Normally, when a Node program being debugged ends, the adapter will capture the process exit event and then notify the client. It will typically send an `exited` event with the Node process’s exit code, then a `terminated` event to end the session (in practice, VS Code’s Node debug shows the exit code in the debug console and ends the session).

However, a historical quirk: in certain versions of Node, if a debugger was attached, Node would **not fully exit on its own** until the debugger detached. The Node process would pause at the end waiting for the debug connection to close. This meant the adapter wouldn’t get a normal “process exited” signal immediately. As an example, one issue noted: *“when the script terminates and a debugger is attached, Node waits for the debugger to detach before quitting, but the debugger has no way to know”*. In other words, Node.js could reach the end of script but stay alive waiting for the adapter. The node-debug2 implementation had to handle this. The resolution was to detect end-of-script and proactively detach/terminate the session. In practice, node-debug2 listened for the Node process’s output message `"Waiting for the debugger to disconnect..."` or used Node’s close events to infer termination. Once detected, it would send the `terminated` (and possibly `exited`) events to VS Code.

For Node, the **event order** might differ slightly depending on how it’s implemented. Some versions might have sent `terminated` before `exited` due to how the adapter was coded. But the **recommended sequence** (and what newer Node debug adapters do) is to send the `exited` event as soon as the process ends to report the code, then send `terminated` to signal the end of the debugging session. Regardless of order, node-debug2 ensures both events are fired. After `terminated`, VS Code will respond by terminating the debug session (and will send a `disconnect` request if needed to detach). In summary, **node-debug2 emits**: `exited` (with code, if known) → `terminated` (session over). It also takes care to detach so that the Node process can actually exit in older Node versions.

### **Go (Delve)**

The **Delve** debugger (which has a DAP mode, often invoked via `dlv dap`) likewise follows the protocol. According to the Delve DAP documentation, *when the debugged program terminates, Delve sends a `terminated` event*, and it expects the client (IDE) to then issue a `disconnect` request to finish the session (and shut down the adapter). This design implies that Delve treats the `terminated` event as the primary signal that “the debug session is done.” Delve will also send an `exited` event if it knows the program’s exit code. In practice, Delve’s adapter will report the process exit with a code (if it was a launched process) via an `exited` event, and then send `terminated`. (If you attach to an external process and then detach, Delve would just send `terminated` since the process is still running and there is no exit code to report.)

One particular difference in Delve’s design is that the **`terminated` event triggers the client to clean up**. The VS Code Go extension, upon seeing `terminated`, will send a `disconnect` to Delve DAP, which then causes Delve to shut down the debugger backend. In effect, **Delve emits**: `exited` (with code, on program end) → `terminated` → (then awaits `disconnect` from client). If the debug session is ended by user (stop command), the sequence is similar except the client may initiate a `terminate` or `disconnect` request first, and Delve will still emit `terminated` during the shutdown.

### **Comparison of Termination Handling**

To summarize the behaviors of these adapters, here’s a comparison:

| **Debug Adapter**         | **Normal Program End Behavior**                   | **Events Emitted (order)**                                | **Notes**                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **debugpy (Python)**      | Detects Python script exit (including exit code). | `exited` (with exit code) → `terminated`                  | Always sends both events on a normal exit to signal end. Handles special cases like `sys.exit()` as normal termination (no lingering pause). May delay termination if configured to wait for input on exit.                                                                               |
| **node-debug2 (Node.js)** | Detects end-of-script or process exit.            | `exited` (with code) → `terminated` *(order in practice)* | Sends both events. Had to work around Node’s behavior of waiting for detach – the adapter ensures it sends `terminated` to close session, allowing Node process to exit. In attach scenarios, if user disconnects, it might only send `terminated` (since the process continues running). |
| **Delve (Go)**            | Detects program termination.                      | `exited` (with code) → `terminated`                       | Sends `terminated` event to indicate session should end, and expects a client `disconnect`. In attach mode (no process exit), an `exited` event isn’t sent – just `terminated` on detach.                                                                                                 |

*Note:* Nearly all debug adapters follow the rule that **the session ends with a `terminated` event**. The `exited` event is used when applicable to convey the exit code or confirmation that the debuggee process ended. Some adapters might emit these in quick succession such that the order doesn't visibly matter to the user, but the sequence above (exit then terminate) is typical. Importantly, a `stopped` event is **not** used for program end – receiving `stopped` means a pause, whereas `terminated`/`exited` mean finish.

## 3. State Naming Conventions Across Debuggers

When describing debugger state, common terms are used across many tools, even if not formally defined by DAP. Typically, you’ll encounter states such as:

* **Running** – the debuggee is actively running (no current break/pause). The debugger is simply waiting for events (or for user commands). This corresponds to times between breakpoints or after a continue command.
* **Paused (Stopped)** – the debuggee is suspended at a breakpoint or due to a pause request or exception. In VS Code UI, this is shown as "Paused on <reason>". Many adapters internally refer to this as the "stopped" state since DAP’s event is named `stopped`. (Some documentation uses *paused* for user-friendly wording, but technically it’s the same as a stopped event state.)
* **Terminated** – the debuggee program has finished execution or the debugging session has ended. No code is running under the debugger’s control anymore. Some may also use the word **Ended** for the session state here. Once terminated, the session typically cannot be resumed (you would have to restart a new debug session).

There isn’t an official enforced naming convention for these states in all debuggers’ code, but the concepts are consistent. For example, a debugger might implement an internal state machine with enum values like `STATE_RUNNING`, `STATE_PAUSED`, `STATE_TERMINATED`. The DAP events map onto these concepts: a `stopped` event signals the transition to *paused*, a `continued` event or a continue response signals *running*, and a `terminated` event signals *terminated*.

**All debuggers distinguish**:

* **Active vs Paused:** Whether the debuggee is currently running or halted at a debug stop.
* **Active vs Terminated:** Whether the session is ongoing or completely finished.

In usage, the term “stopped” can be confusing – in DAP it means *paused*, not “stopped debugging”. To avoid confusion, many UIs say “Paused” for a stopped event. Conversely, “terminated” is unambiguous as session finished. As a best practice for a mock debugger implementation, one can use names like **“Running”**, **“Paused”**, and **“Terminated”** for the session states. This aligns with user expectations and most debugger UIs. Some might include an **“Initializing”** state at the very start (during launch/attach setup), and perhaps a **“Disconnected”** state after termination (once the adapter is fully shut down). But generally, running/paused/terminated cover the main lifecycle.

## 4. Typical Event Sequences for Program Resumption and Termination

Different debug scenarios produce different sequences of events. Below are step-by-step sequences for a common scenario, along with notes if variations occur in different debuggers:

### **Scenario:** Hit a Breakpoint, Then Continue to Program End

1. **Breakpoint Hit:** The program hits a breakpoint. The debug adapter sends a **`stopped` event** with reason `"breakpoint"` (and the thread ID, etc.) to notify the client that execution is paused at a breakpoint. At this point, the debugger state is *paused*.
   **(Client may query stack frames, variables, etc. at this time.)**

2. **User Continues:** The user resumes execution (e.g. presses "Continue" in the IDE). The client sends a `continue` request to the debug adapter. In response, the adapter resumes the debuggee. Since the continue was explicit, the adapter **may not send a `continued` event** (the DAP spec notes this is optional because the client knows it issued a continue). Many adapters simply omit the `continued` event here. *(If the adapter did not receive an explicit request – e.g. program auto-continues after a step – it would send a `continued` event to update the UI.)* For clarity, we'll assume no `continued` event is sent in this manual continue case.

3. **Program Runs to Completion:** After resuming, the program executes the rest of its code and eventually exits (for example, reaches the end of `main()` or calls an exit function).

4. **Debuggee Process Exits:** The debug adapter detects that the target process has ended. It then sends an **`exited` event** to the client, providing the process exit code (e.g., 0 for success). This informs the IDE of the actual program outcome. (If the adapter is in *attach mode* and the program ended on its own, it would still do this if it can detect the termination. In a detach scenario where the program continues running, no exited event would be sent because the program didn’t end.)

5. **Debug Session Termination:** Immediately after signaling the process exit, the adapter sends the **`terminated` event**. This indicates that the debugging session is ending. The adapter will no longer send any further debug events for this session. The client, upon receiving `terminated`, knows it can clean up the UI and will typically send a `disconnect` request to the adapter to finalize the shutdown (this is often automatic in IDEs). For example, the Go Delve adapter expects the terminated event to *trigger* the client’s disconnect. The ordering of `exited` and `terminated` is usually as described: first exit code, then session end. (If an adapter ever sent `terminated` first, the client would still get the exit event, but it might be handled slightly differently. The conventional approach is exit then terminate.)

6. **Session Ends:** The client sends a `disconnect` request (if needed) and the debug adapter shuts down the debugging session entirely. Any UI indicators (like debug toolbar, variables view, etc.) are removed since the session is over. The state is now **terminated** – no process is being debugged. If the user restarts or a `restart` was indicated, a new session would begin afresh.

**Sequence summary:**

```text
[ Program running ]  
→ (Breakpoint hit)  
→ Adapter sends 'stopped' (reason: breakpoint)  
→ User resumes (continue request)  
→ [ Program continues running ]  
→ Program ends naturally  
→ Adapter sends 'exited' (exitCode: N)  
→ Adapter sends 'terminated'  
→ Client cleans up (disconnects session)
```

This sequence (paused → continued → exited → terminated) is the typical flow when execution goes from a break to completion. All three event types (`stopped`, `exited`, `terminated`) appear in this lifecycle with distinct meanings.

### **Other Scenarios and Variations:**

* **Program runs to end without any breakpoints:** In this case, there would be no `stopped` event at all. The sequence would simply be: the program runs → exits → adapter sends `exited` → adapter sends `terminated`. From the user perspective, the debug session just ends when the program finishes (perhaps the console closes or a message like "Process exited with code 0" is shown, then the session terminates).

* **User stops the program manually:** If the user presses a "Stop" button, the client might send a `terminate` request or `disconnect` request to the adapter. The adapter will then end the program (e.g., kill the process if it launched it, or detach if attached). The adapter still should send a `terminated` event to signal the session is ending (even if the stop was user-initiated). If the program was killed, an `exited` event may or may not be sent depending on if the adapter was able to capture an exit code (sometimes a forced kill might not have a meaningful exit code, but typically it would be treated as exit code 0 or a specific code). The sequence in that scenario: (User stop request) → adapter possibly sends `terminated` immediately (and kills process) → maybe an `exited` if there is an exit code to report. The key is that `terminated` is always emitted once debugging stops.

* **Exception causes program to end:** If the debuggee crashes or encounters an unhandled exception that terminates it, the adapter might first send a `stopped` event with reason `exception` (if it breaks on the exception). If the user doesn’t intervene and the program truly crashes/exits, the adapter will then send the `exited` and `terminated`. In some configurations, adapters are set to break on all uncaught exceptions – giving a chance to inspect – which would be a `stopped` event, and if the user then continues, the program may immediately exit, leading to the exit/terminated events as usual.

* **Attach/detach scenario:** In attach mode, if the user disconnects but the program keeps running, the adapter would send `terminated` (to end the session) *without* an `exited` (since the debuggee didn’t end, it’s simply that the debugger detached). For instance, attaching to a long-running server and then detaching would result in a `terminated` event only. Conversely, if the process exits on its own while attached, the adapter would ideally send both `exited` and `terminated` (the session ends because the process died).

In all cases, the **final event** marking the end of a debug session is `terminated`. The client (IDE) uses that as the cue that no further debug interaction is possible for that session. The **`stopped` event is never used to signal session end** – it's strictly for pause states during an active session. By adhering to these sequences and state transitions, a debugger (or a mock adapter) can ensure it behaves in line with user expectations and the DAP spec, regardless of which IDE is controlling it.

**Sources:**

1. Microsoft Debug Adapter Protocol Specification – definitions of `stopped`, `continued`, `exited`, and `terminated` events
2. Progress Documentation (OpenEdge Debugger) – note on session terminating when program ends
3. Node Debug2 Issue – describes Node waiting for debugger detach on program end
4. PTVSD GitHub Issue – describes sending `exited` and `terminated` on disconnect (precursor to debugpy)
