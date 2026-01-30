//
//  AuthRootView.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import SwiftUI
import SwiftData

struct AuthRootView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(NetworkMonitor.self) private var networkMonitor
    @State private var tokenManager: TokenManager
    @State private var authState: AuthenticationState
    @State private var authService: AuthService

    init(tokenManager: TokenManager, authState: AuthenticationState) {
        _tokenManager = State(initialValue: tokenManager)
        _authState = State(initialValue: authState)
        // authService initialization will happen in onAppear
        _authService = State(initialValue: AuthService(
            apiClient: APIClient(tokenManager: tokenManager),
            tokenManager: tokenManager,
            modelContext: ModelContainer.shared.mainContext
        ))
    }

    var body: some View {
        AuthFlowView(
            authService: authService,
            authState: authState,
            networkMonitor: networkMonitor
        )
    }
}

#Preview {
    let tokenManager = TokenManager()
    let authState = AuthenticationState(tokenManager: tokenManager)
    AuthRootView(tokenManager: tokenManager, authState: authState)
        .modelContainer(ModelContainer.shared)
        .environment(NetworkMonitor())
}
