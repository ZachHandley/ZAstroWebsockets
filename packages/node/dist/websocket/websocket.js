const wsMap = /* @__PURE__ */ new WeakMap();
const attacher = { attach: null };
class WebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  get url() {
    const ws = wsMap.get(this);
    return ws?.url ?? "";
  }
  get readyState() {
    const ws = wsMap.get(this);
    return ws?.readyState ?? this.CONNECTING;
  }
  get bufferedAmount() {
    const ws = wsMap.get(this);
    return ws?.bufferedAmount ?? 0;
  }
  // networking
  onopen = null;
  onerror = null;
  onclose = null;
  get extensions() {
    const ws = wsMap.get(this);
    return ws?.extensions ?? "";
  }
  get protocol() {
    const ws = wsMap.get(this);
    return ws?.protocol ?? "";
  }
  close() {
    const ws = wsMap.get(this);
    if (ws) ws.close();
    else this.addEventListener("open", () => this.close(), { once: true });
  }
  // messaging
  onmessage = null;
  get binaryType() {
    const ws = wsMap.get(this);
    return ws?.binaryType ?? "blob";
  }
  set binaryType(value) {
    const ws = wsMap.get(this);
    if (ws) {
      Object.assign(ws, { binaryType: value });
    } else {
      this.addEventListener("open", () => this.binaryType = value, { once: true });
    }
  }
  send(data) {
    const ws = wsMap.get(this);
    if (data instanceof Blob) data.arrayBuffer().then((buffer) => ws.send(buffer));
    else ws.send(data);
  }
  static {
    Object.assign(this.prototype, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    });
    Object.freeze(this.prototype);
    Object.freeze(this);
    attacher.attach = attachImpl;
  }
}
function attachImpl(standard, ws) {
  if (wsMap.has(standard)) {
    throw new Error("WebSocket already attached");
  }
  wsMap.set(standard, ws);
  init(standard, ws);
}
function init(standard, ws) {
  Object.assign(ws, { binaryType: "blob" });
  if (ws.readyState === ws.OPEN) {
    const event = new Event("open");
    standard.onopen?.(event);
    standard.dispatchEvent(event);
  }
  ws.on("open", function onOpen() {
    const event = new Event("open");
    standard.onopen?.(event);
    standard.dispatchEvent(event);
  });
  ws.on("message", function onMessage(data, isBinary) {
    const event = new MessageEvent("message", { data: isBinary ? data : data.toString() });
    standard.onmessage?.(event);
    standard.dispatchEvent(event);
  });
  ws.on("error", function onError(error) {
    const event = new ErrorEvent(error, error.message);
    standard.onerror?.(event);
    standard.dispatchEvent(event);
  });
  ws.addEventListener("close", function onClose(ev) {
    const event = new (globalThis.CloseEvent ?? CloseEvent)("close", ev);
    standard.onclose?.(event);
    standard.dispatchEvent(event);
  });
}
class ErrorEvent extends Event {
  constructor(error, message) {
    super("error");
    this.error = error;
    this.message = message;
  }
}
class CloseEvent extends Event {
  code;
  reason;
  wasClean;
  constructor(type, eventInitDict) {
    super(type, eventInitDict);
    this.code = eventInitDict.code ?? 0;
    this.reason = eventInitDict.reason ?? "";
    this.wasClean = eventInitDict.wasClean ?? false;
  }
}
function attach(standard, ws) {
  return attacher.attach?.(standard, ws);
}
export {
  CloseEvent,
  ErrorEvent,
  WebSocket,
  attach,
  attacher
};
