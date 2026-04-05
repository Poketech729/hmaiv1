/**
 * OTP Utilities - Generate, verify, and manage One-Time Passwords
 */

import { db } from "../db/index.js";
import { otpVerification } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

// ─── OTP Generation ───────────────────────────────────────────────────────────

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits.charAt(Math.floor(Math.random() * 10));
  }
  return otp;
}

/**
 * Calculate OTP expiration time (default: 10 minutes)
 */
export function getOTPExpirationTime(minutesFromNow: number = 10): Date {
  const now = new Date();
  return new Date(now.getTime() + minutesFromNow * 60000);
}

// ─── OTP Storage ──────────────────────────────────────────────────────────────

/**
 * Store OTP in database
 * @param phone - Phone number in international format (e.g., +91XXXXXXXXXX)
 * @param otp - The OTP code to store
 */
export async function storeOTP(phone: string, otp: string): Promise<void> {
  // Invalidate previous OTPs for this phone
  await db
    .update(otpVerification)
    .set({ status: "expired" })
    .where(
      and(
        eq(otpVerification.phone, phone),
        eq(otpVerification.status, "pending")
      )
    );

  // Store new OTP
  await db.insert(otpVerification).values({
    phone,
    otp,
    status: "pending",
    attempts: 0,
    expiresAt: getOTPExpirationTime(10),
  });
}

/**
 * Store email OTP (similar to phone OTP)
 * @param email - Email address
 * @param otp - The OTP code to store
 */
export async function storeEmailOTP(email: string, otp: string): Promise<void> {
  // For email, we can use the same table but with email in the "phone" field
  // Or create a separate table. For simplicity, we'll use the same table with "email:" prefix
  const emailKey = `email:${email}`;

  await db
    .update(otpVerification)
    .set({ status: "expired" })
    .where(
      and(
        eq(otpVerification.phone, emailKey),
        eq(otpVerification.status, "pending")
      )
    );

  await db.insert(otpVerification).values({
    phone: emailKey,
    otp,
    status: "pending",
    attempts: 0,
    expiresAt: getOTPExpirationTime(10),
  });
}

// ─── OTP Verification ─────────────────────────────────────────────────────────

/**
 * Verify OTP against stored value
 * @param phone - Phone number
 * @param otp - OTP code to verify
 * @returns true if valid, throws error if invalid/expired
 */
export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  const [record] = await db
    .select()
    .from(otpVerification)
    .where(
      and(
        eq(otpVerification.phone, phone),
        eq(otpVerification.status, "pending")
      )
    )
    .limit(1);

  if (!record) {
    throw new Error("OTP not found or already used");
  }

  // Check expiration
  if (new Date() > record.expiresAt) {
    await db.update(otpVerification).set({ status: "expired" }).where(eq(otpVerification.id, record.id));
    throw new Error("OTP has expired");
  }

  // Check attempts
  if (record.attempts >= 3) {
    await db.update(otpVerification).set({ status: "expired" }).where(eq(otpVerification.id, record.id));
    throw new Error("Too many attempts. OTP expired");
  }

  // Verify OTP
  if (record.otp !== otp) {
    // Increment attempts
    await db
      .update(otpVerification)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpVerification.id, record.id));
    throw new Error("Invalid OTP");
  }

  // Mark as verified
  await db
    .update(otpVerification)
    .set({
      status: "verified",
      verifiedAt: new Date(),
    })
    .where(eq(otpVerification.id, record.id));

  return true;
}

/**
 * Verify email OTP
 */
export async function verifyEmailOTP(email: string, otp: string): Promise<boolean> {
  const emailKey = `email:${email}`;
  return verifyOTP(emailKey, otp);
}
