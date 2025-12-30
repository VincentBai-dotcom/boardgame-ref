import { OpenAIConversationsSession } from "@openai/agents";

export class OpenAIConversationsSessionProvider {
  getSession(conversationId?: string): OpenAIConversationsSession {
    return new OpenAIConversationsSession({
      conversationId,
    });
  }
}
