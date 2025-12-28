import { forwardRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { MessageSquare, User, Bot } from "lucide-react";
import type {
  UnifiedMessageList,
  UnifiedMessage,
} from "../../../backend/src/modules/chat/model";

type ChatMessagesProps = {
  messages: UnifiedMessageList | undefined;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  ({ messages, messagesEndRef }, ref) => {
    // Extract text content from unified message format
    const getTextContent = (message: UnifiedMessage) => {
      return message.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("");
    };

    const messageList = messages?.messages ?? [];

    return (
      <ScrollArea className="flex-1 p-4" ref={ref}>
        <div className="max-w-3xl mx-auto space-y-4">
          {messageList.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-neutral-600 dark:text-neutral-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Start a new conversation
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                Ask me anything about board game rules
              </p>
            </div>
          )}

          {/* Render messages */}
          {messageList.map((msg, idx) => {
            const textContent = getTextContent(msg);
            if (!textContent) return null;

            return (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-neutral-50 dark:text-neutral-900" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{textContent}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-neutral-50 dark:text-neutral-900" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    );
  },
);

ChatMessages.displayName = "ChatMessages";
