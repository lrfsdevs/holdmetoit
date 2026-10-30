export type ShutdownHandler = () => Promise<unknown> | unknown;

export interface GracefulShutdownOptions {
   exitCode?: number;
}

export function installGracefulShutdown(
   handlers: ShutdownHandler[],
   options: GracefulShutdownOptions = {}
): void {
   let shuttingDown = false;

   const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}. Shutting down gracefully...`);

      for (const handler of handlers) {
         try {
            await handler();
         } catch (error) {
            console.error("Error during shutdown:", error);
         }
      }

      process.exit(options.exitCode ?? 0);
   };

   process.on("SIGINT", () => void shutdown("SIGINT"));
   process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
