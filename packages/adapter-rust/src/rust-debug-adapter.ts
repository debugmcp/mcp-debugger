/**
 * Rust Debug Adapter implementation
 */

import type {
  IDebugAdapter,
  AdapterConfig,
  AdapterCapabilities,
  ValidationResult,
  GenericLaunchConfig
} from '@debugmcp/shared';
import { 
  AdapterState,
  DebugFeature 
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { EventEmitter } from 'events';
import { resolveCodeLLDBExecutable } from './utils/codelldb-resolver.js';
import { checkCargoInstallation } from './utils/rust-utils.js';

/**
 * Rust Debug Adapter using CodeLLDB
 */
export class RustDebugAdapter extends EventEmitter implements IDebugAdapter {
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private config: AdapterConfig;
  private capabilities: AdapterCapabilities;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private adapterProcess?: any;

  constructor(config: AdapterConfig) {
    super();
    this.config = config;
    this.capabilities = this.initializeCapabilities();
  }

  /**
   * Initialize adapter capabilities
   */
  private initializeCapabilities(): AdapterCapabilities {
    return {
      supportsConfigurationDoneRequest: true,
      supportsSetVariable: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsLogPoints: true,
      supportsFunctionBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: false,
      supportsRestartFrame: false,
      supportsGotoTargetsRequest: false,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: true,
      supportsModulesRequest: true,
      supportsValueFormattingOptions: true,
      supportsCancelRequest: true,
      supportsBreakpointLocationsRequest: true,
      supportsDataBreakpoints: true,
      supportsDisassembleRequest: true,
      supportsSteppingGranularity: true,
      supportsInstructionBreakpoints: true
    };
  }

  /**
   * Get adapter ID
   */
  getId(): string {
    return 'rust-debug-adapter';
  }

  /**
   * Get adapter state
   */
  getState(): AdapterState {
    return this.state;
  }

  /**
   * Get adapter configuration
   */
  getConfig(): AdapterConfig {
    return this.config;
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapabilities {
    return this.capabilities;
  }

  /**
   * Check if a feature is supported
   */
  supportsFeature(feature: DebugFeature): boolean {
    const featureMap: Partial<Record<DebugFeature, keyof AdapterCapabilities>> = {
      [DebugFeature.CONDITIONAL_BREAKPOINTS]: 'supportsConditionalBreakpoints',
      [DebugFeature.FUNCTION_BREAKPOINTS]: 'supportsFunctionBreakpoints',
      [DebugFeature.DATA_BREAKPOINTS]: 'supportsDataBreakpoints',
      [DebugFeature.LOG_POINTS]: 'supportsLogPoints',
      [DebugFeature.STEP_BACK]: 'supportsStepBack',
      [DebugFeature.SET_VARIABLE]: 'supportsSetVariable',
      [DebugFeature.EXCEPTION_OPTIONS]: 'supportsExceptionOptions'
    };

    const capabilityKey = featureMap[feature];
    return capabilityKey ? Boolean(this.capabilities[capabilityKey]) : false;
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    this.state = AdapterState.INITIALIZING;
    
    // Initialize CodeLLDB adapter
    // This would typically start the CodeLLDB process
    const codelldbPath = await resolveCodeLLDBExecutable();
    
    if (!codelldbPath) {
      throw new Error('CodeLLDB executable not found');
    }
    
    // TODO: Start CodeLLDB process
    
    this.state = AdapterState.READY;
    this.emit('initialized');
  }

  /**
   * Configure the adapter
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configure(args: any): Promise<void> {
    // Apply any configuration settings
    this.emit('configured', args);
  }

  /**
   * Launch a debug session
   */
  async launch(config: GenericLaunchConfig): Promise<void> {
    this.state = AdapterState.RUNNING;
    
    // Extract Rust-specific launch configuration
    const program = (config as any).program || config.name;
    const args = config.args || [];
    const cwd = config.cwd || process.cwd();
    const env = config.env || {};
    
    // Build launch arguments for CodeLLDB
    const launchArgs = {
      type: 'lldb',
      request: 'launch',
      program,
      args,
      cwd,
      env,
      stopOnEntry: config.stopOnEntry || false
    };
    
    // TODO: Send launch request to CodeLLDB
    
    this.emit('launched', launchArgs);
  }

  /**
   * Attach to a running process
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async attach(config: any): Promise<void> {
    this.state = AdapterState.RUNNING;
    
    // Build attach arguments for CodeLLDB
    const attachArgs = {
      type: 'lldb',
      request: 'attach',
      pid: config.pid || config.processId
    };
    
    // TODO: Send attach request to CodeLLDB
    
    this.emit('attached', attachArgs);
  }

  /**
   * Disconnect from the debug session
   */
  async disconnect(): Promise<void> {
    this.state = AdapterState.DISCONNECTED;
    
    // TODO: Disconnect from CodeLLDB
    
    this.emit('disconnected');
  }

  /**
   * Terminate the debug session
   */
  async terminate(): Promise<void> {
    this.state = AdapterState.TERMINATED;
    
    // TODO: Terminate CodeLLDB process
    if (this.adapterProcess) {
      // Kill the process
    }
    
    this.emit('terminated');
  }

  /**
   * Send a custom request to the adapter
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  async customRequest(command: string, args?: any): Promise<any> {
    // Handle custom requests
    switch (command) {
      case 'cargo.build':
        // TODO: Run cargo build
        return { success: true };
        
      case 'cargo.test':
        // TODO: Run cargo test
        return { success: true };
        
      default:
        throw new Error(`Unknown custom request: ${command}`);
    }
  }

  /**
   * Validate the adapter installation
   */
  async validate(): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    
    // Check for CodeLLDB
    const codelldbPath = await resolveCodeLLDBExecutable();
    if (!codelldbPath) {
      errors.push({
        code: 'CODELLDB_NOT_FOUND',
        message: 'CodeLLDB executable not found',
        suggestion: 'Run npm run build:adapter to download CodeLLDB'
      });
    }
    
    // Check for Cargo
    const cargoInstalled = await checkCargoInstallation();
    if (!cargoInstalled) {
      warnings.push({
        code: 'CARGO_NOT_FOUND',
        message: 'Cargo not found in PATH',
        suggestion: 'Install Rust from https://rustup.rs/'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dependencies: [
        {
          name: 'CodeLLDB',
          required: true,
          installed: Boolean(codelldbPath),
          version: '1.11.0',
          installCommand: 'npm run build:adapter'
        },
        {
          name: 'Cargo',
          required: false,
          installed: cargoInstalled,
          installCommand: 'Install from https://rustup.rs/'
        }
      ]
    };
  }

  /**
   * Dispose of the adapter
   */
  async dispose(): Promise<void> {
    await this.terminate();
    this.removeAllListeners();
  }
}
