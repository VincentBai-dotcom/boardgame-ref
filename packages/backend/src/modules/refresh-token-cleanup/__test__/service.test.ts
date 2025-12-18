/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  createMockDb,
  createMockDeleteBuilder,
} from "../../../test-utils/mock-drizzle";
import { RefreshTokenCleanupService } from "../service";
import { refreshToken } from "../../db/schema";

describe("RefreshTokenCleanupService", () => {
  let cleanupService: RefreshTokenCleanupService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDbService: { getDb: ReturnType<typeof mock> };
  let originalDateNow: () => number;
  const fixedNow = new Date("2024-01-15T00:00:00.000Z").getTime();

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => fixedNow;

    mockDb = createMockDb();
    mockDbService = {
      getDb: mock(() => mockDb),
    };
  });

  afterEach(() => {
    Date.now = originalDateNow;
    mock.restore();
  });

  test("deletes revoked and expired tokens using configured retention", async () => {
    const deletedRows = [{ id: "r1" }, { id: "r2" }];
    const deleteBuilder = createMockDeleteBuilder(deletedRows);
    mockDb.delete.mockReturnValue(deleteBuilder);

    cleanupService = new RefreshTokenCleanupService(mockDbService as any, {
      revokedRetentionDays: 7,
      expiredGraceDays: 2,
    });

    const result = await cleanupService.cleanup();

    expect(mockDb.delete).toHaveBeenCalledWith(refreshToken);
    expect(deleteBuilder.where).toHaveBeenCalledTimes(1);
    expect(deleteBuilder.returning).toHaveBeenCalledWith({
      id: refreshToken.id,
    });
    expect(result.deletedCount).toBe(deletedRows.length);
    expect(result.revokedCutoff).toEqual(new Date(fixedNow - 7 * 86_400_000));
    expect(result.expiredCutoff).toEqual(new Date(fixedNow - 2 * 86_400_000));
  });

  test("clamps negative retention config to zero days", async () => {
    const deleteBuilder = createMockDeleteBuilder([]);
    mockDb.delete.mockReturnValue(deleteBuilder);

    cleanupService = new RefreshTokenCleanupService(mockDbService as any, {
      revokedRetentionDays: -5,
      expiredGraceDays: -1,
    });

    const result = await cleanupService.cleanup();

    expect(result.revokedCutoff).toEqual(new Date(fixedNow));
    expect(result.expiredCutoff).toEqual(new Date(fixedNow));
  });
});
