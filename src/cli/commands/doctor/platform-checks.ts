/**
 * Host-platform checks for `mcp-debugger doctor` (issue #423).
 *
 * These probe host conditions no adapter owns: the Linux Yama ptrace scope
 * (gates attach for the CodeLLDB-backed adapters) and the container
 * workspace mount. Pure reads — nothing here mutates the system.
 */
import type { IEnvironment, IFileSystem } from '@debugmcp/shared';
import { isContainerMode, getWorkspaceRoot } from '../../../utils/container-path-utils.js';

export interface PlatformCheckResult {
  id: 'container-mode' | 'workspace-mount' | 'yama-ptrace-scope';
  label: string;
  status: 'ok' | 'warn' | 'broken' | 'skipped';
  detail: string;
  fixHint?: string;
}

const YAMA_SYSCTL_FILE = '/proc/sys/kernel/yama/ptrace_scope';
const YAMA_FIX_HINT =
  'sudo sysctl kernel.yama.ptrace_scope=0 (host) or --cap-add=SYS_PTRACE (containers); see docs/cpp/README.md';

/**
 * Semantics per docs/cpp/README.md: 0 = unrestricted, 1 = ancestor-only
 * (blocks attaching to arbitrary PIDs), 2 = CAP_SYS_PTRACE only,
 * 3 = permanently disabled until reboot.
 */
export async function checkYamaPtraceScope(
  fileSystem: IFileSystem,
  platform: NodeJS.Platform
): Promise<PlatformCheckResult> {
  const base = { id: 'yama-ptrace-scope' as const, label: 'yama ptrace_scope' };

  if (platform !== 'linux') {
    return { ...base, status: 'skipped', detail: 'linux only' };
  }

  let raw: string;
  try {
    raw = await fileSystem.readFile(YAMA_SYSCTL_FILE, 'utf8');
  } catch {
    return { ...base, status: 'skipped', detail: 'Yama LSM not present' };
  }

  const scope = Number.parseInt(raw.trim(), 10);
  switch (scope) {
    case 0:
      return { ...base, status: 'ok', detail: 'ptrace_scope=0 (attach unrestricted)' };
    case 1:
      return {
        ...base,
        status: 'warn',
        detail: 'ptrace_scope=1 (attach limited to child processes)',
        fixHint: YAMA_FIX_HINT
      };
    case 2:
      return {
        ...base,
        status: 'warn',
        detail: 'ptrace_scope=2 (attach requires CAP_SYS_PTRACE)',
        fixHint: YAMA_FIX_HINT
      };
    case 3:
      return {
        ...base,
        status: 'broken',
        detail: 'ptrace_scope=3 (attach permanently disabled until reboot)'
      };
    default:
      return { ...base, status: 'skipped', detail: `unrecognized ptrace_scope value: ${raw.trim()}` };
  }
}

/**
 * Container-mode detection plus a sanity check of the workspace mount —
 * `getWorkspaceRoot` only reads env vars, so the existence/emptiness of the
 * mounted directory is verified here (a missing -v mount is the most common
 * container-mode failure, docs/docker-support.md).
 */
export async function checkContainerWorkspace(
  environment: IEnvironment,
  fileSystem: IFileSystem
): Promise<PlatformCheckResult[]> {
  const containerBase = { id: 'container-mode' as const, label: 'container mode' };
  const mountBase = { id: 'workspace-mount' as const, label: 'workspace mount' };

  if (!isContainerMode(environment)) {
    return [
      { ...containerBase, status: 'ok', detail: 'not running in container mode' },
      { ...mountBase, status: 'skipped', detail: 'host mode' }
    ];
  }

  const containerResult: PlatformCheckResult = {
    ...containerBase,
    status: 'ok',
    detail: 'MCP_CONTAINER=true'
  };

  let root: string;
  try {
    root = getWorkspaceRoot(environment);
  } catch {
    return [
      containerResult,
      {
        ...mountBase,
        status: 'broken',
        detail: 'MCP_WORKSPACE_ROOT is not set',
        fixHint: 'Set MCP_WORKSPACE_ROOT (the Docker image sets /workspace) and mount your project there'
      }
    ];
  }

  try {
    const stats = await fileSystem.stat(root);
    if (!stats.isDirectory()) {
      return [
        containerResult,
        {
          ...mountBase,
          status: 'broken',
          detail: `${root} exists but is not a directory`
        }
      ];
    }
  } catch {
    return [
      containerResult,
      {
        ...mountBase,
        status: 'broken',
        detail: `${root} does not exist — is the volume mounted?`,
        fixHint: 'docker run -v "$(pwd)":/workspace ... (see docs/docker-support.md)'
      }
    ];
  }

  try {
    const entries = await fileSystem.readdir(root);
    if (entries.length === 0) {
      return [
        containerResult,
        {
          ...mountBase,
          status: 'warn',
          detail: `${root} is mounted but empty — wrong host directory?`
        }
      ];
    }
    return [
      containerResult,
      { ...mountBase, status: 'ok', detail: `${root} (${entries.length} entries)` }
    ];
  } catch {
    return [
      containerResult,
      { ...mountBase, status: 'warn', detail: `${root} exists but could not be listed` }
    ];
  }
}
