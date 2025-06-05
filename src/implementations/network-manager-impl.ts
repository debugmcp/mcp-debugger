/**
 * Concrete implementation of INetworkManager using Node.js net module
 */
import net from 'net';
import { INetworkManager, IServer } from '../interfaces/external-dependencies.js';

export class NetworkManagerImpl implements INetworkManager {
  createServer(): IServer {
    // Directly return the Node.js Server as it implements our IServer interface
    return net.createServer() as unknown as IServer;
  }

  async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object' && 'port' in address) {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to get port from server address')));
        }
      });
    });
  }
}
