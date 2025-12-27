import { OpenAIConversationsSession, Session } from "@openai/agents";

export interface sessionProvider {
  getSession(conversationId?: string): Session;
}

export class OpenAIConversationsSessionProvider implements sessionProvider {
  getSession(conversationId?: string): Session {
    return new OpenAIConversationsSession({
      conversationId,
    });
  }
}
