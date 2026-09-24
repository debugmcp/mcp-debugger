# Inspecting launch configuration with mcp-debugger

The regression test in [mcp-server-self-debug.test.ts](../../tests/integration/mcp-server-self-debug.test.ts)
uses an outer mcp-debugger to debug an inner mcp-debugger while the inner server launches a Node
target. This makes configuration handling observable at the point where it affects execution.

After installing dependencies and building, run:

```bash
pnpm exec vitest run --project integration tests/integration/mcp-server-self-debug.test.ts
```

The test named `inspects its own launch configuration and steps past the decision to keep an entry stop`
sets conditional source breakpoints in the inner server at launch preparation and at the core's
entry-stop decision. It evaluates local variables and steps over those statements through MCP.
Only the inner target's launch matches the conditions, so the outer session can continue servicing
its own debugging requests.

The target request deliberately combines `dapLaunchArgs.stopOnEntry: false` with
`adapterLaunchConfig.stopOnEntry: true`, a relative environment file, a null environment override,
a malformed `outFiles`, and a misspelled `sourceMapPathOverides`.

| Observation | Before the fixes | With the fixes |
| --- | --- | --- |
| Entry-stop intent | Worker sees `true`, core sees `false` and resumes entry | Both see `true`; `shouldAutoContinue` is `false` |
| Configuration notices | Malformed/unknown inputs absent from the response | Notices survive setup's per-launch reset and reach the response |
| Environment file | Inherited values shadow the file | File values reach the target |
| Null override | Inherited variable remains | DAP carries `null`; target has no such variable |
| File's Node option | File option is lost | Target's `Error.stackTraceLimit` is `37` |

The test prints the following sanitized evidence (the `removed` field in the target observation
means whether the variable still exists):

```json
{
  "prepared": { "core": true, "worker": true, "value": "file", "removed": null },
  "decision": { "requested": true, "core": true, "shouldAutoContinue": false, "reason": "entry" },
  "target": { "value": "file", "removed": false, "nodeEnv": "production", "stackLimit": 37 }
}
```

This exercise reproduced [#791](https://github.com/debugmcp/mcp-debugger/issues/791) and
[#792](https://github.com/debugmcp/mcp-debugger/issues/792) while investigating
[#709](https://github.com/debugmcp/mcp-debugger/issues/709). The independent
[launch integration suite](../../tests/integration/javascript-launch-config.test.ts) additionally
checks both entry-stop override directions, restart, warning reset, dry runs, failed preparation,
explicit environment overrides and exit-code recording under `noDebug`.
