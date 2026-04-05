/**
 * Auth Routes - Handle authentication with multiple methods:
 * 1. Email OTP
 * 2. Phone OTP
 * 3. Google OAuth
 * 4. Sign up / Sign in flows
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { doctorProfiles, patientProfiles, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { supabase, supabaseAdmin } from "../lib/supabase.js";
import { generateOTP, storeOTP, verifyOTP, storeEmailOTP, verifyEmailOTP } from "../lib/otpUtils.js";
import { sendOTP } from "../lib/messageService.js";
import { sendOTPEmail } from "../lib/emailService.js";
import { HTTPException } from "hono/http-exception";

const router = new Hono();

const emailProvider = process.env.EMAIL_PROVIDER || "mock";
const messageProvider = process.env.MESSAGE_PROVIDER || "mock";

function providerStatus() {
  return {
    google: true,
    password: true,
    emailOtp: true,
    phoneOtp: true,
    emailProvider,
    messageProvider,
    emailMockMode: emailProvider === "mock",
    phoneMockMode: messageProvider === "mock",
  };
}

async function generateMagicLink(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data?.properties?.action_link) {
    throw new HTTPException(500, {
      message: error?.message || "Could not generate a sign-in link.",
    });
  }

  return data.properties.action_link;
}

router.get("/providers/status", (c) => {
  return c.json(providerStatus());
});

async function getSupabaseUserFromRequest(c: any) {
  const authorization = c.req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  const token = authorization.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  return user;
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const sendPhoneOTPSchema = z.object({
  phone: z.string().regex(/^\+\d{1,3}\d{6,14}$/, "Invalid phone format (use +91XXXXXXXXXX)"),
});

const sendEmailOTPSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const verifyOTPSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
  contact: z.string(), // phone or email
  type: z.enum(["phone", "email"]),
});

const signUpSchema = z.object({
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  email: z.string().email(),
  phone: z.string().regex(/^\+\d{1,3}\d{6,14}$/),
  role: z.enum(["patient", "doctor"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifyOTPSignUpSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string(),
  role: z.enum(["patient", "doctor"]),
  otp: z.string().length(6),
  otpType: z.enum(["phone", "email"]),
});

// ─── Phone OTP Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/otp/phone/send
 * Send OTP to phone number
 */
router.post(
  "/complete-profile",
  zValidator(
    "json",
    z.object({
      role: z.enum(["patient", "doctor"]),
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
  ),
  async (c) => {
    const supabaseUser = await getSupabaseUserFromRequest(c);
    const body = c.req.valid("json");

    const email = body.email || supabaseUser.email;
    if (!email) {
      throw new HTTPException(400, { message: "Email is required to complete profile." });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUser.id))
      .limit(1);

    if (existingUser) {
      return c.json({ success: true, user: existingUser, alreadyExists: true });
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        supabaseUserId: supabaseUser.id,
        firstName: body.firstName,
        lastName: body.lastName || "",
        email,
        phone: body.phone,
        role: body.role,
      })
      .returning();

    if (body.role === "doctor") {
      await db.insert(doctorProfiles).values({
        userId: createdUser.id,
        licenseNumber: "PENDING",
        specialty: "General",
      });
    } else {
      await db.insert(patientProfiles).values({
        userId: createdUser.id,
      });
    }

    return c.json({ success: true, user: createdUser });
  }
);

router.post(
  "/otp/phone/send",
  zValidator("json", sendPhoneOTPSchema),
  async (c) => {
    const { phone } = c.req.valid("json");

    try {
      // Generate and store OTP
      const otp = generateOTP();
      await storeOTP(phone, otp);

      // Send OTP via SMS
      await sendOTP(phone, otp);

      return c.json({
        status: "success",
        message: "OTP sent to phone number",
        expiresIn: 600, // seconds (10 minutes)
        provider: messageProvider,
        devOtp: messageProvider === "mock" ? otp : undefined,
      });
    } catch (error) {
      console.error("Failed to send phone OTP:", error);
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
      });
    }
  }
);

/**
 * POST /api/auth/otp/phone/verify
 * Verify OTP sent to phone
 */
router.post(
  "/otp/phone/verify",
  zValidator("json", z.object({ phone: z.string(), otp: z.string() })),
  async (c) => {
    const { phone, otp } = c.req.valid("json");

    try {
      await verifyOTP(phone, otp);
      return c.json({
        status: "success",
        message: "Phone verified successfully",
      });
    } catch (error: any) {
      throw new HTTPException(400, {
        message: error.message || "Invalid or expired OTP",
      });
    }
  }
);

