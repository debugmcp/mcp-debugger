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
import { translatePathForContainer } from './container-path-utils.js';
/**
 * Simple file checker that follows hands-off path policy
 */
export class SimpleFileChecker {
    fileSystem;
    environment;
    logger;
    constructor(fileSystem, environment, logger) {
        this.fileSystem = fileSystem;
        this.environment = environment;
        this.logger = logger;
    }
    /**
     * Check if file exists - the ONLY path operation we perform
     */
    async checkExists(path) {
        const effectivePath = this.getEffectivePath(path);
        this.logger?.debug(`[SimpleFileChecker] Checking existence: ${path} -> ${effectivePath}`);
        try {
            const exists = await this.fileSystem.pathExists(effectivePath);
            return {
                exists,
                originalPath: path,
                effectivePath
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger?.debug(`[SimpleFileChecker] Check failed for ${effectivePath}: ${errorMessage}`);
            return {
                exists: false,
                originalPath: path,
                effectivePath,
                errorMessage: `Cannot check file existence: ${errorMessage}`
            };
        }
    }
    /**
     * Get the effective path we'll check for existence
     * ONLY container prefix logic - no other path manipulation
     */
    getEffectivePath(path) {
        return translatePathForContainer(path, this.environment);
    }
}
/**
 * Factory function to create a SimpleFileChecker instance
 */
export function createSimpleFileChecker(fileSystem, environment, logger) {
    return new SimpleFileChecker(fileSystem, environment, logger);
}
//# sourceMappingURL=simple-file-checker.js.map