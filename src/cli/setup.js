import { Command } from 'commander';
export function createCLI(name, description, version) {
    const program = new Command();
    program
        .name(name)
        .description(description)
        .version(version);
    return program;
}
export function setupStdioCommand(program, handler) {
    program
        .command('stdio', { isDefault: true })
        .description('Start the server using stdio as transport')
        .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
        .option('--log-file <path>', 'Log to file instead of console')
        .action(async (options, command) => {
        // Explicitly mark stdio mode to ensure logger avoids console output even under bundling
        process.env.DEBUG_MCP_STDIO = '1';
        await handler(options, command);
    });
}
export function setupSSECommand(program, handler) {
    program
        .command('sse')
        .description('Start the server using SSE (Server-Sent Events) transport')
        .option('-p, --port <number>', 'Port to listen on', '3001')
        .option('-l, --log-level <level>', 'Set log level (error, warn, info, debug)', 'info')
        .option('--log-file <path>', 'Log to file instead of console')
        .action(handler);
}
//# sourceMappingURL=setup.js.map