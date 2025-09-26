/**
 * Concrete implementation of INetworkManager using Node.js net module
 */
import net from 'net';
export class NetworkManagerImpl {
    createServer() {
        // Directly return the Node.js Server as it implements our IServer interface
        return net.createServer();
    }
    async findFreePort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(0, () => {
                const address = server.address();
                if (address && typeof address === 'object' && 'port' in address) {
                    const port = address.port;
                    server.close(() => resolve(port));
                }
                else {
                    server.close(() => reject(new Error('Failed to get port from server address')));
                }
            });
        });
    }
}
//# sourceMappingURL=network-manager-impl.js.map