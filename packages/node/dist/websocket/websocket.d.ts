import type * as ws from "ws";
type WebSocketInterface = globalThis.WebSocket;
export declare const attacher: {
    attach: null | typeof attachImpl;
};
export declare class WebSocket extends EventTarget implements WebSocketInterface {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    get url(): string;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
    get readyState(): 0 | 2 | 3 | 1;
    get bufferedAmount(): number;
    onopen: WebSocketInterface["onopen"];
    onerror: WebSocketInterface["onerror"];
    onclose: WebSocketInterface["onclose"];
    get extensions(): string;
    get protocol(): string;
    close(): void;
    onmessage: WebSocketInterface["onmessage"];
    get binaryType(): "arraybuffer" | "blob";
    set binaryType(value: "arraybuffer" | "blob");
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
}
declare function attachImpl(standard: WebSocket, ws: ws.WebSocket): void;
export declare class ErrorEvent extends Event {
    readonly error: Error;
    readonly message: string;
    constructor(error: Error, message: string);
}
export declare class CloseEvent extends Event implements globalThis.CloseEvent {
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
    constructor(type: string, eventInitDict: CloseEventInit);
}
export declare function attach(standard: WebSocket, ws: ws.WebSocket): void;
interface CloseEventInit extends EventInit {
    code?: number;
    reason?: string;
    wasClean?: boolean;
}
declare global {
    namespace App {
        interface Locals {
            isUpgradeRequest?: boolean;
            upgradeWebSocket?: () => {
                socket: WebSocket;
                response: import("./response.js").UpgradeResponse;
            };
        }
    }
}
export {};
