/**
 * Compile-checked fake for `IDebugAdapter`.
 *
 * The suite used to hand-roll ~40 object literals shaped like a debug adapter and force
 * them through `as unknown as IDebugAdapter`. That cast silenced every divergence, so the
 * literals drifted: a *sync* `transformLaunchConfig` (the interface returns a Promise), two
 * members (`translateScriptPath` / `translateBreakpointPath`) that no longer exist, and
 * fifteen stubbed EventEmitter methods that never emitted anything.
 *
 * This class is the single conformant double, following `MockProxyManager`'s precedent of a
 * class that `implements` the real interface — so the compiler, not review, catches drift.
 *
 * Two rules make it useful beyond "it compiles":
 *
 * - Every REQUIRED member is a `vi.fn` with a production-shaped default, so a test only
 *   states the behaviour it actually cares about and can still assert on the rest.
 * - The seven OPTIONAL members are ABSENT unless opted in via `withAttachSupport()` /
 *   `withLaunchBarrier()`. Production code guards them (`adapter.supportsAttach?.()`), and a
 *   double that always defines them would only ever exercise one side of that branch.
 */
import { EventEmitter } from 'events';
import { vi, type Mock } from 'vitest';
import type { DebugProtocol } from '@vscode/debugprotocol';
import {
  AdapterState,
  DebugLanguage,
  type AdapterCapabilities,
  type AdapterCommand,
  type AdapterConfig,
  type AdapterLaunchBarrier,
  type DependencyInfo,
  type FeatureRequirement,
  type GenericAttachConfig,
  type GenericLaunchConfig,
  type IDebugAdapter,
  type LanguageSpecificAttachConfig,
  type LanguageSpecificLaunchConfig,
  type ValidationResult
} from '@debugmcp/shared';

/**
 * The behavioural surface of `IDebugAdapter`: everything except the EventEmitter machinery
 * (supplied by the base class) and the three data members, which are plain values rather
 * than implementations.
 */
type AdapterMethods = Exclude<
  keyof IDebugAdapter,
  keyof EventEmitter | 'language' | 'name' | 'supportedAttachKeys'
>;

/** The implementation type of one adapter member, with the optionality stripped. */
type Impl<K extends AdapterMethods> = NonNullable<IDebugAdapter[K]>;

/**
 * `sendDapRequest` is the one generic member (`<T extends DebugProtocol.Response>`), and
 * vitest's `Mock<T>` collapses a generic signature to a single instantiation — so a bare mock
 * does not satisfy `implements IDebugAdapter`. Intersecting the mock with the interface's own
 * signature restores the generic call; the cast at the field is that restoration and nothing
 * more. Callers still get the full mock API (`mockResolvedValue`, call assertions).
 */
type DapRequestMock =
  Mock<(command: string, args?: unknown) => Promise<DebugProtocol.Response>> &
  IDebugAdapter['sendDapRequest'];

/**
 * Constructor overrides. Each entry is an *implementation* typed against the real interface —
 * not a bare `vi.fn()` — so a wrong argument list or return type is a compile error at the
 * call site rather than a silent no-op at runtime.
 */
export type FakeDebugAdapterOverrides =
  Partial<Pick<IDebugAdapter, 'language' | 'name' | 'supportedAttachKeys'>> &
  { [K in AdapterMethods]?: Impl<K> };

/** Options for {@link FakeDebugAdapter.withAttachSupport}. */
export interface FakeAttachSupportOptions {
  /** Value returned by `usesDirectConnectForAttach()` (default false — spawn-mode attach). */
  directConnect?: boolean;
  /** Value returned by `supportsDetach()` (default true). */
  detach?: boolean;
  /** Implementation for `transformAttachConfig` (default: pass the config through). */
  transform?: Impl<'transformAttachConfig'>;
  /** Value exposed as the readonly `supportedAttachKeys` list. */
  supportedAttachKeys?: readonly string[];
}

