import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { healthRecords, users } from "../db/schema.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

const healthRouter = new Hono<{ Variables: AuthVariables }>();

healthRouter.use("*", requireAuth);

// ─── Validation ───────────────────────────────────────────────────────────────

const logHealthSchema = z.object({
  type: z.enum([
    "blood_pressure",
    "blood_sugar",
    "heart_rate",
    "weight",
    "temperature",
    "oxygen_saturation",
    "other",
  ]),
  // Flexible: { value: 98.6 } or { systolic: 120, diastolic: 80 }
  value: z.record(z.unknown()),
  unit: z.string().optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(), // ISO datetime; defaults to now
  // Doctors can log on behalf of a patient
  patientId: z.string().uuid().optional(),
});

// ─── POST /api/health ─────────────────────────────────────────────────────────
// Log a health measurement. Patients log for themselves; doctors can log for a patient.

healthRouter.post("/", zValidator("json", logHealthSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  let targetPatientId: string;

  if (user.role === "doctor") {
    if (!body.patientId) {
      throw new HTTPException(400, {
        message: "Doctors must provide patientId when logging health records.",
      });
    }

    // Verify the patient exists
    const [patient] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, body.patientId))
      .limit(1);

    if (!patient || patient.role !== "patient") {
      throw new HTTPException(404, { message: "Patient not found." });
    }

    targetPatientId = body.patientId;
  } else {
    // Patient always logs for themselves
    targetPatientId = user.id;
  }

  const [record] = await db
    .insert(healthRecords)
    .values({
      patientId: targetPatientId,
      loggedBy: user.id,
      type: body.type,
      value: body.value,
      unit: body.unit,
      notes: body.notes,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    })
    .returning();

  return c.json(record, 201);
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
// Patients see their own history.
// Doctors query by ?patientId=... and optionally ?type=blood_pressure

healthRouter.get("/", async (c) => {
  const user = c.get("user");

  let patientId = user.id;

  if (user.role === "doctor") {
    const qPatientId = c.req.query("patientId");
    if (!qPatientId) {
      throw new HTTPException(400, { message: "Doctors must provide ?patientId=" });
    }
    patientId = qPatientId;
  }

  const type = c.req.query("type");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = parseInt(c.req.query("limit") ?? "50");

  const conditions = [eq(healthRecords.patientId, patientId)];

  if (type) {
    conditions.push(eq(healthRecords.type, type as any));
  }
  if (from) {
    conditions.push(gte(healthRecords.recordedAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(healthRecords.recordedAt, new Date(to)));
  }

  const results = await db
    .select()
    .from(healthRecords)
    .where(and(...conditions))
    .orderBy(desc(healthRecords.recordedAt))
    .limit(Math.min(limit, 200));

  return c.json(results);
});

// ─── GET /api/health/summary ──────────────────────────────────────────────────
// Returns the latest reading of each health metric type for a patient.
// Great for a dashboard "health overview" card.

healthRouter.get("/summary", async (c) => {
  const user = c.get("user");
  let patientId = user.id;

  if (user.role === "doctor") {
    const qPatientId = c.req.query("patientId");
    if (!qPatientId) {
      throw new HTTPException(400, { message: "Doctors must provide ?patientId=" });
    }
    patientId = qPatientId;
  }

  const types = [
    "blood_pressure",
    "blood_sugar",
    "heart_rate",
    "weight",
    "temperature",
    "oxygen_saturation",
  ] as const;

  const summary: Record<string, any> = {};

  for (const type of types) {
    const [latest] = await db
      .select()
      .from(healthRecords)
      .where(
        and(
          eq(healthRecords.patientId, patientId),
          eq(healthRecords.type, type)
        )
      )
      .orderBy(desc(healthRecords.recordedAt))
      .limit(1);

    summary[type] = latest ?? null;
  }

  return c.json(summary);
});

// ─── DELETE /api/health/:id ───────────────────────────────────────────────────
// Only the logger (patient or doctor who created it) can delete.

healthRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const { id } = c.req.param();

  const [record] = await db
    .select()
    .from(healthRecords)
    .where(eq(healthRecords.id, id))
    .limit(1);

  if (!record) {
    throw new HTTPException(404, { message: "Health record not found." });
  }

  // Only the person who logged it can delete
  if (record.loggedBy !== user.id && record.patientId !== user.id) {
    throw new HTTPException(403, { message: "Access denied." });
  }

  await db.delete(healthRecords).where(eq(healthRecords.id, id));

  return c.json({ success: true });
});

export default healthRouter;
