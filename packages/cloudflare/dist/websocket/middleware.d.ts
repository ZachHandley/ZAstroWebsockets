/**
 * Cloudflare WebSocket middleware
 */
import { WebSocket } from './websocket.js';
declare global {
    var WebSocketPair: {
        new (): {
            0: CloudflareWebSocket;
            1: CloudflareWebSocket;
        };
    };
    interface CloudflareWebSocket {
        send(data: string | ArrayBufferLike | ArrayBufferView): void;
        close(code?: number, reason?: string): void;
        accept(): void;
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
    }
}
export interface CloudflareLocals {
    isUpgradeRequest: boolean;
    upgradeWebSocket(): {
        socket: WebSocket;
        response: Response;
    };
    runtime?: {
        env: any;
        cf: any;
        ctx: any;
        caches: any;
        waitUntil: (promise: Promise<any>) => void;
    };
}
export declare const onRequest: (context: any, next: () => Promise<Response>) => Promise<Response>;
