import { createServer } from "node:http";

function buildHealthPayload() {
   return JSON.stringify({
      status: "ok",
      service: "ypt-bot",
      uptimeSeconds: Math.floor(process.uptime()),
   });
}

export function createHealthServer() {
   return createServer((req, res) => {
      const pathname = (req.url || "/").split("?")[0];

      const isHead = req.method === "HEAD";

      if ((req.method === "GET" || isHead) && pathname === "/health") {
         const body = buildHealthPayload();

         res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
         });
         res.end(isHead ? undefined : body);
         return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
   });
}
