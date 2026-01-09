//
//  ChatViewModel.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData
import Observation

@Observable
@MainActor
class ChatViewModel {
    var messages: [Message] = []
    var inputText = ""
    var currentConversationId: String?
    var isStreaming = false
    var streamingContent = ""
    var errorMessage: String?

    private let chatService: ChatService
    private let conversationService: ConversationService
    private let modelContext: ModelContext
    private var lastFailedMessage: String?

    init(
        chatService: ChatService,
        conversationService: ConversationService,
        modelContext: ModelContext
    ) {
        self.chatService = chatService
        self.conversationService = conversationService
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func loadConversation(id: String) {
        currentConversationId = id
        errorMessage = nil

        let descriptor = FetchDescriptor<Message>(
            predicate: #Predicate { $0.conversation?.id == id },
            sortBy: [SortDescriptor(\.timestamp, order: .forward)]
        )

        do {
            messages = try modelContext.fetch(descriptor)
            print("✅ Loaded \(messages.count) messages for conversation \(id)")
        } catch {
            errorMessage = "Failed to load messages: \(error.localizedDescription)"
            print("⚠️ Error loading messages: \(error)")
        }
    }

    func sendMessage() {
        guard !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        let userMessage = inputText
        inputText = ""
        errorMessage = nil
        lastFailedMessage = nil

        // Add user message to UI immediately (optimistic update)
        let tempUserMessage = Message(
            id: UUID().uuidString,
            role: "user",
            content: userMessage,
            timestamp: Date()
        )
        messages.append(tempUserMessage)

        isStreaming = true
        streamingContent = ""

        sendMessageInternal(userMessage)
    }

    func retryLastMessage() {
        guard let message = lastFailedMessage else {
            errorMessage = "No message to retry"
            return
        }

        errorMessage = nil
        isStreaming = true
        streamingContent = ""
        sendMessageInternal(message)
    }

    func startNewConversation() {
        currentConversationId = nil
        messages = []
        inputText = ""
        streamingContent = ""
        errorMessage = nil
        print("✅ Started new conversation")
    }

    // MARK: - Private Methods

    private func sendMessageInternal(_ userMessage: String) {
        Task {
            do {
                if let convId = currentConversationId {
                    // Continue existing conversation
                    try await chatService.continueChat(
                        conversationId: convId,
                        message: userMessage,
                        onChunk: { [weak self] chunk in
                            Task { @MainActor in
                                self?.streamingContent = chunk
                            }
                        },
                        onComplete: { [weak self] fullResponse in
                            Task { @MainActor in
                                self?.finalizeMessage(fullResponse)
                            }
                        },
                        onError: { [weak self] error in
                            Task { @MainActor in
                                self?.lastFailedMessage = userMessage
                                self?.errorMessage = error
                                self?.isStreaming = false
                                self?.streamingContent = ""
                            }
                        }
                    )
                } else {
                    // Start new conversation
                    try await chatService.startNewChat(
                        message: userMessage,
                        onConversationId: { [weak self] convId in
                            Task { @MainActor in
                                self?.currentConversationId = convId
                                print("✅ New conversation created: \(convId)")
                            }
                        },
                        onChunk: { [weak self] chunk in
                            Task { @MainActor in
                                self?.streamingContent = chunk
                            }
                        },
                        onComplete: { [weak self] fullResponse in
                            Task { @MainActor in
                                self?.finalizeMessage(fullResponse)
                            }
                        },
                        onError: { [weak self] error in
                            Task { @MainActor in
                                self?.lastFailedMessage = userMessage
                                self?.errorMessage = error
                                self?.isStreaming = false
                                self?.streamingContent = ""
                            }
                        }
                    )
                }
            } catch {
                lastFailedMessage = userMessage
                errorMessage = "Failed to send message: \(error.localizedDescription)"
                isStreaming = false
                streamingContent = ""
                print("⚠️ Error sending message: \(error)")
            }
        }
    }

    private func finalizeMessage(_ fullResponse: String) {
        guard !fullResponse.isEmpty else {
            isStreaming = false
            streamingContent = ""
            return
        }

        // Create assistant message
        let assistantMessage = Message(
            id: UUID().uuidString,
            role: "assistant",
            content: fullResponse,
            timestamp: Date()
        )

        messages.append(assistantMessage)

        // Clear streaming state
        isStreaming = false
        streamingContent = ""

        // Reload messages from database to ensure consistency
        if let convId = currentConversationId {
            loadConversation(id: convId)
        }

        print("✅ Message finalized")
    }
}
