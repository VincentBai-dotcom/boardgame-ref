//
//  BoardGameRefApp.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 12/16/25.
//

import SwiftUI
import SwiftData

@main
struct BoardGameRefApp: App {
    @Environment(\.scenePhase) private var scenePhase

    @State private var tokenManager = TokenManager()
    @State private var authState: AuthenticationState
    @State private var networkMonitor = NetworkMonitor()
    @State private var syncService: SyncService?

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            User.self,
            Conversation.self,
            Message.self
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    init() {
        let tm = TokenManager()
        _tokenManager = State(initialValue: tm)
        _authState = State(initialValue: AuthenticationState(tokenManager: tm))
    }

    var body: some Scene {
        WindowGroup {
            if authState.isAuthenticated {
                ChatView()
                    .environment(authState)
                    .environment(tokenManager)
                    .environment(networkMonitor)
                    .onAppear {
                        initializeSyncService()
                    }
            } else {
                AuthRootView(tokenManager: tokenManager, authState: authState)
                    .environment(networkMonitor)
            }
        }
        .modelContainer(sharedModelContainer)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active && authState.isAuthenticated {
                syncService?.syncAll()
            }
        }
    }

    private func initializeSyncService() {
        guard syncService == nil else { return }
        let httpClient = HTTPClient(tokenManager: tokenManager)
        let modelContext = sharedModelContainer.mainContext
        let conversationService = ConversationService(
            httpClient: httpClient,
            modelContext: modelContext
        )
        let chatService = ChatService(
            httpClient: httpClient,
            modelContext: modelContext,
            tokenManager: tokenManager
        )
        syncService = SyncService(
            conversationService: conversationService,
            chatService: chatService
        )
        // Trigger initial sync
        syncService?.syncAll()
    }
}
