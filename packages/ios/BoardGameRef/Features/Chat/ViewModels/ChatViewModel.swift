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
    private let authService: AuthService
    private let authState: AuthenticationState
    private var lastFailedMessage: String?

    init(
        chatService: ChatService,
        conversationService: ConversationService,
        modelContext: ModelContext,
        authService: AuthService,
        authState: AuthenticationState
    ) {
        self.chatService = chatService
        self.conversationService = conversationService
        self.modelContext = modelContext
        self.authService = authService
        self.authState = authState
    }

    // MARK: - Public Methods

    func selectConversation(id: String) {
        currentConversationId = id
        errorMessage = nil

        // Read from local SwiftData cache
        loadLocalMessages(conversationId: id)

        // Load draft for this conversation
        inputText = getConversation(id: id)?.draftMessage ?? ""
    }

    func saveDraft() {
        guard let convId = currentConversationId,
              let conversation = getConversation(id: convId) else { return }
        let draft = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        conversation.draftMessage = draft.isEmpty ? nil : draft
        try? modelContext.save()
    }

    func clearDraft() {
        guard let convId = currentConversationId,
              let conversation = getConversation(id: convId) else { return }
        conversation.draftMessage = nil
        try? modelContext.save()
    }

    private func getConversation(id: String) -> Conversation? {
        let descriptor = FetchDescriptor<Conversation>()
        let conversations = try? modelContext.fetch(descriptor)
        return conversations?.first { $0.id == id }
    }

    private func loadLocalMessages(conversationId: String) {
        let descriptor = FetchDescriptor<Message>(
            predicate: #Predicate { $0.conversation?.id == conversationId },
            sortBy: [SortDescriptor(\.timestamp, order: .forward)]
        )

        do {
            messages = try modelContext.fetch(descriptor)
            print("📦 Loaded \(messages.count) messages from local cache")
        } catch {
            print("⚠️ Error loading local messages: \(error)")
        }
    }

    func sendMessage() {
        guard !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        let userMessage = inputText
        inputText = ""
        clearDraft()
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
    
    func logout() async throws {
        // Call backend logout endpoint
        try await authService.logout()
        
        // Clear local state
        currentConversationId = nil
        messages = []
        inputText = ""
        streamingContent = ""
        errorMessage = nil
        
        // Update authentication state
        authState.logout()
        
        print("✅ User logged out successfully")
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
            selectConversation(id: convId)
        }

        print("✅ Message finalized")
    }
}
