export async function generateOpenAPISpec(
  host: string,
  port: number,
): Promise<void> {
  try {
    const response = await fetch(`http://${host}:${port}/openapi/json`);
    const spec = await response.json();
    const specJson = JSON.stringify(spec, null, 2);

    await Promise.all([
      Bun.write("./openapi.json", specJson),
      Bun.write("../ios/BoardGameRef/openapi.json", specJson),
    ]);

    console.log("📄 OpenAPI spec written to backend and iOS project");
  } catch (error) {
    console.error("Failed to generate OpenAPI spec:", error);
  }
}
