import { Logger } from "../../logger";

export interface IngestGameDataInput {
  boardgameName: string;
  yearPublished: number; // Should be a valid year (e.g., 1900-current year)
  bggId: number; // BoardGameGeek ID
  rulebookTitle: string;
  rulebookPdfFile: Blob | File; // PDF file as Blob or File
  rulebookType?: string; // Optional: 'base', 'expansion', 'quickstart', 'reference', 'faq', 'other'
  language?: string; // Optional: language code (e.g., 'en', 'es', 'fr'), defaults to 'en'
}

export interface IngestGameDataResult {
  gameId: string;
  rulebookId: string;
  chunksCreated: number;
}

/**
 * Abstract base class for ingestion services
 * Provides shared CSV reading functionality while allowing different implementations
 */
export abstract class IngestionService {
  protected readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Abstract method to be implemented by concrete classes
   * Ingests a single game and its rulebook
   */
  abstract ingestGameData(
    gameData: IngestGameDataInput,
  ): Promise<IngestGameDataResult>;

  /**
   * Shared method that reads games from CSV and ingests each one
   * CSV columns should match IngestGameDataInput fields
   */
  async ingestGameDataFromCSV(csvFile: File): Promise<{
    successCount: number;
    failureCount: number;
    results: Array<{
      boardgameName: string;
      success: boolean;
      result?: IngestGameDataResult;
      error?: string;
    }>;
  }> {
    this.logger.info("Starting CSV ingestion");

    const text = await csvFile.text();
    const lines = text.trim().split("\n");

    if (lines.length === 0) {
      this.logger.error("CSV file is empty");
      throw new Error("CSV file is empty");
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim());
    const totalRows = lines.length - 1; // Exclude header
    this.logger.info(`Found ${totalRows} games to ingest`);

    const results: Array<{
      boardgameName: string;
      success: boolean;
      result?: IngestGameDataResult;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};

      header.forEach((key, index) => {
        row[key] = values[index] || "";
      });

      // Skip empty rows
      if (!row.boardgameName && !row.bggId && !row.rulebookPdfFile) {
        this.logger.info(`Skipping empty row ${i}`);
        continue;
      }

      const gameName = row.boardgameName || row.name || `Row ${i}`;
      this.logger.info(
        `Processing [${i}/${totalRows}]: ${gameName} (BGG ID: ${row.bggId})`,
      );

      try {
        // Map CSV row to IngestGameDataInput
        // Construct path relative to backend directory (where server runs)
        const pdfPath = `data/rulebooks/${row.rulebookPdfFile}`;
        const gameData: IngestGameDataInput = {
          boardgameName: row.boardgameName || row.name,
          yearPublished: parseInt(row.yearPublished),
          bggId: parseInt(row.bggId),
          rulebookTitle: row.rulebookTitle,
          rulebookPdfFile: Bun.file(pdfPath),
          rulebookType: row.rulebookType,
          language: row.language,
        };

        const result = await this.ingestGameData(gameData);
        results.push({
          boardgameName: gameData.boardgameName,
          success: true,
          result,
        });
        successCount++;
        this.logger.info(
          `✓ Successfully ingested: ${gameName} (${result.chunksCreated} chunks)`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          boardgameName: gameName,
          success: false,
          error: errorMessage,
        });
        failureCount++;
        this.logger.error(`✗ Failed to ingest: ${gameName}`, {
          error: errorMessage,
        });
      }
    }

    this.logger.info(
      `CSV ingestion complete: ${successCount} succeeded, ${failureCount} failed`,
    );

    return { successCount, failureCount, results };
  }
}
