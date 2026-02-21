# Debug Adapter Development Guide (v0.15.0)

Audience: Adapter authors who want to add a new language to mcp-debugger  
Scope: Full end-to-end instructions to build, test, publish, and troubleshoot a language adapter for the dynamic loading system.

## What is an Adapter?

An adapter is a language-specific component that implements the Debug Adapter Protocol (DAP) behind a common TypeScript interface (`IDebugAdapter`). The mcp-debugger core discovers and loads adapters dynamically at runtime using the package naming convention `@debugmcp/adapter-<language>` and a factory class named `<CapitalizedLanguage>AdapterFactory`.

Benefits:
- Pluggable language support (install only what you need)
- Small core with lazy loading (faster startup)
- Clean separation of concerns (core vs language details)

---

## Package Structure (Recommended)

```
packages/adapter-<language>/
  package.json
  tsconfig.json
  src/
    <Language>Adapter.ts
    <Language>AdapterFactory.ts
    index.ts
  dist/
    (compiled output)
```

Naming conventions:
- Package name: `@debugmcp/adapter-<language>`
- Factory class: `<CapitalizedLanguage>AdapterFactory` (e.g., `PythonAdapterFactory`)
- Default export: `{ name: '<language>', factory: <Language>AdapterFactory }`

Why? The dynamic loader expects the package name and factory class name to follow these conventions.

---

## Step-by-Step Implementation

1) Create the package directory under `packages/`
```
packages/
  adapter-mock/
  adapter-python/
  adapter-yourlang/        ← new package here
```

2) package.json (ESM + proper exports)
```json
{
  "name": "@debugmcp/adapter-yourlang",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist"
  },
  "peerDependencies": {
    "@debugmcp/shared": "^0.14.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

3) Implement `IDebugAdapter` (core contract)
- File: `src/<Language>Adapter.ts`
- Use `packages/shared/src/interfaces/debug-adapter.ts` for signatures

4) Implement the factory extending `AdapterFactory`
- File: `src/<Language>AdapterFactory.ts`
- Extend `AdapterFactory` from `@debugmcp/shared`
- Implement `createAdapter(dependencies)`

5) Export from `src/index.ts` with the required default shape
- Must export named factory class and default `{ name, factory }`

6) Add TypeScript configuration
- File: `tsconfig.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

---

## Minimal Adapter Example

src/ExampleAdapter.ts
```typescript
import { EventEmitter } from 'events';
import {
  AdapterState,
  type IDebugAdapter,
  type AdapterCapabilities,
  type DebugFeature,
} from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';

export class ExampleAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = 'example' as any;
  readonly name = 'Example Debug Adapter';
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private threadId: number | null = null;

  async initialize(): Promise<void> {
    this.state = AdapterState.READY;
    this.emit('initialized');
  }

  async dispose(): Promise<void> {
    this.state = AdapterState.DISCONNECTED;
    this.emit('disconnected');
  }

  getState(): AdapterState { return this.state; }
  isReady(): boolean { return this.state === AdapterState.READY || this.state === AdapterState.DEBUGGING; }
  getCurrentThreadId(): number | null { return this.threadId; }

  async validateEnvironment() { return { valid: true, errors: [], warnings: [] }; }
  getRequiredDependencies() { return []; }

  async resolveExecutablePath(preferred?: string): Promise<string> { return preferred ?? 'example'; }
  getDefaultExecutableName(): string { return 'example'; }
  getExecutableSearchPaths(): string[] { return []; }

  buildAdapterCommand(config: any) {
    return { command: 'example', args: ['--port', String(config.adapterPort)], env: process.env as Record<string, string> };
  }

  getAdapterModuleName(): string { return 'example.adapter'; }
  getAdapterInstallCommand(): string { return 'npm install -g example-adapter'; }

  async transformLaunchConfig(config: any): Promise<any> { return config; }
  getDefaultLaunchConfig() { return { stopOnEntry: true }; }

  async sendDapRequest<T extends DebugProtocol.Response>(_command: string, _args?: unknown): Promise<T> {
    throw new Error('Not implemented');
  }
  handleDapEvent(_event: DebugProtocol.Event): void { /* map events to state; emit as needed */ }
  handleDapResponse(_response: DebugProtocol.Response): void { /* optional */ }

  async connect(_host: string, _port: number): Promise<void> {
    this.state = AdapterState.CONNECTED;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.state = AdapterState.DISCONNECTED;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.state === AdapterState.CONNECTED || this.state === AdapterState.DEBUGGING;
  }

  getInstallationInstructions(): string { return 'Install example adapter per your OS instructions.'; }
  getMissingExecutableError(): string { return 'Example executable not found'; }
  translateErrorMessage(error: Error): string { return error.message; }

  supportsFeature(_feature: DebugFeature): boolean { return false; }
  getFeatureRequirements(_feature: DebugFeature) { return []; }
  getCapabilities(): AdapterCapabilities { return { supportsConfigurationDoneRequest: true }; }
}
```

