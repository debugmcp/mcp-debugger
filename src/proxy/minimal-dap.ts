/* eslint-disable @typescript-eslint/no-explicit-any */
import net from 'net';
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('debug-mcp:minimal-dap');

export class MinimalDapClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  private seq = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (response: DebugProtocol.Response) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private host: string;
  private port: number;
  private isDisconnectingOrDisconnected = false; // Added flag

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`[MinimalDapClient] Connecting to ${this.host}:${this.port}`);
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        logger.info(`[MinimalDapClient] Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('data', (data) => this.handleData(data));
      this.socket.on('error', (err) => {
        logger.error(`[MinimalDapClient] Socket error:`, err);
        this.emit('error', err);
        reject(err);
      });
      this.socket.on('close', () => {
        logger.info(`[MinimalDapClient] Socket closed`);
        this.emit('close');
      });
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf8');
    logger.debug(`[MinimalDapClient] Received data, buffer is now: "${this.buffer.substring(0, 100)}..."`);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        logger.debug('[MinimalDapClient] No complete header found in buffer.');
        break; 
      }

      const header = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/i);
      if (!contentLengthMatch) {
        logger.error('[MinimalDapClient] Invalid DAP header (no Content-Length):', header);
        this.buffer = this.buffer.substring(headerEnd + 4); // Skip malformed header
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEnd + 4;

      if (this.buffer.length < messageStart + contentLength) {
        logger.debug(`[MinimalDapClient] Incomplete message body. Need ${contentLength}, have ${this.buffer.length - messageStart}.`);
        break; 
      }

      const messageJson = this.buffer.substring(messageStart, messageStart + contentLength);
      const nextMessageStartInOriginalBuffer = messageStart + contentLength;
      
      // Consume the processed message (or attempted-to-process message) from the buffer *before* parsing
      // This prevents reprocessing a malformed message if JSON.parse throws.
      this.buffer = this.buffer.substring(nextMessageStartInOriginalBuffer);
      logger.debug(`[MinimalDapClient] Extracted message JSON (length ${contentLength}): ${messageJson.substring(0,100)}...`);
      logger.debug(`[MinimalDapClient] Buffer sliced. Remaining length: ${this.buffer.length}. Preview: "${this.buffer.substring(0,100)}..."`);
      
      try {
        const message = JSON.parse(messageJson) as DebugProtocol.ProtocolMessage;
        logger.info(`[MinimalDapClient] Parsed DAP message:`, { 
            type: message.type, 
            seq: message.seq,
            command: (message as DebugProtocol.Request).command || (message as DebugProtocol.Response).command, 
            request_seq: (message as DebugProtocol.Response).request_seq,
            event: (message as DebugProtocol.Event).event,
            success: (message as DebugProtocol.Response).success,
        });
        
        if (message.type === 'response') {
          const response = message as DebugProtocol.Response;
          if (this.pendingRequests.has(response.request_seq)) {
            const promise = this.pendingRequests.get(response.request_seq)!;
            clearTimeout(promise.timer);
            if (response.success) {
              promise.resolve(response);
            } else {
              promise.reject(new Error(response.message || `DAP request failed (seq: ${response.request_seq})`));
            }
            this.pendingRequests.delete(response.request_seq);
          } else {
            logger.warn(`[MinimalDapClient] Received response for unknown request_seq: ${response.request_seq}`);
          }
        } else if (message.type === 'event') {
          // The file-level disable should cover this now.
          this.emit((message as DebugProtocol.Event).event, (message as DebugProtocol.Event).body);
          this.emit('event', message as DebugProtocol.Event); // Generic event
          logger.debug(`[MinimalDapClient] Emitted event: ${(message as DebugProtocol.Event).event}`);
        } else {
          logger.warn('[MinimalDapClient] Received unknown DAP message type:', message.type, message);
        }
      } catch (e) {
        logger.error('[MinimalDapClient] Error parsing DAP message JSON:', e, { jsonPreview: messageJson.substring(0,200) });
        // Buffer was already advanced, so we don't re-process the bad JSON.
      }
    }
    if (this.buffer.length > 0) {
      logger.debug(`[MinimalDapClient] Exited message loop with remaining data in buffer (length: ${this.buffer.length}): "${this.buffer.substring(0,100)}..."`);
    } else {
      logger.debug('[MinimalDapClient] Exited message loop, buffer is empty.');
    }
  }

  public sendRequest<T extends DebugProtocol.Response>(command: string, args?: any): Promise<T> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new Error('Socket not connected or destroyed'));
    }
    const requestSeq = this.seq++;
    const request: DebugProtocol.Request = {
      seq: requestSeq,
      type: 'request',
      command: command,
      arguments: args,
    };

    const json = JSON.stringify(request);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    
    logger.info(`[MinimalDapClient] Sending DAP request:`, { command, seq: requestSeq, args: args || {}});
    this.socket.write(header + json);

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestSeq)) {
          this.pendingRequests.delete(requestSeq);
          reject(new Error(`DAP request '${command}' (seq ${requestSeq}) timed out`));
        }
      }, 30000); // 30s timeout

      this.pendingRequests.set(requestSeq, {
        resolve: resolve as (value: DebugProtocol.Response) => void,
        reject,
        timer
      });
    });
  }

  public disconnect(): void {
    this.shutdown('DAP client disconnected');
  }

  /**
   * Shutdown the DAP client, rejecting all pending requests and disposing resources.
   * This method is idempotent.
   */
  public shutdown(reason = 'dap client shutdown'): void {
    if (this.isDisconnectingOrDisconnected) {
      logger.info('[MinimalDapClient] Shutdown already in progress or completed.');
      return;
    }
    this.isDisconnectingOrDisconnected = true;
    logger.info(`[MinimalDapClient] Shutdown initiated. Reason: ${reason}`);

    // Close socket if needed
    if (this.socket && !this.socket.destroyed) {
      this.socket.end(() => {
        logger.info('[MinimalDapClient] Socket ended gracefully.');
      });
      this.socket.destroy();
      logger.info('[MinimalDapClient] Socket destroyed.');
    }
    this.socket = null;

    // Reject and clear all pending requests
    if (this.pendingRequests.size > 0) {
      logger.info(`[MinimalDapClient] Rejecting ${this.pendingRequests.size} pending requests on shutdown.`);
      this.pendingRequests.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(new Error(reason));
      });
      this.pendingRequests.clear();
    }

    // Remove listeners
    logger.info('[MinimalDapClient] Removing all event listeners.');
    this.removeAllListeners();
  }
}
