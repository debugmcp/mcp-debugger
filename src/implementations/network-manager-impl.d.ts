import { INetworkManager, IServer } from '@debugmcp/shared';
export declare class NetworkManagerImpl implements INetworkManager {
    createServer(): IServer;
    findFreePort(): Promise<number>;
}
