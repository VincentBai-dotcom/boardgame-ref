import type { AgentInputItem, Session } from "@openai/agents";
import type { ConversationRepository } from "../../../../repositories";

class DatabaseSession implements Session {
  constructor(
    private readonly conversationId: string,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async getSessionId(): Promise<string> {
    return this.conversationId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    if (limit) {
      const total = await this.conversationRepository.countMessages(
        this.conversationId,
      );
      const offset = Math.max(0, total - limit);
      const messages = await this.conversationRepository.getMessages(
        this.conversationId,
        { limit, offset },
      );
      return messages.map((message) => message.content as AgentInputItem);
    }

    const messages = await this.conversationRepository.getMessages(
      this.conversationId,
    );
    return messages.map((message) => message.content as AgentInputItem);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await this.conversationRepository.createMessages(
      items.map((item) => ({
        conversationId: this.conversationId,
        content: item,
      })),
    );
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const message = await this.conversationRepository.popLatestMessage(
      this.conversationId,
    );
    return message?.content as AgentInputItem | undefined;
  }

  async clearSession(): Promise<void> {
    await this.conversationRepository.deleteMessagesByConversationId(
      this.conversationId,
    );
  }
}

export class OpenAIConversationsSessionProvider {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  getSession(conversationId: string): Session {
    return new DatabaseSession(conversationId, this.conversationRepository);
  }
}
