import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserProtocol } from '../../scripts/lib/browser-protocol.mjs';

class FakeSocket extends EventTarget {
  readyState = 1;
  send = vi.fn();
  receive(data: object) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
afterEach(() => { vi.useRealTimers(); });

describe('isolated browser protocol lifecycle', () => {
  it.each(['close', 'error'])('settles pending commands on %s without waiting for the protocol timeout', async event => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const send = browserProtocol(socket);
    const closing = expect(send('Browser.close')).rejects.toThrow('BROWSER_PROTOCOL_DISCONNECTED');
    const evaluating = expect(send('Runtime.evaluate')).rejects.toThrow('BROWSER_PROTOCOL_DISCONNECTED');
    socket.readyState = 3;
    socket.dispatchEvent(new Event(event));
    await Promise.all([closing, evaluating]);
    expect(vi.getTimerCount()).toBe(0);
    await expect(send('Page.enable')).rejects.toThrow('BROWSER_PROTOCOL_DISCONNECTED');
    expect(socket.send).toHaveBeenCalledTimes(2);
  });
  it('matches out-of-order responses and clears their timers', async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const send = browserProtocol(socket);
    const first = send('Page.enable');
    const second = send('Runtime.evaluate', {}, 'session');
    socket.receive({ id: 2, result: { value: 42 } });
    socket.receive({ id: 1, result: {} });
    await expect(second).resolves.toEqual({ value: 42 });
    await expect(first).resolves.toEqual({});
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a close command even when Chrome neither responds nor disconnects', async () => {
    vi.useFakeTimers();
    const send = browserProtocol(new FakeSocket());
    const closing = expect(send('Browser.close', {}, undefined, 3000)).rejects.toThrow('BROWSER_PROTOCOL_TIMEOUT: Browser.close');
    await vi.advanceTimersByTimeAsync(3000);
    await closing;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the command timer when sending throws', async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    socket.send.mockImplementation(() => { throw new Error('socket closed during send'); });
    await expect(browserProtocol(socket)('Page.enable')).rejects.toThrow('socket closed during send');
    expect(vi.getTimerCount()).toBe(0);
  });
});
