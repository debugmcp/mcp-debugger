/**
 * Simplified MinimalDapClient using proper buffer management
 * Extracts just the message parsing logic from vscode's implementation
 */

import net, { Socket } from 'net';
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('minimal-dap-simple');

const TWO_CRLF = '\r\n\r\n';

export class MinimalDapClient extends EventEmitter {
  private socket: Socket | null = null;
  private rawData = Buffer.alloc(0);
  private contentLength = -1;
  private pendingRequests = new Map<number, {
    resolve: (response: DebugProtocol.Response) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private nextSeq = 1;
  private isDisconnectingOrDisconnected = false;
  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
  }

  /**
   * Handle raw data using the same algorithm as vscode's ProtocolServer
   * This ensures compatibility and proper message boundaries
   */
  private handleData(data: Buffer): void {
    this.rawData = Buffer.concat([this.rawData, data]);
    
    while (true) {
      if (this.contentLength >= 0) {
        // We have a content length, check if we have the full message
        if (this.rawData.length >= this.contentLength) {
          const message = this.rawData.toString('utf8', 0, this.contentLength);
          this.rawData = this.rawData.slice(this.contentLength);
          this.contentLength = -1;
          
          // Parse and handle the message
          if (message.length > 0) {
            try {
              const msg = JSON.parse(message) as DebugProtocol.ProtocolMessage;
              this.handleProtocolMessage(msg);
            } catch (e) {
              logger.error('[MinimalDapClient] Error parsing message:', e);
            }
          }
          continue;
        }
      }
      
      // Look for the header
      const idx = this.rawData.indexOf(TWO_CRLF);
      if (idx === -1) {
        // No complete header yet
        break;
      }
      
      const header = this.rawData.toString('utf8', 0, idx);
      const lines = header.split('\r\n');
      
      for (const line of lines) {
        const match = line.match(/Content-Length: (\d+)/i);
        if (match) {
          this.contentLength = parseInt(match[1], 10);
        }
      }
      
      // Remove header from buffer
      this.rawData = this.rawData.slice(idx + TWO_CRLF.length);
    }
  }

  private handleProtocolMessage(message: DebugProtocol.ProtocolMessage): void {
    logger.debug(`[MinimalDapClient] Received message:`, {
      type: message.type,
      seq: message.seq,
      command: (message as any).command,
      event: (message as any).event
    });
    
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const pending = this.pendingRequests.get(response.request_seq);
      
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.request_seq);
        
        if (response.success) {
          pending.resolve(response);
        } else {
          pending.reject(new Error(response.message || 'Request failed'));
        }
      } else {
        logger.warn(`[MinimalDapClient] Received response for unknown request ${response.request_seq}`);
      }
    } else if (message.type === 'event') {
      const event = message as DebugProtocol.Event;
      logger.info(`[MinimalDapClient] Received event: ${event.event}`);
      // Emit both the specific event and the generic event for backward compatibility
      this.emit(event.event, event.body);
      this.emit('event', event);
    }
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`[MinimalDapClient] Connecting to ${this.host}:${this.port}`);
      
      // Error handler for connection phase only
      const connectErrorHandler = (err: Error) => {
        logger.error('[MinimalDapClient] Connection error:', err);
        reject(err);
      };
      
      // Use net.createConnection for test compatibility
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        logger.info(`[MinimalDapClient] Connected to ${this.host}:${this.port}`);
        // Remove the temporary error handler since we're connected
        this.socket?.removeListener('error', connectErrorHandler);
        resolve();
      });
      
      // Add temporary error handler for connection
      this.socket.once('error', connectErrorHandler);
      
      // Set up persistent handlers
      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });
      
      this.socket.on('close', () => {
        logger.info('[MinimalDapClient] Socket closed');
        this.emit('close');
        this.cleanup();
      });
      
      // Add persistent error handler after connection phase
      this.socket.on('error', (err) => {
        logger.error('[MinimalDapClient] Socket error:', err);
        this.emit('error', err);
      });
    });
  }

  public async sendRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown,
    timeoutMs: number = 30000
  ): Promise<T> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Socket not connected or destroyed');
    }
    
    if (this.isDisconnectingOrDisconnected) {
      throw new Error('Client is disconnecting or disconnected');
    }
    
    const requestSeq = this.nextSeq++;
    
    const request: DebugProtocol.Request = {
      seq: requestSeq,
      type: 'request',
      command: command,
      arguments: args
    };
    
    logger.info(`[MinimalDapClient] Sending request:`, {
      command,
      seq: requestSeq,
      args: args || {}
    });
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestSeq)) {
          this.pendingRequests.delete(requestSeq);
          reject(new Error(`DAP request '${command}' (seq ${requestSeq}) timed out`));
        }
      }, timeoutMs);
      
      // Store pending request
      this.pendingRequests.set(requestSeq, {
        resolve: resolve as (value: DebugProtocol.Response) => void,
        reject,
        timer
      });
      
      // Send the request
      const json = JSON.stringify(request);
      const contentLength = Buffer.byteLength(json, 'utf8');
      const message = `Content-Length: ${contentLength}${TWO_CRLF}${json}`;
      
      // Socket was already checked above, but TypeScript needs reassurance
      if (!this.socket) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestSeq);
        reject(new Error('Socket unexpectedly null'));
        return;
      }
      
      this.socket.write(message, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(requestSeq);
          reject(err);
        }
      });
    });
  }

  public disconnect(): void {
    this.shutdown('Client disconnect requested');
  }

  public shutdown(reason: string = 'shutdown'): void {
    if (this.isDisconnectingOrDisconnected) {
      logger.debug('[MinimalDapClient] Already disconnecting or disconnected');
      return;
    }
    
    this.isDisconnectingOrDisconnected = true;
    logger.info(`[MinimalDapClient] Shutting down: ${reason}`);
    
    // Use immediate cleanup when explicitly shutting down
    this.cleanup(true);
    
    // Close socket
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
      this.socket.destroy();
    }
  }

  private cleanup(immediate: boolean = false): void {
    // Clear all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('DAP client disconnected'));
    });
    this.pendingRequests.clear();
    
    // Clear buffer to free memory
    this.rawData = Buffer.alloc(0);
    this.contentLength = -1;
    
    // Remove all listeners to prevent memory leaks
    if (immediate) {
      this.removeAllListeners();
    } else {
      // Use setImmediate to allow any pending emit operations to complete
      setImmediate(() => {
        this.removeAllListeners();
      });
    }
  }
}