/**
 * Host-platform checks for `mcp-debugger doctor` (issue #423).
 *
 * These probe host conditions no adapter owns: the Linux Yama ptrace scope
 * (gates attach for the CodeLLDB-backed adapters) and the container
 * workspace mount. Pure reads — nothing here mutates the system.
 */
import type { IEnvironment, IFileSystem, IProcessManager } from '@debugmcp/shared';
import { isContainerMode, getWorkspaceRoot } from '../../../utils/container-path-utils.js';

export interface PlatformCheckResult {
  id: 'container-mode' | 'workspace-mount' | 'yama-ptrace-scope' | 'stale-containers';
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
    // Only the exact string 'true' enables container mode — a truthy-looking
    // near-miss (MCP_CONTAINER=1/TRUE/yes) is precisely the misconfiguration
    // a doctor run should call out rather than bless as "host mode".
    // Reads MCP_CONTAINER directly on purpose: the near-miss warning needs
    // the raw value, which neither helper's boolean can carry.
    const rawValue = environment.get('MCP_CONTAINER');
    if (rawValue !== undefined && rawValue !== '') {
      return [
        {
          ...containerBase,
          status: 'warn',
          detail: `MCP_CONTAINER='${rawValue}' is set but does not enable container mode`,
          fixHint: "Container mode requires exactly MCP_CONTAINER=true"
        },
        { ...mountBase, status: 'skipped', detail: 'host mode (container mode not enabled)' }
      ];
    }
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

/**
 * Long-running mcp-debugger containers on the host (issue #633).
 *
 * A Docker-based stdio server used to outlive the client that started it, so
 * `docker run --rm` never fired and every session leaked a container. The
 * server now exits on a real client disconnect, but that only takes effect
 * once the fixed image is pulled, and containers already leaked by an older
 * image (or by a hard-killed supervisor) stay until someone removes them.
 *
 * Doctor cannot tell an in-use container from an orphan — an active session
 * looks identical to a leaked one — so this reports on AGE and says so rather
 * than claiming a verdict it cannot support. Pure read, in keeping with this
 * module: the removal command goes in the fix hint, it is never run here.
 */
const STALE_CONTAINER_AGE_MS = 24 * 60 * 60 * 1000;

/** `docker ps` timestamps look like `2026-08-31 20:01:34 +0000 UTC`. */
function parseDockerTimestamp(raw: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4})/.exec(raw.trim());
  if (!match) return null;
  const parsed = Date.parse(match[1].replace(' ', 'T').replace(' ', ''));
  return Number.isNaN(parsed) ? null : parsed;
}

export async function checkStaleContainers(
  processManager: IProcessManager | undefined,
  now: number = Date.now()
): Promise<PlatformCheckResult> {
  const base = { id: 'stale-containers' as const, label: 'stale containers' };

  if (!processManager) {
    return { ...base, status: 'skipped', detail: 'no process manager available' };
  }

  let stdout: string;
  try {
    // Name filter rather than an image filter: orphans from older builds show
    // up under bare image IDs, but every one of them runs the same binary.
    ({ stdout } = await processManager.exec(
      'docker ps --filter ancestor=debugmcp/mcp-debugger:latest --format "{{.Names}}\t{{.CreatedAt}}"'
    ));
  } catch {
    // Docker absent, daemon down, or no permission — none of which is a
    // finding about this installation.
    return { ...base, status: 'skipped', detail: 'docker not available' };
  }

  const containers = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, created] = line.split('\t');
      return { name, startedAt: parseDockerTimestamp(created ?? '') };
    });

  if (containers.length === 0) {
    return { ...base, status: 'ok', detail: 'no mcp-debugger containers running' };
  }

  const stale = containers.filter(
    (container) => container.startedAt !== null && now - container.startedAt > STALE_CONTAINER_AGE_MS
  );

  if (stale.length === 0) {
    return {
      ...base,
      status: 'ok',
      detail: `${containers.length} mcp-debugger container(s) running, none older than 24h`
    };
  }

  const oldestDays = Math.floor(
    (now - Math.min(...stale.map((container) => container.startedAt as number))) / 86_400_000
  );

  return {
    ...base,
    status: 'warn',
    detail:
      `${stale.length} of ${containers.length} mcp-debugger container(s) have run for over 24h ` +
      `(oldest ${oldestDays}d) — likely orphaned by a client that exited (issue #633), ` +
      'though an active session looks the same',
    fixHint:
      'Check them with `docker ps --filter ancestor=debugmcp/mcp-debugger:latest`, ' +
      'then remove the ones you no longer need with `docker rm -f <name>`'
  };
}
