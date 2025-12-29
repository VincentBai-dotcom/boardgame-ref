import { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ScrollArea } from "./ui/scroll-area";
import { MessageSquare } from "lucide-react";
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
        const { className, children, ...rest } = props;
        const isInline = "inline" in props && props.inline;

        return isInline ? (
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
      pre: (props) => (
        <pre
          className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-black py-4"
          {...props}
        />
      ),
      a: (props) => (
        <a className="font-medium underline underline-offset-4" {...props} />
      ),
    };

    // Extract text content from unified message format
    const getTextContent = (message: UnifiedMessage) => {
      return message.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("");
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
            const textContent = getTextContent(msg);
            if (!textContent) return null;
            const isUser = msg.role === "user";

            return (
              <div
                key={idx}
                className={`flex ${isUser ? "gap-3 justify-end" : "justify-start"}`}
              >
                {isUser ? (
                  <>
                    <div className="rounded-lg px-4 py-2 max-w-[80%] bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 text-lg">
                      <p className="whitespace-pre-wrap">{textContent}</p>
                    </div>
                  </>
                ) : (
                  <div className="w-full text-neutral-900 dark:text-neutral-100 text-base">
                    <ReactMarkdown components={markdownComponents}>
                      {textContent}
                    </ReactMarkdown>
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
