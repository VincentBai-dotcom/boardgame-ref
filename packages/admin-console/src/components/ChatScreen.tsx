import { useState, useEffect, useRef } from "react";
import { Layout } from "./Layout";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Plus, MessageSquare, Send } from "lucide-react";
import { client } from "../lib/client";
import { ChatMessages } from "./ChatMessages";
import type { Conversations } from "../../../backend/src/modules/conversation/model";
import type { UnifiedMessageList } from "../../../backend/src/modules/chat/model";

export function ChatScreen() {
  const [conversations, setConversations] = useState<Conversations>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | undefined
  >(undefined);
  const [messages, setMessages] = useState<UnifiedMessageList | undefined>();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    } else {
      setMessages(undefined);
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const response = await client.conversations.get();
    if (response.data) {
      setConversations(response.data);
      // Set current conversation to the first one
      if (response.data.length > 0) {
        setCurrentConversationId(response.data[0].id);
      }
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const { data, error } = await client.chat
        .messages({ id: conversationId })
        .get();
      console.log("Loaded messages:", data, error);
      if (error) {
        console.error("Failed to load messages:", error);
        return;
      }

      if (data) {
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }

  async function startNewConversation() {
    setCurrentConversationId(undefined);
    setMessages(undefined);
  }

  async function sendMessage() {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);

    // Add user message to chat (unified format)
    setMessages((prev) => ({
      messages: [
        ...(prev?.messages ?? []),
        {
          role: "user",
          content: [{ type: "text", text: userMessage }],
          metadata: { provider: "openai" },
        },
      ],
      hasMore: false,
    }));

    try {
      let newConversationId: string | undefined = undefined;

      // Call appropriate endpoint using Eden Treaty
      const { data, error } = currentConversationId
        ? await client.chat.continue({ id: currentConversationId }).post({
            userText: userMessage,
          })
        : await client.chat.new.post({ userText: userMessage });

      if (error) {
        throw error;
      }

      // Handle the stream
      for await (const event of data) {
        console.log(event);

        // Handle conversation ID
        if (event.event === "conversation_id") {
          newConversationId = event.data.conversationId;
          if (!currentConversationId) {
            setCurrentConversationId(event.data.conversationId);
          }
          continue;
        }

        // Handle completion
        if (event.event === "done") {
          break;
        }

        // Handle errors
        else if (event.event === "error") {
          console.error("Stream error:", event.data.error);
          throw new Error(event.data.error);
        }
        // Handle text delta
        else if (event.event === "text_delta") {
          setMessages((prev) => {
            const messages = prev?.messages ?? [];
            const lastMessage = messages[messages.length - 1];

            // Check if last message is an assistant message
            if (lastMessage && lastMessage.role === "assistant") {
              // Append to existing assistant message
              const lastContent =
                lastMessage.content[lastMessage.content.length - 1];

              if (lastContent && lastContent.type === "text") {
                // Append to existing text content
                return {
                  messages: [
                    ...messages.slice(0, -1),
                    {
                      ...lastMessage,
                      content: [
                        ...lastMessage.content.slice(0, -1),
                        {
                          ...lastContent,
                          text: lastContent.text + event.data.text,
                        },
                      ],
                    },
                  ],
                  hasMore: false,
                };
              } else {
                // Add new text content to assistant message
                return {
                  messages: [
                    ...messages.slice(0, -1),
                    {
                      ...lastMessage,
                      content: [
                        ...lastMessage.content,
                        { type: "text", text: event.data.text },
                      ],
                    },
                  ],
                  hasMore: false,
                };
              }
            } else {
              // Create new assistant message
              return {
                messages: [
                  ...messages,
                  {
                    role: "assistant",
                    content: [{ type: "text", text: event.data.text }],
                    metadata: { provider: "openai" },
                  },
                ],
                hasMore: false,
              };
            }
          });
        }
      }

      // Reload conversations to update sidebar
      if (newConversationId && !currentConversationId) {
        await loadConversations();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => ({
        messages: [
          ...(prev?.messages ?? []),
          {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "Sorry, there was an error processing your message.",
              },
            ],
            metadata: { provider: "openai" },
          },
        ],
        hasMore: false,
      }));
    } finally {
      setIsLoading(false);
    }
  }

  const ConversationList = (
    <>
      <div className="p-4">
        <Button onClick={startNewConversation} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversationId(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                currentConversationId === conv.id
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
              }`}
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="truncate">{conv.title}</span>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="text-center py-8 text-sm text-neutral-500">
              No conversations yet
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <Layout sidebarContent={ConversationList}>
      <div className="flex flex-col h-full">
        {/* Chat Messages */}
        <div className="flex-1 overflow-hidden">
          <ChatMessages
            messages={messages}
            messagesEndRef={messagesEndRef}
            ref={scrollAreaRef}
          />
        </div>

        {/* Message Input */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about board game rules..."
                className="resize-none"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!message.trim() || isLoading}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
