/**
 * Cloudflare WebSocket implementation
 */
export interface WebSocketUpgrade {
    socket: WebSocket;
    response: Response;
}
export declare class WebSocket extends EventTarget {
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    private _readyState;
    private _binaryType;
    private _url;
    private _protocol;
    private _extensions;
    private _ws;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
    onopen: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    constructor(url?: string);
    get url(): string;
    get readyState(): number;
    get bufferedAmount(): number;
    get extensions(): string;
    get protocol(): string;
    get binaryType(): "blob" | "arraybuffer";
    set binaryType(value: 'blob' | 'arraybuffer');
    close(code?: number, reason?: string): void;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
}
export declare function attach(standard: WebSocket, cfWebSocket: CloudflareWebSocket): void;
export declare class ErrorEvent extends Event {
    constructor(type: string, init?: {
        message?: string;
    });
    readonly message: string;
}
export declare class CloseEvent extends Event implements globalThis.CloseEvent {
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
    constructor(type: string, eventInitDict?: CloseEventInit);
}
interface CloseEventInit extends EventInit {
    code?: number;
    reason?: string;
    wasClean?: boolean;
}
interface CloudflareWebSocket {
    send(data: string | ArrayBufferLike | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: 'message', listener: (event: {
        data: any;
    }) => void): void;
    addEventListener(type: 'close', listener: (event: {
        code: number;
        reason: string;
        wasClean: boolean;
    }) => void): void;
    addEventListener(type: 'error', listener: (event: any) => void): void;
    addEventListener(type: 'open', listener: (event: any) => void): void;
    removeEventListener(type: string, listener: any): void;
    readonly readyState: number;
    readonly url: string;
    accept(): void;
}
export {};
