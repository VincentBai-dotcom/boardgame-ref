import { run } from "@openai/agents";
import type { AgentInputItem, RunStreamEvent } from "@openai/agents";
import { OpenAIAgentFactory, OpenAISessionProvider } from "./agent";
import type { ConversationService } from "../conversation";
import type {
  UnifiedMessage,
  UnifiedMessageList,
  MessageContent,
  UnifiedStreamEvent,
} from "./model";

export type StreamChatInput = {
  userId: string;
  userText: string;
  conversationId?: string;
};

export type ChatResult = {
  conversationId: string;
  events: AsyncIterable<RunStreamEvent>;
};

export type RetrieveMessagesInput = {
  userId: string;
  conversationId: string;
  limit?: number;
};

export class ChatService {
  constructor(
    private readonly sessionProvider: OpenAISessionProvider,
    private readonly agentFactory: OpenAIAgentFactory,
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * Stream chat - creates new or continues existing conversation
   * @param input - User ID, message text, and optional conversation ID
   * @returns Async generator of stream events
   */
  async *streamChat(
    input: StreamChatInput,
  ): AsyncGenerator<UnifiedStreamEvent> {
    const { userId, userText, conversationId } = input;

    let session;
    let finalConversationId: string | undefined;

    if (conversationId) {
      // Continue existing conversation
      const conversationRecord =
        await this.conversationService.findConversationById(conversationId);

      if (!conversationRecord) {
        throw new Error("Conversation not found");
      }

      session = this.sessionProvider.getSession(
        conversationRecord.openaiConversationId,
      );
      finalConversationId = conversationId;
    } else {
      // Create new conversation
      session = this.sessionProvider.getSession();
    }

    // Run the agent
    const agent = this.agentFactory.createAgent();
    const events = await run(agent, userText, {
      session,
      stream: true,
    });

    // Save or update conversation
    if (!finalConversationId) {
      const openaiConversationId = await session.getSessionId();
      const conversationRecord =
        await this.conversationService.createConversation({
          userId,
          openaiConversationId,
          title: "New conversation",
        });
      finalConversationId = conversationRecord.id;
    } else {
      await this.conversationService.updateConversation(
        finalConversationId,
        {},
      );
    }

    // Stream events
    yield {
      event: "conversation_id",
      data: { conversationId: finalConversationId },
    };

    for await (const event of events) {
      const unified = this.convertToUnifiedEvent(event);
      if (unified) {
        yield unified;
      }
    }

    yield { event: "done" };
  }

  /**
   * Convert OpenAI RunStreamEvent to UnifiedStreamEvent
   * @param event - OpenAI run stream event
   * @returns Unified stream event or null if not convertible
   */
  private convertToUnifiedEvent(
    event: RunStreamEvent,
  ): UnifiedStreamEvent | null {
    // Handle raw model stream events (text deltas)
    if (event.type === "raw_model_stream_event") {
      const data = event.data;
      if (data.type === "output_text_delta" && data.delta) {
        return { event: "text_delta", data: { text: data.delta } };
      }
    }
    // Ignore other event types for now (agent_updated, etc.)
    return null;
  }

  /**
   * Retrieve all messages from a conversation
   * @param input - User ID and conversation ID
   * @returns Unified message list
   */
  async retrieveMessages(
    input: RetrieveMessagesInput,
  ): Promise<UnifiedMessageList> {
    const { userId, conversationId, limit } = input;

    const conversation =
      await this.conversationService.findConversationByIdForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const session = this.sessionProvider.getSession(
      conversation.openaiConversationId,
    );

    // Retrieve all items from the conversation
    const items = await session.getItems(limit);

    // Convert to unified format
    return this.convertOpenAIToUnifiedMessages(items);
  }

  /**
   * Convert OpenAI AgentInputItems to unified message format
   * @param items - OpenAI agent input items
   * @returns Unified message list
   */
  private convertOpenAIToUnifiedMessages(
    items: AgentInputItem[],
  ): UnifiedMessageList {
    const messages: UnifiedMessage[] = [];

    for (const item of items) {
      const message = this.convertOpenAIItemToMessage(item);
      if (message) {
        messages.push(message);
      }
    }

    return {
      messages,
      hasMore: false, // OpenAI session.getItems() returns all items
    };
  }

  /**
   * Convert a single OpenAI AgentInputItem to UnifiedMessage
   * @param item - OpenAI agent input item
   * @returns Unified message or null if not convertible
   */
  private convertOpenAIItemToMessage(
    item: AgentInputItem,
  ): UnifiedMessage | null {
    const content: MessageContent[] = [];

    // Handle user messages
    if (item.type === "message" && item.role === "user") {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "input_text" && "text" in part) {
            content.push({ type: "text", text: part.text });
          }
        }
      }
      return {
        role: "user",
        content,
        metadata: { provider: "openai" },
      };
    }

    // Handle assistant messages
    if (item.type === "message" && item.role === "assistant") {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "output_text" && "text" in part) {
            content.push({ type: "text", text: part.text });
          }
        }
      }
      return {
        role: "assistant",
        content,
        metadata: { provider: "openai" },
      };
    }

    // Handle system messages
    if (item.type === "message" && item.role === "system") {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if ("text" in part) {
            content.push({ type: "text", text: part.text });
          }
        }
      }
      return {
        role: "system",
        content,
        metadata: { provider: "openai" },
      };
    }

    // Handle tool calls
    if (
      item.type === "hosted_tool_call" ||
      item.type === "function_call" ||
      item.type === "shell_call"
    ) {
      content.push({
        type: "tool_call",
        toolCallId: item.id || "",
        toolName: "name" in item ? item.name : item.type,
        arguments: "arguments" in item ? item.arguments : {},
      });
      return {
        role: "assistant",
        content,
        metadata: { provider: "openai" },
      };
    }

    // Handle tool results
    if (
      item.type === "function_call_result" ||
      item.type === "shell_call_result"
    ) {
      content.push({
        type: "tool_result",
        toolCallId: "call_id" in item ? item.call_id : "",
        toolName: item.type,
        result: "output" in item ? item.output : null,
      });
      return {
        role: "system",
        content,
        metadata: { provider: "openai" },
      };
    }

    // Return null for unknown types (will be filtered out)
    return null;
  }
}
