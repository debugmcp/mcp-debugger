# mcp-debugger documentation

Everything here describes the current code. Historical material lives in
[`archive/`](archive/) and [`releases/`](releases/) and is deliberately not maintained.

## Start here

| | |
|---|---|
| [Quickstart](quickstart.md) | The copy-paste path: install, register with a client, debug something. |
| [Getting started](getting-started.md) | The same ground, narrated, with a worked Python session. |
| [Diagnostics](diagnostics.md) | `mcp-debugger doctor`, the per-language prerequisites table, and what to reach for when a language will not start. |
| [Troubleshooting](troubleshooting.md) | Symptoms and fixes. |
| [Known issues](KNOWN_ISSUES.md) | Current caveats worth knowing before you hit them. |

## Using the debugger

| | |
|---|---|
| [Tool reference](tool-reference.md) | All 28 tools: parameters, response shapes, error cases. The authoritative API doc. |
| [Usage guide](usage.md) | The session golden path and how the tools compose. |
| [Agent debugging guide](agent-debugging-guide.md) | Tool-usage patterns for AI agents driving the server. |
| [Stack trace filtering](stack-trace-filtering.md) | Why frames are hidden, and how to see them anyway. |
| [Multiple MCP servers](multiple-mcp-servers.md) | Running mcp-debugger alongside other servers. |

The agent skill in [`skills/debugging/`](../skills/debugging/) is the procedural
companion to the tool reference: when to debug rather than print, bisection
discipline, and per-language quirks.

## Languages

| | |
|---|---|
| [Python](python/README.md) | debugpy: launch, attach, path mapping. |
| [JavaScript / TypeScript](javascript/README.md) | js-debug, source maps, child sessions. |
| [Ruby](ruby/README.md) | rdbg, including remote attach into containers and pods. |
| [Rust](rust-debugging.md) | CodeLLDB and Cargo ([Windows specifics](rust-debugging-windows.md)). |
| [Go](go/README.md) | Delve's native DAP. |
| [Java](java/README.md) | The JDI bridge, JDWP attach, and class hot-swap. |
| [.NET / C#](dotnet/README.md) | netcoredbg and portable PDBs. |
| [C / C++](cpp/README.md) | CodeLLDB: prebuilt binaries, auto-compile, attach by PID, core dumps. |

## Deployment

| | |
|---|---|
| [Docker support](docker-support.md) | Which languages the image debugs, and the container lifecycle. |
| [Kubernetes](kubernetes.md) | Port-forward attach and the ephemeral debug sidecar, with [manifests](../examples/kubernetes/). |
| [Just-in-time diagnostics](jit-diagnostics/README.md) | A worked sick-pod investigation. |

## Architecture and internals

Start with the [architecture overview](architecture/README.md); it indexes the rest.
[System overview](architecture/system-overview.md) is the map,
[component design](architecture/component-design.md) the per-module detail, and
[adapter development](architecture/adapter-development-guide.md) the guide to adding a language.
Cross-cutting patterns are in [`patterns/`](patterns/), and the
[logging format](logging-format-specification.md) and
[error handling](error-handling-guide.md) specs sit alongside.

## Contributing

[Setup](development/setup-guide.md) ·
[build pipeline](development/build-pipeline.md) ·
[testing](development/testing-guide.md) ·
[debugging the server itself](development/debugging-guide.md) ·
[git hooks](development/git-hooks-guide.md) ·
[commit workflow](commit-workflow.md) ·
[DAP sequence reference](development/dap-sequence-reference.md)

Release and CI: [release checklist](release-checklist.md) ·
[validation script](validation-script.md) ·
[local Act runs](ACT_LOCAL_CI_TESTING.md) ·
[assurance case](assurance-case.md)

## Case studies

mcp-debugger debugging real failures, several of them its own. These are narratives
fixed in time, not reference material.

- [The initialize response that never came](case-studies/rdbg-initialize-response-stall.md) — stepping through its own DAP client to root-cause a Ruby launch stall.
- [Attaching the debugger to itself](case-studies/self-attach-fork-release-and-the-500ms-ack-window.md) — live-patching a running server through `evaluate_expression`.
- [The pause that always succeeded](case-studies/js-attach-pause-and-the-smart-stepper.md) — js-debug's smart-stepper eating user pauses.
- [The zombie worker and the frozen force-kill](case-studies/the-zombie-worker-and-the-frozen-force-kill.md)
- [The trace that couldn't name its socket](case-studies/trace-that-couldnt-name-its-socket.md) — measure-fix-measure on the diagnostics themselves.
- [The bug report that couldn't happen](case-studies/the-bug-report-that-couldnt-happen.md) — refuting a filed issue by setting breakpoints in the server's own dist.
