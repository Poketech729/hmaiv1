import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  medicationSchedules,
  prescriptions,
  users,
} from "../db/schema.js";
import { requireAuth, requireRole, type AuthVariables } from "../middleware/auth.js";
import { generateNextDays } from "../lib/scheduleUtils.js";

const schedulesRouter = new Hono<{ Variables: AuthVariables }>();

schedulesRouter.use("*", requireAuth);

// ─── GET /api/schedules/today ─────────────────────────────────────────────────
// Patient: today's medication doses with status.
// Doctor: today's schedule for a specific patient (query ?patientId=...)

schedulesRouter.get("/today", async (c) => {
  const user = c.get("user");

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  let patientId = user.id;

  // Doctors can view a specific patient's schedule
  if (user.role === "doctor") {
    const qPatientId = c.req.query("patientId");
    if (!qPatientId) {
      throw new HTTPException(400, {
        message: "Doctors must provide ?patientId= to view a patient's schedule.",
      });
    }
    patientId = qPatientId;
  }

  const schedules = await db
    .select({
      schedule: medicationSchedules,
      prescription: {
        medicineName: prescriptions.medicineName,
        dosage: prescriptions.dosage,
        withFood: prescriptions.withFood,
        instructions: prescriptions.instructions,
        purpose: prescriptions.purpose,
      },
    })
    .from(medicationSchedules)
    .innerJoin(prescriptions, eq(medicationSchedules.prescriptionId, prescriptions.id))
    .where(
      and(
        eq(medicationSchedules.patientId, patientId),
        gte(medicationSchedules.scheduledFor, startOfDay),
        lte(medicationSchedules.scheduledFor, endOfDay)
      )
    )
    .orderBy(medicationSchedules.scheduledFor);

  // Summary stats
  const total = schedules.length;
  const taken = schedules.filter((s) => s.schedule.status === "taken").length;
  const missed = schedules.filter((s) => s.schedule.status === "missed").length;
  const pending = schedules.filter((s) => s.schedule.status === "pending").length;

  return c.json({
    date: now.toISOString().split("T")[0],
    summary: { total, taken, missed, pending },
    schedules,
  });
});

// ─── GET /api/schedules ───────────────────────────────────────────────────────
// Returns schedules for a date range. Query: ?from=2025-01-01&to=2025-01-07

schedulesRouter.get("/", async (c) => {
  const user = c.get("user");

  const from = c.req.query("from");
  const to = c.req.query("to");
  let patientId = user.id;

  if (user.role === "doctor") {
    const qPatientId = c.req.query("patientId");
    if (!qPatientId) {
      throw new HTTPException(400, { message: "Doctors must provide ?patientId=" });
    }
    patientId = qPatientId;
  }

  const conditions = [eq(medicationSchedules.patientId, patientId)];

  if (from) {
    conditions.push(gte(medicationSchedules.scheduledFor, new Date(from)));
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(medicationSchedules.scheduledFor, toDate));
  }

  const results = await db
    .select({
      schedule: medicationSchedules,
      medicineName: prescriptions.medicineName,
      dosage: prescriptions.dosage,
      withFood: prescriptions.withFood,
      instructions: prescriptions.instructions,
    })
    .from(medicationSchedules)
    .innerJoin(prescriptions, eq(medicationSchedules.prescriptionId, prescriptions.id))
    .where(and(...conditions))
    .orderBy(medicationSchedules.scheduledFor);

  return c.json(results);
});

// ─── POST /api/schedules/:id/take ─────────────────────────────────────────────
// Patient marks a dose as taken.

schedulesRouter.post(
  "/:id/take",
  requireRole("patient"),
  async (c) => {
    const patient = c.get("user");
    const { id } = c.req.param();

    const [schedule] = await db
      .select()
      .from(medicationSchedules)
      .where(
        and(
          eq(medicationSchedules.id, id),
          eq(medicationSchedules.patientId, patient.id)
        )
      )
      .limit(1);

    if (!schedule) {
      throw new HTTPException(404, { message: "Schedule entry not found." });
    }

    if (schedule.status === "taken") {
      throw new HTTPException(400, { message: "Dose already marked as taken." });
    }

    const [updated] = await db
      .update(medicationSchedules)
      .set({ status: "taken", takenAt: new Date() })
      .where(eq(medicationSchedules.id, id))
      .returning();

    return c.json({ success: true, schedule: updated });
  }
);

// ─── POST /api/schedules/:id/skip ─────────────────────────────────────────────
// Patient skips a dose with optional reason.

schedulesRouter.post(
  "/:id/skip",
  requireRole("patient"),
  zValidator("json", z.object({ notes: z.string().optional() })),
  async (c) => {
    const patient = c.get("user");
    const { id } = c.req.param();
    const { notes } = c.req.valid("json");

    const [schedule] = await db
      .select()
      .from(medicationSchedules)
      .where(
        and(
          eq(medicationSchedules.id, id),
          eq(medicationSchedules.patientId, patient.id)
        )
      )
      .limit(1);

    if (!schedule) {
      throw new HTTPException(404, { message: "Schedule entry not found." });
    }

    const [updated] = await db
      .update(medicationSchedules)
      .set({ status: "skipped", notes: notes ?? null })
      .where(eq(medicationSchedules.id, id))
      .returning();

    return c.json({ success: true, schedule: updated });
  }
);

// ─── POST /api/schedules/extend/:prescriptionId ───────────────────────────────
// Extends schedule generation for another 7 days.
// Called by a cron job or manually when running low on pre-generated slots.

schedulesRouter.post(
  "/extend/:prescriptionId",
  requireRole("doctor"),
  async (c) => {
    const { prescriptionId } = c.req.param();

    const [prescription] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, prescriptionId))
      .limit(1);

    if (!prescription) {
      throw new HTTPException(404, { message: "Prescription not found." });
    }

    // Find the latest existing scheduled entry
    const [latest] = await db
      .select({ scheduledFor: medicationSchedules.scheduledFor })
      .from(medicationSchedules)
      .where(eq(medicationSchedules.prescriptionId, prescriptionId))
      .orderBy(desc(medicationSchedules.scheduledFor))
      .limit(1);

    const fromDate = latest
      ? new Date(latest.scheduledFor)
      : new Date(prescription.startDate);

    // Start one day after the last existing entry
    fromDate.setDate(fromDate.getDate() + 1);

    const endDate = prescription.endDate ? new Date(prescription.endDate) : null;

    const newDates = generateNextDays(
      fromDate,
      endDate,
      prescription.scheduleTimes as string[],
      7
    );

    if (newDates.length === 0) {
      return c.json({ success: true, added: 0, message: "No new dates to add." });
    }

    await db.insert(medicationSchedules).values(
      newDates.map((scheduledFor) => ({
        prescriptionId,
        patientId: prescription.patientId,
        scheduledFor,
        status: "pending" as const,
      }))
    );

    return c.json({ success: true, added: newDates.length });
  }
);

export default schedulesRouter;
