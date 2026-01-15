//
//  ChatService.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Observable
class ChatService {
    private let httpClient: HTTPClient
    private let sseClient = SSEClient()
    private let modelContext: ModelContext
    private let tokenManager: TokenManager
    private let baseURL = "http://localhost:3000"

    init(httpClient: HTTPClient, modelContext: ModelContext, tokenManager: TokenManager) {
        self.httpClient = httpClient
        self.modelContext = modelContext
        self.tokenManager = tokenManager
    }

    // MARK: - Public Methods

    func startNewChat(
        message: String,
        onConversationId: @escaping @Sendable (String) -> Void,
        onChunk: @escaping @Sendable (String) -> Void,
        onComplete: @escaping @Sendable (String) -> Void,
        onError: @escaping @Sendable (String) -> Void
    ) async throws {
        guard let url = URL(string: "\(baseURL)/chat/new") else {
            throw APIError.invalidURL
        }

        let request = NewChatRequest(userText: message)
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)

        var headers: [String: String] = [
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        ]

        if let accessToken = tokenManager.accessToken {
            headers["Authorization"] = "Bearer \(accessToken)"
        }

        var conversationId: String?
        var fullResponse = ""

        try await sseClient.connect(url: url, headers: headers, body: body) { event in
            switch event {
            case .conversationId(let id):
                conversationId = id
                onConversationId(id)

            case .textDelta(let chunk):
                fullResponse += chunk
                onChunk(fullResponse)

            case .done:
                onComplete(fullResponse)

            case .error(let errorMessage):
                onError(errorMessage)
            }
        }

        // Save messages to local database
        if let convId = conversationId {
            try saveMessagesToLocal(
                conversationId: convId,
                userMessage: message,
                assistantMessage: fullResponse
            )
        }
    }

    func continueChat(
        conversationId: String,
        message: String,
        onChunk: @escaping @Sendable (String) -> Void,
        onComplete: @escaping @Sendable (String) -> Void,
        onError: @escaping @Sendable (String) -> Void
    ) async throws {
        guard let url = URL(string: "\(baseURL)/chat/continue/\(conversationId)") else {
            throw APIError.invalidURL
        }

        let request = ContinueChatRequest(userText: message)
        let encoder = JSONEncoder()
        let body = try encoder.encode(request)

        var headers: [String: String] = [
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        ]

        if let accessToken = tokenManager.accessToken {
            headers["Authorization"] = "Bearer \(accessToken)"
        }

        var fullResponse = ""

        try await sseClient.connect(url: url, headers: headers, body: body) { event in
            switch event {
            case .conversationId:
                // Already have conversation ID
                break

            case .textDelta(let chunk):
                fullResponse += chunk
                onChunk(fullResponse)

            case .done:
                onComplete(fullResponse)

            case .error(let errorMessage):
                onError(errorMessage)
            }
        }

        // Save messages to local database
        try saveMessagesToLocal(
            conversationId: conversationId,
            userMessage: message,
            assistantMessage: fullResponse
        )
    }

    func getMessages(conversationId: String) async throws -> [Message] {
        let response: GetMessagesResponse = try await httpClient.request(
            endpoint: .getChatMessages(id: conversationId)
        )

        // Convert DTOs to local messages and save
        var messages: [Message] = []

        for messageDTO in response.messages {
            // Extract text content from content array
            let textContent = messageDTO.content.compactMap { item -> String? in
                switch item {
                case MessageContentDTO.text(let string):
                    return string
                default:
                    return nil
                }
            }.joined(separator: " ")

            let message = Message(
                id: UUID().uuidString,
                role: messageDTO.role,
                content: textContent,
                timestamp: Date()
            )

            messages.append(message)
        }

        return messages
    }

    // MARK: - Private Methods

    private func saveMessagesToLocal(
        conversationId: String,
        userMessage: String,
        assistantMessage: String
    ) throws {
        let descriptor = FetchDescriptor<Conversation>()

        let conversation: Conversation
        if let existing = try modelContext.fetch(descriptor)
            .first(where: { $0.id == conversationId }) {
            conversation = existing
        } else {
            // Create new conversation
            conversation = Conversation(
                id: conversationId,
                title: "New conversation",
                createdAt: Date(),
                updatedAt: Date()
            )
            modelContext.insert(conversation)
        }

        // Save user message
        let userMsg = Message(
            id: UUID().uuidString,
            role: "user",
            content: userMessage,
            timestamp: Date()
        )
        userMsg.conversation = conversation
        modelContext.insert(userMsg)

        // Save assistant message
        let assistantMsg = Message(
            id: UUID().uuidString,
            role: "assistant",
            content: assistantMessage,
            timestamp: Date()
        )
        assistantMsg.conversation = conversation
        modelContext.insert(assistantMsg)

        // Update conversation timestamp
        conversation.updatedAt = Date()

        try modelContext.save()
        print("✅ Messages saved to local database")
    }
}

