import { createServer } from "node:http";

export function createHealthServer() {
   return createServer((req, res) => {
      const pathname = (req.url || "/").split("?")[0];

      if (req.method === "GET" && pathname === "/health") {
         res.writeHead(200, { "Content-Type": "application/json" });
         res.end(
            JSON.stringify({
               status: "ok",
               service: "ypt-bot",
               uptimeSeconds: Math.floor(process.uptime()),
            })
         );
         return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
   });
}
