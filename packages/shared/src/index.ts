/**
 * @debugmcp/shared - Shared interfaces, types, and utilities for MCP Debugger
 * 
 * This package provides the core abstractions and contracts used across
 * the MCP Debugger ecosystem, enabling language-specific debug adapters
 * to integrate seamlessly with the main debugger.
 * 
 * @packageDocumentation
 */

// ===== Core Interfaces =====

// Debug Adapter interfaces - Types
export type {
  // Main interface
  IDebugAdapter,
  
  // Validation
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyInfo,
  
  // State and configuration
  AdapterConfig,
  AdapterCommand,
  AdapterCapabilities,
  
  // Launch configurations
  GenericLaunchConfig,
  LanguageSpecificLaunchConfig,
  
  // Features
  FeatureRequirement,
  ExceptionBreakpointFilter,
  
  // Events
  AdapterEvents,
  
  // Migration
  ConfigMigration
} from './interfaces/debug-adapter.js';

// Debug Adapter interfaces - Values (enums and classes)
export {
  // State enum
  AdapterState,
  
  // Feature enum
  DebugFeature,
  
  // Error class and enum
  AdapterError,
  AdapterErrorCode
} from './interfaces/debug-adapter.js';

// Adapter Registry interfaces - Types
export type {
  // Main interfaces
  IAdapterRegistry,
  IAdapterFactory,
  
  // Configuration and metadata
  AdapterDependencies,
  AdapterMetadata,
  AdapterInfo,
  AdapterRegistryConfig,
  
  // Validation
  FactoryValidationResult,
  
  // Utility types
  AdapterFactoryMap,
  ActiveAdapterMap
} from './interfaces/adapter-registry.js';

// Adapter Registry interfaces - Values
export {
  // Implementation helpers
  BaseAdapterFactory,
  
  // Errors
  AdapterNotFoundError,
  FactoryValidationError,
  DuplicateRegistrationError,
  
  // Type guards
  isAdapterFactory,
  isAdapterRegistry
} from './interfaces/adapter-registry.js';

// External Dependencies - Types
export type {
  // Core interfaces
  IFileSystem,
  IChildProcess,
  IProcessManager,
  INetworkManager,
  IServer,
  ILogger,
  IProxyManager,
  IProxyManagerFactory,
  IEnvironment,
  
  // Dependency injection
  IDependencies,
  PartialDependencies,
  
  // Factories
  ILoggerFactory,
  IChildProcessFactory
} from './interfaces/external-dependencies.js';

// Process interfaces - Types
export type {
  // Core process interfaces
  IProcess,
  IProcessLauncher,
  IProcessOptions,
  
  // Debug target interfaces
  IDebugTargetLauncher,
  IDebugTarget,
  
  // Proxy process interfaces
  IProxyProcessLauncher,
  IProxyProcess,
  
  // Factory
  IProcessLauncherFactory
} from './interfaces/process-interfaces.js';

// ===== Models =====

// Model types
export type {
  // Launch arguments
  CustomLaunchRequestArguments,
  
  // Session types
  SessionConfig,
  Breakpoint,
  DebugSession,
  DebugSessionInfo,
  
  // Debug info types
  Variable,
  StackFrame,
  DebugLocation
} from './models/index.js';

// Model values (enums and functions)
export {
  // Enums
  DebugLanguage,
  SessionLifecycleState,
  ExecutionState,
  SessionState,
  
  // State mapping functions
  mapLegacyState,
  mapToLegacyState
} from './models/index.js';

// ===== Factories =====

export { AdapterFactory } from './factories/adapter-factory.js';

// Adapter Policy interfaces and implementations
export type { 
  AdapterPolicy, 
  ChildSessionStrategy,
  AdapterSpecificState,
  CommandHandling 
} from './interfaces/adapter-policy.js';
export { DefaultAdapterPolicy } from './interfaces/adapter-policy.js';
export { JsDebugAdapterPolicy } from './interfaces/adapter-policy-js.js';
export { PythonAdapterPolicy } from './interfaces/adapter-policy-python.js';
export { RustAdapterPolicy } from './interfaces/adapter-policy-rust.js';
export type { RustAdapterPolicyInterface } from './interfaces/adapter-policy-rust.js';
export { MockAdapterPolicy } from './interfaces/adapter-policy-mock.js';

// DAP Client Behavior interfaces for adapter policies
export type {
  DapClientBehavior,
  DapClientContext,
  ReverseRequestResult,
  ChildSessionConfig
} from './interfaces/dap-client-behavior.js';

// Adapter launch coordination helpers
export type { AdapterLaunchBarrier } from './interfaces/adapter-launch-barrier.js';

// FileSystem abstraction for dependency injection
export type { FileSystem } from './interfaces/filesystem.js';
export { NodeFileSystem, setDefaultFileSystem, getDefaultFileSystem } from './interfaces/filesystem.js';

// ===== Re-export VSCode Debug Protocol types for convenience =====
export type { DebugProtocol } from '@vscode/debugprotocol';
