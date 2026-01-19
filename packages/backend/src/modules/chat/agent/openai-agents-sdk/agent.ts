import { Agent as OpenAIAgent, run, Session } from "@openai/agents";
import { Agent as BaseAgent, StreamChatInput } from "../base";
import type { ConversationRepository } from "../../../repositories";
import type { UIStreamEvent } from "../../model";
import type { Logger } from "../../../logger";
import type { OpenAIConversationsSessionProvider } from "./session-provider/session-provider";
import { convertRunStreamEventToUIEvent } from "../../utils/message-converter";

/**
 * OpenAI Agents SDK adapter for the base agent interface.
 */
export class OpenAIAgentsAgent extends BaseAgent {
  constructor(
    private readonly logger: Logger,
    private readonly sessionProvider: OpenAIConversationsSessionProvider,
    private readonly agent: OpenAIAgent,
    private readonly conversationRepository: ConversationRepository,
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
      const conversationRecord = await this.conversationRepository.create({
        userId,
        provider: "openai-agents-sdk",
        title: "New conversation",
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
}
