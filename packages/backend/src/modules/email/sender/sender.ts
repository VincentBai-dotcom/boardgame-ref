export interface EmailSender {
  sendVerificationCode(to: string, code: string): Promise<void>;
}
