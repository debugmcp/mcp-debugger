import { CommandFinder } from '../interfaces/command-finder.js';
/**
 * Production implementation of CommandFinder using the 'which' package
 */
export declare class WhichCommandFinder implements CommandFinder {
    private useCache;
    private cache;
    /**
     * @param useCache Whether to cache found command paths (default: true)
     */
    constructor(useCache?: boolean);
    /**
     * Find the full path to an executable command
     * @param command The command name to find
     * @returns The full path to the executable
     * @throws CommandNotFoundError if the command is not found
     */
    find(command: string): Promise<string>;
    /**
     * Clear the cache (useful for testing)
     */
    clearCache(): void;
}
