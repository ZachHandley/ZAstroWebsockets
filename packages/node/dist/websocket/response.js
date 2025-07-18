import { pipeline } from "node:stream/promises";
class UpgradeResponse extends Response {
  status = 101;
  constructor() {
    super(null, {
      status: 200,
      statusText: "Switching Protocols",
      headers: {
        "Upgrade": "websocket",
        "Connection": "Upgrade"
      }
    });
    Object.defineProperty(this, "status", {
      value: 101,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }
}
async function writeResponseToSocket(socket, response) {
  let head = `HTTP/1.1 ${response.status}`;
  if (response.statusText) head += ` ${response.statusText}`;
  head += `\r
`;
  for (const [name, value] of response.headers) {
    head += `${name}: ${value}\r
`;
  }
  socket.write(head + "\r\n");
  if (response.body) {
    await pipeline(response.clone().body, socket);
  }
}
export {
  UpgradeResponse,
  writeResponseToSocket
};
