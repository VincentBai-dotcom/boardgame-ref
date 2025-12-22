import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/modules/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_LOCAL ||
      "postgres://postgres:postgres@localhost:5432/boardgame_ref",
  },
});
