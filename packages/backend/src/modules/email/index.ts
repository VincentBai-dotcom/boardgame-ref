import { configService } from "../config";
import { PostmarkEmailSender } from "./sender/impl/postmark";
import { EmailVerificationService } from "./service";

export type { EmailSender } from "./sender/sender";
export { PostmarkEmailSender } from "./sender/impl/postmark";
export { EmailVerificationService } from "./service";

const postmarkEmailSender = new PostmarkEmailSender(configService);
export const emailVerificationService = new EmailVerificationService(
  postmarkEmailSender,
);
