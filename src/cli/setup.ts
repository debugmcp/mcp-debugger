import { Command } from 'commander';

export interface StdioOptions {
  logLevel?: string;
  logFile?: string;
}

export interface SSEOptions {
  port: string;
  logLevel?: string;
  logFile?: string;
}

export type StdioHandler = (options: StdioOptions, command?: Command) => Promise<void>;
export type SSEHandler = (options: SSEOptions, command?: Command) => Promise<void>;

export function createCLI(name: string, description: string, version: string): Command {
  const program = new Command();
  
  program
    .name(name)
    .description(description)
    .version(version);
    
  return program;
}

export function setupStdioCommand(program: Command, handler: StdioHandler): void {
  program
    .command('stdio', { isDefault: true })
    .description('Start the server using stdio as transport')
    .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
    .option('--log-file <path>', 'Log to file instead of console')
    .action(async (options: StdioOptions, command: Command) => {
      // Explicitly mark stdio mode to ensure logger avoids console output even under bundling
      process.env.DEBUG_MCP_STDIO = '1';
      await handler(options, command);
    });
}

export function setupSSECommand(program: Command, handler: SSEHandler): void {
  program
    .command('sse')
    .description('Start the server using SSE (Server-Sent Events) transport')
    .option('-p, --port <number>', 'Port to listen on', '3001')
    .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
    .option('--log-file <path>', 'Log to file instead of console')
    .action(handler);
}
