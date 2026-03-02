#!/usr/bin/env node

/**
 * Ensures packages build in a consistent order across local and CI workflows.
 * The BUILD_SCRIPT env var selects which package script to run (defaults to "build").
 */
const { spawnSync } = require('node:child_process');

const buildScript = process.env.BUILD_SCRIPT || 'build';
const disabledLanguages = new Set(
  (process.env.DEBUG_MCP_DISABLE_LANGUAGES || '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean),
);
const packages = [
  '@debugmcp/shared',
  '@debugmcp/adapter-mock',
  '@debugmcp/adapter-python',
  '@debugmcp/adapter-javascript',
  ...(!disabledLanguages.has('rust') ? ['@debugmcp/adapter-rust'] : []),
  ...(!disabledLanguages.has('go') ? ['@debugmcp/adapter-go'] : []),
  ...(!disabledLanguages.has('java') ? ['@debugmcp/adapter-java'] : []),
];

for (const pkg of packages) {
  const result = spawnSync(
    'pnpm',
    ['--filter', pkg, 'run', buildScript],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );

  if (result.status !== 0) {
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    process.exit(exitCode);
  }
}
