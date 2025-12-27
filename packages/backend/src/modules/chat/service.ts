import { run } from "@openai/agents";
import type { RunStreamEvent } from "@openai/agents";
import { OpenAIAgentFactory, OpenAISessionProvider } from "./agent";
import type { ConversationService } from "../conversation";

export type CreateChatInput = {
  userId: string;
  userText: string;
};

export type ContinueChatInput = {
  conversationId: string;
  userText: string;
};

export type ChatResult = {
  conversationId: string;
  events: AsyncIterable<RunStreamEvent>;
};

export class ChatService {
  constructor(
    private readonly sessionProvider: OpenAISessionProvider,
    private readonly agentFactory: OpenAIAgentFactory,
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * Create a new conversation and stream the first message
   * @param input - User ID and message text
   * @returns Conversation ID and event stream
   */
  async createAndStreamChat(input: CreateChatInput): Promise<ChatResult> {
    const { userId, userText } = input;

    // Create new OpenAI session (no conversationId)
    const session = this.sessionProvider.getSession();
    const agent = this.agentFactory.createAgent();

    const events = await run(agent, userText, {
      session,
      stream: true,
    });

    // Get the OpenAI conversation ID from the session
    const openaiConversationId = await session.getSessionId();

    // Save conversation to database
    const conversationRecord =
      await this.conversationService.createConversation({
        userId,
        openaiConversationId,
        title: "New conversation",
      });

    return {
      conversationId: conversationRecord.id,
      events,
    };
  }

  /**
   * Continue an existing conversation with a new message
   * @param input - Conversation ID and message text
   * @returns Conversation ID and event stream
   */
  async continueAndStreamChat(input: ContinueChatInput): Promise<ChatResult> {
    const { conversationId, userText } = input;

    // Find conversation in database
    const conversationRecord =
      await this.conversationService.findConversationById(conversationId);

    if (!conversationRecord) {
      throw new Error("Conversation not found");
    }

    // Get existing OpenAI session
    const session = this.sessionProvider.getSession(
      conversationRecord.openaiConversationId,
    );
    const agent = this.agentFactory.createAgent();

    const events = await run(agent, userText, {
      session,
      stream: true,
    });

    // Update conversation timestamp
    await this.conversationService.updateConversation(conversationId, {});

    return {
      conversationId,
      events,
    };
  }
}
