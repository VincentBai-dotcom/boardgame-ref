import { GameService } from "../../modules/game/service";

/**
 * Input data for ingesting a game and its rulebook
 */
export interface IngestGameDataInput {
  boardgameName: string;
  yearPublished: number; // Should be a valid year (e.g., 1900-current year)
  bggId: number; // BoardGameGeek ID
  rulebookTitle: string;
  rulebookPdfFile: Buffer; // PDF file content as a buffer
  rulebookType?: string; // Optional: 'base', 'expansion', 'quickstart', 'reference', 'faq', 'other'
  language?: string; // Optional: language code (e.g., 'en', 'es', 'fr'), defaults to 'en'
}

export class IngestionService {
  constructor(private gameService: GameService) {}

  async ingestGameData(gameData: IngestGameDataInput) {
    if (await this.gameService.findGameByBggId(gameData.bggId)) {
      throw new Error(`Game already exists with BGG ID: ${gameData.bggId}`);
    }
  }
}
