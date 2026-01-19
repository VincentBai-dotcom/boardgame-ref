import type { AgentInputItem, RunStreamEvent } from "@openai/agents";
import type {
  UIMessage,
  UIMessageList,
  MessageContent,
  UIStreamEvent,
} from "../model";
import type { Logger } from "../../logger";

export const convertRunStreamEventToUIEvent = (
  event: RunStreamEvent,
  logger?: Logger,
): UIStreamEvent | undefined => {
  if (event.type === "raw_model_stream_event") {
    const data = event.data;
    if (data.type === "output_text_delta" && data.delta) {
      return { event: "text_delta", data: { text: data.delta } };
    }
  } else if (event.type === "run_item_stream_event") {
    const { name, item } = event;

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
            logger?.error("Failed to parse tool arguments", {
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

  return undefined;
};

export const convertAgentInputItemToUIMessage = (
  item: AgentInputItem,
): UIMessage | null => {
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

  if (item.type === "message" && item.role === "user") {
    if (Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "input_text" && "text" in part) {
          content.push({ type: "text", text: part.text });
        }
      }
    } else if (typeof item.content === "string") {
      content.push({ type: "text", text: item.content });
    }
    return {
      role: "user",
      content,
      metadata: { provider: "openai" },
    };
  }

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

  return null;
};

export const convertAgentInputItemToUIMessageList = (
  items: AgentInputItem[],
): UIMessageList => {
  const messages: UIMessage[] = [];

  for (const item of items) {
    const message = convertAgentInputItemToUIMessage(item);
    if (message) {
      messages.push(message);
    }
  }

  return {
    messages,
    hasMore: false,
  };
};
