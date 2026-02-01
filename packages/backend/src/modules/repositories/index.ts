import { GameRepository } from "./game";
import { RulebookRepository } from "./rulebook";
import { RuleChunkRepository } from "./rule-chunk";
import { ConversationRepository } from "./conversation";
import { UserRepository } from "./user";
import { RefreshTokenRepository } from "./refresh-token";
import { EmailVerificationRepository } from "./email-verification";
import { OAuthAccountRepository } from "./oauth-account";
import { dbService } from "../db";

// Export repository classes
export { GameRepository } from "./game";
export { RulebookRepository } from "./rulebook";
export { RuleChunkRepository } from "./rule-chunk";
export { ConversationRepository } from "./conversation";
export { UserRepository, type IUserRepository } from "./user";
export {
  OAuthAccountRepository,
  type IOAuthAccountRepository,
} from "./oauth-account";
export {
  RefreshTokenRepository,
  type IRefreshTokenRepository,
} from "./refresh-token";
export {
  EmailVerificationRepository,
  type IEmailVerificationRepository,
} from "./email-verification";

// Create singleton instances
export const gameRepository = new GameRepository(dbService);
export const rulebookRepository = new RulebookRepository(dbService);
export const ruleChunkRepository = new RuleChunkRepository(dbService);
export const conversationRepository = new ConversationRepository(dbService);
export const userRepository = new UserRepository(dbService);
export const oauthAccountRepository = new OAuthAccountRepository(dbService);
export const refreshTokenRepository = new RefreshTokenRepository(dbService);
export const emailVerificationRepository = new EmailVerificationRepository(
  dbService,
);

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
export type { OAuthAccount, NewOAuthAccount } from "./oauth-account";
export type { RefreshToken, NewRefreshToken } from "./refresh-token";
export type {
  EmailVerificationCode,
  NewEmailVerificationCode,
} from "./email-verification";
