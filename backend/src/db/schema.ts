import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  date,
  integer,
  boolean,
  jsonb,
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["patient", "doctor"]);

export const prescriptionStatusEnum = pgEnum("prescription_status", [
  "active",
  "completed",
  "cancelled",
  "paused",
]);

export const scheduleStatusEnum = pgEnum("schedule_status", [
  "pending",
  "taken",
  "missed",
  "skipped",
]);

export const healthRecordTypeEnum = pgEnum("health_record_type", [
  "blood_pressure",
  "blood_sugar",
  "heart_rate",
  "weight",
  "temperature",
  "oxygen_saturation",
  "other",
]);

export const frequencyEnum = pgEnum("frequency", [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "every_6_hours",
  "every_8_hours",
  "every_12_hours",
  "weekly",
  "as_needed",
]);

export const otpStatusEnum = pgEnum("otp_status", ["pending", "verified", "expired"]);

// ─── Users (extends Supabase Auth) ────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Links to Supabase auth.users
  supabaseUserId: uuid("supabase_user_id").unique().notNull(),
  role: roleEnum("role").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  avatarUrl: text("avatar_url"),
  preferredLanguage: text("preferred_language").default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Doctor Profiles ──────────────────────────────────────────────────────────

export const doctorProfiles = pgTable("doctor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  licenseNumber: text("license_number").notNull(),
  specialty: text("specialty").notNull(),
  hospital: text("hospital"),
  qualification: text("qualification"),
  yearsOfExperience: integer("years_of_experience"),
  bio: text("bio"),
  consultationFee: integer("consultation_fee_paise"), // stored in paise (₹ * 100)
  availableFrom: time("available_from"),
  availableTo: time("available_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Patient Profiles ─────────────────────────────────────────────────────────

export const patientProfiles = pgTable("patient_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  assignedDoctorId: uuid("assigned_doctor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  bloodType: text("blood_type"),
  // JSON arrays for flexibility
  allergies: jsonb("allergies").$type<string[]>().default([]),
  chronicConditions: jsonb("chronic_conditions").$type<string[]>().default([]),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Doctor–Patient Relationships ─────────────────────────────────────────────

export const doctorPatients = pgTable("doctor_patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  patientId: uuid("patient_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  active: boolean("active").default(true),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
});

// ─── Prescriptions ────────────────────────────────────────────────────────────

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  doctorId: uuid("doctor_id")
    .references(() => users.id, { onDelete: "set null" }),
  medicineName: text("medicine_name").notNull(),
  genericName: text("generic_name"),
  dosage: text("dosage").notNull(), // e.g. "500mg", "10ml"
  frequency: frequencyEnum("frequency").notNull(),
  // Specific times of day (e.g. ["08:00","20:00"])
  scheduleTimes: jsonb("schedule_times").$type<string[]>().notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  withFood: boolean("with_food").default(false),
  instructions: text("instructions"), // e.g. "Take with warm water"
  purpose: text("purpose"),           // why prescribed
  refillsRemaining: integer("refills_remaining").default(0),
  status: prescriptionStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Medication Schedules (daily dose tracking) ───────────────────────────────

export const medicationSchedules = pgTable("medication_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  prescriptionId: uuid("prescription_id")
    .references(() => prescriptions.id, { onDelete: "cascade" })
    .notNull(),
  patientId: uuid("patient_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(), // exact datetime of dose
  takenAt: timestamp("taken_at"),                     // when patient marked it taken
  status: scheduleStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Health Records ───────────────────────────────────────────────────────────

export const healthRecords = pgTable("health_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  loggedBy: uuid("logged_by") // either patient or doctor
    .references(() => users.id, { onDelete: "set null" }),
  type: healthRecordTypeEnum("type").notNull(),
  // Flexible value storage (e.g. { systolic: 120, diastolic: 80 } or { value: 98.6 })
  value: jsonb("value").notNull(),
  unit: text("unit"),           // e.g. "mmHg", "mg/dL", "bpm", "°C"
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── OTP Verification ─────────────────────────────────────────────────────────

export const otpVerification = pgTable("otp_verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(),
  otp: text("otp").notNull(),
  status: otpStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  doctorProfile: one(doctorProfiles, {
    fields: [users.id],
    references: [doctorProfiles.userId],
  }),
  patientProfile: one(patientProfiles, {
    fields: [users.id],
    references: [patientProfiles.userId],
  }),
  prescriptionsAsPatient: many(prescriptions, { relationName: "patient" }),
  prescriptionsAsDoctor: many(prescriptions, { relationName: "doctor" }),
  healthRecords: many(healthRecords),
  medicationSchedules: many(medicationSchedules),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patient: one(users, {
    fields: [prescriptions.patientId],
    references: [users.id],
    relationName: "patient",
  }),
  doctor: one(users, {
    fields: [prescriptions.doctorId],
    references: [users.id],
    relationName: "doctor",
  }),
  schedules: many(medicationSchedules),
}));

export const medicationSchedulesRelations = relations(medicationSchedules, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [medicationSchedules.prescriptionId],
    references: [prescriptions.id],
  }),
  patient: one(users, {
    fields: [medicationSchedules.patientId],
    references: [users.id],
  }),
}));

export const healthRecordsRelations = relations(healthRecords, ({ one }) => ({
  patient: one(users, {
    fields: [healthRecords.patientId],
    references: [users.id],
    relationName: "healthRecord_patient",
  }),
  loggedBy: one(users, {
    fields: [healthRecords.loggedBy],
    references: [users.id],
    relationName: "healthRecord_loggedBy",
  }),
}));

// ─── Types (inferred from schema) ─────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DoctorProfile = typeof doctorProfiles.$inferSelect;
export type PatientProfile = typeof patientProfiles.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;
export type MedicationSchedule = typeof medicationSchedules.$inferSelect;
export type HealthRecord = typeof healthRecords.$inferSelect;
export type NewHealthRecord = typeof healthRecords.$inferInsert;
