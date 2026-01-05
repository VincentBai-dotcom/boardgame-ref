import { GameRepository } from "./game";
import { RulebookRepository } from "./rulebook";
import { RuleChunkRepository } from "./rule-chunk";
import { ConversationRepository } from "./conversation";
import { UserRepository } from "./user";
import { dbService } from "../db";

// Create singleton instances
export const gameRepository = new GameRepository(dbService);
export const rulebookRepository = new RulebookRepository(dbService);
export const ruleChunkRepository = new RuleChunkRepository(dbService);
export const conversationRepository = new ConversationRepository(dbService);
export const userRepository = new UserRepository(dbService);

// Export types
export type { Game, NewGame, ListGamesOptions } from "./game";

export type { Rulebook, NewRulebook, ListRulebooksOptions } from "./rulebook";

export type {
  RuleChunk,
  NewRuleChunk,
  ListRuleChunksOptions,
} from "./rule-chunk";

export type {
  Conversation,
  NewConversation,
  ListConversationsOptions,
} from "./conversation";

export type { User, NewUser, FindUserOptions, ListUsersOptions } from "./user";
