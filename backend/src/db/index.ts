import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the backend.");
}

const queryClient = postgres(databaseUrl, {
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export default db;
