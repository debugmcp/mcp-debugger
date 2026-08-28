# Adversarial DAP adapter fixture

`server.mjs` is a deterministic TCP Debug Adapter Protocol scenario player for
integration tests. Tests inject it through the internal `ProxyConfig.adapterCommand`
seam, so it drives the production proxy worker, socket framing, policy handshake, and
parent/worker status IPC without adding a test-only field to the MCP tool schema.

Run it with a port and a JSON scenario:

```text
node tests/fixtures/adversarial-adapter/server.mjs --port 4711 --scenario scenario.json
```

A scenario has command rules plus optional listener behavior:

```json
{
  "commands": {
    "initialize": {
      "dropResponse": true,
      "eventsBeforeResponse": [{ "event": "initialized" }],
      "delayMs": 25
    },
    "launch": { "close": "mid-response", "closeAfterBytes": 12 },
    "*": { "success": true }
  }
}
```

Each command rule supports:

- `dropResponse` and `delayMs`
- `eventsBeforeResponse` / `eventsAfterResponse` (a string, object, or array)
- `junkPrefix` (a string or byte array written immediately before the response)
- `duplicateResponse`
- `success`, `message`, and `body` response overrides
- `close`: `before-response`, `mid-response`, or `after-response`
- `closeAfterBytes` for a mid-response close

At the scenario root, `neverListen`, `listenDelayMs`, and `closeOnConnect` cover
connection-stage failures. Unspecified commands receive a successful minimal response.
The fixture is intentionally not a general fuzzer: scenarios are small JSON documents,
fully deterministic, and focused on adapter-resilience regressions.
