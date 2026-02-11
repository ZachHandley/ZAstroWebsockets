import { attacher } from "./attach.js";
class WebSocket extends EventTarget {
  // Use private field like the original patch
  #ws;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  get url() {
    return this.#ws?.url ?? "";
  }
  get readyState() {
    return this.#ws?.readyState ?? this.CONNECTING;
  }
  get bufferedAmount() {
    return this.#ws?.bufferedAmount ?? 0;
  }
  // networking event handlers
  onopen = null;
  onerror = null;
  onclose = null;
  get extensions() {
    return this.#ws?.extensions ?? "";
  }
  get protocol() {
    return this.#ws?.protocol ?? "";
  }
  close() {
    if (this.#ws) this.#ws.close();
    else this.addEventListener("open", () => this.close(), { once: true });
  }
  // messaging
  onmessage = null;
  get binaryType() {
    return this.#ws?.binaryType ?? "blob";
  }
  set binaryType(value) {
    if (this.#ws) {
      this.#ws.binaryType = value;
    } else {
      this.addEventListener("open", () => this.binaryType = value, { once: true });
    }
  }
  send(data) {
    if (data instanceof Blob) data.arrayBuffer().then((buffer) => this.#ws.send(buffer));
    else this.#ws.send(data);
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
    attacher.attach = (standard, ws) => {
      if (standard.#ws) {
        throw new Error("WebSocket already attached");
      }
      standard.#ws = ws;
      init(standard, ws);
      return standard;
    };
  }
}
function init(standard, ws) {
  ws.binaryType = "blob";
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
export {
  CloseEvent,
  ErrorEvent,
  WebSocket
};
