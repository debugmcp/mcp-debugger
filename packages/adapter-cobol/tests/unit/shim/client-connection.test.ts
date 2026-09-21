import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { DapFrameDecoder } from '@debugmcp/shared';
import { ClientConnection } from '../../../src/shim/client-connection.js';
import { NOOP_LOGGER } from '../../../src/shim/logger.js';

describe('client connection ending', () => {
  function setup() {
    const socket = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), destroyed: false, writableEnded: false });
    const client = new ClientConnection(socket as unknown as Socket, NOOP_LOGGER, { onClose: vi.fn(), onMessage: vi.fn() });
    return { socket, client };
  }

  it('flushes completed final replies past an unfinished walk and rejects later output immediately', () => {
    const { client, socket } = setup();
    const slow = client.reserve();
    client.send({ seq: 1, type: 'response', request_seq: 3, command: 'disconnect', success: true } as import('@vscode/debugprotocol').DebugProtocol.Response);
    expect(socket.write).not.toHaveBeenCalled();
    client.end();
    expect(client.isEnding).toBe(true);
    expect(client.isClosed).toBe(false);
    expect(new DapFrameDecoder().push(socket.write.mock.calls[0][0])).toMatchObject([{ command: 'disconnect', success: true }]);
    slow.resolve({ seq: 2, type: 'event' });
    client.send({ seq: 3, type: 'event' });
    client.end();
    expect(socket.write).toHaveBeenCalledTimes(1);
    expect(socket.end).toHaveBeenCalledTimes(1);
  });

  it.each(['end', 'close'])('discards pending and new output after socket %s', event => {
    const { client, socket } = setup();
    const slow = client.reserve();
    socket.emit(event);
    slow.resolve({ seq: 1, type: 'event' });
    client.send({ seq: 2, type: 'event' });
    expect(client.isEnding).toBe(true);
    expect(socket.write).not.toHaveBeenCalled();
  });
});
