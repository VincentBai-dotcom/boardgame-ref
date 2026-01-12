import Elysia from "elysia";

import {
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
} from "../repositories";
import { dbService } from "../db";
import { IngestionModel, IngestionResponse } from "./model";
import { adminGuard, localGuard } from "../../plugins/guard";
import { createIngestionService } from "./service";
import { Logger } from "../logger";
import { configService } from "../config";

export const ingestionService = createIngestionService(
  configService,
  dbService,
  gameRepository,
  rulebookRepository,
  ruleChunkRepository,
  new Logger("IngestionService", configService),
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
  )
  .post(
    "/csv",
    async ({ body, status }) => {
      try {
        const result = await ingestionService.ingestGameDataFromCSV(
          body.csvFile,
        );

        return result;
      } catch (error) {
        return status(400, { error: (error as Error).message });
      }
    },
    {
      body: IngestionModel.ingestGamesCsv,
      response: {
        200: IngestionResponse.ingestGamesCsvResult,
        400: IngestionResponse.error,
      },
    },
  );
