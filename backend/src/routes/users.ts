import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  doctorProfiles,
  patientProfiles,
  doctorPatients,
} from "../db/schema.js";
import { requireAuth, requireRole, type AuthVariables } from "../middleware/auth.js";

const usersRouter = new Hono<{ Variables: AuthVariables }>();

usersRouter.use("*", requireAuth);

// ─── GET /api/users/me ────────────────────────────────────────────────────────

usersRouter.get("/me", async (c) => {
  const user = c.get("user");

  let profile = null;
  if (user.role === "doctor") {
    const [dp] = await db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, user.id))
      .limit(1);
    profile = dp ?? null;
  } else {
    const [pp] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, user.id))
      .limit(1);
    profile = pp ?? null;
  }

  return c.json({ user, profile });
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  preferredLanguage: z.string().optional(),
});

usersRouter.put("/me", zValidator("json", updateUserSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const [updated] = await db
    .update(users)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  return c.json(updated);
});

// ─── PUT /api/users/me/profile ────────────────────────────────────────────────
// Update role-specific profile fields.

const updateDoctorProfileSchema = z.object({
  specialty: z.string().optional(),
  hospital: z.string().optional(),
  qualification: z.string().optional(),
  yearsOfExperience: z.number().int().optional(),
  bio: z.string().optional(),
  consultationFee: z.number().int().optional(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
});

const updatePatientProfileSchema = z.object({
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
});

usersRouter.put("/me/profile", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  if (user.role === "doctor") {
    const parsed = updateDoctorProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message });
    }

    const [updated] = await db
      .update(doctorProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(doctorProfiles.userId, user.id))
      .returning();

    return c.json(updated);
  } else {
    const parsed = updatePatientProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPException(400, { message: parsed.error.message });
    }

    const [updated] = await db
      .update(patientProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(patientProfiles.userId, user.id))
      .returning();

    return c.json(updated);
  }
});

// ─── GET /api/users/doctor/patients ──────────────────────────────────────────
// Doctor fetches their linked patient list.

usersRouter.get("/doctor/patients", requireRole("doctor"), async (c) => {
  const doctor = c.get("user");

  const links = await db
    .select({ patientId: doctorPatients.patientId })
    .from(doctorPatients)
    .where(
      and(
        eq(doctorPatients.doctorId, doctor.id),
        eq(doctorPatients.active, true)
      )
    );

  if (links.length === 0) return c.json([]);

  const patientIds = links.map((l) => l.patientId);

  // Fetch all patients with their profiles
  const patients = await Promise.all(
    patientIds.map(async (pid) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, pid))
        .limit(1);

      const [profile] = await db
        .select()
        .from(patientProfiles)
        .where(eq(patientProfiles.userId, pid))
        .limit(1);

      return { user, profile: profile ?? null };
    })
  );

  return c.json(patients);
});

// ─── POST /api/users/doctor/link-patient ─────────────────────────────────────
// Doctor links a patient to their care (by patient userId).

usersRouter.post(
  "/doctor/link-patient",
  requireRole("doctor"),
  zValidator("json", z.object({ patientId: z.string().uuid() })),
  async (c) => {
    const doctor = c.get("user");
    const { patientId } = c.req.valid("json");

    const [patient] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, patientId))
      .limit(1);

    if (!patient || patient.role !== "patient") {
      throw new HTTPException(404, { message: "Patient not found." });
    }

    // Check if already linked
    const [existing] = await db
      .select()
      .from(doctorPatients)
      .where(
        and(
          eq(doctorPatients.doctorId, doctor.id),
          eq(doctorPatients.patientId, patientId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.active) {
        return c.json({ message: "Patient already linked." }, 200);
      }
      // Re-activate
      await db
        .update(doctorPatients)
        .set({ active: true })
        .where(eq(doctorPatients.id, existing.id));
      return c.json({ success: true, message: "Patient re-linked." });
    }

    await db.insert(doctorPatients).values({
      doctorId: doctor.id,
      patientId,
    });

    return c.json({ success: true }, 201);
  }
);

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
// View a user's public profile. Patients see doctors; doctors see patients.

usersRouter.get("/:id", async (c) => {
  const { id } = c.req.param();

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw new HTTPException(404, { message: "User not found." });
  }

  let profile = null;
  if (user.role === "doctor") {
    const [dp] = await db
      .select({
        specialty: doctorProfiles.specialty,
        hospital: doctorProfiles.hospital,
        qualification: doctorProfiles.qualification,
        yearsOfExperience: doctorProfiles.yearsOfExperience,
        bio: doctorProfiles.bio,
        consultationFee: doctorProfiles.consultationFee,
        availableFrom: doctorProfiles.availableFrom,
        availableTo: doctorProfiles.availableTo,
      })
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, id))
      .limit(1);
    profile = dp ?? null;
  }

  return c.json({ ...user, profile });
});

export default usersRouter;
