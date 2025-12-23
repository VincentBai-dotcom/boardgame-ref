import { dbService } from "../db";
import { GameService } from "./service";

export const gameService = new GameService(dbService);
