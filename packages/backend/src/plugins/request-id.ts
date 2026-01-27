import { Elysia } from "elysia";

export const requestId = new Elysia({ name: "request-id" }).onRequest(
  ({ request, set }) => {
    const incoming = request.headers.get("x-request-id");
    const requestId = incoming?.trim() || crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
  },
);
