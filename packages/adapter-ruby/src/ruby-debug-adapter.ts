import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import {
  IDebugAdapter,
  AdapterState,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyInfo,
  AdapterConfig,
  AdapterCommand,
  GenericLaunchConfig,
  GenericAttachConfig,
  LanguageSpecificLaunchConfig,
  LanguageSpecificAttachConfig,
  DebugFeature,
  FeatureRequirement,
  AdapterCapabilities,
  AdapterError,
  AdapterErrorCode,
  AdapterEvents
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { AdapterDependencies } from '@debugmcp/shared';
import {
  findRubyExecutable,
  findRdbgExecutable,
  getRubyVersion,
  getRdbgVersion,
  getRubySearchPaths,
  buildRdbgInvocation
} from './utils/ruby-utils.js';

interface RubyPathCacheEntry {
  path: string;
  timestamp: number;
  version?: string;
}

interface RubyLaunchConfig extends LanguageSpecificLaunchConfig {
  type?: string;
  request?: 'launch';
  name?: string;
  script?: string;
  command?: string;
  debugPort?: string;
  localfs?: boolean;
  localfsMap?: string;
  useTerminal?: boolean;
  showProtocolLog?: boolean;
  useBundler?: boolean;
  bundlePath?: string;
  [key: string]: unknown;
}

interface RubyAttachConfig extends LanguageSpecificAttachConfig {
  type: 'rdbg';
  request: 'attach';
  name: string;
  host: string;
  port: number;
  localfs: boolean;
  localfsMap?: string;
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  cwd?: string;
  env?: Record<string, string>;
}

export class RubyDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.RUBY;
  readonly name = 'Ruby Debug Adapter (rdbg)';

  private state: AdapterState = AdapterState.UNINITIALIZED;
  private dependencies: AdapterDependencies;
  private rubyPathCache = new Map<string, RubyPathCacheEntry>();
  private rdbgPathCache = new Map<string, RubyPathCacheEntry>();
  private readonly cacheTimeout = 60000;
  private currentThreadId: number | null = null;
  private connected = false;

  constructor(dependencies: AdapterDependencies) {
    super();
    this.dependencies = dependencies;
  }

  async initialize(): Promise<void> {
    this.transitionTo(AdapterState.INITIALIZING);

    try {
      const validation = await this.validateEnvironment();
      if (!validation.valid) {
        this.transitionTo(AdapterState.ERROR);
        throw new AdapterError(
          validation.errors[0]?.message || 'Ruby environment validation failed',
          AdapterErrorCode.ENVIRONMENT_INVALID
        );
      }

      this.transitionTo(AdapterState.READY);
      this.emit('initialized');
    } catch (error) {
      this.transitionTo(AdapterState.ERROR);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.rubyPathCache.clear();
    this.rdbgPathCache.clear();
    this.currentThreadId = null;
    this.connected = false;
    this.transitionTo(AdapterState.UNINITIALIZED);
    this.emit('disposed');
  }

  getState(): AdapterState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === AdapterState.READY ||
      this.state === AdapterState.CONNECTED ||
      this.state === AdapterState.DEBUGGING;
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  private transitionTo(newState: AdapterState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChanged', oldState, newState);
  }

  async validateEnvironment(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const rubyPath = await this.resolveExecutablePath();
      const rubyVersion = await this.checkRubyVersion(rubyPath);

      if (rubyVersion) {
        const [major, minor] = rubyVersion.split('.').map(Number);
        if (major < 2 || (major === 2 && minor < 7)) {
          errors.push({
            code: 'RUBY_VERSION_TOO_OLD',
            message: `Ruby 2.7 or higher required. Current version: ${rubyVersion}`,
            recoverable: false
          });
        }
      } else {
        warnings.push({
          code: 'RUBY_VERSION_CHECK_FAILED',
          message: 'Could not determine Ruby version'
        });
      }
    } catch (error) {
      errors.push({
        code: 'RUBY_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Ruby executable not found',
        recoverable: false
      });
    }

    try {
      const rdbgPath = await this.resolveRdbgPath();
      const rdbgVersion = await this.checkRdbgVersion(rdbgPath);
      if (!rdbgVersion) {
        warnings.push({
          code: 'RDBG_VERSION_CHECK_FAILED',
          message: 'Could not determine rdbg version'
        });
      }
    } catch (error) {
      errors.push({
        code: 'RDBG_NOT_FOUND',
        message: error instanceof Error ? error.message : 'rdbg not found',
        recoverable: true
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  getRequiredDependencies(): DependencyInfo[] {
    return [
      {
        name: 'Ruby',
        version: '2.7+',
        required: true,
        installCommand: 'Install Ruby from https://www.ruby-lang.org/'
      },
      {
        name: 'debug gem (rdbg)',
        version: '1.7+',
        required: true,
        installCommand: 'gem install debug'
      }
    ];
  }

  async resolveExecutablePath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.rubyPathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.path;
    }

    const rubyPath = await findRubyExecutable(preferredPath, this.dependencies.logger);
    this.rubyPathCache.set(cacheKey, {
      path: rubyPath,
      timestamp: Date.now()
    });

    return rubyPath;
  }

  getDefaultExecutableName(): string {
    return process.platform === 'win32' ? 'ruby.exe' : 'ruby';
  }

  getExecutableSearchPaths(): string[] {
    return getRubySearchPaths();
  }

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    const launchConfig = config.launchConfig as RubyLaunchConfig;
    const rdbgPath = this.getCachedRdbgPath()
      || process.env.RDBG_PATH
      || (process.platform === 'win32' ? 'rdbg.bat' : 'rdbg');
    const targetCommand = this.buildTargetCommand(config, launchConfig);
    // Plain --open serves DAP over the TCP socket (protocol is auto-detected
    // on connect); --open=vscode would try to launch a local VS Code instead.
    //
    // No --nonstop: rdbg must suspend at load and wait for the client, or a
    // short script finishes before the proxy can connect. The stop-at-entry
    // pause is released by SessionManager.handleAutoContinue when
    // stopOnEntry=false, matching how other adapters handle entry stops.
    const rdbgArgs = [
      '--open',
      '--host', config.adapterHost,
      '--port', config.adapterPort.toString(),
    ];

    const invocation = buildRdbgInvocation(
      rdbgPath,
      [...rdbgArgs, '-c', '--', ...targetCommand],
      config.executablePath
    );

    return {
      command: invocation.command,
      args: invocation.args,
      env: {
        ...process.env,
        RUBY_DEBUG_DAP_SHOW_PROTOCOL: process.env.DEBUG ? '1' : '0'
      }
    };
  }

  private buildTargetCommand(config: AdapterConfig, launchConfig: RubyLaunchConfig): string[] {
    if (launchConfig.useBundler) {
      return [
        launchConfig.bundlePath || 'bundle',
        'exec',
        config.executablePath,
        config.scriptPath,
        ...(config.scriptArgs || [])
      ];
    }

    return [
      config.executablePath,
      config.scriptPath,
      ...(config.scriptArgs || [])
    ];
  }

  getAdapterModuleName(): string {
    return 'rdbg';
  }

  getAdapterInstallCommand(): string {
    return 'gem install debug';
  }

  async transformLaunchConfig(config: GenericLaunchConfig): Promise<RubyLaunchConfig> {
    const rawConfig = config as Record<string, unknown>;
    const script = typeof rawConfig.program === 'string'
      ? rawConfig.program
      : typeof rawConfig.script === 'string'
        ? rawConfig.script
        : undefined;

    const rubyConfig: RubyLaunchConfig = {
      ...config,
      type: 'rdbg',
      request: 'launch',
      name: 'Ruby: Current File',
      script,
      localfs: rawConfig.localfs === false ? false : true,
      debugPort: typeof rawConfig.debugPort === 'string' ? rawConfig.debugPort : undefined,
      useTerminal: false,
      showProtocolLog: process.env.DEBUG === '1' || process.env.DEBUG === 'true',
      stopOnEntry: config.stopOnEntry ?? false,
      justMyCode: config.justMyCode ?? true,
      cwd: config.cwd ?? process.cwd()
    };

    if (typeof rawConfig.command === 'string') {
      rubyConfig.command = rawConfig.command;
    }

    if (typeof rawConfig.localfsMap === 'string') {
      rubyConfig.localfsMap = rawConfig.localfsMap;
    }

    if (typeof rawConfig.bundlePath === 'string') {
      rubyConfig.bundlePath = rawConfig.bundlePath;
    }

    if (typeof rawConfig.useBundler === 'boolean') {
      rubyConfig.useBundler = rawConfig.useBundler;
    }

    return rubyConfig;
  }

  getDefaultLaunchConfig(): Partial<GenericLaunchConfig> {
    return {
      stopOnEntry: false,
      justMyCode: true,
      env: {},
      cwd: process.cwd()
    };
  }

  supportsAttach(): boolean {
    return true;
  }

  supportsDetach(): boolean {
    return true;
  }

  usesDirectConnectForAttach(): boolean {
    return true;
  }

  transformAttachConfig(config: GenericAttachConfig): RubyAttachConfig {
    const rawConfig = config as Record<string, unknown>;
    const host = config.host || '127.0.0.1';
    const port = config.port;

    if (typeof port !== 'number') {
      throw new AdapterError(
        'Ruby attach requires a debug port opened by rdbg',
        AdapterErrorCode.ENVIRONMENT_INVALID
      );
    }

    const attachConfig: RubyAttachConfig = {
      type: 'rdbg',
      request: 'attach',
      name: 'Ruby: Attach',
      host,
      port,
      localfs: this.isLocalHost(host),
      stopOnEntry: config.stopOnEntry,
      justMyCode: config.justMyCode ?? true
    };

    if (typeof rawConfig.localfsMap === 'string') {
      attachConfig.localfsMap = rawConfig.localfsMap;
    }

    if (config.cwd) {
      attachConfig.cwd = config.cwd;
    }

    if (config.env) {
      attachConfig.env = config.env;
    }

    return attachConfig;
  }

  getDefaultAttachConfig(): Partial<GenericAttachConfig> {
    return {
      request: 'attach',
      host: '127.0.0.1',
      stopOnEntry: true,
      justMyCode: true
    };
  }

  async sendDapRequest<T extends DebugProtocol.Response>(
    _command: string,
    _args?: unknown
  ): Promise<T> {
    return {} as T;
  }

  handleDapEvent(event: DebugProtocol.Event): void {
    switch (event.event) {
      case 'stopped':
        this.transitionTo(AdapterState.DEBUGGING);
        if (event.body?.threadId) {
          this.currentThreadId = event.body.threadId;
        }
        break;
      case 'continued':
        this.transitionTo(AdapterState.DEBUGGING);
        break;
      case 'terminated':
        this.transitionTo(AdapterState.DISCONNECTED);
        break;
    }

    type AdapterEventName = Extract<keyof AdapterEvents, string | symbol>;
    this.emit(event.event as AdapterEventName, event.body);
  }

  handleDapResponse(_response: DebugProtocol.Response): void {
  }

  async connect(_host: string, _port: number): Promise<void> {
    this.connected = true;
    this.transitionTo(AdapterState.CONNECTED);
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.currentThreadId = null;
    this.transitionTo(AdapterState.DISCONNECTED);
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getInstallationInstructions(): string {
    return `Ruby Debugging Setup:

1. Install Ruby 2.7 or higher:
   - https://www.ruby-lang.org/

2. Install the debug gem:
   gem install debug

3. Verify installation:
   ruby --version
   rdbg --version`;
  }

  getMissingExecutableError(): string {
    return `Ruby not found. Please ensure Ruby 2.7+ is installed and available in PATH.`;
  }

  translateErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('rdbg') && message.includes('not found')) {
      return 'rdbg not found. Install the debug gem with: gem install debug';
    }

    if (message.includes('ruby') && message.includes('not found')) {
      return this.getMissingExecutableError();
    }

    if (message.includes('permission denied')) {
      return 'Permission denied accessing Ruby or rdbg. Check file permissions.';
    }

    if (message.includes('connection refused') || message.includes('could not connect')) {
      return 'Could not connect to the rdbg DAP server. Check for port conflicts or firewall rules.';
    }

    return error.message;
  }

  supportsFeature(feature: DebugFeature): boolean {
    const supportedFeatures = [
      DebugFeature.CONDITIONAL_BREAKPOINTS,
      DebugFeature.FUNCTION_BREAKPOINTS,
      DebugFeature.EXCEPTION_BREAKPOINTS,
      DebugFeature.EVALUATE_FOR_HOVERS,
      DebugFeature.TERMINATE_REQUEST
    ];

    return supportedFeatures.includes(feature);
  }

  getFeatureRequirements(feature: DebugFeature): FeatureRequirement[] {
    switch (feature) {
      case DebugFeature.CONDITIONAL_BREAKPOINTS:
        return [{
          type: 'dependency',
          description: 'debug gem with DAP support',
          required: true
        }];
      case DebugFeature.EXCEPTION_BREAKPOINTS:
        return [{
          type: 'dependency',
          description: 'rdbg exception breakpoint support',
          required: true
        }];
      default:
        return [];
    }
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      exceptionBreakpointFilters: [
        {
          filter: 'any',
          label: 'Rescue any exception',
          default: false,
          supportsCondition: true
        }
      ],
      supportsCompletionsRequest: true,
      supportsTerminateRequest: true,
      supportTerminateDebuggee: true
    };
  }

  private async resolveRdbgPath(preferredPath?: string): Promise<string> {
    const cacheKey = preferredPath || 'default';
    const cached = this.rdbgPathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.path;
    }

    const rdbgPath = await findRdbgExecutable(preferredPath, this.dependencies.logger);
    this.rdbgPathCache.set(cacheKey, {
      path: rdbgPath,
      timestamp: Date.now()
    });
    return rdbgPath;
  }

  /** Synchronous view of the last resolved rdbg path (populated by initialize/validateEnvironment). */
  private getCachedRdbgPath(): string | null {
    return this.rdbgPathCache.get('default')?.path ?? null;
  }

  private async checkRubyVersion(rubyPath: string): Promise<string | null> {
    const cached = this.rubyPathCache.get(rubyPath) || this.rubyPathCache.get('default');
    if (cached?.version) {
      return cached.version;
    }

    const version = await getRubyVersion(rubyPath);
    if (version) {
      this.rubyPathCache.set(rubyPath, {
        ...(cached ?? {}),
        path: rubyPath,
        version,
        timestamp: Date.now()
      });
    }

    return version;
  }

  private async checkRdbgVersion(rdbgPath: string): Promise<string | null> {
    const cached = this.rdbgPathCache.get(rdbgPath) || this.rdbgPathCache.get('default');
    if (cached?.version) {
      return cached.version;
    }

    const version = await getRdbgVersion(rdbgPath);
    if (version) {
      this.rdbgPathCache.set(rdbgPath, {
        ...(cached ?? {}),
        path: rdbgPath,
        version,
        timestamp: Date.now()
      });
    }

    return version;
  }

  private isLocalHost(host: string): boolean {
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  }
}