// ─── Email OTP Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/otp/email/send
 * Send OTP to email address
 */
router.post(
  "/otp/email/send",
  zValidator("json", sendEmailOTPSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    try {
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      const otp = generateOTP();
      await storeEmailOTP(email, otp);
      await sendOTPEmail(email, otp);

      return c.json({
        status: "success",
        message: "OTP sent to email address",
        expiresIn: 600,
        isNewUser: !existingUser,
        provider: emailProvider,
        devOtp: emailProvider === "mock" ? otp : undefined,
      });
    } catch (error) {
      console.error("Failed to send email OTP:", error);
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
      });
    }
  }
);

/**
 * POST /api/auth/otp/email/verify
 * Verify OTP sent to email
 */
router.post(
  "/otp/email/verify",
  zValidator("json", z.object({ email: z.string().email(), otp: z.string() })),
  async (c) => {
    const { email, otp } = c.req.valid("json");

    try {
      await verifyEmailOTP(email, otp);
      return c.json({
        status: "success",
        message: "Email verified successfully",
      });
    } catch (error: any) {
      throw new HTTPException(400, {
        message: error.message || "Invalid or expired OTP",
      });
    }
  }
);

router.post(
  "/signin/email-otp/send",
  zValidator("json", sendEmailOTPSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      throw new HTTPException(404, { message: "No account was found for that email." });
    }

    const otp = generateOTP();
    await storeEmailOTP(email, otp);
    await sendOTPEmail(email, otp);

    return c.json({
      status: "success",
      message: "A sign-in code was sent to your email.",
      provider: emailProvider,
      devOtp: emailProvider === "mock" ? otp : undefined,
    });
  }
);

router.post(
  "/signin/email-otp/verify",
  zValidator("json", z.object({ email: z.string().email(), otp: z.string().length(6) })),
  async (c) => {
    const { email, otp } = c.req.valid("json");
    await verifyEmailOTP(email, otp);

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      throw new HTTPException(404, { message: "No account was found for that email." });
    }

    const actionLink = await generateMagicLink(email);
    return c.json({
      status: "success",
      actionLink,
      message: "Email OTP verified. Completing sign-in now.",
    });
  }
);

router.post(
  "/signin/phone-otp/send",
  zValidator("json", sendPhoneOTPSchema),
  async (c) => {
    const { phone } = c.req.valid("json");

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!existingUser) {
      throw new HTTPException(404, { message: "No account was found for that phone number." });
    }

    const otp = generateOTP();
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    return c.json({
      status: "success",
      message: "A sign-in code was sent to your phone.",
      provider: messageProvider,
      devOtp: messageProvider === "mock" ? otp : undefined,
    });
  }
);

router.post(
  "/signin/phone-otp/verify",
  zValidator("json", z.object({ phone: z.string(), otp: z.string().length(6) })),
  async (c) => {
    const { phone, otp } = c.req.valid("json");
    await verifyOTP(phone, otp);

    const [existingUser] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!existingUser?.email) {
      throw new HTTPException(404, { message: "No account was found for that phone number." });
    }

    const actionLink = await generateMagicLink(existingUser.email);
    return c.json({
      status: "success",
      actionLink,
      message: "Phone OTP verified. Completing sign-in now.",
    });
  }
);

// ─── Sign Up Routes ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup/email-otp
 * Sign up with email OTP verification
 */
router.post(
  "/signup/email-otp",
  zValidator("json", verifyOTPSignUpSchema),
  async (c) => {
    const { firstName, lastName, email, phone, role, otp, otpType } = c.req.valid("json");

    try {
      // Verify OTP first
      if (otpType === "email") {
        await verifyEmailOTP(email, otp);
      } else {
        await verifyOTP(phone, otp);
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        throw new HTTPException(409, { message: "Email already registered" });
      }

      // Create auth user in Supabase
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: generateOTP(8) + "TempPass123!", // Temporary password
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          role,
        },
      });

      if (authError || !authData.user) {
        throw new HTTPException(400, {
          message: authError?.message || "Failed to create account",
        });
      }

      // Create user profile in database
      await db.insert(users).values({
        supabaseUserId: authData.user.id,
        firstName,
        lastName,
        email,
        phone,
        role: role as "patient" | "doctor",
      });

      // Generate session (user needs to set password)
      const { data: sessionData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
      });

      return c.json({
        status: "success",
        message: "Account created successfully",
        userId: authData.user.id,
        nextStep: "set-password",
        resetLink: sessionData?.properties?.action_link,
      });
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(400, {
        message: error.message || "Sign up failed",
      });
    }
  }
);

