import type * as ws from "ws";
import type { WebSocket } from "./websocket.js";
export declare class ConnectionManager {
    private connections;
    registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string;
}
export declare const ConnectionManagerAPI: {
    getInstance: () => ConnectionManager;
    getStats: () => {
        totalConnections: number;
    };
};
