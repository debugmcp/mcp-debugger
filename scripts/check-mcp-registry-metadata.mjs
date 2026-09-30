/**
 * Consistency check for the official MCP Registry listing (issue #835).
 *
 * The registry accepts `server.json` only if every package it lists proves ownership at
 * exactly the listed version: the npm package's `mcpName` and the Docker image's
 * `io.modelcontextprotocol.server.name` label must both equal the server name. Those three
 * copies of the name live in three files, and the versions move with every release cut, so
 * this check runs in the release dry-run, in the release job before publishing, and in the
 * unit tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMain } from './lib/is-main.mjs';

/** The registry's schema caps these fields (server.schema.json 2025-12-11). */
export const DESCRIPTION_MAX = 100;
export const TITLE_MAX = 100;

const LABEL = /^LABEL\s+io\.modelcontextprotocol\.server\.name="([^"]+)"\s*$/m;

/**
 * The server name the Dockerfile's label declares, or `null` when there is no label.
 *
 * @param {string} dockerfile
 * @returns {string | null}
 */
export function dockerfileServerName(dockerfile) {
  const match = LABEL.exec(dockerfile.replace(/\r\n/g, '\n'));
  return match ? match[1] : null;
}

/**
 * Every way the three sources disagree with each other or with `version`.
 *
 * @param {{ serverJson: any, cliPackage: any, dockerfile: string, version: string }} input
 * @returns {string[]} problems; empty when the listing is consistent
 */
export function checkMcpRegistryMetadata({ serverJson, cliPackage, dockerfile, version }) {
  const problems = [];
  const name = serverJson.name;

  if (cliPackage.mcpName !== name) {
    problems.push(`packages/mcp-debugger/package.json mcpName is ${JSON.stringify(cliPackage.mcpName)}, server.json name is ${JSON.stringify(name)}`);
  }
  const label = dockerfileServerName(dockerfile);
  if (label !== name) {
    problems.push(`Dockerfile label io.modelcontextprotocol.server.name is ${JSON.stringify(label)}, server.json name is ${JSON.stringify(name)}`);
  }
  if (typeof serverJson.description !== 'string' || serverJson.description.length > DESCRIPTION_MAX) {
    problems.push(`server.json description must be at most ${DESCRIPTION_MAX} characters`);
  }
  if (serverJson.title !== undefined && serverJson.title.length > TITLE_MAX) {
    problems.push(`server.json title must be at most ${TITLE_MAX} characters`);
  }
  if (serverJson.version !== version) {
    problems.push(`server.json version is ${serverJson.version}, expected ${version}`);
  }

  const packages = serverJson.packages ?? [];
  const npm = packages.find(entry => entry.registryType === 'npm');
  const oci = packages.find(entry => entry.registryType === 'oci');
  if (!npm) {
    problems.push('server.json lists no npm package');
  } else {
    if (npm.identifier !== cliPackage.name) {
      problems.push(`server.json npm identifier is ${npm.identifier}, the CLI package is ${cliPackage.name}`);
    }
    if (npm.version !== version) problems.push(`server.json npm version is ${npm.version}, expected ${version}`);
  }
  if (!oci) {
    problems.push('server.json lists no oci package');
  } else {
    const tag = oci.identifier.slice(oci.identifier.lastIndexOf(':') + 1);
    if (!oci.identifier.startsWith('docker.io/debugmcp/mcp-debugger:')) {
      problems.push(`server.json oci identifier ${oci.identifier} is not docker.io/debugmcp/mcp-debugger:<version>`);
    } else if (tag !== version) {
      problems.push(`server.json oci tag is ${tag}, expected ${version}`);
    }
  }
  return problems;
}

/** Read the three sources from a checkout. */
export function readMcpRegistrySources(root) {
  return {
    serverJson: JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8')),
    cliPackage: JSON.parse(fs.readFileSync(path.join(root, 'packages', 'mcp-debugger', 'package.json'), 'utf8')),
    dockerfile: fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8'),
    rootVersion: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
  };
}

if (isMain(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const versionFlag = process.argv.indexOf('--version');
  try {
    const sources = readMcpRegistrySources(root);
    const version = versionFlag !== -1 ? process.argv[versionFlag + 1] : sources.rootVersion;
    if (!version) throw new Error('Usage: node scripts/check-mcp-registry-metadata.mjs [--version <x.y.z>]');
    const problems = checkMcpRegistryMetadata({ ...sources, version });
    if (problems.length > 0) {
      console.error(`MCP Registry metadata is inconsistent for ${version}:`);
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error('Run scripts/sync-versions.cjs to move server.json with the release.');
      process.exit(1);
    }
    console.log(`MCP Registry metadata consistent: ${sources.serverJson.name} at ${version}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
