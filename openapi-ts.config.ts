import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: "./packages/backend/src/pdf-ingestion-service-client",
});
