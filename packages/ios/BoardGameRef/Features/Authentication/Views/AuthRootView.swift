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
    @State private var showLogin = true
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
        VStack(spacing: 0) {
            Spacer()

            // App branding
            VStack(spacing: 8) {
                Text("BoardGameRef")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.primary)

                Text("Your AI Board Game Assistant")
                    .font(.system(size: 16))
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 48)

            // Auth forms
            if showLogin {
                LoginView(
                    authService: authService,
                    authState: authState,
                    networkMonitor: networkMonitor,
                    onSwitchToRegister: {
                        withAnimation {
                            showLogin = false
                        }
                    }
                )
            } else {
                RegisterView(
                    authService: authService,
                    authState: authState,
                    networkMonitor: networkMonitor,
                    onSwitchToLogin: {
                        withAnimation {
                            showLogin = true
                        }
                    }
                )
            }

            Spacer()
        }
        .padding(.horizontal, 24)
        .background(Color(UIColor.systemBackground))
    }
}

#Preview {
    let tokenManager = TokenManager()
    let authState = AuthenticationState(tokenManager: tokenManager)
    AuthRootView(tokenManager: tokenManager, authState: authState)
        .modelContainer(ModelContainer.shared)
        .environment(NetworkMonitor())
}
