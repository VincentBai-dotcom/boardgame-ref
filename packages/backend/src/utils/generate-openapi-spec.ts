export async function generateOpenAPISpec(
  host: string,
  port: number,
): Promise<void> {
  try {
    const response = await fetch(`http://${host}:${port}/openapi/json`);
    const spec = await response.json();
    const fixedSpec = preprocessOpenAPISpec(spec);
    const specJson = JSON.stringify(fixedSpec, null, 2);

    await Bun.write("./openapi.json", specJson);

    console.log("📄 OpenAPI spec written to backend and iOS project");
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

function preprocessOpenAPISpec(spec: JsonValue): JsonValue {
  const normalized = replaceDateType(spec);
  return rewriteSseResponses(normalized);
}

function replaceDateType(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(replaceDateType);
  }

  if (value && typeof value === "object") {
    const obj = value as JsonObject;

    if (obj.type === "Date") {
      const next: JsonObject = { ...obj, type: "string" };
      if (next.format == null) {
        next.format = "date-time";
      }
      return visitObject(next);
    }

    if (obj.type === "AsyncIterator") {
      const next: JsonObject = { ...obj, type: "string" };
      if (next.format == null) {
        next.format = "event-stream";
      }
      return visitObject(next);
    }

    if (Array.isArray(obj.type)) {
      const types = obj.type as JsonValue[];
      if (types.includes("Date") || types.includes("AsyncIterator")) {
        const nextTypes = types.map((t) =>
          t === "Date" || t === "AsyncIterator" ? "string" : t,
        );
        const next: JsonObject = { ...obj, type: nextTypes };
        if (next.format == null && types.includes("Date")) {
          next.format = "date-time";
        } else if (next.format == null && types.includes("AsyncIterator")) {
          next.format = "event-stream";
        }
        return visitObject(next);
      }
    }

    return visitObject(obj);
  }

  return value;
}

function visitObject(obj: JsonObject): JsonObject {
  const next: JsonObject = {};
  for (const [key, val] of Object.entries(obj)) {
    if (
      (key === "anyOf" || key === "oneOf" || key === "allOf") &&
      Array.isArray(val)
    ) {
      next[key] = dedupeSchemas(val as JsonValue[]);
      continue;
    }

    next[key] = replaceDateType(val as JsonValue);
  }
  return next;
}

function dedupeSchemas(schemas: JsonValue[]): JsonValue[] {
  const seen = new Set<string>();
  const result: JsonValue[] = [];

  for (const schema of schemas) {
    const normalized = replaceDateType(schema);
    const key = stableStringify(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as JsonObject;
  const keys = Object.keys(obj).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(obj[key] as JsonValue)}`,
  );
  return `{${entries.join(",")}}`;
}

function rewriteSseResponses(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(rewriteSseResponses);
  }

  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    const next: JsonObject = {};

    for (const [key, val] of Object.entries(obj)) {
      if (key === "responses" && val && typeof val === "object") {
        next[key] = rewriteResponses(val as JsonObject);
      } else {
        next[key] = rewriteSseResponses(val as JsonValue);
      }
    }

    return next;
  }

  return value;
}

function rewriteResponses(responses: JsonObject): JsonObject {
  const next: JsonObject = {};
  for (const [status, responseVal] of Object.entries(responses)) {
    const responseObj =
      responseVal && typeof responseVal === "object"
        ? (responseVal as JsonObject)
        : null;
    if (!responseObj || !responseObj.content) {
      next[status] = rewriteSseResponses(responseVal as JsonValue);
      continue;
    }

    const content = responseObj.content as JsonObject;
    if (hasVoidType(content)) {
      const newResponse: JsonObject = { ...responseObj };
      delete newResponse.content;
      next[status] = newResponse;
      continue;
    }
    const appJson = content["application/json"] as JsonObject | undefined;
    const schema = appJson?.schema as JsonValue | undefined;
    if (schema && hasEventStreamFormat(schema)) {
      const sseSchema = stripEventStreamFormat(schema);
      const newContent: JsonObject = { ...content };
      delete newContent["application/json"];
      newContent["text/event-stream"] = { schema: sseSchema };
      next[status] = { ...responseObj, content: newContent };
      continue;
    }

    next[status] = rewriteSseResponses(responseVal as JsonValue);
  }
  return next;
}

function hasEventStreamFormat(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(hasEventStreamFormat);
  }
  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    if (obj.format === "event-stream") {
      return true;
    }
    return Object.values(obj).some((v) => hasEventStreamFormat(v as JsonValue));
  }
  return false;
}

function stripEventStreamFormat(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(stripEventStreamFormat);
  }
  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    const next: JsonObject = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "format" && val === "event-stream") {
        continue;
      }
      next[key] = stripEventStreamFormat(val as JsonValue);
    }
    return next;
  }
  return value;
}

function hasVoidType(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(hasVoidType);
  }
  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    if (obj.type === "void") {
      return true;
    }
    return Object.values(obj).some((v) => hasVoidType(v as JsonValue));
  }
  return false;
}
