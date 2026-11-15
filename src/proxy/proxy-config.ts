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
  /** id is the store breakpoint id, echoed back by the worker's
   *  breakpoints_synced status for exact store matching (issue #439) */
  initialBreakpoints?: Array<{ id?: string; file: string; line: number; condition?: string; logMessage?: string; suspendPolicy?: 'all' | 'thread' }>;
  initialFunctionBreakpoints?: Array<{ name: string; condition?: string }>;
  /**
   * The launcher's decision that this launch runs with the debugger off —
   * an honoured `noDebug` (issue #710) — stamped once so the worker never
   * re-derives it from a launch config a transform may have reshaped
   * (issue #746).
   */
  debuggerOff?: boolean;
  /** Effective log level for the per-session proxy logger (issue #403) */
  logLevel?: string;
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

/**
 * Whether a launch config, as the worker is given it, is an attach (issue
 * #1151). The one read of this fact: the worker decides from it what its
 * shutdown does to the program (detach, or end it), and the session records
 * from it whether it borrows the program or owns it. The config is the
 * adapter's transformed one, so a transform that rewrites `request` (an
 * adapter with no attach of its own turns attach-shaped launch arguments into
 * a launch) is seen by both.
 */
export function launchConfigIsAttach(launchConfig: object | null | undefined): boolean {
  const config = launchConfig as { request?: unknown; __attachMode?: unknown } | null | undefined;
  return config?.request === 'attach' || config?.__attachMode === true;
}
