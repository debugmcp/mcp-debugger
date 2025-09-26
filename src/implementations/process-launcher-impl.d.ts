/**
 * Production implementations of process launcher interfaces
 * These delegate to the existing ProcessManager for actual process operations
 */
import { IProcess, IProcessLauncher, IProcessOptions, IDebugTargetLauncher, IDebugTarget, IProxyProcessLauncher, IProxyProcess } from '@debugmcp/shared';
import { IProcessManager, INetworkManager } from '@debugmcp/shared';
/**
 * Production implementation of IProcessLauncher
 */
export declare class ProcessLauncherImpl implements IProcessLauncher {
    private processManager;
    constructor(processManager: IProcessManager);
    launch(command: string, args: string[], options?: IProcessOptions): IProcess;
}
/**
 * Production implementation of IDebugTargetLauncher
 */
export declare class DebugTargetLauncherImpl implements IDebugTargetLauncher {
    private processLauncher;
    private networkManager;
    constructor(processLauncher: IProcessLauncher, networkManager: INetworkManager);
    launchPythonDebugTarget(scriptPath: string, args: string[], pythonPath?: string, debugPort?: number): Promise<IDebugTarget>;
}
/**
 * Production implementation of IProxyProcessLauncher
 */
export declare class ProxyProcessLauncherImpl implements IProxyProcessLauncher {
    private processLauncher;
    constructor(processLauncher: IProcessLauncher);
    launchProxy(proxyScriptPath: string, sessionId: string, env?: Record<string, string>): IProxyProcess;
}
/**
 * Production implementation of IProcessLauncherFactory
 */
export declare class ProcessLauncherFactoryImpl {
    private processManager;
    private networkManager;
    constructor(processManager: IProcessManager, networkManager: INetworkManager);
    createProcessLauncher(): IProcessLauncher;
    createDebugTargetLauncher(): IDebugTargetLauncher;
    createProxyProcessLauncher(): IProxyProcessLauncher;
}
