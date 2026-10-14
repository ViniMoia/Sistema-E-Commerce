/** Reject outstanding CDP commands when Chrome disconnects, including during
 * Browser.close (which can close the socket before returning a response). */
export function browserProtocol(socket) {
  let serial = 0;
  const pending = new Map();
  const rejectPending = () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('BROWSER_PROTOCOL_DISCONNECTED'));
    }
    pending.clear();
  };
  socket.addEventListener('close', rejectPending);
  socket.addEventListener('error', rejectPending);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  return (method, params = {}, sessionId = undefined, timeout = 45000) => new Promise((resolve, reject) => {
    if (socket.readyState !== 1) { reject(new Error('BROWSER_PROTOCOL_DISCONNECTED')); return; }
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('BROWSER_PROTOCOL_TIMEOUT: ' + method));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
