import type { AstroAdapter, AstroIntegration } from 'astro';
import type { Options, UserOptions } from './types.js';
export declare function getAdapter(options: Options): AstroAdapter;
declare global {
    namespace App {
        interface Locals {
            isUpgradeRequest?: boolean;
            upgradeWebSocket?: () => {
                socket: import('./websocket/websocket.js').WebSocket;
                response: import('./websocket/response.js').UpgradeResponse;
            };
        }
    }
}
export default function createIntegration(userOptions: UserOptions): AstroIntegration;
