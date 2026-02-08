import type { APIContext, AstroIntegration, MiddlewareNext } from "astro";
export type ViteDevServer = Parameters<NonNullable<AstroIntegration["hooks"]["astro:server:setup"]>>[0]["server"];
/**
 * This dev-only middleware is responsible for all requests
 * that have been made as a result of an upgrade request.
 *
 * It checks whether the request is running within the context
 * of an `upgradeRequestStorage`, which are created below in
 * `hookIntoViteDevServer()`, and only runs if it is.
 */
export declare const onRequest: (context: APIContext, next: MiddlewareNext) => Promise<Response>;
export declare function handleUpgradeRequests(viteDevServer: ViteDevServer): void;
