class WebSocket extends EventTarget {
  _ws;
  _readyState = 0;
  // Use numeric literal instead of static property
  _binaryType = "blob";
  _url = "";
  _protocol = "";
  _extensions = "";
  _bufferedAmount = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  // Instance constants
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
  // Event handlers
  onopen = null;
  onerror = null;
  onclose = null;
  onmessage = null;
  constructor(url) {
    super();
    this._url = url || "";
  }
  get url() {
    return this._url;
  }
  get readyState() {
    return this._readyState;
  }
  get bufferedAmount() {
    return this._bufferedAmount;
  }
  get extensions() {
    return this._extensions;
  }
  get protocol() {
    return this._protocol;
  }
  get binaryType() {
    return this._binaryType;
  }
  set binaryType(value) {
    this._binaryType = value;
  }
  close(code, reason) {
    if (this._readyState === WebSocket.CLOSED || this._readyState === WebSocket.CLOSING) {
      return;
    }
    this._readyState = WebSocket.CLOSING;
    if (this._ws) {
      this._ws.close(code, reason);
    } else {
      this._readyState = WebSocket.CLOSED;
      const event = new CloseEvent("close", { code: code || 1e3, reason: reason || "", wasClean: true });
      this.onclose?.(event);
      this.dispatchEvent(event);
    }
  }
  send(data) {
    if (this._readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    if (this._ws) {
      if (data instanceof Blob) {
        data.arrayBuffer().then((buffer) => this._ws.send(buffer));
      } else {
        this._ws.send(data);
      }
    }
  }
}
const wsMap = /* @__PURE__ */ new WeakMap();
function attach(standard, cfWebSocket) {
  if (wsMap.has(standard)) {
    throw new Error("WebSocket already attached");
  }
  wsMap.set(standard, cfWebSocket);
  Object.defineProperty(standard, "_ws", { value: cfWebSocket, writable: true });
  Object.defineProperty(standard, "_readyState", { value: WebSocket.OPEN, writable: true });
  cfWebSocket.addEventListener("message", (event) => {
    const messageEvent = new MessageEvent("message", { data: event.data });
    standard.onmessage?.(messageEvent);
    standard.dispatchEvent(messageEvent);
  });
  cfWebSocket.addEventListener("close", (event) => {
    Object.assign(standard, { _readyState: WebSocket.CLOSED });
    const closeEvent = new CloseEvent("close", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
    standard.onclose?.(closeEvent);
    standard.dispatchEvent(closeEvent);
  });
  cfWebSocket.addEventListener("error", (_event) => {
    const errorEvent = new ErrorEvent("error", { message: "WebSocket error" });
    standard.onerror?.(errorEvent);
    standard.dispatchEvent(errorEvent);
  });
  const openEvent = new Event("open");
  standard.onopen?.(openEvent);
  standard.dispatchEvent(openEvent);
}
class ErrorEvent extends Event {
  constructor(type, init) {
    super(type);
    this.message = init?.message || "";
  }
  message;
}
class CloseEvent extends Event {
  code;
  reason;
  wasClean;
  constructor(type, eventInitDict) {
    super(type, eventInitDict);
    this.code = eventInitDict?.code ?? 0;
    this.reason = eventInitDict?.reason ?? "";
    this.wasClean = eventInitDict?.wasClean ?? false;
  }
}
export {
  CloseEvent,
  ErrorEvent,
  WebSocket,
  attach
};
