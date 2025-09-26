/**
 * Environment implementation that wraps Node.js process.env and process.cwd()
 */
import { IEnvironment } from '@debugmcp/shared';
/**
 * Production implementation of IEnvironment
 * Provides access to real process environment variables and working directory
 */
export declare class ProcessEnvironment implements IEnvironment {
    private readonly envSnapshot;
    constructor();
    /**
     * Get a specific environment variable
     */
    get(key: string): string | undefined;
    /**
     * Get all environment variables
     */
    getAll(): Record<string, string | undefined>;
    /**
     * Get the current working directory
     */
    getCurrentWorkingDirectory(): string;
}
