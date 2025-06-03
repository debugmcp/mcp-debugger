/**
 * Enhanced Debug Adapter Protocol (DAP) utilities
 * 
 * This module contains enhanced utilities for working with the Debug Adapter Protocol.
 * It includes more robust error handling, connection management, and protocol handling.
 * 
 * @see https://microsoft.github.io/debug-adapter-protocol/
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import * as DAP from '@vscode/debugprotocol';

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
 * Enhanced Debug adapter client for communicating with a debug adapter using DAP
 * Adds improved connection management, error handling, and logging
 */
export class EnhancedDebugAdapterClient extends EventEmitter {
  /** Socket connection to the debug adapter */
  private socket: net.Socket | null = null;
  /** Sequence number for messages */
  private seq: number = 1;
  /** Data buffer for incoming messages */
  private buffer: string = '';
  /** Map of pending requests waiting for responses */
  private pendingRequests: Map<number, { 
    resolve: (value: DAP.DebugProtocol.Response['body']) => void; 
    reject: (reason?: Error) => void; 
    command: string;
    timestamp: number;
  }> = new Map();
  /** Whether the client is connected */
  private connected: boolean = false;
  /** Connection timeout in milliseconds */
  private connectionTimeout: number = 10000; // 10 seconds
  /** Request timeout in milliseconds */
  private requestTimeout: number = 30000; // 30 seconds
  /** Logger function */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logDebug: (message: string, data?: any) => void;
  /** Logger function for errors */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logError: (message: string, data?: any) => void;

  /**
   * Create a new debug adapter client
   * 
   * @param debugLogger - Function to log debug messages
   * @param errorLogger - Function to log error messages
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debugLogger?: (message: string, data?: any) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorLogger?: (message: string, data?: any) => void
  ) {
    super();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.logDebug = debugLogger || ((message: string, data?: any) => console.log(message, data));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.logError = errorLogger || ((message: string, data?: any) => console.error(message, data));
  }

  /**
   * Set the connection timeout
   * 
   * @param timeout - Timeout in milliseconds
   */
  setConnectionTimeout(timeout: number): void {
    this.connectionTimeout = timeout;
  }

  /**
   * Set the request timeout
   * 
   * @param timeout - Timeout in milliseconds
   */
  setRequestTimeout(timeout: number): void {
    this.requestTimeout = timeout;
  }

