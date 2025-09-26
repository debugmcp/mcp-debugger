/**
 * Pure message handlers for DAP protocol
 */
import { DAPSessionState, DAPProcessingResult, ProxyMessage } from './types.js';
/**
 * Main handler for proxy messages
 */
export declare function handleProxyMessage(state: DAPSessionState, message: ProxyMessage): DAPProcessingResult;
/**
 * Validate a message has required fields
 */
export declare function isValidProxyMessage(message: unknown): message is ProxyMessage;
