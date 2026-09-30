/**
 * Types for `check-mcp-registry-metadata.mjs`, so its TypeScript tests see a real API.
 */

/** The registry schema's cap on `description`. */
export const DESCRIPTION_MAX: number;

/** The registry schema's cap on `title`. */
export const TITLE_MAX: number;

/** The server name the Dockerfile's `io.modelcontextprotocol.server.name` label declares, or `null`. */
export function dockerfileServerName(dockerfile: string): string | null;

/** The three sources the check compares, as parsed from a checkout. */
export interface McpRegistrySources {
  serverJson: Record<string, any>;
  cliPackage: Record<string, any>;
  dockerfile: string;
  rootVersion: string;
}

/** Every inconsistency between the sources and `version`; empty when consistent. */
export function checkMcpRegistryMetadata(input: {
  serverJson: Record<string, any>;
  cliPackage: Record<string, any>;
  dockerfile: string;
  version: string;
}): string[];

/** Read server.json, the CLI package.json, the Dockerfile and the root version from a checkout. */
export function readMcpRegistrySources(root: string): McpRegistrySources;
