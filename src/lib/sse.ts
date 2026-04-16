import { pool } from "./db";

/**
 * Create an SSE ReadableStream backed by PostgreSQL LISTEN/NOTIFY.
 * The stream emits JSON events whenever pg_notify fires on the channel.
 * Also sends a heartbeat every 15s to keep mobile connections alive.
 */
export function createRoomStream(roomId: string): ReadableStream {
  const channel = `room_${roomId.replace(/[^a-zA-Z0-9_]/g, "_")}`;

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

      let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

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

        // Send initial connected event
        send("connected", { channel, ts: Date.now() });

        // Heartbeat to prevent mobile browsers/proxies from killing the connection
        heartbeat = setInterval(() => {
          send("heartbeat", { ts: Date.now() });
        }, 15_000);
      } catch (err) {
        send("error", { message: "Failed to connect to event stream" });
        controller.close();
      }

      // Cleanup when the stream is cancelled (client disconnects)
      return () => {
        if (heartbeat) clearInterval(heartbeat);
        if (client) {
          client.query(`UNLISTEN ${channel}`).catch(() => {});
          client.release();
        }
      };
    },

    cancel() {
      // Handled by the start() return cleanup
    },
  });
}
