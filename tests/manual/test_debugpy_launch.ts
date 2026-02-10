import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra'; // For ensuring log directory

async function testLaunch() {
  console.log('Starting debugpy.adapter launch test...');

  const pythonPath = 'C:\\Python313\\python.exe'; // Hardcoded Windows path - update for your environment
  const adapterHost = '127.0.0.1';
  const adapterPort = 5678; // Fixed port for this test
  const sessionIdForLog = 'test-session'; // Dummy session ID for log path

  // Ensure log directory exists (similar to PythonDebugger)
  const adapterLogPathDefault = path.join(os.tmpdir(), `debugpy-adapter-${sessionIdForLog}`);
  try {
    await fs.ensureDir(adapterLogPathDefault);
    console.log(`Adapter log directory ensured: ${adapterLogPathDefault}`);
  } catch (dirError) {
    console.error(`Error ensuring log directory ${adapterLogPathDefault}:`, dirError);
  }
  
  const adapterArgs = [
    '-m', 'debugpy.adapter',
    '--host', adapterHost,
    '--port', String(adapterPort),
    '--log-dir', adapterLogPathDefault // Use the ensured path
  ];

  console.log(`Spawning: "${pythonPath}" ${adapterArgs.join(' ')}`);

  let adapterProcess: ChildProcess | null = null;

  try {
    adapterProcess = spawn(pythonPath, adapterArgs, {
      stdio: ['ignore', 'pipe', 'pipe'], // 'pipe' for stdout/stderr
      detached: false // Keep it attached
    });
  } catch (spawnError) {
    console.error('Error during spawn call itself:', spawnError);
    return;
  }

  if (!adapterProcess || !adapterProcess.pid) {
    console.error('Failed to spawn process or process has no PID.');
    if (adapterProcess === null) console.error('adapterProcess is null');
    // Attempt to get more info if spawn failed without throwing an error immediately
    if (adapterProcess && typeof (adapterProcess as any).spawnfile === 'string' && (adapterProcess as any).spawnargs) {
        console.error(`Spawn details: spawnfile='${(adapterProcess as any).spawnfile}', spawnargs='${(adapterProcess as any).spawnargs.join(' ')}'`);
    }
    return;
  }

  console.log(`Spawned debugpy.adapter process with PID: ${adapterProcess.pid}`);

  adapterProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`Adapter STDOUT: ${data.toString().trim()}`);
  });

  adapterProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`Adapter STDERR: ${data.toString().trim()}`);
  });

  adapterProcess.on('error', (err: Error) => {
    console.error('Adapter process ERROR event:', err);
  });

  adapterProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    console.log(`Adapter process EXITED with code: ${code}, signal: ${signal}`);
  });

  adapterProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
    console.log(`Adapter process CLOSE event with code: ${code}, signal: ${signal}`);
  });

  // Keep the test script running for a bit to observe the adapter
  console.log('Test script will wait for 30 seconds to observe adapter...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  if (adapterProcess && adapterProcess.pid && !adapterProcess.killed) {
    console.log('Test finished, killing adapter process.');
    const killed = adapterProcess.kill('SIGTERM');
    if (!killed) {
        console.error('Failed to kill adapter process with SIGTERM. It might have already exited.');
    }
  } else {
    console.log('Adapter process already exited or was not successfully started.');
  }
}

testLaunch().catch(e => console.error('Test launch function threw an error:', e));
