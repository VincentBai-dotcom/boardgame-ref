import { user } from "./schema/user";
import { game, rulebook } from "./schema/game";
import {
  emailVerificationToken,
  passwordResetToken,
  refreshToken,
} from "./schema/auth";
import { spreads } from "./utils";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

export const table = {
  user,
  game,
  rulebook,
  passwordResetToken,
  emailVerificationToken,
  refreshToken,
} as const;

export type Table = typeof table;

export const dbModel = {
  insert: spreads(
    {
      user: createInsertSchema(table.user, {
        email: t.String({ format: "email" }),
      }),
      game: createInsertSchema(table.game),
      rulebook: createInsertSchema(table.rulebook),
      passwordResetToken: createInsertSchema(table.passwordResetToken),
      emailVerificationToken: createInsertSchema(table.emailVerificationToken),
      refreshToken: createInsertSchema(table.refreshToken),
    },
    "insert",
  ),
  select: spreads(
    {
      user: createSelectSchema(table.user, {
        email: t.String({ format: "email" }),
      }),
      game: createSelectSchema(table.game),
      rulebook: createSelectSchema(table.rulebook),
      passwordResetToken: createSelectSchema(table.passwordResetToken),
      emailVerificationToken: createSelectSchema(table.emailVerificationToken),
      refreshToken: createSelectSchema(table.refreshToken),
    },
    "select",
  ),
} as const;
