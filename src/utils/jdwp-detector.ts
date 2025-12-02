/**
 * Utility to detect JDWP configuration from running Java processes
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

export interface JdwpConfig {
  suspend: boolean;
  port?: number;
  address?: string;
}

/**
 * Detect JDWP suspend mode from a process by port number
 */
export function detectSuspendByPort(port: number): boolean | null {
  try {
    // Find process ID listening on the port
    const lsofOutput = execSync(`lsof -ti :${port} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();

    if (!lsofOutput) {
      return null;
    }

    const pid = parseInt(lsofOutput.split('\n')[0]);
    if (isNaN(pid)) {
      return null;
    }

    return detectSuspendByPid(pid);
  } catch {
    // lsof failed or timeout
    return null;
  }
}

/**
 * Detect JDWP suspend mode from a process by PID
 */
export function detectSuspendByPid(pid: number): boolean | null {
  try {
    // Read command line from /proc
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf-8');

    // Split by null bytes
    const args = cmdline.split('\0');

    // Look for JDWP agent arguments
    for (const arg of args) {
      if (arg.includes('agentlib:jdwp=') || arg.includes('Xrunjdwp:')) {
        const jdwpConfig = parseJdwpArgument(arg);
        if (jdwpConfig !== null) {
          return jdwpConfig.suspend;
        }
      }
    }

    return null;
  } catch {
    // /proc read failed (not Linux, or no access)
    return null;
  }
}

/**
 * Parse JDWP argument string to extract configuration
 *
 * Examples:
 *   -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:8000
 *   -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005
 */
export function parseJdwpArgument(arg: string): JdwpConfig | null {
  // Extract the part after jdwp=
  const match = arg.match(/jdwp[=:](.*)/);
  if (!match) {
    return null;
  }

  const params = match[1];
  const config: Partial<JdwpConfig> = {};

  // Parse comma-separated key=value pairs
  for (const pair of params.split(',')) {
    const [key, value] = pair.split('=');

    switch (key) {
      case 'suspend':
        config.suspend = value === 'y';
        break;
      case 'address': {
        // Address can be "5005", "*:5005", "localhost:5005"
        const portMatch = value.match(/:?(\d+)$/);
        if (portMatch) {
          config.port = parseInt(portMatch[1]);
        }
        config.address = value;
        break;
      }
    }
  }

  // Only return if we found suspend setting
  if (config.suspend !== undefined) {
    return config as JdwpConfig;
  }

  return null;
}
