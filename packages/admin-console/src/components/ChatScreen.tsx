import { useState, useEffect } from "react";
import { Layout } from "./Layout";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Plus, MessageSquare, Send } from "lucide-react";
import { client } from "../lib/client";

type Conversation = {
  id: string;
  userId: string;
  openaiConversationId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export function ChatScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load current conversation ID from localStorage
  useEffect(() => {
    const savedConversationId = localStorage.getItem("currentConversationId");
    if (savedConversationId) {
      setCurrentConversationId(savedConversationId);
    }
  }, []);

  // Save current conversation ID to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("currentConversationId", currentConversationId);
    } else {
      localStorage.removeItem("currentConversationId");
    }
  }, [currentConversationId]);

  async function loadConversations() {
    const response = await client.conversations.get();
    if (response.data) {
      setConversations(response.data);
    }
  }

  async function startNewConversation() {
    setCurrentConversationId(null);
  }

  async function selectConversation(id: string) {
    setCurrentConversationId(id);
  }

  async function sendMessage() {
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      // TODO: Implement chat endpoint
      console.log(
        "Sending message:",
        message,
        "to conversation:",
        currentConversationId,
      );
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
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
              onClick={() => selectConversation(conv.id)}
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
      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {!currentConversationId && (
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
          {/* TODO: Render chat messages here */}
        </div>
      </ScrollArea>

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
    </Layout>
  );
}
