import { processPdfDocument } from "../../../../pdf-ingestion-service-client";
import {
  IngestGameDataInput,
  IngestGameDataResult,
  IngestionService,
} from "../base";
import { Logger } from "../../../logger";
import type { DbService } from "../../../db/service";
import { GameRepository } from "../../../repositories/game";
import { RulebookRepository } from "../../../repositories/rulebook";
import { RuleChunkRepository } from "../../../repositories/rule-chunk";

export class DoclingIngestionService extends IngestionService {
  constructor(
    private readonly dbService: DbService,
    private readonly gameRepository: GameRepository,
    private readonly rulebookRepository: RulebookRepository,
    private readonly ruleChunkRepository: RuleChunkRepository,
    protected readonly logger: Logger,
  ) {
    super(logger);
  }

  async ingestGameData(
    gameData: IngestGameDataInput,
  ): Promise<IngestGameDataResult> {
    try {
      // Call PDF ingestion service via SDK (outside transaction)
      this.logger.info("Processing PDF document...");
      const response = await processPdfDocument({
        body: {
          file: gameData.rulebookPdfFile,
        },
      });

      const ruleChunks = response.data.chunks;

      // ATOMIC TRANSACTION: All database operations happen atomically
      // If any operation fails, everything rolls back automatically
      const result = await this.dbService.getDb().transaction(async (tx) => {
        // UPSERT GAME
        this.logger.info(`Upserting game with BGG ID: ${gameData.bggId}`);
        const gameRecord = await this.gameRepository.upsertByBggId(
          gameData.bggId,
          {
            name: gameData.boardgameName,
            yearPublished: gameData.yearPublished,
          },
          tx,
        );

        // UPSERT RULEBOOK
        this.logger.info("Upserting rulebook...");
        const rulebookType = gameData.rulebookType || "base";
        const language = gameData.language || "en";

        // Check if rulebook exists to determine if we need to delete old chunks
        const existingRulebooks = await this.rulebookRepository.findByGameId(
          gameRecord.id,
          tx,
        );
        const existingRulebook = existingRulebooks.find(
          (rb) => rb.rulebookType === rulebookType && rb.language === language,
        );

        const rulebookRecord =
          await this.rulebookRepository.upsertByGameIdAndType(
            gameRecord.id,
            rulebookType,
            language,
            {
              title: gameData.rulebookTitle,
              fullText: response.data.full_text,
            },
            tx,
          );

        // Delete old chunks if updating existing rulebook
        if (existingRulebook) {
          this.logger.info(
            `Deleting old chunks for rulebook ${rulebookRecord.id}`,
          );
          await this.ruleChunkRepository.deleteByRulebookId(
            rulebookRecord.id,
            tx,
          );
        }

        // CREATE RULE CHUNKS
        this.logger.info(`Creating ${ruleChunks.length} rule chunks...`);
        const createdChunks = await this.ruleChunkRepository.createMany(
          ruleChunks.map((chunk) => ({
            rulebookId: rulebookRecord.id,
            gameId: gameRecord.id,
            chunkText: chunk.text,
            embedding: chunk.embedding,
            chunkIndex: chunk.index,
          })),
          tx,
        );

        // Return result from transaction
        return {
          gameId: gameRecord.id,
          rulebookId: rulebookRecord.id,
          chunksCreated: createdChunks.length,
        };
      });

      this.logger.info("Ingestion complete!");
      return result;
    } catch (error) {
      this.logger.error("Ingestion failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
