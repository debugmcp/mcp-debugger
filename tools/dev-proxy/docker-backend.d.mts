/**
 * Types for `docker-backend.mjs`, so its TypeScript tests see a real API
 * instead of `@ts-ignore`-ing the import into `any` (issue #562).
 */
import type { CommandRunner } from './command-runner.mjs';

/** Reserved Docker label used to identify containers owned by one dev proxy. */
export const DOCKER_OWNER_LABEL: string;

/** A backend command line, before it is handed to `spawn`. */
export interface BackendInvocation {
  command: string;
  args: string[];
}

/** Is this invocation a `docker run` (by executable basename and subcommand)? */
export function isDockerRunInvocation(invocation: BackendInvocation): boolean;

/**
 * Add a proxy ownership label immediately after the `run` subcommand, since
 * Docker run options must precede the image. The caller's invocation is never
 * mutated; a non-`docker run` invocation is returned unchanged, by identity.
 */
export function addDockerOwnershipLabel(
  invocation: BackendInvocation,
  ownerId: string
): BackendInvocation;

/** Container ids removed by {@link removeOwnedDockerContainers}. */
export interface RemovedDockerContainers {
  /** Ids carrying this proxy's {@link DOCKER_OWNER_LABEL}. */
  ownedIds: string[];
  /** Unlabeled ids matched only by published port; always `[]` unless asked for. */
  legacyIds: string[];
}

/**
 * Remove containers owned by this proxy. Network backends additionally reap
 * unlabeled legacy containers by their published port.
 */
export function removeOwnedDockerContainers(options: {
  dockerCommand: string;
  ownerId: string;
  port: number;
  includeLegacyPort: boolean;
  log?: (message: string) => void;
  /** Injectable for tests; defaults to the bounded async command runner. */
  runFile?: CommandRunner;
}): Promise<RemovedDockerContainers>;
