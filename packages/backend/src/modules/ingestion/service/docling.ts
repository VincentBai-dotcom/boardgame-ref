import type {
  GameRepository,
  RulebookRepository,
  RuleChunkRepository,
} from "../../repositories";
import { processPdfDocument } from "../../../pdf-ingestion-service-client";
import { IngestGameDataInput, IngestionService } from ".";

export class DoclingIngestionService implements IngestionService {
  constructor(
    private gameRepository: GameRepository,
    private rulebookRepository: RulebookRepository,
    private ruleChunkRepository: RuleChunkRepository,
  ) {}

  async ingestGameData(gameData: IngestGameDataInput): Promise<{
    gameId: string;
    rulebookId: string;
    chunksCreated: number;
  }> {
    // Check if game already exists
    const existingGame = await this.gameRepository.findByBggId(gameData.bggId);
    if (existingGame) {
      throw new Error(
        `Game already exists with BGG ID: ${gameData.bggId} (ID: ${existingGame.id})`,
      );
    }

    // Call PDF ingestion service via SDK
    const response = await processPdfDocument({
      body: {
        file: gameData.rulebookPdfFile,
      },
    });

    const ruleChunks = response.data.chunks;

    const game = await this.gameRepository.create({
      name: gameData.boardgameName,
      yearPublished: gameData.yearPublished,
      bggId: gameData.bggId,
    });

    // Create rulebook record
    console.log("Creating rulebook record...");
    const rulebook = await this.rulebookRepository.create({
      gameId: game.id,
      title: gameData.rulebookTitle,
      rulebookType: gameData.rulebookType || "base",
      language: gameData.language || "en",
      fullText: response.data.full_text,
    });

    // Create rule chunks with embeddings
    console.log(`Creating ${ruleChunks.length} rule chunks...`);
    const createdChunks = await this.ruleChunkRepository.createMany(
      ruleChunks.map((chunk) => ({
        rulebookId: rulebook.id,
        gameId: game.id,
        chunkText: chunk.text,
        embedding: chunk.embedding,
        chunkIndex: chunk.index,
      })),
    );

    console.log("Ingestion complete!");
    return {
      gameId: game.id,
      rulebookId: rulebook.id,
      chunksCreated: createdChunks.length,
    };
  }
}
