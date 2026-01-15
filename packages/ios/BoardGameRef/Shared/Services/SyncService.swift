//
//  SyncService.swift
//  BoardGameRef
//
//  Created by Claude on 1/15/26.
//

import Foundation

@Observable
@MainActor
class SyncService {
    private let conversationService: ConversationService
    private let chatService: ChatService
    private var isSyncing = false

    init(conversationService: ConversationService, chatService: ChatService) {
        self.conversationService = conversationService
        self.chatService = chatService
    }

    /// Call on app launch and when returning from background.
    /// Fire-and-forget: errors are logged, not surfaced to UI.
    func syncAll() {
        guard !isSyncing else {
            print("🔄 Sync already in progress, skipping")
            return
        }
        isSyncing = true

        Task.detached(priority: .utility) { [weak self] in
            await self?.performSync()
            await MainActor.run {
                self?.isSyncing = false
            }
        }
    }

    private func performSync() async {
        print("🔄 Background sync: starting...")

        // 1. Sync conversations list
        var conversations: [Conversation] = []
        do {
            conversations = try await conversationService.fetchConversations()
            print("✅ Background sync: \(conversations.count) conversations synced")
        } catch {
            print("⚠️ Background sync: conversations failed - \(error)")
            return
        }

        // 2. Sync messages for recent conversations 
        for conversation in conversations {
            do {
                let serverMessages = try await chatService.getMessages(conversationId: conversation.id)
                try await chatService.syncMessagesToLocal(conversationId: conversation.id, serverMessages: serverMessages)
                print("✅ Background sync: messages synced for \(conversation.id)")
            } catch {
                print("⚠️ Background sync: messages failed for \(conversation.id) - \(error)")
            }
        }

        print("✅ Background sync: complete")
    }
}
