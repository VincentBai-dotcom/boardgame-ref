import {
  AgentInputItem,
  OpenAIConversationsSession,
  run,
  RunStreamEvent,
} from "@openai/agents";
import {
  OpenAIAgentFactory,
  OpenAIConversationsSessionProvider,
} from "../../agent";
import type { ConversationRepository } from "../../../repositories";
import type {
  UnifiedMessage,
  UnifiedMessageList,
  MessageContent,
  UnifiedStreamEvent,
} from "../../model";
import type { Logger } from "../../../logger";
import type {
  ChatService,
  StreamChatInput,
  RetrieveMessagesInput,
  Conversation,
} from "../base";

/**
 * OpenAI Agents SDK implementation of ChatService
 *
 * This implementation uses OpenAI's Agents SDK which owns its own
 * conversation persistence via the session provider. We maintain
 * a separate conversation record in our database for user-facing
 * features (listing, titles, etc.) but message storage is handled
 * by OpenAI.
 */
export class OpenAIAgentsChatService implements ChatService {
  constructor(
    private readonly logger: Logger,
    private readonly sessionProvider: OpenAIConversationsSessionProvider,
    private readonly agentFactory: OpenAIAgentFactory,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  /**
   * Stream chat - creates new or continues existing conversation
   * Uses OpenAI Agents SDK for LLM interaction and session persistence
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
   * Retrieve all messages from a conversation
   * Fetches from OpenAI's session storage
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
   * List conversations for a user
   */
  async listConversations(
    userId: string,
    limit: number = 100,
  ): Promise<Conversation[]> {
    return this.conversationRepository.list({ userId, limit });
  }

  /**
   * Get a single conversation by ID (with ownership check)
   */
  async getConversation(
    id: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepository.findByIdForUser(id, userId);
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(
    id: string,
    userId: string,
    title: string,
  ): Promise<Conversation | null> {
    // Verify ownership first
    const conversation = await this.conversationRepository.findByIdForUser(
      id,
      userId,
    );

    if (!conversation) {
      return null;
    }

    return this.conversationRepository.updateTitle(id, title);
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string, userId: string): Promise<boolean> {
    return this.conversationRepository.deleteForUser(id, userId);
  }

  /**
   * Convert OpenAI RunStreamEvent to UnifiedStreamEvent
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
        const rawItem = item.rawItem as {
          type?: string;
          name?: string;
          arguments?: string;
        };
        if (rawItem.type === "function_call" && rawItem.name) {
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
    // Ignore other event types for now
    return undefined;
  }

  /**
   * Convert OpenAI AgentInputItems to unified message format
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
      hasMore: false,
    };
  }

  /**
   * Convert a single OpenAI AgentInputItem to UnifiedMessage
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

    // Return null for unknown types
    return null;
  }
}
