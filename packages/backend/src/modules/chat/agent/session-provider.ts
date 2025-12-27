import { OpenAIConversationsSession, Session } from "@openai/agents";

export interface OpenAISessionProvider {
  getSession(conversationId?: string): Session;
}

export class OpenAIConversationsSessionProvider implements OpenAISessionProvider {
  getSession(conversationId?: string): Session {
    return new OpenAIConversationsSession({
      conversationId,
    });
  }
}
