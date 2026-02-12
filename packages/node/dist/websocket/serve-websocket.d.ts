import { NodeApp } from "astro/app/node";
export type UpgradeHandler = import("node:http").Server["on"] extends (event: "upgrade", callback: infer UpgradeHandler) => unknown ? UpgradeHandler : never;
export declare function createWebsocketHandler(app: NodeApp): UpgradeHandler;
