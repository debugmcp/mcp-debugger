/**
 * Configuration for starting a proxy - language agnostic version
 */
import { DebugLanguage, type ExceptionBreakMode, type LanguageSpecificLaunchConfig } from '@debugmcp/shared';

/**
 * Configuration for starting a proxy
 */
export interface ProxyConfig {
  sessionId: string;
  language: DebugLanguage;        // Language to specify which debugger to use
  executablePath?: string;        // Optional - adapter can discover if not provided
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  initialBreakpoints?: Array<{ file: string; line: number; condition?: string; logMessage?: string; suspendPolicy?: 'all' | 'thread' }>;
  initialFunctionBreakpoints?: Array<{ name: string; condition?: string }>;
  dryRunSpawn?: boolean;
  breakOnExceptions?: ExceptionBreakMode;
  launchConfig?: LanguageSpecificLaunchConfig;
  attachMode?: boolean;           // True for attach sessions; direct-connect attach skips local toolchain probing
  
  // Adapter spawn command info - needed for proxy to spawn the correct adapter
  adapterCommand?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
}
