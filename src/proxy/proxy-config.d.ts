/**
 * Configuration for starting a proxy - language agnostic version
 */
import { DebugLanguage } from '@debugmcp/shared';
/**
 * Configuration for starting a proxy
 */
export interface ProxyConfig {
    sessionId: string;
    language: DebugLanguage;
    executablePath?: string;
    adapterHost: string;
    adapterPort: number;
    logDir: string;
    scriptPath: string;
    scriptArgs?: string[];
    stopOnEntry?: boolean;
    justMyCode?: boolean;
    initialBreakpoints?: Array<{
        file: string;
        line: number;
        condition?: string;
    }>;
    dryRunSpawn?: boolean;
    adapterCommand?: {
        command: string;
        args: string[];
        env?: Record<string, string>;
    };
}
