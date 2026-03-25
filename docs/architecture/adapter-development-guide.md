# Debug Adapter Development Guide

How to build, test, and wire a new language adapter for mcp-debugger.
Reference implementation: `packages/adapter-go/` (Go/Delve adapter).

## What is an Adapter?

An adapter is a language-specific package that implements the Debug Adapter Protocol (DAP) behind a common TypeScript interface (`IDebugAdapter`). The mcp-debugger core discovers adapters dynamically at runtime using the package naming convention `@debugmcp/adapter-<language>` and a **named export** of a factory class named `<Language>AdapterFactory`.

Benefits:
- Pluggable language support — install only what you need
- Small core with lazy loading — faster startup
- Clean separation of concerns — core vs language details

---

## Prerequisites

- Node.js 18+
- pnpm (not npm) — the monorepo uses `workspace:*` protocol
- TypeScript 5.9+
- Familiarity with the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/)
- A working debugger for the target language (e.g., Delve for Go, debugpy for Python)

---

## Package Structure

```
packages/adapter-<language>/
  package.json
  tsconfig.json
  src/
    <language>-adapter-factory.ts    # IAdapterFactory implementation
    <language>-debug-adapter.ts      # IDebugAdapter implementation
    index.ts                         # Package entry point (exports)
    utils/                           # Optional: language-specific helpers
      <language>-utils.ts
  dist/                              # Build output (gitignored)
```

Naming conventions:
- Package name: `@debugmcp/adapter-<language>`
- Factory class: `<Language>AdapterFactory` (e.g., `GoAdapterFactory`)
- File names: kebab-case (e.g., `go-debug-adapter.ts`, not `GoDebugAdapter.ts`)

---

## Step-by-Step Implementation

### 1. Create the package directory

```bash
mkdir -p packages/adapter-<language>/src
```

### 2. package.json

Based on `packages/adapter-go/package.json`:

```json
{
  "name": "@debugmcp/adapter-<language>",
  "version": "0.1.0",
  "description": "<Language> debugging adapter for mcp-debugger using <debugger>",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "build:ci": "tsc -p tsconfig.json --noEmitOnError",
    "clean": "rimraf dist",
    "lint": "eslint src/**/*.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@debugmcp/shared": "workspace:*",
    "@vscode/debugprotocol": "^1.68.0"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "rimraf": "^6.1.3",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  },
  "keywords": ["mcp", "debugger", "<language>", "dap"],
  "author": "mcp-debugger team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/debugmcp/mcp-debugger.git",
    "directory": "packages/adapter-<language>"
  }
}
```

Notes:
- No `peerDependencies` — real adapters don't use them.
- Build uses `tsc -p` (project mode), not `tsc -b` (build mode).

### 3. tsconfig.json

Based on `packages/adapter-go/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"],
  "references": [
    { "path": "../shared" }
  ]
}
```

### 4. Implement `IAdapterFactory`

The factory creates adapter instances, provides metadata, and validates the environment. Implement the `IAdapterFactory` interface from `@debugmcp/shared` — do not extend a base class.

**Interface** (3 required methods):
```typescript
interface IAdapterFactory {
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter;
  getMetadata(): AdapterMetadata;
  validate(): Promise<FactoryValidationResult>;
}
```

**Real example** — `packages/adapter-go/src/go-adapter-factory.ts`:

```typescript
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { GoDebugAdapter } from './go-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { findGoExecutable, findDelveExecutable, getGoVersion, getDelveVersion, checkDelveDapSupport } from './utils/go-utils.js';

export class GoAdapterFactory implements IAdapterFactory {
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new GoDebugAdapter(dependencies);
  }

  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.GO,
      displayName: 'Go',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug Go applications using Delve (dlv)',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/go',
      minimumDebuggerVersion: '0.17.0',
      fileExtensions: ['.go'],
    };
  }

  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const goPath = await findGoExecutable();
      const goVersion = await getGoVersion(goPath) || undefined;
      if (goVersion) {
        const [major, minor] = goVersion.split('.').map(Number);
        if (major < 1 || (major === 1 && minor < 18)) {
          errors.push(`Go 1.18 or higher required. Current version: ${goVersion}`);
        }
      }

      try {
        const dlvPath = await findDelveExecutable();
        const dapCheck = await checkDelveDapSupport(dlvPath);
        if (!dapCheck.supported) {
          errors.push('Delve does not support DAP mode.');
        }
      } catch {
        errors.push('Delve (dlv) not found. Install with: go install github.com/go-delve/delve/cmd/dlv@latest');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Go executable not found');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
```

### 5. Implement `IDebugAdapter`

The adapter is the core component that manages the debugger lifecycle. It extends `EventEmitter` and implements `IDebugAdapter` from `@debugmcp/shared`.

**Key method groups** (see `packages/shared/src/interfaces/debug-adapter.ts` for full interface):

