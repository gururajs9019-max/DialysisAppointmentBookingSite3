// Keep failures local to this request; never log URLs, headers, bodies, or
// arbitrary error messages, which can contain credentials or clinical data.
export function withRequestErrorBoundary(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch {
      console.error("Unexpected request handler failure.");
      if (res.destroyed || res.writableFinished) return;
      try {
        // A partial response must not be replaced with a second set of headers
        // or made to look like a successfully completed response.
        if (res.headersSent || res.writableEnded) {
          res.destroy();
          return;
        }
        for (const name of res.getHeaderNames()) res.removeHeader(name);
        res.writeHead(500, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Connection": "close",
        });
        res.end("Unexpected server error.");
      } catch {
        // The peer may have disconnected while we were preparing the error.
        res.destroy();
      }
    }
  };
}
