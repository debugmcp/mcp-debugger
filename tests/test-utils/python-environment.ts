/**
 * Python environment detection utilities for tests
 */
import { spawn } from 'child_process';

/**
 * Check if Python is available in the current environment
 */
export async function isPythonAvailable(): Promise<boolean> {
  const pythonCommands = ['python', 'python3', 'py'];
  
  for (const cmd of pythonCommands) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn(cmd, ['--version'], { 
          stdio: 'pipe',
          shell: true 
        });
        
        let hasOutput = false;
        
        proc.stdout?.on('data', () => {
          hasOutput = true;
        });
        
        proc.stderr?.on('data', () => {
          hasOutput = true;
        });
        
        proc.on('close', (code) => {
          resolve(code === 0 && hasOutput);
        });
        
        proc.on('error', () => {
          resolve(false);
        });
        
        // Timeout after 2 seconds
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 2000);
      });
      
      if (result) {
        return true;
      }
    } catch {
      // Continue to next command
    }
  }
  
  return false;
}

/**
 * Check if debugpy is available
 */
export async function isDebugpyAvailable(): Promise<boolean> {
  if (!await isPythonAvailable()) {
    return false;
  }
  
  const pythonCommands = ['python', 'python3', 'py'];
  
  for (const cmd of pythonCommands) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn(cmd, ['-c', 'import debugpy; print("OK")'], { 
          stdio: 'pipe',
          shell: true 
        });
        
        let hasOkOutput = false;
        
        proc.stdout?.on('data', (data) => {
          if (data.toString().includes('OK')) {
            hasOkOutput = true;
          }
        });
        
        proc.on('close', (code) => {
          resolve(code === 0 && hasOkOutput);
        });
        
        proc.on('error', () => {
          resolve(false);
        });
        
        // Timeout after 3 seconds
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 3000);
      });
      
      if (result) {
        return true;
      }
    } catch {
      // Continue to next command
    }
  }
  
  return false;
}
