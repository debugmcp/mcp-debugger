#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const containerName = `mcp-debugger-js-test-${Date.now()}`;
const imageName = 'mcp-debugger:local';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('=== JavaScript Docker Debugging Detailed Test ===\n');
  
  // Clean up any existing container
  try {
    execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
  } catch {
    // Ignore error if container doesn't exist
  }
  
  try {
    // Start container with verbose logging
    console.log('Starting Docker container with verbose logging...');
    const transport = new StdioClientTransport({
      command: 'docker',
      args: [
        'run',
        '--rm',
        '-i',
        '--name', containerName,
        '-v', `${process.cwd()}/examples:/workspace:rw`,
        '-v', `${process.cwd()}/logs:/tmp:rw`,
        '-e', 'DEBUG=*',
        '-e', 'NODE_OPTIONS=--trace-warnings',
        imageName,
        'stdio',
        '--log-level', 'debug',
        '--log-file', '/tmp/mcp-debugger-js-test.log'
      ]
    });
    
    const client = new Client({
      name: 'js-docker-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('✓ Connected to MCP server\n');
    
    // List supported languages
    console.log('Listing supported languages...');
    const langResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'list_supported_languages',
        arguments: {}
      }
    });
    
    // Handle different response formats
    let languages;
    if (langResult && langResult.content && langResult.content[0]) {
      if (typeof langResult.content[0].text === 'string') {
        try {
          languages = JSON.parse(langResult.content[0].text);
        } catch {
          languages = langResult.content[0].text;
        }
      } else {
        languages = langResult.content[0];
      }
    }
    console.log('Languages:', languages);
    
    // Create a JavaScript debug session
    console.log('\nCreating JavaScript debug session...');
    const createResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'create_debug_session',
        arguments: {
          language: 'javascript',
          name: 'Test JS Session'
        }
      }
    });
    
    const sessionResponse = JSON.parse(createResult.content[0].text);
    console.log('Session created:', sessionResponse);
    
    if (!sessionResponse.success) {
      console.error('Failed to create session:', sessionResponse.message);
      return;
    }
    
    let sessionId = sessionResponse.sessionId;
    console.log(`Session ID: ${sessionId}\n`);
    
    // Set a breakpoint
    console.log('Setting breakpoint...');
    const breakpointResult = await client.request({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: sessionId,
          file: 'javascript/mcp_target.js',  // Relative path
          line: 2
        }
      }
    });
    console.log('Breakpoint result:', JSON.parse(breakpointResult.content[0].text));
    
    // Start debugging with different path formats
    const pathsToTry = [
      'javascript/mcp_target.js',                    // Relative from /workspace
      '/workspace/javascript/mcp_target.js',         // Absolute
      './javascript/mcp_target.js',                  // Relative with ./
      'examples/javascript/mcp_target.js',           // Relative with examples/
    ];
    
    for (const scriptPath of pathsToTry) {
      console.log(`\nTrying to start debugging with path: ${scriptPath}`);
      
      try {
        const startResult = await client.request({
          method: 'tools/call',
          params: {
            name: 'start_debugging',
            arguments: {
              sessionId: sessionId,
              scriptPath: scriptPath,
              args: []
            }
          }
        });
        
        const startResponse = JSON.parse(startResult.content[0].text);
        console.log('Start result:', startResponse);
        
        if (startResponse.success && startResponse.state === 'paused') {
          console.log('✓ Successfully started debugging!');
          
          // Get stack trace
          console.log('\nGetting stack trace...');
          const stackResult = await client.request({
            method: 'tools/call',
            params: {
              name: 'get_stack_trace',
              arguments: {
                sessionId: sessionId
              }
            }
          });
          console.log('Stack:', JSON.parse(stackResult.content[0].text));
          
          // Close session
          await client.request({
            method: 'tools/call',
            params: {
              name: 'close_debug_session',
              arguments: {
                sessionId: sessionId
              }
            }
          });
          
          break;
        }
      } catch (error) {
        console.error(`Failed with path ${scriptPath}:`, error.message);
        
        // Wait a bit before trying next path
        await sleep(1000);
        
        // Close and recreate session for next attempt
        try {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'close_debug_session',
              arguments: {
                sessionId: sessionId
              }
            }
          });
        } catch {
          // Ignore error if session already closed
        }
        
        // Recreate session for next attempt
        const recreateResult = await client.request({
          method: 'tools/call',
          params: {
            name: 'create_debug_session',
            arguments: {
              language: 'javascript',
              name: 'Test JS Session'
            }
          }
        });
        const newSession = JSON.parse(recreateResult.content[0].text);
        if (newSession.success) {
          sessionId = newSession.sessionId;
        }
      }
    }
    
    console.log('\n--- Getting container logs ---');
    try {
      const logs = execSync(`docker logs ${containerName} --tail 50`, { encoding: 'utf8' });
      console.log('Container logs:', logs);
    } catch (e) {
      console.error('Could not get logs:', e.message);
    }
    
    // Close client
    await client.close();
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    console.log('\nCleaning up...');
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
    } catch {
      // Ignore error if container already stopped
    }
    try {
      execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
    } catch {
      // Ignore error if container already removed
    }
    console.log('Container removed');
  }
}

runTest().catch(console.error);
