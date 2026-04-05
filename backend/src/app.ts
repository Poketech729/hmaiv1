import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";

import authRouter from "./routes/authNew.js";
import prescriptionsRouter from "./routes/prescriptions.js";
import schedulesRouter from "./routes/schedules.js";
import healthRouter from "./routes/health.js";
import usersRouter from "./routes/users.js";
import aiRouter from "./routes/ai.js";

const DEFAULT_LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function getAllowedOrigins() {
  const configured = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_LOCAL_ORIGINS, ...configured])];
}

const allowedOrigins = getAllowedOrigins();

const app = new Hono();

app.use("*", logger());
app.use("*", prettyJSON());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0];
      if (allowedOrigins.includes(origin)) return origin;
      if (/^https:\/\/.+\.vercel\.app$/.test(origin)) return origin;
      return allowedOrigins[0];
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.get("/", (c) => c.json({ status: "ok", service: "HMAI Backend", version: "1.0.0" }));

app.route("/api/auth", authRouter);
app.route("/api/users", usersRouter);
app.route("/api/prescriptions", prescriptionsRouter);
app.route("/api/schedules", schedulesRouter);
app.route("/api/health", healthRouter);
app.route("/api", aiRouter);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status,
    );
  }

  console.error("[Unhandled Error]", err);

  return c.json(
    {
      error: "Internal server error",
      status: 500,
    },
    500,
  );
});

app.notFound((c) =>
  c.json({ error: `Route ${c.req.method} ${c.req.path} not found`, status: 404 }, 404),
);

export default app;
