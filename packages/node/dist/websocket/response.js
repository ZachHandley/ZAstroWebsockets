import { pipeline } from "node:stream/promises";
class UpgradeResponse extends Response {
  status = 101;
}
const { Headers } = globalThis;
async function writeResponseToSocket(socket, response) {
  const { headers, status, statusText } = response;
  let head = `HTTP/1.1 ${status} ${statusText}\r
`;
  for (const [header, value] of new Headers(headers).entries()) {
    head += header + ": " + value + "\r\n";
  }
  socket.on("error", console.error);
  socket.write(head + "\r\n");
  if (response.body) {
    await pipeline(response.clone().body, socket);
  }
}
export {
  UpgradeResponse,
  writeResponseToSocket
};
