import { gameRepository, ruleChunkRepository } from "../repositories";
import { GameService } from "./service";

export const gameService = new GameService(gameRepository, ruleChunkRepository);

export { GameService };
