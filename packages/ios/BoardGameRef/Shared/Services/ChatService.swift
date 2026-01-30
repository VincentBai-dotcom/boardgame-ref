//
//  ChatService.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData
import OpenAPIRuntime

@Observable
class ChatService {
    private let apiClient: APIClient
    private let sseClient = SSEClient()
    private let modelContext: ModelContext
    private let tokenManager: TokenManager

    init(apiClient: APIClient, modelContext: ModelContext, tokenManager: TokenManager) {
        self.apiClient = apiClient
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
        let url = apiClient.serverURL.appendingPathComponent("chat/new")

        let body = try JSONEncoder().encode(["userText": message])

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
        let url = apiClient.serverURL.appendingPathComponent("chat/continue/\(conversationId)")

        let body = try JSONEncoder().encode(["userText": message])

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

    func getMessages(conversationId: String) async throws -> [MessageDTO] {
        let output = try await apiClient.client.getChatMessagesById(
            path: .init(id: conversationId)
        )
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return payload.messages.map { mapMessagePayload($0) }
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .notFound(let notFound):
            let payload = try notFound.body.json
            throw APIError.serverError(404, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    /// Sync server messages to local SwiftData (replace all for conversation)
    @MainActor
    func syncMessagesToLocal(conversationId: String, serverMessages: [MessageDTO]) throws {
        // Get conversation
        let descriptor = FetchDescriptor<Conversation>()
        guard let conversation = try modelContext.fetch(descriptor)
            .first(where: { $0.id == conversationId }) else {
            print("⚠️ Conversation \(conversationId) not found locally")
            return
        }

        // Delete existing messages for this conversation
        let existingMessages = conversation.messages ?? []
        for msg in existingMessages {
            modelContext.delete(msg)
        }

        // Insert fresh messages from server
        for (index, messageDTO) in serverMessages.enumerated() {
            // Extract text content from content array
            let textContent = messageDTO.content.compactMap { item -> String? in
                switch item {
                case MessageContentDTO.text(let string):
                    return string
                default:
                    return nil
                }
            }.joined(separator: " ")

            let msg = Message(
                id: "\(conversationId)-\(index)",
                role: messageDTO.role,
                content: textContent,
                timestamp: Date()
            )
            msg.conversation = conversation
            modelContext.insert(msg)
        }

        try modelContext.save()
        print("✅ Synced \(serverMessages.count) messages to local DB for \(conversationId)")
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

    // MARK: - Mapping

    private func mapMessagePayload(
        _ payload: Operations.getChatMessagesById.Output.Ok.Body.jsonPayload.messagesPayloadPayload
    ) -> MessageDTO {
        let contentItems: [MessageContentDTO] = payload.content.compactMap { item in
            if let value1 = item.value1 {
                return .text(value1.text)
            }
            if let value2 = item.value2 {
                return .image(imageUrl: value2.imageUrl, alt: value2.alt)
            }
            if let value3 = item.value3 {
                let arguments = Self.toAnyCodableDictionary(from: value3.arguments)
                return .toolCall(
                    toolCallId: value3.toolCallId,
                    toolName: value3.toolName,
                    arguments: arguments
                )
            }
            if let value4 = item.value4 {
                let result = Self.toAnyCodable(from: value4.result)
                return .toolResult(
                    toolCallId: value4.toolCallId,
                    toolName: value4.toolName,
                    result: result
                )
            }
            return nil
        }

        return MessageDTO(
            role: payload.role.rawValue,
            content: contentItems,
            metadata: payload.metadata.map { MessageMetadata(provider: $0.provider) }
        )
    }

    private static func toAnyCodableDictionary(
        from container: OpenAPIRuntime.OpenAPIObjectContainer
    ) -> [String: AnyCodable] {
        container.value.mapValues { value in
            AnyCodable(unwrapOpenAPIValue(value))
        }
    }

    private static func toAnyCodable(
        from container: OpenAPIRuntime.OpenAPIValueContainer
    ) -> AnyCodable {
        AnyCodable(unwrapOpenAPIValue(container.value))
    }

    private static func unwrapOpenAPIValue(_ value: (any Sendable)?) -> Any {
        guard let value else { return NSNull() }
        if let string = value as? String { return string }
        if let int = value as? Int { return int }
        if let double = value as? Double { return double }
        if let bool = value as? Bool { return bool }
        if let array = value as? [(any Sendable)?] {
            return array.map { unwrapOpenAPIValue($0) }
        }
        if let dict = value as? [String: (any Sendable)?] {
            return dict.mapValues { unwrapOpenAPIValue($0) }
        }
        return NSNull()
    }
}
