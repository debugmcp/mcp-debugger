/**
 * Unit tests for debug-adapter-interface
 * Testing enums, error classes, and type validation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdapterState,
  AdapterError,
  AdapterErrorCode,
  DebugFeature,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  DependencyInfo,
  AdapterCommand,
  AdapterConfig,
  GenericLaunchConfig,
  LanguageSpecificLaunchConfig,
  FeatureRequirement,
  AdapterCapabilities,
  ExceptionBreakpointFilter
} from '../../../../src/adapters/debug-adapter-interface.js';
import { DebugLanguage } from '../../../../src/session/models.js';

describe('debug-adapter-interface', () => {
  describe('AdapterState enum', () => {
    it('should have all expected states', () => {
      expect(AdapterState.UNINITIALIZED).toBe('uninitialized');
      expect(AdapterState.INITIALIZING).toBe('initializing');
      expect(AdapterState.READY).toBe('ready');
      expect(AdapterState.CONNECTED).toBe('connected');
      expect(AdapterState.DEBUGGING).toBe('debugging');
      expect(AdapterState.DISCONNECTED).toBe('disconnected');
      expect(AdapterState.ERROR).toBe('error');
    });

    it('should have exactly 7 states', () => {
      const states = Object.values(AdapterState);
      expect(states).toHaveLength(7);
    });
  });

  describe('AdapterErrorCode enum', () => {
    it('should have all environment error codes', () => {
      expect(AdapterErrorCode.ENVIRONMENT_INVALID).toBe('ENVIRONMENT_INVALID');
      expect(AdapterErrorCode.EXECUTABLE_NOT_FOUND).toBe('EXECUTABLE_NOT_FOUND');
      expect(AdapterErrorCode.ADAPTER_NOT_INSTALLED).toBe('ADAPTER_NOT_INSTALLED');
      expect(AdapterErrorCode.INCOMPATIBLE_VERSION).toBe('INCOMPATIBLE_VERSION');
    });

    it('should have all connection error codes', () => {
      expect(AdapterErrorCode.CONNECTION_FAILED).toBe('CONNECTION_FAILED');
      expect(AdapterErrorCode.CONNECTION_TIMEOUT).toBe('CONNECTION_TIMEOUT');
      expect(AdapterErrorCode.CONNECTION_LOST).toBe('CONNECTION_LOST');
    });

    it('should have all protocol error codes', () => {
      expect(AdapterErrorCode.INVALID_RESPONSE).toBe('INVALID_RESPONSE');
      expect(AdapterErrorCode.UNSUPPORTED_OPERATION).toBe('UNSUPPORTED_OPERATION');
    });

    it('should have all runtime error codes', () => {
      expect(AdapterErrorCode.DEBUGGER_ERROR).toBe('DEBUGGER_ERROR');
      expect(AdapterErrorCode.SCRIPT_NOT_FOUND).toBe('SCRIPT_NOT_FOUND');
      expect(AdapterErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    });

    it('should have generic error code', () => {
      expect(AdapterErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should have exactly 13 error codes', () => {
      const errorCodes = Object.values(AdapterErrorCode);
      expect(errorCodes).toHaveLength(13);
    });
  });

  describe('DebugFeature enum', () => {
    it('should have all expected debug features', () => {
      expect(DebugFeature.CONDITIONAL_BREAKPOINTS).toBe('conditionalBreakpoints');
      expect(DebugFeature.FUNCTION_BREAKPOINTS).toBe('functionBreakpoints');
      expect(DebugFeature.EXCEPTION_BREAKPOINTS).toBe('exceptionBreakpoints');
      expect(DebugFeature.VARIABLE_PAGING).toBe('variablePaging');
      expect(DebugFeature.EVALUATE_FOR_HOVERS).toBe('evaluateForHovers');
      expect(DebugFeature.SET_VARIABLE).toBe('setVariable');
      expect(DebugFeature.SET_EXPRESSION).toBe('setExpression');
      expect(DebugFeature.DATA_BREAKPOINTS).toBe('dataBreakpoints');
      expect(DebugFeature.DISASSEMBLE_REQUEST).toBe('disassembleRequest');
      expect(DebugFeature.TERMINATE_THREADS_REQUEST).toBe('terminateThreadsRequest');
      expect(DebugFeature.DELAYED_STACK_TRACE_LOADING).toBe('delayedStackTraceLoading');
      expect(DebugFeature.LOADED_SOURCES_REQUEST).toBe('loadedSourcesRequest');
      expect(DebugFeature.LOG_POINTS).toBe('logPoints');
      expect(DebugFeature.TERMINATE_REQUEST).toBe('terminateRequest');
      expect(DebugFeature.RESTART_REQUEST).toBe('restartRequest');
      expect(DebugFeature.EXCEPTION_OPTIONS).toBe('exceptionOptions');
      expect(DebugFeature.EXCEPTION_INFO_REQUEST).toBe('exceptionInfoRequest');
      expect(DebugFeature.STEP_BACK).toBe('stepBack');
      expect(DebugFeature.REVERSE_DEBUGGING).toBe('reverseDebugging');
      expect(DebugFeature.STEP_IN_TARGETS_REQUEST).toBe('stepInTargetsRequest');
    });

    it('should have exactly 20 features', () => {
      const features = Object.values(DebugFeature);
      expect(features).toHaveLength(20);
    });
  });

  describe('AdapterError class', () => {
    it('should create error with message and code', () => {
      const error = new AdapterError('Test error', AdapterErrorCode.CONNECTION_FAILED);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AdapterError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(AdapterErrorCode.CONNECTION_FAILED);
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('AdapterError');
    });

    it('should create error with recoverable flag', () => {
      const error = new AdapterError('Recoverable error', AdapterErrorCode.CONNECTION_TIMEOUT, true);
      
      expect(error.message).toBe('Recoverable error');
      expect(error.code).toBe(AdapterErrorCode.CONNECTION_TIMEOUT);
      expect(error.recoverable).toBe(true);
    });

    it('should default recoverable to false', () => {
      const error = new AdapterError('Non-recoverable error', AdapterErrorCode.UNKNOWN_ERROR);
      
      expect(error.recoverable).toBe(false);
    });

    it('should have proper error stack trace', () => {
      const error = new AdapterError('Stack trace test', AdapterErrorCode.DEBUGGER_ERROR);
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AdapterError');
      expect(error.stack).toContain('Stack trace test');
    });
  });

  describe('Type interfaces', () => {
    describe('ValidationResult', () => {
      it('should create valid validation result', () => {
        const result: ValidationResult = {
          valid: true,
          errors: [],
          warnings: []
        };
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should create invalid validation result with errors', () => {
        const error: ValidationError = {
          code: 'TEST_ERROR',
          message: 'Test error message',
          recoverable: false
        };
        
        const result: ValidationResult = {
          valid: false,
          errors: [error],
          warnings: []
        };
        
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('TEST_ERROR');
      });

      it('should support warnings', () => {
        const warning: ValidationWarning = {
          code: 'TEST_WARNING',
          message: 'Test warning message'
        };
        
        const result: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [warning]
        };
        
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].code).toBe('TEST_WARNING');
      });
    });

    describe('DependencyInfo', () => {
      it('should create dependency info with required fields', () => {
        const dep: DependencyInfo = {
          name: 'debugpy',
          required: true
        };
        
        expect(dep.name).toBe('debugpy');
        expect(dep.required).toBe(true);
      });

      it('should support optional fields', () => {
        const dep: DependencyInfo = {
          name: 'pytest',
          version: '>=7.0.0',
          required: false,
          installCommand: 'pip install pytest>=7.0.0'
        };
        
        expect(dep.name).toBe('pytest');
        expect(dep.version).toBe('>=7.0.0');
        expect(dep.required).toBe(false);
        expect(dep.installCommand).toBe('pip install pytest>=7.0.0');
      });
    });

    describe('AdapterCommand', () => {
      it('should create adapter command with required fields', () => {
        const command: AdapterCommand = {
          command: 'python',
          args: ['-m', 'debugpy', '--listen', '5678']
        };
        
        expect(command.command).toBe('python');
        expect(command.args).toHaveLength(4);
        expect(command.args[0]).toBe('-m');
      });

      it('should support environment variables', () => {
        const command: AdapterCommand = {
          command: 'node',
          args: ['--inspect'],
          env: {
            NODE_ENV: 'development',
            DEBUG: 'true'
          }
        };
        
        expect(command.env).toBeDefined();
        expect(command.env!.NODE_ENV).toBe('development');
        expect(command.env!.DEBUG).toBe('true');
      });
    });

    describe('AdapterConfig', () => {
      it('should create adapter config with all fields', () => {
        const config: AdapterConfig = {
          sessionId: 'test-session-123',
          executablePath: '/usr/bin/python3',
          adapterHost: 'localhost',
          adapterPort: 5678,
          logDir: '/tmp/logs',
          scriptPath: '/app/main.py',
          launchConfig: {
            stopOnEntry: true
          }
        };
        
        expect(config.sessionId).toBe('test-session-123');
        expect(config.executablePath).toBe('/usr/bin/python3');
        expect(config.adapterHost).toBe('localhost');
        expect(config.adapterPort).toBe(5678);
        expect(config.logDir).toBe('/tmp/logs');
        expect(config.scriptPath).toBe('/app/main.py');
        expect(config.launchConfig.stopOnEntry).toBe(true);
      });

      it('should support optional script args', () => {
        const config: AdapterConfig = {
          sessionId: 'test-session-456',
          executablePath: 'python',
          adapterHost: '127.0.0.1',
          adapterPort: 5679,
          logDir: './logs',
          scriptPath: 'script.py',
          scriptArgs: ['--verbose', '--debug'],
          launchConfig: {}
        };
        
        expect(config.scriptArgs).toBeDefined();
        expect(config.scriptArgs).toHaveLength(2);
        expect(config.scriptArgs![0]).toBe('--verbose');
      });
    });

    describe('GenericLaunchConfig', () => {
      it('should create empty launch config', () => {
        const config: GenericLaunchConfig = {};
        
        expect(Object.keys(config)).toHaveLength(0);
      });

      it('should support all optional fields', () => {
        const config: GenericLaunchConfig = {
          stopOnEntry: false,
          justMyCode: true,
          env: {
            PYTHONPATH: '/app',
            DEBUG_MODE: '1'
          },
          cwd: '/workspace',
          args: ['--test', 'file.py']
        };
        
        expect(config.stopOnEntry).toBe(false);
        expect(config.justMyCode).toBe(true);
        expect(config.env).toBeDefined();
        expect(config.env!.PYTHONPATH).toBe('/app');
        expect(config.cwd).toBe('/workspace');
        expect(config.args).toHaveLength(2);
      });
    });

    describe('LanguageSpecificLaunchConfig', () => {
      it('should extend generic launch config', () => {
        const config: LanguageSpecificLaunchConfig = {
          stopOnEntry: true,
          pythonPath: '/usr/bin/python3',
          django: true,
          pyramid: false
        };
        
        expect(config.stopOnEntry).toBe(true);
        expect(config['pythonPath']).toBe('/usr/bin/python3');
        expect(config['django']).toBe(true);
        expect(config['pyramid']).toBe(false);
      });
    });


    describe('FeatureRequirement', () => {
      it('should create dependency requirement', () => {
        const req: FeatureRequirement = {
          type: 'dependency',
          description: 'Requires debugpy >= 1.6.0',
          required: true
        };
        
        expect(req.type).toBe('dependency');
        expect(req.description).toBe('Requires debugpy >= 1.6.0');
        expect(req.required).toBe(true);
      });

      it('should create version requirement', () => {
        const req: FeatureRequirement = {
          type: 'version',
          description: 'Python 3.8 or higher',
          required: false
        };
        
        expect(req.type).toBe('version');
        expect(req.required).toBe(false);
      });

      it('should create configuration requirement', () => {
        const req: FeatureRequirement = {
          type: 'configuration',
          description: 'Enable remote debugging in settings',
          required: true
        };
        
        expect(req.type).toBe('configuration');
        expect(req.required).toBe(true);
      });
    });

    describe('AdapterCapabilities', () => {
      it('should create empty capabilities', () => {
        const caps: AdapterCapabilities = {};
        
        expect(Object.keys(caps)).toHaveLength(0);
      });

      it('should support all capability flags', () => {
        const caps: AdapterCapabilities = {
          supportsConfigurationDoneRequest: true,
          supportsFunctionBreakpoints: false,
          supportsConditionalBreakpoints: true,
          supportsHitConditionalBreakpoints: true,
          supportsEvaluateForHovers: false,
          supportsStepBack: false,
          supportsSetVariable: true,
          supportsRestartFrame: false,
          supportsGotoTargetsRequest: false,
          supportsStepInTargetsRequest: true,
          supportsCompletionsRequest: true,
          supportsModulesRequest: false,
          supportsRestartRequest: true,
          supportsExceptionOptions: true,
          supportsValueFormattingOptions: false,
          supportsExceptionInfoRequest: true,
          supportTerminateDebuggee: true,
          supportSuspendDebuggee: false,
          supportsDelayedStackTraceLoading: true,
          supportsLoadedSourcesRequest: false,
          supportsLogPoints: true,
          supportsTerminateThreadsRequest: false,
          supportsSetExpression: true,
          supportsTerminateRequest: true,
          supportsDataBreakpoints: false,
          supportsReadMemoryRequest: false,
          supportsWriteMemoryRequest: false,
          supportsDisassembleRequest: false,
          supportsCancelRequest: true,
          supportsBreakpointLocationsRequest: true,
          supportsClipboardContext: false,
          supportsSteppingGranularity: true,
          supportsInstructionBreakpoints: false,
          supportsExceptionFilterOptions: true,
          supportsSingleThreadExecutionRequests: false
        };
        
        expect(caps.supportsConfigurationDoneRequest).toBe(true);
        expect(caps.supportsFunctionBreakpoints).toBe(false);
        expect(caps.supportsExceptionFilterOptions).toBe(true);
      });

      it('should support exception filters', () => {
        const filter: ExceptionBreakpointFilter = {
          filter: 'raised',
          label: 'Raised Exceptions',
          description: 'Break on all raised exceptions',
          default: true,
          supportsCondition: true,
          conditionDescription: 'Enter exception type to filter'
        };
        
        const caps: AdapterCapabilities = {
          exceptionBreakpointFilters: [filter]
        };
        
        expect(caps.exceptionBreakpointFilters).toHaveLength(1);
        expect(caps.exceptionBreakpointFilters![0].filter).toBe('raised');
        expect(caps.exceptionBreakpointFilters![0].supportsCondition).toBe(true);
      });

      it('should support completion trigger characters', () => {
        const caps: AdapterCapabilities = {
          supportsCompletionsRequest: true,
          completionTriggerCharacters: ['.', ':', '(']
        };
        
        expect(caps.completionTriggerCharacters).toHaveLength(3);
        expect(caps.completionTriggerCharacters).toContain('.');
      });

      it('should support checksum algorithms', () => {
        const caps: AdapterCapabilities = {
          supportedChecksumAlgorithms: ['MD5' as any, 'SHA1' as any]
        };
        
        expect(caps.supportedChecksumAlgorithms).toHaveLength(2);
      });
    });

    describe('ExceptionBreakpointFilter', () => {
      it('should create filter with required fields', () => {
        const filter: ExceptionBreakpointFilter = {
          filter: 'uncaught',
          label: 'Uncaught Exceptions'
        };
        
        expect(filter.filter).toBe('uncaught');
        expect(filter.label).toBe('Uncaught Exceptions');
      });

      it('should support all optional fields', () => {
        const filter: ExceptionBreakpointFilter = {
          filter: 'userUnhandled',
          label: 'User Unhandled Exceptions',
          description: 'Break when exception is not handled by user code',
          default: false,
          supportsCondition: true,
          conditionDescription: 'Exception type (e.g., ValueError)'
        };
        
        expect(filter.description).toBe('Break when exception is not handled by user code');
        expect(filter.default).toBe(false);
        expect(filter.supportsCondition).toBe(true);
        expect(filter.conditionDescription).toBe('Exception type (e.g., ValueError)');
      });
    });
  });

  describe('Error handling patterns', () => {
    it('should create different error types', () => {
      const envError = new AdapterError('Python not found', AdapterErrorCode.EXECUTABLE_NOT_FOUND);
      const connError = new AdapterError('Connection refused', AdapterErrorCode.CONNECTION_FAILED);
      const protoError = new AdapterError('Invalid DAP response', AdapterErrorCode.INVALID_RESPONSE);
      
      expect(envError.code).toBe(AdapterErrorCode.EXECUTABLE_NOT_FOUND);
      expect(connError.code).toBe(AdapterErrorCode.CONNECTION_FAILED);
      expect(protoError.code).toBe(AdapterErrorCode.INVALID_RESPONSE);
    });

    it('should support error recovery patterns', () => {
      const recoverableError = new AdapterError(
        'Connection timeout - retrying',
        AdapterErrorCode.CONNECTION_TIMEOUT,
        true
      );
      
      const fatalError = new AdapterError(
        'Adapter not installed',
        AdapterErrorCode.ADAPTER_NOT_INSTALLED,
        false
      );
      
      expect(recoverableError.recoverable).toBe(true);
      expect(fatalError.recoverable).toBe(false);
    });
  });

  describe('Type safety tests', () => {
    it('should enforce correct enum usage', () => {
      const state: AdapterState = AdapterState.READY;
      expect(Object.values(AdapterState)).toContain(state);
    });

    it('should enforce correct error code usage', () => {
      const errorCode: AdapterErrorCode = AdapterErrorCode.DEBUGGER_ERROR;
      expect(Object.values(AdapterErrorCode)).toContain(errorCode);
    });

    it('should enforce correct feature usage', () => {
      const feature: DebugFeature = DebugFeature.CONDITIONAL_BREAKPOINTS;
      expect(Object.values(DebugFeature)).toContain(feature);
    });
  });
});
