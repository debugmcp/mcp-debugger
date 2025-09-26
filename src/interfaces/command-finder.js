/**
 * Error thrown when a command cannot be found in the system PATH
 */
export class CommandNotFoundError extends Error {
    command;
    constructor(command) {
        super(`Command not found: ${command}`);
        this.command = command;
        this.name = 'CommandNotFoundError';
    }
}
//# sourceMappingURL=command-finder.js.map