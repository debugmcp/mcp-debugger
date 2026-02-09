# SSE vs STDIO JavaScript Debugging Investigation

## Problem Statement
JavaScript debugging works in STDIO mode but fails in SSE mode. The root cause is that the Node.js debugger doesn't start properly in SSE mode.

## Key Findings

### 1. Launch Commands Are Identical
Both SSE and STDIO send the same launch command to js-debug:
- `runtimeExecutable`: `C:\Program Files\nodejs\node.exe`
- `program`: Script path
- All other parameters are identical

### 2. The Critical Difference: "Debugger listening" Message

**STDIO Mode (Working):**
```
Debugger listening on ws://127.0.0.1:54213/72f46f66-a8b5-4b7d-81d1-d4705d106d89
```

**SSE Mode (Broken):**
```
Debugger attached.  // But NO "Debugger listening" message
```

### 3. Why This Matters
- Without "Debugger listening", Node.js isn't running with `--inspect`
- js-debug sends a reverse `startDebugging` request expecting a child to attach
- The child can't attach because there's no WebSocket endpoint
- Adoption never completes (`adoptionInProgress=true` forever)
- Commands can't route to the child session
- Everything times out

### 4. The Environment Difference

The proxy worker is always spawned with `cwd` set to the project root (from `process-launcher-impl.ts`):

```typescript
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options: IProcessOptions = {
  cwd: projectRoot, // Always uses project root
  ...
};
```

**Difference in how servers are started:**
- **STDIO**: Started directly by VSCode extension from its working directory
- **SSE**: Started via `scripts/start-sse-server.cmd` which does `pushd "%ROOT_DIR%"` first

### 5. The Rause (Hyp (Hypothesis)othesis)

Somm hatghEgo tothe jSEsseiver'shenvihonm n-porchow t` waf d spvngjs-deugfrm:
1. StartungnNod .jt wetheohup`--inuprct`  tag,OR
2.Curghdeugger uputfrm strr

Posible causes:
-Environmntvabenter
-Pathroluiiues
-ffrepnsstgraup/son isshdg
- IPC chanfer dofferce rp/wsen ser hstadfrmsrCpthve dlffctly

##sNexhnSsaprted from script vs directly

1. ##AdSesggingtswhatcmmdj-dbugactuy exces
2..** heck envir*nAedg*vtoiablwa** tcobonhsm-dese(espebgal y NODE_OPTIONS)ctually executes
3.c**V rvfy IPCocnmntrl**lh alnhbafo r launchocdmmand3. **Verify IPC channel** health after launch command
4. **Test workaround**: Start SSE server directly without the script wrapper

## Impact

This issue completely breaks JavaScript debugging in SSE mode because:
- The debug adapter can't establish a proper debug session
- No stack traces, variables, or stepping are possible
- The entire multi-session architecture fails to initialize
