/**
 * Configuration for starting a proxy - language agnostic version
 */
import { DebugLanguage } from '../session/models.js';

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
  initialBreakpoints?: Array<{ file: string; line: number; condition?: string }>;
  dryRunSpawn?: boolean;
  
  // Adapter spawn command info - needed for proxy to spawn the correct adapter
  adapterCommand?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
}
