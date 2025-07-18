import type * as ws from "ws";
import type { WebSocket } from "./websocket.js";
export declare const WebSocketStats: {
    getConnectionCount: () => number;
    getConnectionStats: () => {
        totalConnections: number;
    };
    shutdown: () => void;
};
export declare function registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string;
