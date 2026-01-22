export async function generateOpenAPISpec(
  host: string,
  port: number,
): Promise<void> {
  try {
    const response = await fetch(`http://${host}:${port}/openapi/json`);
    const spec = await response.json();
    const fixedSpec = preprocessOpenAPISpec(spec);
    const specJson = JSON.stringify(fixedSpec, null, 2);

    await Promise.all([
      Bun.write("./openapi.json", specJson),
      Bun.write("../ios/BoardGameRef/openapi.json", specJson),
    ]);

    console.log("📄 OpenAPI spec written to backend and iOS project");
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

function preprocessOpenAPISpec(spec: JsonValue): JsonValue {
  return replaceDateType(spec);
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

    if (Array.isArray(obj.type)) {
      const types = obj.type as JsonValue[];
      if (types.includes("Date")) {
        const nextTypes = types.map((t) => (t === "Date" ? "string" : t));
        const next: JsonObject = { ...obj, type: nextTypes };
        if (next.format == null && nextTypes.includes("string")) {
          next.format = "date-time";
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
