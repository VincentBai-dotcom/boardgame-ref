import { Agent } from "@openai/agents";

export interface OpenAIAgentFactory {
  createAgent(): Agent;
}

export class DefaultOpenAIAgentFactory implements OpenAIAgentFactory {
  createAgent(): Agent {
    return new Agent({
      name: "Default Agent",
      instructions: "",
    });
  }
}