/**
 * POST /api/auth/signup/phone-otp
 * Sign up with phone OTP verification
 */
router.post(
  "/signup/phone-otp",
  zValidator("json", z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    phone: z.string(),
    role: z.enum(["patient", "doctor"]),
    otp: z.string().length(6),
  })),
  async (c) => {
    const { firstName, lastName, email, phone, role, otp } = c.req.valid("json");

    try {
      // Verify phone OTP
      await verifyOTP(phone, otp);

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        throw new HTTPException(409, { message: "Email already registered" });
      }

      // Create auth user in Supabase
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          role,
        },
      });

      if (authError || !authData.user) {
        throw new HTTPException(400, {
          message: authError?.message || "Failed to create account",
        });
      }

      // Create user profile
      await db.insert(users).values({
        supabaseUserId: authData.user.id,
        firstName,
        lastName,
        email,
        phone,
        role: role as "patient" | "doctor",
      });

      return c.json({
        status: "success",
        message: "Account created successfully",
        userId: authData.user.id,
        nextStep: "set-password",
      });
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(400, {
        message: error.message || "Sign up failed",
      });
    }
  }
);

// ─── Sign In Route ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post(
  "/signin",
  zValidator("json", signInSchema),
  async (c) => {
    const { email, password } = c.req.valid("json");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new HTTPException(401, {
          message: "Invalid email or password",
        });
      }

      // Verify user profile exists
      const [userProfile] = await db
        .select()
        .from(users)
        .where(eq(users.supabaseUserId, data.user.id))
        .limit(1);

      if (!userProfile) {
        throw new HTTPException(403, {
          message: "User profile not found. Please complete registration.",
        });
      }

      return c.json({
        status: "success",
        message: "Signed in successfully",
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          role: userProfile.role,
        },
      });
    } catch (error: any) {
      console.error("Sign in error:", error);
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(401, {
        message: "Sign in failed",
      });
    }
  }
);

// ─── Google OAuth Setup ───────────────────────────────────────────────────────

/**
 * POST /api/auth/signin/google
 * Exchange Google token for session
 */
router.post(
  "/signin/google",
  zValidator("json", z.object({ idToken: z.string() })),
  async (c) => {
    const { idToken } = c.req.valid("json");

    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error || !data.user) {
        throw new HTTPException(401, {
          message: "Google authentication failed",
        });
      }

      // Check if user profile exists
      let userProfile = await db
        .select()
        .from(users)
        .where(eq(users.supabaseUserId, data.user.id))
        .limit(1)
        .then(r => r[0]);

      // If user doesn't exist, create basic profile (requires role to be set by user)
      if (!userProfile) {
        // Return flag indicating user needs to complete profile
        return c.json({
          status: "success",
          message: "Google sign in successful",
          token: data.session?.access_token,
          isNewUser: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name,
          },
          nextStep: "complete-profile",
        });
      }

      return c.json({
        status: "success",
        message: "Signed in successfully",
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token,
        expiresIn: data.session?.expires_in,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          role: userProfile.role,
        },
      });
    } catch (error: any) {
      console.error("Google sign in error:", error);
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(401, {
        message: "Google sign in failed",
      });
    }
  }
);

/**
 * POST /api/auth/google/callback
 * Complete profile after Google sign in (for new users)
 */
router.post(
  "/google/callback",
  zValidator("json", z.object({
    userId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    role: z.enum(["patient", "doctor"]),
  })),
  async (c) => {
    const { userId, firstName, lastName, phone, role } = c.req.valid("json");

    try {
      // Get user from Supabase
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);

      if (!user) {
        throw new HTTPException(404, { message: "User not found" });
      }

      // Create user profile
      await db.insert(users).values({
        supabaseUserId: userId,
        firstName,
        lastName,
        email: user.email!,
        phone,
        role: role as "patient" | "doctor",
      });

      return c.json({
        status: "success",
        message: "Profile completed successfully",
      });
    } catch (error: any) {
      console.error("Profile completion error:", error);
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(400, {
        message: error.message || "Failed to complete profile",
      });
    }
  }
);

// ─── Helper Routes ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Refresh authentication token
 */
router.post(
  "/refresh",
  zValidator("json", z.object({ refreshToken: z.string() })),
  async (c) => {
    const { refreshToken } = c.req.valid("json");

    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

      if (error || !data.session) {
        throw new HTTPException(401, { message: "Failed to refresh token" });
      }

      return c.json({
        status: "success",
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
      });
    } catch (error: any) {
      if (error instanceof HTTPException) throw error;
      throw new HTTPException(401, { message: "Token refresh failed" });
    }
  }
);

export default router;
