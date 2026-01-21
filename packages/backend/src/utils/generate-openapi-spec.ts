export async function generateOpenAPISpec(
  host: string,
  port: number,
): Promise<void> {
  try {
    const response = await fetch(`http://${host}:${port}/openapi/json`);
    const spec = await response.json();
    await Bun.write("./openapi.json", JSON.stringify(spec, null, 2));
    console.log("📄 OpenAPI spec written to openapi.json");
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
  }
}
