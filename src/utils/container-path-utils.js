/**
 * Container workspace directory prefix
 */
export const CONTAINER_WORKSPACE_PREFIX = '/workspace/';
/**
 * Translates a path for container mode if needed.
 * In container mode (MCP_CONTAINER=true), always prefixes paths with /workspace/
 * In host mode, returns the path unchanged.
 *
 * @param path The original path
 * @param environment The environment interface to check MCP_CONTAINER
 * @returns The translated path
 */
export function translatePathForContainer(path, environment) {
    // Only translate in container mode
    if (environment.get('MCP_CONTAINER') !== 'true') {
        return path;
    }
    // Always prefix with /workspace/ in container mode
    return `${CONTAINER_WORKSPACE_PREFIX}${path}`;
}
/**
 * Checks if the application is running in container mode
 * @param environment The environment interface
 * @returns true if MCP_CONTAINER is set to 'true'
 */
export function isContainerMode(environment) {
    return environment.get('MCP_CONTAINER') === 'true';
}
//# sourceMappingURL=container-path-utils.js.map