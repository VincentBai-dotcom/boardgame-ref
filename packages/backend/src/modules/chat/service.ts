import { run } from "@openai/agents";
import { OpenAIAgentFactory, OpenAISessionProvider } from "./agent";

export type ChatTurn = {
  conversationId?: string;
  userId: string;
  userText: string;
};

export class ChatService {
  constructor(
    private readonly sessionProvider: OpenAISessionProvider,
    private readonly agentFactory: OpenAIAgentFactory,
  ) {}

  async *streamChat(turn: ChatTurn) {
    const session = this.sessionProvider.getSession(turn.conversationId);
    const agent = this.agentFactory.createAgent();
    const result = await run(agent, turn.userText, {
      session,
      stream: true,
    });

    for await (const event of result) {
      if (event.type === "raw_model_stream_event") {
        console.log(`${event.type} %o`, event.data);
      }
      // agent updated events
      else if (event.type === "agent_updated_stream_event") {
        console.log(`${event.type} %s`, event.agent.name);
      }
      // Agent SDK specific events
      else if (event.type === "run_item_stream_event") {
        console.log(`${event.type} %o`, event.item);
      }
    }
    yield "";
  }
}