src/ExampleAdapterFactory.ts
```typescript
import { AdapterFactory, type AdapterDependencies, type IDebugAdapter } from '@debugmcp/shared';
import { ExampleAdapter } from './ExampleAdapter.js';

export class ExampleAdapterFactory extends AdapterFactory {
  constructor() {
    super({
      name: 'example',
      displayName: 'Example',
      description: 'Example adapter',
      minimumDebuggerVersion: '0.14.0'
    });
  }

  async validate() {
    // Optional: verify environment prerequisites here
    return { valid: true, errors: [], warnings: [] };
  }

  createAdapter(_deps: AdapterDependencies): IDebugAdapter {
    return new ExampleAdapter();
  }
}
```

src/index.ts
```typescript
export { ExampleAdapterFactory } from './ExampleAdapterFactory.js';
export default { name: 'example', factory: ExampleAdapterFactory };
```

---

## Testing Your Adapter

Unit tests (Vitest)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleAdapter } from '../src/ExampleAdapter';

describe('ExampleAdapter', () => {
  let adapter: ExampleAdapter;

  beforeEach(() => {
    adapter = new ExampleAdapter();
  });

  it('initializes to READY', async () => {
    await adapter.initialize();
    expect(adapter.isReady()).toBe(true);
  });
});
```

Integration smoke (using the server tools)
- Ensure your adapter is built and discoverable (installed into the same node_modules or available via monorepo fallback)
- From an MCP client or test harness:
  - Call `list_supported_languages` and confirm your language appears
  - Call `create_debug_session` with `"language": "<yourlang>"` and ensure success

Local linking
- `npm pack` and install the generated `.tgz` into your test project
- Or use `npm link` (note: watch out for ESM + symlink constraints; `npm pack` is often more predictable)

---

## Publishing

- Build to `dist/` (`tsc -p tsconfig.json`)
- Publish to npm (`npm publish`)
- SemVer policy:
  - Avoid breaking `IDebugAdapter` contracts across minor versions
  - Use `minimumDebuggerVersion` in factory metadata if the core version is required

---

## Modular adapters and enabling JavaScript

Modularity by default
- mcp-debugger loads adapters dynamically from a fixed catalog using package names `@debugmcp/adapter-<language>`.
- There is no auto-install on first use. Users install or build only the adapters they need.

“Installed” semantics
- list_supported_languages marks an adapter as installed:true when the loader can resolve/import the adapter package (or its dist via monorepo fallback).
- Validation of deeper requirements (e.g., vendor files like js-debug) happens later at session creation/start; discovery remains fast and non-invasive.

Developer workflow (monorepo)
- Build all adapters for local testing:
  - pnpm -w run build:adapters:all
- Build only the JavaScript adapter and vendor js-debug:
  - pnpm -w run dev:js
  - Equivalent steps:
    - pnpm -w -F @debugmcp/adapter-javascript build
    - pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- After building, list_supported_languages should show:
  - available includes javascript with installed:true
  - languages contains a JavaScript/TypeScript entry with defaultExecutable: node

Published/package consumption
- Consumers install only the adapters they need, for example:
  - npm i @debugmcp/adapter-javascript
- The adapter-javascript package includes dist and vendor/js-debug (to support offline/air-gapped use).

Monorepo dynamic loading
- The loader first tries to import the package by name.
- If that fails, it attempts fallback URLs that include:
  - node_modules/@debugmcp/adapter-<language>/dist/index.js
  - packages/adapter-<language>/dist/index.js (handy for monorepo development)
- A small unit test ensures javascript is marked installed:true when only packages/adapter-javascript/dist exists.

Windows notes
- Fallback paths are constructed via file URLs; tests cover resolution on Windows.
- Use Node.js 18+ for the JS adapter and ensure node is on PATH for defaultExecutable behavior.

Verification
- Build and vendor JS:
  - pnpm -w run dev:js
- Build all adapters (optional):
  - pnpm -w run build:adapters:all
- Start the server and call list_supported_languages:
  - javascript appears in available with installed:true
  - languages contains the JavaScript/TypeScript metadata with defaultExecutable: node

## Performance Tips

- Lazy initialization: do minimal work in the constructor and in `initialize()`
- Cache executable discovery results
- First-load vs cached-load:
  - The loader caches the factory in-memory; repeated sessions load instantly
- Preloading:
  - If your deployment benefits, trigger `list_supported_languages` early to prime the loader

---

## Container Notes

- If your adapter uses `which`, remember it depends on `isexe` at runtime in minimal Node images
  - Ensure both are included in the runtime image or avoid shell resolution entirely
- Stdout must be NDJSON-only in stdio mode (no non-JSON output)
  - The runtime entry preloads a silencer that mirrors to `/app/logs/stdout-raw.log` and `/app/logs/stdin-raw.log` without altering protocol framing
- Diagnostics:
  - Use `node scripts/diagnose-stdio-client.mjs` to validate connect → list → create → close
  - Volume-mount logs and review `/app/logs/*`

---

## Troubleshooting

Common errors & fixes
- `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND`
  - Not installed in the runtime. Fix: `npm install @debugmcp/adapter-<language>` and rebuild image/app
- `Factory class <Language>AdapterFactory not found`
  - Export mismatch. Ensure you export the named class and default `{ name, factory }` in your entry
- Adapter not listed by `list_supported_languages`
  - Verify npm installation (`npm ls @debugmcp/adapter-*`)
  - Confirm package’s `exports` and `type: "module"` are correct
  - In monorepo/dev, confirm dist exists and fallback paths are correct
- Immediate disconnect on stdio
  - Likely stdout pollution. Ensure your adapter does not log to stdout/stderr on import/initialize
  - Use the provided stdio silencer and inspect `/app/logs/stdout-raw.log`

Debugging dynamic loading
- Increase server logging (debug level) and watch loader logs
- Note: `DEBUG=mcp:*` is misleading in STDIO mode because console output is silenced to protect JSON-RPC framing. Use `--log-file <path>` instead to capture verbose logs to disk
- Confirm default export shape in the compiled `dist/index.js`
- Validate `@debugmcp/shared` peer version compatibility with the core

Troubleshooting flow
```
Adapter not loading?
├── npm ls @debugmcp/adapter-*
├── Verify export structure { name: '<lang>', factory: <Lang>AdapterFactory }
├── Check compiled dist/index.js exists and is ESM
├── Check stdout purity in stdio (no logs)
└── Inspect /app/logs/stdout-raw.log and stdin-raw.log (container)
```

---

## Checklist for New Adapters

- [ ] `IDebugAdapter` fully implemented
- [ ] Factory extends `AdapterFactory` and validates environment (if needed)
- [ ] Export conventions followed (`@debugmcp/adapter-<language>`, factory class name, default export)
- [ ] TypeScript built to `dist/` (ESM)
- [ ] Unit and integration tests pass
- [ ] Adapter discovers and loads dynamically
- [ ] Container runtime dependencies included (if applicable)
- [ ] No stdout pollution in stdio mode
- [ ] Publishable package metadata (version, license, description)

---

## Quick Start Template

You can scaffold from the minimal example above, or copy the following files and replace `Example` with your language:

- `src/<Language>Adapter.ts`
- `src/<Language>AdapterFactory.ts`
- `src/index.ts`
- `package.json` (with correct `name`, `exports`, `peerDependencies`)
- `tsconfig.json`

Once built and installed alongside `@debugmcp/mcp-debugger`, your adapter will be discovered by the dynamic loader automatically.
