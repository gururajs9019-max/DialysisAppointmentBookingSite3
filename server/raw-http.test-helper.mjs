import net from "node:net";

// A TCP socket deliberately bypasses fetch/http URL and Host validation.
export function rawHttp(port, request) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let response = "";
    socket.setEncoding("utf8");
    socket.setTimeout(5_000, () => socket.destroy(new Error("Raw HTTP request timed out")));
    socket.on("connect", () => socket.write(request));
    socket.on("data", chunk => { response += chunk; });
    socket.on("error", reject);
    socket.on("close", hadError => { if (!hadError) resolve(response); });
  });
}

export function malformedRequests() {
  const privateHeaders = "Cookie: private-cookie-marker\r\nAuthorization: Bearer private-auth-marker\r\n";
  return [
    `GET /?private-query-marker HTTP/1.1\r\nHost: [\r\n${privateHeaders}Connection: close\r\n\r\n`,
    `GET /staff/sessions HTTP/1.1\r\nHost: invalid:port\r\nConnection: close\r\n\r\n`,
    `GET http://[ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`,
    `POST /api/appointments HTTP/1.1\r\nHost: [\r\nContent-Length: 19\r\nConnection: close\r\n\r\nprivate-body-marker`,
  ];
}
