import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello Elysia")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
