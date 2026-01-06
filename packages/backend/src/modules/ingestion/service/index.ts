import { Logger } from "../../logger";
import type { DbService } from "../../db/service";
import { GameRepository } from "../../repositories/game";
import { RulebookRepository } from "../../repositories/rulebook";
import { RuleChunkRepository } from "../../repositories/rule-chunk";
import { DoclingIngestionService } from "./impl/docling";
import { IngestionService } from "./base";

export type { IngestGameDataInput, IngestGameDataResult } from "./base";
export { IngestionService } from "./base";

export function createIngestionService(
  provider: string,
  dbService: DbService,
  gameRepository: GameRepository,
  rulebookRepository: RulebookRepository,
  ruleChunkRepository: RuleChunkRepository,
  logger: Logger,
): IngestionService {
  const normalized = provider.toLowerCase();
  switch (normalized) {
    case "docling":
      return new DoclingIngestionService(
        dbService,
        gameRepository,
        rulebookRepository,
        ruleChunkRepository,
        logger,
      );
    default: {
      const allowed = ["docling"];
      throw new Error(
        `Unknown ingestion provider "${provider}". Allowed: ${allowed.join(", ")}`,
      );
    }
  }
}
