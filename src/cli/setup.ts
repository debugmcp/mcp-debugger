import { Command, Option } from 'commander';
import { bindOption } from './bind-address.js';
import { portOption } from './port.js';

export interface StdioOptions {
  logLevel?: string;
  logFile?: string;
}

export interface SSEOptions {
  port: string;
  logLevel?: string;
  logFile?: string;
  /**
   * Repeatable `--allowed-host` values; merged with MCP_HTTP_ALLOWED_HOSTS
   * (issue #667). Shared by the http and the deprecated sse transports — a
   * shipped path gets the same Host/Origin control (issue #671).
   */
  allowedHost?: string[];
  /**
   * `--bind <address>`: the interface to listen on (issue #680). Resolved
   * against MCP_HTTP_BIND and the loopback default by `resolveBindAddress`,
   * which is why the option itself carries no commander default.
   */
  bind?: string;
}

export type HttpOptions = SSEOptions;

/**
 * The `--allowed-host` option, built once for both network transports so the
 * flag, its help text and its default description cannot drift apart.
 */
function allowedHostOption(): Option {
  return new Option(
    '--allowed-host <host>',
    'Additional Host (and browser Origin) hostname to accept (repeatable; or MCP_HTTP_ALLOWED_HOSTS, ' +
      'comma-separated). Implies another access control fronts this server. No wildcard.'
  )
    .argParser((value: string, previous: string[]) => [...previous, value])
    .default([] as string[], 'localhost, 127.0.0.1, [::1]');
}

export interface CheckRustBinaryOptions {
  json?: boolean;
}

export interface DoctorOptions {
  json?: boolean;
  timeout?: string;
}

export type StdioHandler = (options: StdioOptions, command?: Command) => Promise<void>;
export type SSEHandler = (options: SSEOptions, command?: Command) => Promise<void>;
export type HttpHandler = (options: HttpOptions, command?: Command) => Promise<void>;
export type CheckRustBinaryHandler = (
  binaryPath: string,
  options: CheckRustBinaryOptions,
  command?: Command
) => Promise<void>;
export type DoctorHandler = (
  languages: string[],
  options: DoctorOptions,
  command?: Command
) => Promise<void>;

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
      // Explicitly mark console silencing to ensure logger avoids console output even under bundling
      process.env.CONSOLE_OUTPUT_SILENCED = '1';
      await handler(options, command);
    });
}

export function setupSSECommand(program: Command, handler: SSEHandler): void {
  program
    .command('sse')
    .description('Start the server using SSE (DEPRECATED: use "http" subcommand instead)')
    .addOption(portOption())
    .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
    .option('--log-file <path>', 'Log to file instead of console')
    .addOption(allowedHostOption())
    .addOption(bindOption())
    .action(async (options: SSEOptions, command: Command) => {
      // Silencing also applies to SSE to protect transports used for JS debugging
      process.env.CONSOLE_OUTPUT_SILENCED = '1';
      await handler(options, command);
    });
}

export function setupHttpCommand(program: Command, handler: HttpHandler): void {
  program
    .command('http')
    .description('Start the server using Streamable HTTP transport (recommended)')
    .addOption(portOption())
    .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
    .option('--log-file <path>', 'Log to file instead of console')
    .addOption(allowedHostOption())
    .addOption(bindOption())
    .action(async (options: HttpOptions, command: Command) => {
      // Silence console output to protect any spawned proxy IPC channels
      process.env.CONSOLE_OUTPUT_SILENCED = '1';
      await handler(options, command);
    });
}

export function setupDoctorCommand(program: Command, handler: DoctorHandler): void {
  program
    .command('doctor')
    .description('Diagnose language toolchains and debug backends (exit code reflects the requested languages)')
    .argument('[languages...]', 'Languages to check and gate the exit code on (default: report all, exit 0)')
    .option('--json', 'Emit JSON output', false)
    .option('--timeout <ms>', 'Per-language probe timeout in milliseconds', '10000')
    .action(async (languages: string[], options: DoctorOptions, command: Command) => {
      await handler(languages, options, command);
    });
}

export function setupCheckRustBinaryCommand(
  program: Command,
  handler: CheckRustBinaryHandler
): void {
  program
    .command('check-rust-binary')
    .description('Analyze a Rust executable to determine debugger compatibility')
    .argument('<binaryPath>', 'Path to the Rust executable to analyze')
    .option('--json', 'Emit JSON output', false)
    .action(async (binaryPath: string, options: CheckRustBinaryOptions, command: Command) => {
      await handler(binaryPath, options, command);
    });
}
