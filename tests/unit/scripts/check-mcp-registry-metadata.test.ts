import { describe, expect, it } from 'vitest';
import path from 'path';
import {
  checkMcpRegistryMetadata,
  dockerfileServerName,
  readMcpRegistrySources
} from '../../../scripts/check-mcp-registry-metadata.mjs';

const ROOT = path.resolve(__dirname, '../../..');
const NAME = 'io.github.debugmcp/mcp-debugger';

function consistent(version = '1.2.3') {
  return {
    serverJson: {
      name: NAME,
      description: 'Step-through debugging for AI agents',
      version,
      packages: [
        { registryType: 'npm', identifier: '@debugmcp/mcp-debugger', version, transport: { type: 'stdio' } },
        { registryType: 'oci', identifier: `docker.io/debugmcp/mcp-debugger:${version}`, transport: { type: 'stdio' } }
      ]
    },
    cliPackage: { name: '@debugmcp/mcp-debugger', mcpName: NAME },
    dockerfile: `FROM ubuntu\r\nLABEL io.modelcontextprotocol.server.name="${NAME}"\r\nCMD ["stdio"]\r\n`,
    version
  };
}

describe('MCP Registry metadata', () => {
  it('the checked-in server.json, CLI manifest and Dockerfile agree at the repo version', () => {
    const sources = readMcpRegistrySources(ROOT);
    expect(checkMcpRegistryMetadata({ ...sources, version: sources.rootVersion })).toEqual([]);
    expect(sources.serverJson.name).toBe(NAME);
  });

  it('reads the Dockerfile label, CRLF included', () => {
    expect(dockerfileServerName(consistent().dockerfile)).toBe(NAME);
    expect(dockerfileServerName('FROM ubuntu\nCMD ["stdio"]\n')).toBeNull();
  });

  it('accepts a consistent listing', () => {
    expect(checkMcpRegistryMetadata(consistent())).toEqual([]);
  });

  it('names each source that disagrees on the server name', () => {
    const input = consistent();
    input.cliPackage.mcpName = 'io.github.someone/else';
    input.dockerfile = 'FROM ubuntu\n';
    const problems = checkMcpRegistryMetadata(input);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('mcpName');
    expect(problems[1]).toContain('Dockerfile label');
  });

  it('flags every version that does not match the release', () => {
    const input = consistent('1.2.3');
    const problems = checkMcpRegistryMetadata({ ...input, version: '1.2.4' });
    expect(problems).toEqual([
      'server.json version is 1.2.3, expected 1.2.4',
      'server.json npm version is 1.2.3, expected 1.2.4',
      'server.json oci tag is 1.2.3, expected 1.2.4'
    ]);
  });

  it('enforces the registry description limit and requires both packages', () => {
    const input = consistent();
    input.serverJson.description = 'x'.repeat(101);
    input.serverJson.packages = [];
    const problems = checkMcpRegistryMetadata(input);
    expect(problems).toContain('server.json description must be at most 100 characters');
    expect(problems).toContain('server.json lists no npm package');
    expect(problems).toContain('server.json lists no oci package');
  });
});
