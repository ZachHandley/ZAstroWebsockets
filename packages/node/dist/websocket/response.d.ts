export declare class UpgradeResponse extends Response {
    readonly status = 101;
    constructor();
}
export declare function writeResponseToSocket(socket: import("node:stream").Duplex, response: Response): Promise<void>;
