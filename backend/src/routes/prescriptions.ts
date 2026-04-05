import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { prescriptions, medicationSchedules, users } from "../db/schema.js";
import { requireAuth, requireRole, type AuthVariables } from "../middleware/auth.js";
import { generateScheduleDates } from "../lib/scheduleUtils.js";

const prescriptionsRouter = new Hono<{ Variables: AuthVariables }>();

// All prescription routes require authentication
prescriptionsRouter.use("*", requireAuth);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  medicineName: z.string().min(1),
  genericName: z.string().optional(),
  dosage: z.string().min(1),
  frequency: z.enum([
    "once_daily",
    "twice_daily",
    "three_times_daily",
    "four_times_daily",
    "every_6_hours",
    "every_8_hours",
    "every_12_hours",
    "weekly",
    "as_needed",
  ]),
  scheduleTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  startDate: z.string(), // ISO date
  endDate: z.string().optional(),
  withFood: z.boolean().optional(),
  instructions: z.string().optional(),
  purpose: z.string().optional(),
  refillsRemaining: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const updatePrescriptionSchema = createPrescriptionSchema
  .partial()
  .extend({
    status: z
      .enum(["active", "completed", "cancelled", "paused"])
      .optional(),
  })
  .omit({ patientId: true }); // can't change who the prescription belongs to

// ─── GET /api/prescriptions ───────────────────────────────────────────────────
// Doctors see all prescriptions they've written.
// Patients see only their own.

prescriptionsRouter.get("/", async (c) => {
  const user = c.get("user");

  const query = user.role === "doctor"
    ? db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.doctorId, user.id))
        .orderBy(desc(prescriptions.createdAt))
    : db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.patientId, user.id))
        .orderBy(desc(prescriptions.createdAt));

  const results = await query;

  // Enrich with patient/doctor name for display
  const enriched = await Promise.all(
    results.map(async (p) => {
      const [patient] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, p.patientId))
        .limit(1);

      let doctor = null;
      if (p.doctorId) {
        const [d] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, p.doctorId))
          .limit(1);
        doctor = d;
      }

      return { ...p, patient, doctor };
    })
  );

  return c.json(enriched);
});

// ─── GET /api/prescriptions/:id ───────────────────────────────────────────────

prescriptionsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const { id } = c.req.param();

  const [prescription] = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.id, id))
    .limit(1);

  if (!prescription) {
    throw new HTTPException(404, { message: "Prescription not found." });
  }

  // Access control: only the patient or prescribing doctor
  if (
    prescription.patientId !== user.id &&
    prescription.doctorId !== user.id
  ) {
    throw new HTTPException(403, { message: "Access denied." });
  }

  // Also fetch upcoming schedules for this prescription
  const schedules = await db
    .select()
    .from(medicationSchedules)
    .where(eq(medicationSchedules.prescriptionId, id))
    .orderBy(medicationSchedules.scheduledFor);

  return c.json({ ...prescription, schedules });
});

// ─── POST /api/prescriptions ──────────────────────────────────────────────────
// Only doctors can create prescriptions.

prescriptionsRouter.post(
  "/",
  requireRole("doctor"),
  zValidator("json", createPrescriptionSchema),
  async (c) => {
    const doctor = c.get("user");
    const body = c.req.valid("json");

    // Verify the patient exists
    const [patient] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, body.patientId))
      .limit(1);

    if (!patient || patient.role !== "patient") {
      throw new HTTPException(404, { message: "Patient not found." });
    }

    const [newPrescription] = await db
      .insert(prescriptions)
      .values({
        ...body,
        doctorId: doctor.id,
        scheduleTimes: body.scheduleTimes,
        startDate: body.startDate,
        endDate: body.endDate,
        withFood: body.withFood ?? false,
        refillsRemaining: body.refillsRemaining ?? 0,
        status: "active",
      })
      .returning();

    // Auto-generate medication schedule entries for the next 7 days
    const scheduleDates = generateScheduleDates(
      body.startDate,
      body.endDate,
      body.scheduleTimes,
      7
    );

    if (scheduleDates.length > 0) {
      await db.insert(medicationSchedules).values(
        scheduleDates.map((scheduledFor) => ({
          prescriptionId: newPrescription.id,
          patientId: body.patientId,
          scheduledFor,
          status: "pending" as const,
        }))
      );
    }

    return c.json(newPrescription, 201);
  }
);

// ─── PUT /api/prescriptions/:id ───────────────────────────────────────────────
// Only the prescribing doctor can edit.

prescriptionsRouter.put(
  "/:id",
  requireRole("doctor"),
  zValidator("json", updatePrescriptionSchema),
  async (c) => {
    const doctor = c.get("user");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(prescriptions)
      .where(and(eq(prescriptions.id, id), eq(prescriptions.doctorId, doctor.id)))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, {
        message: "Prescription not found or you are not the prescribing doctor.",
      });
    }

    const [updated] = await db
      .update(prescriptions)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();

    return c.json(updated);
  }
);

// ─── DELETE /api/prescriptions/:id ────────────────────────────────────────────
// Soft-cancel rather than hard delete.

prescriptionsRouter.delete("/:id", requireRole("doctor"), async (c) => {
  const doctor = c.get("user");
  const { id } = c.req.param();

  const [existing] = await db
    .select({ id: prescriptions.id })
    .from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.doctorId, doctor.id)))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: "Prescription not found." });
  }

  await db
    .update(prescriptions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(prescriptions.id, id));

  return c.json({ success: true, message: "Prescription cancelled." });
});

export default prescriptionsRouter;
