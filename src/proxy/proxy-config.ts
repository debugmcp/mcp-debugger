/**
 * Configuration for starting a proxy - language agnostic version
 */
import { DebugLanguage } from '../session/models.js';

/**
 * Configuration for starting a proxy
 */
export interface ProxyConfig {
  sessionId: string;
  language: DebugLanguage;        // New field to specify which language
  executablePath?: string;        // Renamed from pythonPath, now optional (adapter can discover)
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
  
  // Deprecated - for backward compatibility only
  pythonPath?: string;            // @deprecated Use executablePath instead
}

/**
 * Legacy ProxyConfig for backward compatibility
 * @deprecated This type will be removed in v3.0.0
 */
export interface LegacyProxyConfig extends Omit<ProxyConfig, 'language' | 'executablePath'> {
  pythonPath: string;
}
