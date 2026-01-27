import { Logger } from "../../logger";
import type { DbService } from "../../db/service";
import { GameRepository } from "../../repositories/game";
import { RulebookRepository } from "../../repositories/rulebook";
import { RuleChunkRepository } from "../../repositories/rule-chunk";
import { DoclingIngestionService } from "./impl/docling";
import { IngestionService } from "./base";
import { ConfigService } from "../../config";
import { IngestionError } from "../errors";

export type { IngestGameDataInput, IngestGameDataResult } from "./base";
export { IngestionService } from "./base";

export function createIngestionService(
  configService: ConfigService,
  dbService: DbService,
  gameRepository: GameRepository,
  rulebookRepository: RulebookRepository,
  ruleChunkRepository: RuleChunkRepository,
  logger: Logger,
): IngestionService {
  const provider = configService.get().ingestion.provider.toLocaleLowerCase();
  switch (provider) {
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
      throw IngestionError.failed(
        `Unknown ingestion provider "${provider}". Allowed: ${allowed.join(", ")}`,
      );
    }
  }
}
