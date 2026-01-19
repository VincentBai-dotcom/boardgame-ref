import { OpenAIConversationsSession, Session } from "@openai/agents";

export class OpenAIConversationsSessionProvider {
  getSession(conversationId?: string): Session {
    return new OpenAIConversationsSession({
      conversationId,
    });
  }
}
