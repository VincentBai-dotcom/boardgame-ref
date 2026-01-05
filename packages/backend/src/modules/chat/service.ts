import {
  AgentInputItem,
  OpenAIConversationsSession,
  run,
  RunStreamEvent,
} from "@openai/agents";
import {
  OpenAIAgentFactory,
  OpenAIConversationsSessionProvider,
} from "./agent";
import type { ConversationRepository } from "../repositories/conversation";
import type {
  UnifiedMessage,
  UnifiedMessageList,
  MessageContent,
  UnifiedStreamEvent,
} from "./model";
import { Logger } from "../logger";

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
    private readonly sessionProvider: OpenAIConversationsSessionProvider,
    private readonly agentFactory: OpenAIAgentFactory,
    private readonly conversationRepository: ConversationRepository,
    private readonly logger: Logger,
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

    let session: OpenAIConversationsSession;
    let finalConversationId: string | undefined;

    if (conversationId) {
      // Continue existing conversation
      const conversationRecord =
        await this.conversationRepository.findById(conversationId);

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
      const conversationRecord = await this.conversationRepository.create({
        userId,
        openaiConversationId,
        title: "New conversation",
      });
      finalConversationId = conversationRecord.id;
    } else {
      await this.conversationRepository.update(finalConversationId, {});
    }

    // Stream events
    yield {
      event: "conversation_id",
      data: { conversationId: finalConversationId },
    };

    for await (const event of events) {
      const unified = this.convertStreamEventToUnifiedEvent(event);
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
  private convertStreamEventToUnifiedEvent(
    event: RunStreamEvent,
  ): UnifiedStreamEvent | undefined {
    // Handle raw model stream events (text deltas)
    if (event.type === "raw_model_stream_event") {
      const data = event.data;
      if (data.type === "output_text_delta" && data.delta) {
        return { event: "text_delta", data: { text: data.delta } };
      }
    } else if (event.type === "run_item_stream_event") {
      const { name, item } = event;

      // Handle tool call events
      if (name === "tool_called" && item.type === "tool_call_item") {
        // rawItem can be various types; check if it's a function_call
        const rawItem = item.rawItem as {
          type?: string;
          name?: string;
          arguments?: string;
        };
        if (rawItem.type === "function_call" && rawItem.name) {
          // Parse arguments from JSON string to object
          let parsedArguments: Record<string, unknown> | undefined;
          if (rawItem.arguments) {
            try {
              parsedArguments = JSON.parse(rawItem.arguments);
            } catch (error) {
              this.logger.error("Failed to parse tool arguments", {
                toolName: rawItem.name,
                arguments: rawItem.arguments,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          return {
            event: "tool_call",
            data: {
              toolName: rawItem.name,
              arguments: parsedArguments,
            },
          };
        }
      }

      // Handle tool output events
      if (name === "tool_output" && item.type === "tool_call_output_item") {
        // rawItem can be various types; check if it's a function_call_result
        const rawItem = item.rawItem as { type?: string; name?: string };
        if (rawItem.type === "function_call_result" && rawItem.name) {
          return {
            event: "tool_result",
            data: {
              toolName: rawItem.name,
              result: item.output,
            },
          };
        }
      }
    }
    // Ignore other event types for now (agent_updated, etc.)
    return undefined;
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

    const conversation = await this.conversationRepository.findByIdForUser(
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
    return this.convertAgentInputItemToUnifiedMessages(items);
  }

  /**
   * Convert OpenAI AgentInputItems to unified message format
   * @param items - OpenAI agent input items
   * @returns Unified message list
   */
  private convertAgentInputItemToUnifiedMessages(
    items: AgentInputItem[],
  ): UnifiedMessageList {
    const messages: UnifiedMessage[] = [];

    for (const item of items) {
      const message = this.convertAgentInputItemToMessage(item);
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
  private convertAgentInputItemToMessage(
    item: AgentInputItem,
  ): UnifiedMessage | null {
    const content: MessageContent[] = [];
    const parseToolArguments = (args: unknown): Record<string, unknown> => {
      if (!args) return {};
      if (typeof args === "string") {
        try {
          const parsed = JSON.parse(args);
          if (parsed && typeof parsed === "object") {
            return parsed as Record<string, unknown>;
          }
        } catch {
          return { raw: args };
        }
      }
      if (typeof args === "object") {
        return args as Record<string, unknown>;
      }
      return { raw: args };
    };

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
        arguments: parseToolArguments(
          "arguments" in item ? item.arguments : undefined,
        ),
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
