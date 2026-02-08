import { pipeline } from "node:stream/promises"

/**
 * Custom subclass because spec-compliant Response objects can't have a status of 101.
 */
export class UpgradeResponse extends Response {
    readonly status = 101
}

const { Headers } = globalThis

/**
 * The "upgrade" event callback doesn't provide a response object.
 * If the userland code decides that protocol should not be upgraded,
 * the rejection response must be manually streamed into the lower
 * level socket.
 */
export async function writeResponseToSocket(socket: import("node:stream").Duplex, response: Response) {
    const { headers, status, statusText } = response
    let head = `HTTP/1.1 ${status} ${statusText}\r\n`
    /**
     * The `Headers` class will have made sure that it
     * contains only valid header names and values.
     *
     * But we can't be sure that the prototypes of `Response`
     * and `Headers` classes have not been tampered with.
     *
     * As a security measure, the headers are reconstructed
     * here, performing the validation in the process.
     *
     * This function is not a hot path, it is only called
     * when an upgrade request does not receive an upgrade
     * response.
     */
    for (const [ header, value ] of new Headers(headers).entries()) {
        head += header + ": " + value + "\r\n"
    }
    /**
     * Windows has some odd streaming errors.
     */
    socket.on("error", console.error)
    socket.write(head + "\r\n")
    if (response.body) {
        /**
         * Astro is also going to attempt to read the body
         * if it exists. Since streams can only be consumed
         * once, we clone here.
         */
        await pipeline(response.clone().body!, socket)
    }
}
