import Elysia from "elysia";
import { ingestion } from "./ingestion";
import { localGuard } from "../modules/guard";

export const localModules = new Elysia({
  name: "local-modules",
  prefix: "/local",
})
  .use(localGuard)
  .use(ingestion);
