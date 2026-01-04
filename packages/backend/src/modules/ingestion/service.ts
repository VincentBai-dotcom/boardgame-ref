import { GameService } from "../game/service";
import { processPdfDocument } from "../../pdf-ingestion-service-client";

/**
 * Input data for ingesting a game and its rulebook
 */
export interface IngestGameDataInput {
  boardgameName: string;
  yearPublished: number; // Should be a valid year (e.g., 1900-current year)
  bggId: number; // BoardGameGeek ID
  rulebookTitle: string;
  rulebookPdfFile: Blob | File; // PDF file as Blob or File
  rulebookType?: string; // Optional: 'base', 'expansion', 'quickstart', 'reference', 'faq', 'other'
  language?: string; // Optional: language code (e.g., 'en', 'es', 'fr'), defaults to 'en'
}

export class IngestionService {
  constructor(private gameService: GameService) {}

  async ingestGameData(gameData: IngestGameDataInput): Promise<{
    gameId: string;
    rulebookId: string;
    chunksCreated: number;
  }> {
    // Check if game already exists
    const existingGame = await this.gameService.findGameByBggId(gameData.bggId);
    if (existingGame) {
      throw new Error(
        `Game already exists with BGG ID: ${gameData.bggId} (ID: ${existingGame.id})`,
      );
    }

    // Call PDF ingestion service via SDK
    console.log("Calling PDF ingestion service...");
    const response = await processPdfDocument({
      body: {
        file: gameData.rulebookPdfFile,
      },
    });

    const ruleChunks = response.data.chunks;

    console.log(
      `Received ${ruleChunks.length} chunks from PDF ingestion service.`,
    );
    console.log(ruleChunks.slice(0, 2)); // Log first 2 chunks for inspection

    console.log("Creating game record...");
    const game = await this.gameService.createGame({
      name: gameData.boardgameName,
      yearPublished: gameData.yearPublished,
      bggId: gameData.bggId,
    });

    // Create rulebook record
    console.log("Creating rulebook record...");
    const rulebook = await this.gameService.createRulebook({
      gameId: game.id,
      title: gameData.rulebookTitle,
      rulebookType: gameData.rulebookType || "base",
      language: gameData.language || "en",
      fullText: response.data.full_text,
    });

    // Create rule chunks with embeddings
    console.log(`Creating ${ruleChunks.length} rule chunks...`);
    const createdChunks = await this.gameService.createRuleChunks(
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
