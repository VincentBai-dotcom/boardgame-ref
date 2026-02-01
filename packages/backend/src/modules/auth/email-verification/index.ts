import { EmailVerificationService } from "./service";
import {
  emailVerificationRepository,
  oauthAccountRepository,
  userRepository,
} from "../../repositories";
import { postmarkEmailSender } from "../../email";

export { EmailVerificationService } from "./service";

export const emailVerificationService = new EmailVerificationService(
  postmarkEmailSender,
  userRepository,
  oauthAccountRepository,
  emailVerificationRepository,
);
