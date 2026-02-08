/**
 * Custom subclass because spec-compliant Response objects can't have a status of 101.
 */
export declare class UpgradeResponse extends Response {
    readonly status = 101;
}
/**
 * The "upgrade" event callback doesn't provide a response object.
 * If the userland code decides that protocol should not be upgraded,
 * the rejection response must be manually streamed into the lower
 * level socket.
 */
export declare function writeResponseToSocket(socket: import("node:stream").Duplex, response: Response): Promise<void>;
