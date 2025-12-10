import { user } from "./user";
import { game, rulebook } from "./game";
import {
  passwordResetToken,
  emailVerificationToken,
  refreshToken,
} from "./auth";

export const table = {
  user,
  game,
  rulebook,
  passwordResetToken,
  emailVerificationToken,
  refreshToken,
} as const;

export type Table = typeof table;
