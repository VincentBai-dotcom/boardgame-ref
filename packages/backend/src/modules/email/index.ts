import { configService } from "../config";
import { PostmarkEmailSender } from "./sender/impl/postmark";

export type { EmailSender } from "./sender/sender";
export { PostmarkEmailSender } from "./sender/impl/postmark";

export const postmarkEmailSender = new PostmarkEmailSender(configService);
