/**
 * Debug Adapter Protocol (DAP) utilities
 * 
 * This module contains utilities for working with the Debug Adapter Protocol,
 * which is the protocol used by debugpy and other debug adapters.
 * 
 * @see https://microsoft.github.io/debug-adapter-protocol/
 */

import * as net from 'net';
import { EventEmitter } from 'events';

/**
 * DAP message types
 */
export enum MessageType {
  /** Request message */
  Request = 'request',
  /** Response message */
  Response = 'response',
  /** Event message */
  Event = 'event'
}

/**
 * DAP base message
 */
export interface Message {
  /** Message sequence number */
  seq: number;
  /** Message type: 'request', 'response', 'event' */
  type: string;
}

/**
 * DAP request message
 */
export interface Request extends Message {
  /** The command to execute */
  command: string;
  /** Optional arguments for the command */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arguments?: any;
}

/**
 * DAP response message
 */
export interface Response extends Message {
  /** Sequence number of the corresponding request */
  request_seq: number;
  /** Outcome of the request */
  success: boolean;
  /** The command requested */
  command: string;
  /** Contains error message if success is false */
  message?: string;
  /** Contains request result if success is true */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
}

/**
 * DAP event message
 */
export interface Event extends Message {
  /** Type of event */
  event: string;
  /** Event-specific information */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
}

/**
 * Debug adapter client for communicating with a debug adapter using DAP
 */
export class DebugAdapterClient extends EventEmitter {
  /** Socket connection to the debug adapter */
  private socket: net.Socket | null = null;
  /** Sequence number for messages */
  private seq: number = 1;
  /** Data buffer for incoming messages */
  private buffer: string = '';
  /** Map of pending requests waiting for responses */
  private pendingRequests: Map<number, { resolve: (value: Response) => void; reject: (reason?: Error) => void }> = new Map();
  /** Whether the client is connected */
  private connected: boolean = false;

  /**
   * Create a new debug adapter client
   */
  constructor() {
    super();
  }

  /**
   * Connect to a debug adapter
   * 
   * @param host - The host to connect to
   * @param port - The port to connect to
   * @returns A promise that resolves when connected
   */
  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        return resolve();
      }

      this.socket = new net.Socket();

      this.socket.on('data', (data) => this.handleData(data));
      // For the connection promise, reject if an error occurs before connection.
      const connectErrorHandler = (error: Error) => {
        if (!this.connected) {
          reject(error);
        }
        this.handleError(error); // Still emit the error for persistent listeners
      };
      this.socket.once('error', connectErrorHandler); // Use 'once' for connection attempt
      
      this.socket.on('close', () => this.handleClose());

      this.socket.connect(port, host, () => {
        this.socket?.removeListener('error', connectErrorHandler); // Clean up specific connect error handler
        // Add persistent error handler after connection
        this.socket?.on('error', (error) => this.handleError(error));
        this.connected = true;
        resolve();
      });
    });
  }

  /**
   * Disconnect from the debug adapter
   */
  disconnect(): void {
    if (!this.connected || !this.socket) {
      return;
    }

    this.socket.end();
    this.socket = null;
    this.connected = false;
  }

  /**
   * Send a request to the debug adapter
   * 
   * @param command - The command to execute
   * @param args - Optional arguments for the command
   * @returns A promise that resolves with the response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequest(command: string, args?: any): Promise<Response> { // Changed return type to internal Response
    if (!this.connected || !this.socket) {
      return Promise.reject(new Error('Not connected to debug adapter'));
    }

    const request: Request = {
      seq: this.seq++,
      type: MessageType.Request,
      command,
      arguments: args
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.seq, { resolve, reject });
      
      const message = JSON.stringify(request);
      const contentLength = Buffer.byteLength(message, 'utf8');
      const header = `Content-Length: ${contentLength}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n`;
      
      this.socket!.write(header + message, 'utf8');
    });
  }

  /**
   * Handle incoming data from the debug adapter
   * 
   * @param data - The incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf8');
    
    // Process complete messages
    while (this.processMessage()) {
      // Continue processing until no more complete messages
    }
  }

  /**
   * Process a complete message from the buffer
   * 
   * @returns True if a message was processed, false if there are no complete messages
   */
  private processMessage(): boolean {
    // Find the headers section
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return false;
    }

    // Split headers into lines and parse them
    const headerSection = this.buffer.substring(0, headerEnd);
    const headers = new Map();
    
    headerSection.split('\r\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers.set(key.toLowerCase(), value);
      }
    });
    
    // Content-Length is required
    const contentLengthHeader = headers.get('content-length');
    if (!contentLengthHeader) {
      console.warn('Missing Content-Length header, discarding message');
      this.buffer = this.buffer.substring(headerEnd + 4);
      return false;
    }

    const contentLength = parseInt(contentLengthHeader, 10);
    if (isNaN(contentLength)) {
      console.warn('Invalid Content-Length, discarding message');
      this.buffer = this.buffer.substring(headerEnd + 4);
      return false;
    }

    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;

    // Check if the full message is available
    if (this.buffer.length < messageEnd) {
      return false;
    }

    // Extract the message
    const messageStr = this.buffer.substring(messageStart, messageEnd);
    this.buffer = this.buffer.substring(messageEnd);

    try {
      const message = JSON.parse(messageStr) as Message;
      this.handleMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to parse DAP message:', error);
      console.error('Message content:', messageStr);
      return true; // Continue processing buffer
    }
  }

  /**
   * Handle a parsed message
   * 
   * @param message - The parsed message
   */
  private handleMessage(message: Message): void {
    // Enhanced logging to diagnose protocol issues
    if (!message.type) {
      console.error('Received message with no type field:', message);
      return;
    }
    
    // Debug level logging to track message flow
    console.log(`Received DAP message of type: ${message.type}, seq: ${message.seq}`);
    
    switch (message.type) {
      case MessageType.Response:
        this.handleResponse(message as Response);
        break;
      case MessageType.Event:
        this.handleEvent(message as Event);
        break;
      case MessageType.Request:
        // Handle request messages - we don't expect these but should handle them gracefully
        console.warn('Received unexpected request message from debug adapter:', message);
        break;
      default:
        console.warn(`Unhandled message type: "${message.type}"`, message);
    }
  }

  /**
   * Handle a response message
   * 
   * @param response - The response message
   */
  private handleResponse(response: Response): void {
    const request = this.pendingRequests.get(response.request_seq);
    if (!request) {
      console.warn('Received response for unknown request:', response);
      return;
    }

    this.pendingRequests.delete(response.request_seq);

    if (response.success) {
      // Resolve with the full response object, not just the body,
      // as the internal Response type includes success, command etc.
      request.resolve(response); 
    } else {
      request.reject(new Error(response.message || 'Unknown error'));
    }
  }

  /**
   * Handle an event message
   * 
   * @param event - The event message
   */
  private handleEvent(event: Event): void {
    this.emit(event.event, event.body);
  }

  /**
   * Handle a socket error
   * 
   * @param error - The error
   */
  private handleError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * Handle socket closure
   */
  private handleClose(): void {
    this.connected = false;
    this.emit('close');

    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}
