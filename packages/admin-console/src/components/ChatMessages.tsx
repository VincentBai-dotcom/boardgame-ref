import { forwardRef, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ScrollArea } from "./ui/scroll-area";
import { MessageSquare } from "lucide-react";
import type {
  UnifiedMessageList,
  UnifiedMessage,
  MessageContent,
} from "../../../backend/src/modules/chat/model";

type ChatMessagesProps = {
  messages: UnifiedMessageList | undefined;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(
  ({ messages, messagesEndRef }, ref) => {
    const markdownComponents: Components = {
      h1: (props) => (
        <h1
          className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl"
          {...props}
        />
      ),
      h2: (props) => (
        <h2
          className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 mt-10"
          {...props}
        />
      ),
      h3: (props) => (
        <h3
          className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8"
          {...props}
        />
      ),
      h4: (props) => (
        <h4
          className="scroll-m-20 text-xl font-semibold tracking-tight mt-6"
          {...props}
        />
      ),
      p: (props) => (
        <p
          className="text-lg leading-7 [&:not(:first-child)]:mt-6"
          {...props}
        />
      ),
      ul: (props) => (
        <ul className="my-6 ml-6 list-disc text-lg [&>li]:mt-2" {...props} />
      ),
      ol: (props) => (
        <ol className="my-6 ml-6 list-decimal text-lg [&>li]:mt-2" {...props} />
      ),
      li: (props) => <li {...props} />,
      blockquote: (props) => (
        <blockquote className="mt-6 border-l-2 pl-6 italic" {...props} />
      ),
      code: (props) => {
        const { inline, className, children, ...rest } =
          props as ComponentPropsWithoutRef<"code"> & {
            inline?: boolean;
          };

        return inline ? (
          <code
            className={`relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className ?? ""}`}
            {...rest}
          >
            {children}
          </code>
        ) : (
          <code
            className={`relative font-mono text-sm ${className ?? ""}`}
            {...rest}
          >
            {children}
          </code>
        );
      },
      pre: (props) => {
        const { ...rest } = props as ComponentPropsWithoutRef<"pre">;
        return (
          <pre
            className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-black py-4"
            {...rest}
          />
        );
      },
      a: (props) => (
        <a className="font-medium underline underline-offset-4" {...props} />
      ),
    };

    const renderContentPart = (
      part: MessageContent,
      role: UnifiedMessage["role"],
    ) => {
      if (part.type === "text") {
        if (role === "user") {
          return <p className="whitespace-pre-wrap">{part.text}</p>;
        }

        return (
          <ReactMarkdown components={markdownComponents}>
            {part.text}
          </ReactMarkdown>
        );
      }

      if (part.type === "tool_call") {
        return (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Tool call
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {part.toolName || "unknown"}
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-100 dark:bg-neutral-800 p-2 text-xs">
              {JSON.stringify(part.arguments ?? {}, null, 2)}
            </pre>
          </div>
        );
      }

      if (part.type === "tool_result") {
        return (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Tool result
            </div>
            <div className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {part.toolName || "unknown"}
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-100 dark:bg-neutral-800 p-2 text-xs">
              {typeof part.result === "string"
                ? part.result
                : JSON.stringify(part.result ?? null, null, 2)}
            </pre>
          </div>
        );
      }

      return null;
    };

    const messageList = messages?.messages ?? [];

    return (
      <ScrollArea className="flex-1 min-h-0 p-4" ref={ref}>
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
            if (msg.content.length === 0) return null;
            const isUser = msg.role === "user";
            const isSystem = msg.role === "system";

            return (
              <div
                key={idx}
                className={`flex ${
                  isUser ? "gap-3 justify-end" : "justify-start"
                }`}
              >
                {isUser ? (
                  <>
                    <div className="rounded-lg px-4 py-2 max-w-[80%] bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 text-lg">
                      <div className="space-y-3">
                        {msg.content.map((part, partIdx) => (
                          <div key={partIdx}>
                            {renderContentPart(part, msg.role)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className={`w-full text-base ${
                      isSystem
                        ? "text-neutral-600 dark:text-neutral-400"
                        : "text-neutral-900 dark:text-neutral-100"
                    }`}
                  >
                    <div className="space-y-4">
                      {msg.content.map((part, partIdx) => (
                        <div key={partIdx}>
                          {renderContentPart(part, msg.role)}
                        </div>
                      ))}
                    </div>
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
