/**
 * Cloudflare WebSocket server entrypoint
 */
import type { App } from 'astro/app';
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
export type CloudflareApp = App;
export declare function createWebSocketHandler(app: CloudflareApp): (request: Request, env: any, ctx: any) => Promise<Response>;
export { WebSocket, attach } from './websocket.js';