| Category | Methods |
|----------|---------|
| Lifecycle | `initialize()`, `dispose()` |
| State | `getState()`, `isReady()`, `getCurrentThreadId()` |
| Validation | `validateEnvironment()`, `getRequiredDependencies()` |
| Executable | `resolveExecutablePath()`, `getDefaultExecutableName()`, `getExecutableSearchPaths()` |
| Configuration | `buildAdapterCommand()`, `getAdapterModuleName()`, `getAdapterInstallCommand()`, `transformLaunchConfig()`, `getDefaultLaunchConfig()` |
| DAP | `sendDapRequest()`, `handleDapEvent()`, `handleDapResponse()` |
| Connection | `connect()`, `disconnect()`, `isConnected()` |
| Error handling | `getInstallationInstructions()`, `getMissingExecutableError()`, `translateErrorMessage()` |
| Features | `supportsFeature()`, `getFeatureRequirements()`, `getCapabilities()` |

**Key patterns** from `packages/adapter-go/src/go-debug-adapter.ts`:

```typescript
import { EventEmitter } from 'events';
import { IDebugAdapter, AdapterState, DebugLanguage, AdapterDependencies } from '@debugmcp/shared';

export class GoDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.GO;
  readonly name = 'Go Debug Adapter (Delve)';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;

  constructor(dependencies: AdapterDependencies) {
    super();
    this.dependencies = dependencies;
  }

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);
    const validation = await this.validateEnvironment();
    if (!validation.valid) {
      this.transitionTo(AdapterState.ERROR);
      throw new AdapterError(validation.errors[0]?.message, AdapterErrorCode.ENVIRONMENT_INVALID);
    }
    this.transitionTo(AdapterState.READY);
    this.emit('initialized');
  }

  private transitionTo(newState: AdapterState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChanged', oldState, newState);
  }

  // ... implement all IDebugAdapter methods
}
```

**State machine**: `UNINITIALIZED` → `INITIALIZING` → `READY` → `CONNECTED` ⇄ `DEBUGGING` → `DISCONNECTED` | `ERROR`

See `packages/adapter-go/src/go-debug-adapter.ts` for the complete ~500-line implementation.

### 6. Package entry point (`index.ts`)

Based on `packages/adapter-go/src/index.ts`:

```typescript
export { GoDebugAdapter } from './go-debug-adapter.js';
export { GoAdapterFactory } from './go-adapter-factory.js';
export * from './utils/go-utils.js';

// Optional default export (not used by the dynamic loader, but included by some adapters)
export default {
  name: 'go',
  factory: (await import('./go-adapter-factory.js')).GoAdapterFactory
};
```

The dynamic loader resolves adapters by **named export** — it looks for `<Language>AdapterFactory` in the module's named exports. The default export is not required.

---

## Monorepo Wiring

After creating the package, wire it into the monorepo. These steps are required for the adapter to be discovered.

### 1. Root `package.json` — optionalDependencies

Add your adapter to the `optionalDependencies` section:

```json
"optionalDependencies": {
  "@debugmcp/adapter-<language>": "workspace:*"
}
```

### 2. `vitest.config.ts` — alias

Add an alias entry in `resolve.alias` so tests can import your package:

```typescript
{ find: '@debugmcp/adapter-<language>', replacement: path.resolve(__dirname, './packages/adapter-<language>/src/index.ts') }
```

### 3. `DebugLanguage` enum

Add a new value in `packages/shared/src/models/index.ts`:

```typescript
export enum DebugLanguage {
  // ... existing entries
  <LANGUAGE> = '<language>',
}
```

### 4. Known adapters list

Add an entry to the `known` array in `src/adapters/adapter-loader.ts` → `listAvailableAdapters()`:

```typescript
{ name: '<language>', packageName: '@debugmcp/adapter-<language>', description: '<Language> debugger using <debugger>' },
```

### 5. Update adapter count assertions

Grep for `toHaveLength` assertions in tests that reference adapter/language counts and increment them. Known files:
- `tests/unit/adapters/adapter-loader.test.ts`
- `tests/core/unit/session/models.test.ts`
- `tests/core/unit/adapters/debug-adapter-interface.test.ts`

### 6. Run `pnpm install`

Link the new workspace package:

```bash
pnpm install
```

---

## Adapter Policy

Every adapter that runs real debug sessions needs an adapter policy. The policy encodes debugger-specific behaviors for the DAP proxy and session manager.

### Creating the policy

File: `packages/shared/src/interfaces/adapter-policy-<language>.ts`

The policy implements the `AdapterPolicy` interface (from `adapter-policy.ts`). Key decisions:

| Setting | What it controls | Example |
|---------|-----------------|---------|
| `childSessionStrategy` | Whether the debugger spawns child DAP sessions | `'none'` for most adapters |
| `defaultStopOnEntry` | Whether to pause at program entry | `false` for Go (Delve quirk) |
| `requiresCommandQueueing` | Whether commands need sequential queueing | `false` for most adapters |

