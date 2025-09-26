import { IEnvironment } from '@debugmcp/shared';
/**
 * Container workspace directory prefix
 */
export declare const CONTAINER_WORKSPACE_PREFIX = "/workspace/";
/**
 * Translates a path for container mode if needed.
 * In container mode (MCP_CONTAINER=true), always prefixes paths with /workspace/
 * In host mode, returns the path unchanged.
 *
 * @param path The original path
 * @param environment The environment interface to check MCP_CONTAINER
 * @returns The translated path
 */
export declare function translatePathForContainer(path: string, environment: IEnvironment): string;
/**
 * Checks if the application is running in container mode
 * @param environment The environment interface
 * @returns true if MCP_CONTAINER is set to 'true'
 */
export declare function isContainerMode(environment: IEnvironment): boolean;
