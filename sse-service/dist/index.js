"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT ?? "8000";
const SSE_SECRET = process.env.SSE_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";
if (!SSE_SECRET) {
    throw new Error("SSE_SECRET environment variable is required.");
}
const clientsByPoll = new Map();
function getOrCreateSet(pollId) {
    let set = clientsByPoll.get(pollId);
    if (!set) {
        set = new Set();
        clientsByPoll.set(pollId, set);
    }
    return set;
}
function removeClient(pollId, res) {
    const set = clientsByPoll.get(pollId);
    if (set) {
        set.delete(res);
        if (set.size === 0) {
            clientsByPoll.delete(pollId);
        }
    }
}
function sendSSE(res, event, data) {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.get("/stream/:pollId", (req, res) => {
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
app.post("/notify/:pollId", (req, res) => {
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
    const body = req.body;
    const payload = JSON.stringify({
        question: body?.question,
        options: body?.options ?? [],
        totalVotes: body?.totalVotes ?? 0,
    });
    const clients = clientsByPoll.get(pollId);
    const count = clients?.size ?? 0;
    if (clients) {
        const dead = [];
        clients.forEach((client) => {
            try {
                sendSSE(client, "update", payload);
                client.flushHeaders?.();
            }
            catch {
                dead.push(client);
            }
        });
        dead.forEach((client) => clients.delete(client));
        if (clients.size === 0) {
            clientsByPoll.delete(pollId);
        }
    }
    res.json({ success: true, deliveredTo: count });
});
const server = app.listen(Number(PORT), () => {
    console.log(`SSE service listening on port ${PORT}`);
});
function shutdown() {
    clientsByPoll.forEach((set) => {
        set.forEach((res) => {
            try {
                res.end();
            }
            catch {
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