  /**
   * Connect to a debug adapter with retry capability
   * 
   * @param host - The host to connect to
   * @param port - The port to connect to
   * @param retries - Number of connection retries
   * @param retryDelay - Delay between retries in milliseconds
   * @returns A promise that resolves when connected
   */
  async connect(
    host: string, 
    port: number, 
    retries: number = 3, 
    retryDelay: number = 1000
  ): Promise<void> {
    if (this.connected) {
      this.logDebug('Already connected to debug adapter');
      return;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        this.logDebug(`Connection attempt ${attempt}/${retries + 1} to ${host}:${port}`);
        await this.connectAttempt(host, port);
        this.logDebug(`Successfully connected to debug adapter at ${host}:${port}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logError(`Connection attempt ${attempt} failed: ${lastError.message}`, { error });
        
        if (attempt <= retries) {
          this.logDebug(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError || new Error(`Failed to connect to debug adapter at ${host}:${port}`);
  }

  /**
   * Single connection attempt
   * 
   * @param host - The host to connect to
   * @param port - The port to connect to
   * @returns A promise that resolves when connected
   */
  private connectAttempt(host: string, port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Set a connection timeout
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error(`Connection timeout after ${this.connectionTimeout}ms`));
      }, this.connectionTimeout);

      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.logDebug(`Connected to debug adapter at ${host}:${port}`);
        resolve();
      });

      this.socket.on('data', (data) => this.handleData(data));
      
      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.logError('Socket error', { error });
        this.emit('error', error);
        if (!this.connected) {
          reject(error);
        }
      });
      
      this.socket.on('close', () => {
        clearTimeout(timeout);
        this.handleClose();
        if (!this.connected) {
          reject(new Error('Connection closed during connect attempt'));
        }
      });

      // Connect to the debug adapter
      this.socket.connect(port, host);
    });
  }

  /**
   * Disconnect from the debug adapter
   */
  disconnect(): void {
    if (!this.connected || !this.socket) {
      return;
    }

    this.logDebug('Disconnecting from debug adapter');
    this.socket.end();
    this.socket = null;
    this.connected = false;
    
    // Reject all pending requests
    for (const [seq, { reject, command }] of this.pendingRequests.entries()) {
      this.logDebug(`Rejecting pending request #${seq} (${command}) due to disconnect`);
      reject(new Error('Disconnected from debug adapter'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Send a request to the debug adapter with timeout
   * 
   * @param command - The command to execute
   * @param args - Optional arguments for the command
   * @param timeoutMs - Optional custom timeout for this request
   * @returns A promise that resolves with the response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequest(command: string, args?: any, timeoutMs?: number): Promise<DAP.DebugProtocol.Response['body']> {
    if (!this.connected || !this.socket) {
      return Promise.reject(new Error('Not connected to debug adapter'));
    }

    const request: DAP.DebugProtocol.Request = {
      seq: this.seq++,
      type: 'request',
      command,
      arguments: args
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(request.seq)) {
          this.pendingRequests.delete(request.seq);
          this.logError(`Request #${request.seq} (${command}) timed out after ${timeoutMs || this.requestTimeout}ms`);
          reject(new Error(`Request timeout after ${timeoutMs || this.requestTimeout}ms`));
        }
      }, timeoutMs || this.requestTimeout);
      
      this.pendingRequests.set(request.seq, { 
        resolve: (response: DAP.DebugProtocol.Response['body']) => { // Matched the map type
          clearTimeout(timeout);
          resolve(response);
        }, 
        reject: (error?: Error) => { // Made error optional to match map type
          clearTimeout(timeout);
          if (error) reject(error); // Call outer reject only if error is present
          else reject(new Error('Unknown rejection reason')); // Or handle undefined error appropriately
        },
        command,
        timestamp: Date.now()
      });
      
      this.logDebug(`Sending request #${request.seq}: ${command}`, { args });
      
      try {
        const message = JSON.stringify(request);
        const contentLength = Buffer.byteLength(message, 'utf8');
        const header = `Content-Length: ${contentLength}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n`;
        
        this.socket!.write(header + message, 'utf8');
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.seq);
        this.logError(`Failed to send request #${request.seq} (${command})`, { error });
        reject(error);
      }
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
    const headers = new Map<string, string>();
    
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
      this.logError('Missing Content-Length header, discarding message');
      this.buffer = this.buffer.substring(headerEnd + 4);
      return false;
    }

    const contentLength = parseInt(contentLengthHeader, 10);
    if (isNaN(contentLength)) {
      this.logError('Invalid Content-Length, discarding message');
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
      const message = JSON.parse(messageStr) as DAP.DebugProtocol.ProtocolMessage;
      this.handleMessage(message);
      return true;
    } catch (error) {
      this.logError('Failed to parse DAP message', { error, messageStr });
      return true; // Continue processing buffer
    }
  }

  /**
   * Handle a parsed message
   * 
   * @param message - The parsed message
   */
  private handleMessage(message: DAP.DebugProtocol.ProtocolMessage): void {
    if (!message.type) {
      this.logError('Received message with no type field', { message });
      return;
    }
    
    this.logDebug(`Received message of type: ${message.type}, seq: ${message.seq}`);
    
    switch (message.type) {
      case 'response':
        this.handleResponse(message as DAP.DebugProtocol.Response);
        break;
      case 'event':
        this.handleEvent(message as DAP.DebugProtocol.Event);
        break;
      case 'request':
        this.logDebug('Received unexpected request message from debug adapter', { message });
        break;
      default:
        this.logError(`Unhandled message type: "${message.type}"`, { message });
    }
  }

  /**
   * Handle a response message
   * 
   * @param response - The response message
   */
  private handleResponse(response: DAP.DebugProtocol.Response): void {
    const request = this.pendingRequests.get(response.request_seq);
    if (!request) {
      this.logError('Received response for unknown request', { response });
      return;
    }

    this.pendingRequests.delete(response.request_seq);
    
    const elapsed = Date.now() - request.timestamp;
    this.logDebug(`Response received for request #${response.request_seq} (${request.command}) after ${elapsed}ms`, { success: response.success });

    if (response.success) {
      request.resolve(response.body);
    } else {
      this.logError(`Request #${response.request_seq} (${request.command}) failed`, { 
        message: response.message,
        response
      });
      request.reject(new Error(response.message || 'Unknown error'));
    }
  }

  /**
   * Handle an event message
   * 
   * @param event - The event message
   */
  private handleEvent(event: DAP.DebugProtocol.Event): void {
    this.logDebug(`Received event: ${event.event}`, { body: event.body });
    this.emit(event.event, event.body);
  }

  /**
   * Handle socket closure
   */
  private handleClose(): void {
    if (!this.connected) {
      return;
    }
    
    this.connected = false;
    this.logDebug('Connection to debug adapter closed');
    this.emit('close');
    
    // Reject all pending requests
    for (const [seq, { reject, command }] of this.pendingRequests.entries()) {
      this.logDebug(`Rejecting pending request #${seq} (${command}) due to connection closure`);
      reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}
