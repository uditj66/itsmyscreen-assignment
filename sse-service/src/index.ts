import express, { Request, Response } from "express";
import cors from "cors";
import type { PollId, ClientSet, NotifyBody } from "./types.js";
import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT ?? "8000";
const SSE_SECRET = process.env.SSE_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

if (!SSE_SECRET) {
  throw new Error("SSE_SECRET environment variable is required.");
}

const clientsByPoll = new Map<PollId, ClientSet>();

function getOrCreateSet(pollId: PollId): ClientSet {
  let set = clientsByPoll.get(pollId);
  if (!set) {
    set = new Set<Response>();
    clientsByPoll.set(pollId, set);
  }
  return set;
}

function removeClient(pollId: PollId, res: Response): void {
  const set = clientsByPoll.get(pollId);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      clientsByPoll.delete(pollId);
    }
  }
}

function sendSSE(res: Response, event: string, data: string): void {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/stream/:pollId", (req: Request<{ pollId: string }>, res: Response) => {
  const pollId = req.params.pollId;
  if (!pollId) {
    res.status(400).json({ success: false, message: "Missing pollId." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clients = getOrCreateSet(pollId);
  clients.add(res);

  sendSSE(res, "connected", JSON.stringify({ pollId }));

  req.on("close", () => {
    removeClient(pollId, res);
  });
});

app.post(
  "/notify/:pollId",
  (req: Request<{ pollId: string }>, res: Response) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";

    if (token !== SSE_SECRET) {
      res.status(401).json({ success: false, message: "Unauthorized." });
      return;
    }

    const pollId = req.params.pollId;
    if (!pollId) {
      res.status(400).json({ success: false, message: "Missing pollId." });
      return;
    }

    const body = req.body as NotifyBody;
    const payload = JSON.stringify({
      question: body?.question,
      options: body?.options ?? [],
      totalVotes: body?.totalVotes ?? 0,
    });

    const clients = clientsByPoll.get(pollId);
    const count = clients?.size ?? 0;

    if (clients) {
      const dead: Response[] = [];
      clients.forEach((client) => {
        try {
          sendSSE(client, "update", payload);
          client.flushHeaders?.();
        } catch {
          dead.push(client);
        }
      });
      dead.forEach((client) => clients.delete(client));
      if (clients.size === 0) {
        clientsByPoll.delete(pollId);
      }
    }

    res.json({ success: true, deliveredTo: count });
  }
);

const server = app.listen(Number(PORT), () => {
  console.log(`SSE service listening on port ${PORT}`);
});

function shutdown(): void {
  clientsByPoll.forEach((set) => {
    set.forEach((res) => {
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  });
  clientsByPoll.clear();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