export class FakeDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language: DebugLanguage;
  readonly name: string;

  // ===== Lifecycle =====
  initialize = vi.fn<Impl<'initialize'>>(async () => {});
  dispose = vi.fn<Impl<'dispose'>>(async () => {});

  // ===== State =====
  getState = vi.fn<Impl<'getState'>>(() => AdapterState.READY);
  isReady = vi.fn<Impl<'isReady'>>(() => true);
  getCurrentThreadId = vi.fn<Impl<'getCurrentThreadId'>>(() => 1);

  // ===== Environment validation =====
  validateEnvironment = vi.fn<Impl<'validateEnvironment'>>(
    async (): Promise<ValidationResult> => ({ valid: true, errors: [], warnings: [] })
  );
  getRequiredDependencies = vi.fn<Impl<'getRequiredDependencies'>>((): DependencyInfo[] => []);

  // ===== Executable management =====
  resolveExecutablePath = vi.fn<Impl<'resolveExecutablePath'>>(
    async (preferredPath?: string) => preferredPath ?? 'fake-executable'
  );
  getDefaultExecutableName = vi.fn<Impl<'getDefaultExecutableName'>>(() => 'fake');
  getExecutableSearchPaths = vi.fn<Impl<'getExecutableSearchPaths'>>((): string[] => []);

  // ===== Adapter configuration =====
  buildAdapterCommand = vi.fn<Impl<'buildAdapterCommand'>>(
    (config: AdapterConfig): AdapterCommand => ({
      command: config.executablePath || 'node',
      args: ['fake-adapter.js', '--port', String(config.adapterPort)],
      env: {}
    })
  );
  getAdapterModuleName = vi.fn<Impl<'getAdapterModuleName'>>(() => 'fake-adapter');
  getAdapterInstallCommand = vi.fn<Impl<'getAdapterInstallCommand'>>(
    () => 'echo "fake adapter is built in"'
  );

  // ===== Debug configuration =====
  // ASYNC, per the interface — the literals this replaces returned the config synchronously.
  transformLaunchConfig = vi.fn<Impl<'transformLaunchConfig'>>(
    async (config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig> => ({ ...config })
  );
  getDefaultLaunchConfig = vi.fn<Impl<'getDefaultLaunchConfig'>>(
    (): Partial<GenericLaunchConfig> => ({})
  );

  // ===== DAP protocol operations =====
  sendDapRequest = vi.fn(
    async (): Promise<DebugProtocol.Response> => ({}) as DebugProtocol.Response
  ) as DapRequestMock;
  handleDapEvent = vi.fn<Impl<'handleDapEvent'>>(() => {});
  handleDapResponse = vi.fn<Impl<'handleDapResponse'>>(() => {});

  // ===== Connection management =====
  connect = vi.fn<Impl<'connect'>>(async () => {});
  disconnect = vi.fn<Impl<'disconnect'>>(async () => {});
  isConnected = vi.fn<Impl<'isConnected'>>(() => true);

  // ===== Error handling =====
  getInstallationInstructions = vi.fn<Impl<'getInstallationInstructions'>>(
    () => 'The fake adapter needs no installation'
  );
  getMissingExecutableError = vi.fn<Impl<'getMissingExecutableError'>>(
    () => 'Fake executable not found'
  );
  translateErrorMessage = vi.fn<Impl<'translateErrorMessage'>>((error: Error) => error.message);

  // ===== Feature support =====
  supportsFeature = vi.fn<Impl<'supportsFeature'>>(() => true);
  getFeatureRequirements = vi.fn<Impl<'getFeatureRequirements'>>((): FeatureRequirement[] => []);
  getCapabilities = vi.fn<Impl<'getCapabilities'>>((): AdapterCapabilities => ({}));

  // ===== Optional members =====
  // Deliberately left undefined: production code reaches them through optional calls, and a
  // double that always defines them can only ever exercise the defined branch.
  createLaunchBarrier?: Mock<Impl<'createLaunchBarrier'>>;
  supportsAttach?: Mock<Impl<'supportsAttach'>>;
  supportsDetach?: Mock<Impl<'supportsDetach'>>;
  usesDirectConnectForAttach?: Mock<Impl<'usesDirectConnectForAttach'>>;
  transformAttachConfig?: Mock<Impl<'transformAttachConfig'>>;
  getDefaultAttachConfig?: Mock<Impl<'getDefaultAttachConfig'>>;
  /** Interface-readonly; mutable here so `withAttachSupport()` can set it. */
  supportedAttachKeys?: readonly string[];

  constructor(overrides: FakeDebugAdapterOverrides = {}) {
    super();
    this.language = overrides.language ?? DebugLanguage.MOCK;
    this.name = overrides.name ?? `${this.language} Debug Adapter (fake)`;
    if (overrides.supportedAttachKeys !== undefined) {
      this.supportedAttachKeys = overrides.supportedAttachKeys;
    }
    this.applyOverrides(overrides);
  }

  /**
   * Opt into the attach members as a set, the way a real attach-capable adapter declares them.
   *
   * The builder wins: it replaces any same-member constructor override, so pass attach
   * behaviour through `options` rather than through the constructor.
   */
  withAttachSupport(options: FakeAttachSupportOptions = {}): this {
    this.supportsAttach = vi.fn<Impl<'supportsAttach'>>(() => true);
    this.supportsDetach = vi.fn<Impl<'supportsDetach'>>(() => options.detach ?? true);
    this.usesDirectConnectForAttach = vi.fn<Impl<'usesDirectConnectForAttach'>>(
      () => options.directConnect ?? false
    );
    this.transformAttachConfig = vi.fn<Impl<'transformAttachConfig'>>(
      options.transform ??
        ((config: GenericAttachConfig): LanguageSpecificAttachConfig => ({ ...config }))
    );
    this.getDefaultAttachConfig = vi.fn<Impl<'getDefaultAttachConfig'>>(
      (): Partial<GenericAttachConfig> => ({})
    );
    if (options.supportedAttachKeys !== undefined) {
      this.supportedAttachKeys = options.supportedAttachKeys;
    }
    return this;
  }

  /**
   * Opt into `createLaunchBarrier`, returning `barrier` for every request. Pass `undefined`
   * to define the member but decline the barrier — the "adapter offers none" branch.
   *
   * The builder wins: it replaces any `createLaunchBarrier` passed to the constructor.
   */
  withLaunchBarrier(barrier: AdapterLaunchBarrier | undefined): this {
    this.createLaunchBarrier = vi.fn<Impl<'createLaunchBarrier'>>(() => barrier);
    return this;
  }

  /**
   * Attach adapter-specific members that are not on `IDebugAdapter` but that production code
   * duck-types for (e.g. the C/C++ adapter's `consumeLastToolchainValidation`), keeping them
   * visible to the compiler at the call site instead of hiding them behind a cast.
   */
  withExtras<E extends object>(extras: E): this & E {
    return Object.assign(this, extras);
  }

  /**
   * Install the constructor's method overrides.
   *
   * Each override REPLACES the member with a fresh `vi.fn(impl)` rather than calling
   * `mockImplementation` on the default one. That matters after a reset: vitest's `mockReset`
   * restores the implementation a mock was *constructed* with, so overriding in place would
   * make `vi.resetAllMocks()` silently revert the test's behaviour to the fake's production
   * default. Constructing with the override makes a reset restore the override.
   *
   * The keys are only known dynamically here, so the per-key correlation between `K` and
   * `Impl<K>` — enforced on `FakeDebugAdapterOverrides` at the call site — cannot be carried
   * through `Object.keys`. The two casts below are that erasure and nothing more.
   */
  private applyOverrides(overrides: FakeDebugAdapterOverrides): void {
    for (const key of Object.keys(overrides) as Array<keyof FakeDebugAdapterOverrides>) {
      if (key === 'language' || key === 'name' || key === 'supportedAttachKeys') continue;

      const impl = overrides[key] as (...args: never[]) => unknown;
      (this as Record<string, unknown>)[key] = vi.fn(impl);
    }
  }
}
