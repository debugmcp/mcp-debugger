/**
 * Simple file existence checker - TRUE HANDS-OFF APPROACH
 *
 * POLICY:
 * 1. Accept all paths as-is from MCP clients
 * 2. Only check file existence for immediate UX feedback
 * 3. Container mode: Simple /workspace/ prefix only
 * 4. Pass original paths to debug adapter unchanged
 * 5. No path interpretation, normalization, or cross-platform logic
 */
import { IFileSystem, IEnvironment } from '@debugmcp/shared';
/**
 * Result of simple file existence check
 */
export interface FileExistenceResult {
    exists: boolean;
    originalPath: string;
    effectivePath: string;
    errorMessage?: string;
}
/**
 * Simple file checker that follows hands-off path policy
 */
export declare class SimpleFileChecker {
    private readonly fileSystem;
    private readonly environment;
    private readonly logger?;
    constructor(fileSystem: IFileSystem, environment: IEnvironment, logger?: {
        debug: (msg: string, meta?: unknown) => void;
    } | undefined);
    /**
     * Check if file exists - the ONLY path operation we perform
     */
    checkExists(path: string): Promise<FileExistenceResult>;
    /**
     * Get the effective path we'll check for existence
     * ONLY container prefix logic - no other path manipulation
     */
    private getEffectivePath;
}
/**
 * Factory function to create a SimpleFileChecker instance
 */
export declare function createSimpleFileChecker(fileSystem: IFileSystem, environment: IEnvironment, logger?: {
    debug: (msg: string, meta?: unknown) => void;
}): SimpleFileChecker;
