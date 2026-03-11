import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";

export async function startHttpServer(
  fetch: (request: Request) => Response | Promise<Response>,
  host: string,
  port: number
) {
  return new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off("error", handleError);
      reject(error);
    };

    const server = serve(
      {
        fetch,
        hostname: host,
        port
      },
      (_info: AddressInfo) => {
        server.off("error", handleError);
        resolve(server);
      }
    );
    server.once("error", handleError);
  });
}
