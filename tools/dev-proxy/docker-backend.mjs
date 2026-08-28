/** Reserved Docker label used to identify containers owned by one dev proxy. */
export const DOCKER_OWNER_LABEL = 'io.debugmcp.dev-proxy.owner';

function executableBasename(command) {
  return command.split(/[\\/]/).pop()?.toLowerCase() ?? '';
}

/** @param {{ command: string, args: string[] }} invocation */
export function isDockerRunInvocation(invocation) {
  const executable = executableBasename(invocation.command);
  return (executable === 'docker' || executable === 'docker.exe') && invocation.args[0] === 'run';
}

/**
 * Add a proxy ownership label without changing the caller's invocation.
 * Docker run options must precede the image, so the reserved label is placed
 * immediately after the `run` subcommand.
 *
 * @param {{ command: string, args: string[] }} invocation
 * @param {string} ownerId
 */
export function addDockerOwnershipLabel(invocation, ownerId) {
  if (!isDockerRunInvocation(invocation)) return invocation;
  return {
    command: invocation.command,
    args: [
      invocation.args[0],
      '--label',
      `${DOCKER_OWNER_LABEL}=${ownerId}`,
      ...invocation.args.slice(1),
    ],
  };
}

function parseIds(output) {
  return String(output).trim().split(/\r?\n/).filter(Boolean);
}

/**
 * Remove containers owned by this proxy. Network backends additionally reap
 * unlabeled legacy containers by their published port.
 *
 * @param {object} options
 * @param {string} options.dockerCommand
 * @param {string} options.ownerId
 * @param {number} options.port
 * @param {boolean} options.includeLegacyPort
 * @param {(message: string) => void} [options.log]
 * @param {typeof execFileSync} [options.execFile] Injectable for tests.
 */
export function removeOwnedDockerContainers({
  dockerCommand,
  ownerId,
  port,
  includeLegacyPort,
  log = () => {},
  execFile = execFileSync,
}) {
  const options = { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] };
  const ownedIds = parseIds(
    execFile(
      dockerCommand,
      ['ps', '-aq', '--filter', `label=${DOCKER_OWNER_LABEL}=${ownerId}`],
      options
    )
  );

  const legacyIds = includeLegacyPort
    ? parseIds(
        execFile(
          dockerCommand,
          ['ps', '-q', '--filter', `publish=${port}`],
          options
        )
      ).filter((id) => !ownedIds.includes(id))
    : [];

  for (const id of ownedIds) {
    log(`Removing owned Docker container ${id}`);
    try {
      execFile(dockerCommand, ['rm', '-f', id], { stdio: 'ignore' });
    } catch { /* already removed */ }
  }
  for (const id of legacyIds) {
    log(`Removing legacy Docker container ${id} on port ${port}`);
    try {
      execFile(dockerCommand, ['rm', '-f', id], { stdio: 'ignore' });
    } catch { /* already removed */ }
  }

  return { ownedIds, legacyIds };
}
import { execFileSync } from 'child_process';
