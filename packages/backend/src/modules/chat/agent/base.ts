import type { UIStreamEvent } from "../model";

/**
 * Base agent interface for running model turns.
 */
export type StreamChatInput = {
  userId: string;
  userText: string;
  conversationId?: string;
};

export abstract class Agent {
  abstract streamChat(input: StreamChatInput): AsyncGenerator<UIStreamEvent>;
}
