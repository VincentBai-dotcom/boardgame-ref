//
//  ConversationService.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Observable
class ConversationService {
    private let apiClient: APIClient
    private let modelContext: ModelContext

    init(apiClient: APIClient, modelContext: ModelContext) {
        self.apiClient = apiClient
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func fetchConversations() async throws -> [Conversation] {
        let output = try await apiClient.client.getChatConversations(.init())
        let payloads: [Operations.getChatConversations.Output.Ok.Body.jsonPayloadPayload]
        switch output {
        case .ok(let ok):
            payloads = try ok.body.json
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }

        // Sync with local database
        for payload in payloads {
            let descriptor = FetchDescriptor<Conversation>()
            let existing = try modelContext.fetch(descriptor)
                .first { $0.id == payload.id }

            let createdAt = Self.parseDate(from: payload.createdAt)
            let updatedAt = Self.parseDate(from: payload.updatedAt)

            if let conv = existing {
                // Update existing
                conv.title = payload.title
                conv.updatedAt = updatedAt
            } else {
                // Create new
                let conv = Conversation(
                    id: payload.id,
                    title: payload.title,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                )
                modelContext.insert(conv)
            }
        }

        try modelContext.save()

        // Return local conversations sorted by date
        let descriptor = FetchDescriptor<Conversation>(
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    func deleteConversation(id: String) async throws {
        let output = try await apiClient.client.deleteChatConversationsById(
            path: .init(id: id)
        )
        switch output {
        case .noContent:
            break
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .notFound(let error):
            let payload = try error.body.json
            throw APIError.serverError(404, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }

        // Delete locally
        let descriptor = FetchDescriptor<Conversation>()
        if let conv = try modelContext.fetch(descriptor)
            .first(where: { $0.id == id }) {
            modelContext.delete(conv)
            try modelContext.save()
        }

        print("✅ Conversation deleted")
    }

    func getLocalConversations() throws -> [Conversation] {
        let descriptor = FetchDescriptor<Conversation>(
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        return try modelContext.fetch(descriptor)
    }

    private static func parseDate(
        from payload: Operations.getChatConversations.Output.Ok.Body.jsonPayloadPayload.createdAtPayload
    ) -> Date {
        if let date = payload.value1 {
            return date
        }
        if let string = payload.value2 {
            let formatter = ISO8601DateFormatter()
            if let parsed = formatter.date(from: string) {
                return parsed
            }
        }
        if let number = payload.value3 {
            return Date(timeIntervalSince1970: number)
        }
        return Date()
    }

    private static func parseDate(
        from payload: Operations.getChatConversations.Output.Ok.Body.jsonPayloadPayload.updatedAtPayload
    ) -> Date {
        if let date = payload.value1 {
            return date
        }
        if let string = payload.value2 {
            let formatter = ISO8601DateFormatter()
            if let parsed = formatter.date(from: string) {
                return parsed
            }
        }
        if let number = payload.value3 {
            return Date(timeIntervalSince1970: number)
        }
        return Date()
    }
}
