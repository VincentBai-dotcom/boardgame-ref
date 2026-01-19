import { Agent as OpenAIAgent, run, Session } from "@openai/agents";
import { Agent as BaseAgent, StreamChatInput } from "../base";
import type { ConversationRepository } from "../../../repositories";
import type { UIStreamEvent } from "../../model";
import type { Logger } from "../../../logger";
import type { OpenAIConversationsSessionProvider } from "./session-provider/session-provider";
import { convertRunStreamEventToUIEvent } from "../../utils/message-converter";
import OpenAI from "openai";

/**
 * OpenAI Agents SDK adapter for the base agent interface.
 */
export class OpenAIAgentsAgent extends BaseAgent {
  constructor(
    private readonly logger: Logger,
    private readonly sessionProvider: OpenAIConversationsSessionProvider,
    private readonly agent: OpenAIAgent,
    private readonly conversationRepository: ConversationRepository,
    private readonly openaiClient: OpenAI,
  ) {
    super();
  }

  async *streamChat(input: StreamChatInput): AsyncGenerator<UIStreamEvent> {
    const { userId, userText, conversationId } = input;

    let session: Session;
    let finalConversationId: string;

    if (conversationId) {
      const conversationRecord =
        await this.conversationRepository.findByIdForUser(
          conversationId,
          userId,
        );

      if (!conversationRecord) {
        throw new Error("Conversation not found");
      }

      finalConversationId = conversationRecord.id;
      session = this.sessionProvider.getSession(conversationRecord.id);
    } else {
      const title = await this.generateTitle(userText);
      const conversationRecord = await this.conversationRepository.create({
        userId,
        provider: "openai-agents-sdk",
        title,
      });

      finalConversationId = conversationRecord.id;
      session = this.sessionProvider.getSession(conversationRecord.id);
    }

    const events = await run(this.agent, userText, {
      session,
      stream: true,
    });

    await this.conversationRepository.update(finalConversationId, {});

    yield {
      event: "conversation_id",
      data: { conversationId: finalConversationId },
    };

    for await (const event of events) {
      const uiEvent = convertRunStreamEventToUIEvent(event, this.logger);
      if (uiEvent) {
        yield uiEvent;
      }
    }

    yield { event: "done" };
  }

  // Message retrieval handled by ChatService using repositories + converters.

  /**
   * Generate a conversation title from the user's first message
   */
  private async generateTitle(userMessage: string): Promise<string> {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Generate a short, descriptive title (max 50 characters) for a conversation that starts with the following message. Return only the title, no quotes or punctuation.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_tokens: 30,
        temperature: 0.7,
      });

      const title = response.choices[0]?.message?.content?.trim();
      return title || "New conversation";
    } catch (error) {
      this.logger.error("Failed to generate conversation title", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "New conversation";
    }
  }
}
