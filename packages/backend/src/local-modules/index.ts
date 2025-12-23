import Elysia from "elysia";
import { ingestion } from "./ingestion";

const isLocal = process.env.NODE_ENV !== "production";

const createLocalModules = () => {
  const app = new Elysia({ name: "local-modules", prefix: "/local" });

  if (!isLocal) {
    return app; // Return empty plugin in production
  }

  // Add your local-only routes here
  return app.use(ingestion);
};

export const localModules = createLocalModules();
