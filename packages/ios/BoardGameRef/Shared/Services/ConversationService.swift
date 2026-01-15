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
    private let httpClient: HTTPClient
    private let modelContext: ModelContext

    init(httpClient: HTTPClient, modelContext: ModelContext) {
        self.httpClient = httpClient
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func fetchConversations() async throws -> [Conversation] {
        // Fetch from backend
        let conversations: [ConversationDTO] = try await httpClient.request(
            endpoint: .getConversations
        )

        // Sync with local database
        for dto in conversations {
            let descriptor = FetchDescriptor<Conversation>()
            let existing = try modelContext.fetch(descriptor)
                .first { $0.id == dto.id }

            if let conv = existing {
                // Update existing
                conv.title = dto.title
                conv.updatedAt = dto.updatedAt
            } else {
                // Create new
                let conv = Conversation(
                    id: dto.id,
                    title: dto.title,
                    createdAt: dto.createdAt,
                    updatedAt: dto.updatedAt
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

    func updateConversation(id: String, title: String) async throws {
        // Update on backend
        try await httpClient.requestWithoutResponse(
            endpoint: .updateConversation(id: id, title: title),
            body: UpdateConversationRequest(title: title)
        )

        // Update locally
        let descriptor = FetchDescriptor<Conversation>()
        if let conv = try modelContext.fetch(descriptor)
            .first(where: { $0.id == id }) {
            conv.title = title
            conv.updatedAt = Date()
            try modelContext.save()
        }

        print("✅ Conversation updated: \(title)")
    }

    func deleteConversation(id: String) async throws {
        // Delete on backend
        try await httpClient.requestWithoutResponse(
            endpoint: .deleteConversation(id: id)
        )

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
}
