import { ConfigService } from "../../../config";
import { EmailSender } from "../sender";

export class PostmarkEmailSender implements EmailSender {
  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const config = this.configService.get().email.postmark;

    if (!config.serverToken || !config.fromEmail) {
      throw new Error("Postmark is not configured");
    }

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": config.serverToken,
      },
      body: JSON.stringify({
        From: config.fromEmail,
        To: to,
        Subject: "Your verification code",
        TextBody: `Your verification code is ${code}. It expires in 10 minutes.`,
        MessageStream: config.messageStream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Postmark send failed: ${errorText}`);
    }
  }
}
