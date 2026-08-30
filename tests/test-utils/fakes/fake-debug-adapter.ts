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
  // `||`, not `??`: an empty preferred path is not a path. Real adapters fall back to a PATH
  // search on '', and the proxy worker's init-payload validation rejects an empty
  // executablePath — so returning '' verbatim would be a fake of something that cannot happen.
  resolveExecutablePath = vi.fn<Impl<'resolveExecutablePath'>>(
    async (preferredPath?: string) => preferredPath || 'fake-executable'
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
  // A plain method, not a mock: `sendDapRequest` is the interface's only generic member, and
  // vitest's `Mock<T>` collapses a generic signature to one instantiation — making it a mock
  // costs an intersection type and a cast. Nothing needs it: ProxyManager never calls
  // `adapter.sendDapRequest`, and the DAP-request assertions in these suites are all on
  // ProxyManager. Reach for `vi.spyOn(adapter, 'sendDapRequest')` if that ever changes.
  async sendDapRequest<T extends DebugProtocol.Response>(
    _command: string,
    _args?: unknown
  ): Promise<T> {
    return {} as T;
  }
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
  // Genuinely ABSENT until opted in: production code reaches them through optional calls
  // (`adapter.supportsAttach?.()`), and a double that always defines them can only ever
  // exercise the defined branch.
  //
  // `declare` is load-bearing. Under ES2022 class-field *define* semantics an uninitialised
  // field is emitted as an own property set to undefined — which would make
  // `'supportsAttach' in adapter` true and list every optional member in `Object.keys`, the
  // opposite of what this block promises. `declare` emits no field at all, so the property
  // exists only once a builder or an override assigns it.
  declare createLaunchBarrier?: Mock<Impl<'createLaunchBarrier'>>;
  declare supportsAttach?: Mock<Impl<'supportsAttach'>>;
  declare supportsDetach?: Mock<Impl<'supportsDetach'>>;
  declare usesDirectConnectForAttach?: Mock<Impl<'usesDirectConnectForAttach'>>;
  declare transformAttachConfig?: Mock<Impl<'transformAttachConfig'>>;
  declare getDefaultAttachConfig?: Mock<Impl<'getDefaultAttachConfig'>>;
  /** Interface-readonly; mutable here so `withAttachSupport()` can set it. */
  declare supportedAttachKeys?: readonly string[];

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
  withAttachSupport(options: FakeAttachSupportOptions = {}): this & DefinedAttachMembers {
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
    // The five members above are optional on the class because a fake that never
    // opted in must not define them. They are defined now, and saying so is what
    // lets a caller read `adapter.transformAttachConfig.mock` without a non-null
    // assertion that would silently survive the builder being dropped.
    return this as this & DefinedAttachMembers;
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
   * An explicitly-undefined value is skipped rather than installed. `Object.keys` cannot tell
   * `{ transformAttachConfig: undefined }` from an omitted key, and `vi.fn(undefined)` is a
   * perfectly truthy mock returning undefined — so a conditional override
   * (`{ transformAttachConfig: cond ? fn : undefined }`) would turn an optional member that
   * must stay absent into one the session layer's
   * `supportsAttach() && transformAttachConfig` chain happily calls.
   *
   * The keys are only known dynamically here, so the per-key correlation between `K` and
   * `Impl<K>` — enforced on `FakeDebugAdapterOverrides` at the call site — cannot be carried
   * through `Object.keys`. The two casts below are that erasure and nothing more.
   */
  private applyOverrides(overrides: FakeDebugAdapterOverrides): void {
    for (const key of Object.keys(overrides) as Array<keyof FakeDebugAdapterOverrides>) {
      if (key === 'language' || key === 'name' || key === 'supportedAttachKeys') continue;

      const impl = overrides[key] as ((...args: never[]) => unknown) | undefined;
      if (impl === undefined) continue;

      (this as Record<string, unknown>)[key] = vi.fn(impl);
    }
  }
}

/** The attach members {@link FakeDebugAdapter.withAttachSupport} defines. */
export type DefinedAttachMembers = Required<
  Pick<
    FakeDebugAdapter,
    | 'supportsAttach'
    | 'supportsDetach'
    | 'usesDirectConnectForAttach'
    | 'transformAttachConfig'
    | 'getDefaultAttachConfig'
  >
>;
