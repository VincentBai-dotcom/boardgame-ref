import { GameRepository } from "./game";
import { RulebookRepository } from "./rulebook";
import { RuleChunkRepository } from "./rule-chunk";
import { dbService } from "../db";

// Create singleton instances
export const gameRepository = new GameRepository(dbService);
export const rulebookRepository = new RulebookRepository(dbService);
export const ruleChunkRepository = new RuleChunkRepository(dbService);

// Export types
export type { Game, NewGame, ListGamesOptions } from "./game";

export type { Rulebook, NewRulebook, ListRulebooksOptions } from "./rulebook";

export type {
  RuleChunk,
  NewRuleChunk,
  ListRuleChunksOptions,
} from "./rule-chunk";