See `packages/shared/src/interfaces/adapter-policy-go.ts` for a minimal, clean policy example.

### Wiring the policy (2 locations)

1. **DAP proxy** — `src/proxy/dap-proxy-worker.ts` → `selectAdapterPolicy()` method: add a new `else if` branch matching your adapter command.

2. **Session manager** — `src/session/session-manager-data.ts` → `selectPolicy()` method: add a new `case` branch for your `DebugLanguage` value.

3. **Export** — Add the policy to `packages/shared/src/index.ts` so both locations can import it.

---

## Testing

### Test location

Tests live at the **project root**, not inside the package:

```
tests/adapters/<language>/
  unit/
    <language>-adapter-factory.test.ts
    <language>-debug-adapter.test.ts
    <language>-utils.test.ts           # if you have utils
  integration/
    <language>-session-smoke.test.ts
```

Adapter policy tests go in: `tests/unit/shared/adapter-policy-<language>.test.ts`

### Unit test pattern

From `tests/adapters/go/unit/go-adapter-factory.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GoAdapterFactory } from '@debugmcp/adapter-go';

describe('GoAdapterFactory', () => {
  let factory: GoAdapterFactory;

  beforeEach(() => {
    factory = new GoAdapterFactory();
  });

  it('creates an adapter', () => {
    const adapter = factory.createAdapter({
      fileSystem: {} as any,
      logger: {} as any,
      environment: {} as any,
    });
    expect(adapter).toBeDefined();
    expect(adapter.language).toBe('go');
  });

  it('returns correct metadata', () => {
    const meta = factory.getMetadata();
    expect(meta.language).toBe('go');
    expect(meta.displayName).toBe('Go');
    expect(meta.fileExtensions).toContain('.go');
  });
});
```

### Integration smoke test

Verify end-to-end adapter discovery:
1. Build: `npm run build`
2. Call `list_supported_languages` — your language should appear with `installed: true`
3. Call `create_debug_session` with `"language": "<language>"` — should succeed

---

## Dynamic Loading

The `AdapterLoader` (`src/adapters/adapter-loader.ts`) resolves adapters in this order:

1. **Package import**: `import('@debugmcp/adapter-<language>')`
2. **Fallback 1**: `node_modules/@debugmcp/adapter-<language>/dist/index.js`
3. **Fallback 2**: `packages/adapter-<language>/dist/index.js` (monorepo dev)

The loader:
- Converts the language name to a factory class name: capitalize first letter + `AdapterFactory` (e.g., `go` → `GoAdapterFactory`)
- Looks for that class as a **named export** in the loaded module
- Instantiates it with `new FactoryClass()`
- Caches the factory by language name for subsequent requests

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` | Package not installed | `pnpm install` or `npm install @debugmcp/adapter-<language>` |
| `Factory class <Language>AdapterFactory not found` | Export mismatch | Ensure your factory is a **named export**, not just a default export |
| Adapter not in `list_supported_languages` | Not wired | Check: package installed, `exports` correct, `type: "module"` set, dist exists |
| Immediate disconnect on stdio | stdout pollution | Ensure no `console.log` on import/initialize — use the logger instead |

**Debugging dynamic loading**: Set `--log-file <path>` to capture verbose loader logs (don't use `DEBUG=mcp:*` in STDIO mode — console output is silenced to protect JSON-RPC framing).

---

## Performance Tips

- Do minimal work in constructors — defer to `initialize()`
- Cache executable discovery results (see `GoDebugAdapter`'s 1-minute path cache)
- The loader caches factories in-memory — repeated session creation is fast

---

## Checklist

- [ ] Package created under `packages/adapter-<language>/`
- [ ] `IAdapterFactory` implemented with `createAdapter()`, `getMetadata()`, `validate()`
- [ ] `IDebugAdapter` fully implemented
- [ ] `index.ts` exports the named factory class
- [ ] `DebugLanguage` enum updated in `packages/shared/src/models/index.ts`
- [ ] Adapter policy created in `packages/shared/src/interfaces/adapter-policy-<language>.ts`
- [ ] Policy exported from `packages/shared/src/index.ts`
- [ ] Policy wired into `selectAdapterPolicy()` in `src/proxy/dap-proxy-worker.ts`
- [ ] Policy wired into `selectPolicy()` in `src/session/session-manager-data.ts`
- [ ] Registered in root `package.json` optionalDependencies
- [ ] Added to known adapters list in `src/adapters/adapter-loader.ts`
- [ ] Vitest alias added in `vitest.config.ts`
- [ ] Adapter count assertions updated in tests
- [ ] Unit and integration tests written under `tests/adapters/<language>/`
- [ ] `pnpm install` run to link workspace
- [ ] TypeScript builds to `dist/` (ESM)
- [ ] Adapter discovers and loads via `list_supported_languages`
- [ ] No stdout pollution in stdio mode
