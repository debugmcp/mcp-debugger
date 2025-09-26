/**
 * Interface for finding executable commands in the system PATH
 */
export interface CommandFinder {
    /**
     * Find the full path to an executable command
     * @param command The command name to find
     * @returns The full path to the executable
     * @throws CommandNotFoundError if the command is not found
     */
    find(command: string): Promise<string>;
}
/**
 * Error thrown when a command cannot be found in the system PATH
 */
export declare class CommandNotFoundError extends Error {
    readonly command: string;
    constructor(command: string);
}
