import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { supabase } from "../lib/supabase.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { User } from "../db/schema.js";

// Extend Hono context with typed user
export type AuthVariables = {
  supabaseUserId: string;
  user: User;
};

/**
 * requireAuth — validates Bearer token, loads DB user, attaches to context.
 * Use on any protected route.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
    }

    const token = authorization.slice(7);

    // Verify JWT with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }

    // Load our DB user record
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUser.id))
      .limit(1);

    if (!dbUser) {
      throw new HTTPException(403, {
        message: "Profile not set up. Please complete onboarding.",
      });
    }

    c.set("supabaseUserId", supabaseUser.id);
    c.set("user", dbUser);

    await next();
  }
);

/**
 * requireRole — must be used AFTER requireAuth.
 * Throws 403 if the user's role doesn't match.
 */
export const requireRole = (role: "doctor" | "patient") =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user");
    if (user.role !== role) {
      throw new HTTPException(403, {
        message: `Access denied. This endpoint requires the '${role}' role.`,
      });
    }
    await next();
  });
