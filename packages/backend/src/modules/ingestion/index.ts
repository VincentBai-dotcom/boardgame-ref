import Elysia from "elysia";
import { IngestionService } from "./service";
import {
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
} from "../repositories";
import { IngestionModel, IngestionResponse } from "./model";
import { adminGuard, localGuard } from "../guard";
import { Logger } from "../logger";

export const ingestionService = new IngestionService(
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
  new Logger("IngestionService"),
);

export const ingestion = new Elysia({
  name: "ingestion",
  prefix: "/ingestion",
})
  .use(localGuard)
  .use(adminGuard)
  .post(
    "/game",
    async ({ body, status }) => {
      try {
        const result = await ingestionService.ingestGameData({
          boardgameName: body.boardgameName,
          yearPublished: body.yearPublished,
          bggId: body.bggId,
          rulebookTitle: body.rulebookTitle,
          rulebookPdfFile: body.rulebookPdfFile,
          rulebookType: body.rulebookType,
          language: body.language,
        });

        return result;
      } catch (error) {
        return status(400, { error: (error as Error).message });
      }
    },
    {
      body: IngestionModel.ingestGame,
      response: {
        200: IngestionResponse.ingestGameResult,
        400: IngestionResponse.error,
      },
    },
  );
