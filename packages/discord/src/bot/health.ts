import { createServer, type Server } from "node:http";

export interface HealthServerOptions {
   port: number;
   host?: string;
   service: string;
}

export interface HealthServer {
   server: Server;
   port: number;
   close(): Promise<void>;
}

export function startHealthServer(options: HealthServerOptions): HealthServer {
   const { port, host = "0.0.0.0", service } = options;

   const server = createServer((request, response) => {
      const pathname = (request.url ?? "/").split("?")[0];

      if (request.method === "GET" && pathname === "/health") {
         response.writeHead(200, { "Content-Type": "application/json" });
         response.end(
            JSON.stringify({
               status: "ok",
               service,
               uptimeSeconds: Math.floor(process.uptime()),
            })
         );
         return;
      }

      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
   });

   server.listen(port, host);

   return {
      server,
      port,
      close: () =>
         new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
         }),
   };
}
