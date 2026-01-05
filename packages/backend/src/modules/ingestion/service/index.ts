export interface IngestGameDataInput {
  boardgameName: string;
  yearPublished: number; // Should be a valid year (e.g., 1900-current year)
  bggId: number; // BoardGameGeek ID
  rulebookTitle: string;
  rulebookPdfFile: Blob | File; // PDF file as Blob or File
  rulebookType?: string; // Optional: 'base', 'expansion', 'quickstart', 'reference', 'faq', 'other'
  language?: string; // Optional: language code (e.g., 'en', 'es', 'fr'), defaults to 'en'
}

export interface IngestionService {
  ingestGameData(gameData: IngestGameDataInput): Promise<{
    gameId: string;
    rulebookId: string;
    chunksCreated: number;
  }>;
}

import type {
  GameRepository,
  RulebookRepository,
  RuleChunkRepository,
} from "../../repositories";
import { DoclingIngestionService } from "./docling";

export function createIngestionService(
  provider: string,
  gameRepository: GameRepository,
  rulebookRepository: RulebookRepository,
  ruleChunkRepository: RuleChunkRepository,
): IngestionService {
  const normalized = provider.toLowerCase();
  switch (normalized) {
    case "docling":
      return new DoclingIngestionService(
        gameRepository,
        rulebookRepository,
        ruleChunkRepository,
      );
    default: {
      const allowed = ["docling"];
      throw new Error(
        `Unknown ingestion provider "${provider}". Allowed: ${allowed.join(", ")}`,
      );
    }
  }
}
