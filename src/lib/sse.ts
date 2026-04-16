import { pool } from "./db";
import type { PoolClient } from "pg";

/**
 * Create an SSE ReadableStream backed by PostgreSQL LISTEN/NOTIFY.
 * The stream emits JSON events whenever pg_notify fires on the channel.
 * Also sends a heartbeat every 15s to keep mobile connections alive.
 */
export function createRoomStream(roomId: string): ReadableStream {
  const channel = `room_${roomId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  let client: PoolClient | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      try {
        client = await pool.connect();
        await client.query(`LISTEN ${channel}`);

        client.on("notification", (msg) => {
          if (msg.channel === channel && msg.payload) {
            try {
              const parsed = JSON.parse(msg.payload);
              send("game", parsed);
            } catch {
              send("game", { raw: msg.payload });
            }
          }
        });

        send("connected", { channel, ts: Date.now() });

        heartbeat = setInterval(() => {
          send("heartbeat", { ts: Date.now() });
        }, 15_000);
      } catch {
        send("error", { message: "Failed to connect to event stream" });
        controller.close();
      }
    },

    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (client) {
        client.query(`UNLISTEN ${channel}`).catch(() => {});
        client.release();
      }
    },
  });
}
