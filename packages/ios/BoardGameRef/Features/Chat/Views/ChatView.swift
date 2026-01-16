//
//  ChatView.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/6/26.
//

import SwiftUI
import SwiftData

struct ChatView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(AuthenticationState.self) private var authState
    @Environment(TokenManager.self) private var tokenManager
    @Environment(NetworkMonitor.self) private var networkMonitor

    @State private var viewModel: ChatViewModel
    @State private var isSidebarOpen = false
    @State private var conversationService: ConversationService

    init() {
        // Initialize services - will be updated in onAppear with environment values
        let tempTokenManager = TokenManager()
        let tempHttpClient = HTTPClient(tokenManager: tempTokenManager)
        let tempModelContext = ModelContainer.shared.mainContext
        let tempAuthState = AuthenticationState(tokenManager: tempTokenManager)
        let tempAuthService = AuthService(
            httpClient: tempHttpClient,
            tokenManager: tempTokenManager,
            modelContext: tempModelContext
        )

        _conversationService = State(initialValue: ConversationService(
            httpClient: tempHttpClient,
            modelContext: tempModelContext
        ))

        _viewModel = State(initialValue: ChatViewModel(
            chatService: ChatService(
                httpClient: tempHttpClient,
                modelContext: tempModelContext,
                tokenManager: tempTokenManager
            ),
            conversationService: ConversationService(
                httpClient: tempHttpClient,
                modelContext: tempModelContext
            ),
            modelContext: tempModelContext,
            authService: tempAuthService,
            authState: tempAuthState
        ))
    }

    var body: some View {
        ZStack {
            // Main chat interface
            VStack(spacing: 0) {
                // Navigation bar
                ChatNavigationBar(
                    isSidebarOpen: $isSidebarOpen,
                    title: "BoardGameRef"
                )

                // Offline indicator
                if !networkMonitor.isConnected {
                    HStack {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 14))
                        Text("You're offline. Messages cached locally.")
                            .font(.system(size: 14))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.orange)
                }

                // Chat messages area
                ScrollViewReader { proxy in
                    ScrollView {
                        if viewModel.messages.isEmpty && !viewModel.isStreaming {
                            // Empty state
                            VStack(spacing: 16) {
                                Text("Start a conversation")
                                    .font(.system(size: 17))
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding()
                        } else {
                            // Messages
                            LazyVStack(spacing: 16, pinnedViews: []) {
                                ForEach(viewModel.messages) { message in
                                    if message.role == "user" {
                                        UserMessageBubble(message: message.content)
                                            .id(message.id)
                                    } else {
                                        AssistantMessageBlock(message: message.content)
                                            .id(message.id)
                                    }
                                }

                                // Streaming message or typing indicator
                                if viewModel.isStreaming {
                                    if viewModel.streamingContent.isEmpty {
                                        // Typing indicator when waiting for response
                                        HStack(alignment: .top, spacing: 0) {
                                            HStack(spacing: 6) {
                                                Circle()
                                                    .fill(Color.secondary.opacity(0.5))
                                                    .frame(width: 8, height: 8)
                                                    .scaleEffect(viewModel.isStreaming ? 1.0 : 0.5)
                                                    .animation(
                                                        Animation.easeInOut(duration: 0.6)
                                                            .repeatForever()
                                                            .delay(0),
                                                        value: viewModel.isStreaming
                                                    )
                                                Circle()
                                                    .fill(Color.secondary.opacity(0.5))
                                                    .frame(width: 8, height: 8)
                                                    .scaleEffect(viewModel.isStreaming ? 1.0 : 0.5)
                                                    .animation(
                                                        Animation.easeInOut(duration: 0.6)
                                                            .repeatForever()
                                                            .delay(0.2),
                                                        value: viewModel.isStreaming
                                                    )
                                                Circle()
                                                    .fill(Color.secondary.opacity(0.5))
                                                    .frame(width: 8, height: 8)
                                                    .scaleEffect(viewModel.isStreaming ? 1.0 : 0.5)
                                                    .animation(
                                                        Animation.easeInOut(duration: 0.6)
                                                            .repeatForever()
                                                            .delay(0.4),
                                                        value: viewModel.isStreaming
                                                    )
                                            }
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                            Spacer(minLength: 60)
                                        }
                                        .id("streaming")
                                    } else {
                                        // Actual streaming content
                                        AssistantMessageBlock(message: viewModel.streamingContent)
                                            .id("streaming")
                                            .transition(.opacity)
                                    }
                                }
                            }
                            .padding(.top, 16)
                        }
                    }
                    .onChange(of: viewModel.messages.count) { _, _ in
                        if let lastMessage = viewModel.messages.last {
                            withAnimation {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                    .onChange(of: viewModel.streamingContent) { _, _ in
                        if viewModel.isStreaming {
                            withAnimation {
                                proxy.scrollTo("streaming", anchor: .bottom)
                            }
                        }
                    }
                }

                // Error message with retry
                if let error = viewModel.errorMessage {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                            .font(.system(size: 14))
                        Text(error)
                            .font(.system(size: 14))
                            .foregroundColor(.red)
                            .lineLimit(2)
                        Spacer()
                        Button("Retry") {
                            viewModel.retryLastMessage()
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.blue)
                        .padding(.horizontal, 8)

                        Button("Dismiss") {
                            viewModel.errorMessage = nil
                        }
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.red.opacity(0.1))
                }

                // Input box at the bottom
                ChatInputBox(
                    text: $viewModel.inputText,
                    onSend: {
                        if !networkMonitor.isConnected {
                            viewModel.errorMessage = "No internet connection. Please check your network and try again."
                        } else {
                            viewModel.sendMessage()
                        }
                    },
                    isDisabled: viewModel.isStreaming || !networkMonitor.isConnected
                )
            }
            .background(Color(UIColor.systemBackground))

            // Sidebar drawer overlay
            SidebarDrawer(
                isOpen: $isSidebarOpen,
                conversationService: conversationService,
                onSelectConversation: { conversationId in
                    viewModel.selectConversation(id: conversationId)
                },
                onNewChat: {
                    viewModel.startNewConversation()
                },
                onLogout: {
                    try await viewModel.logout()
                }
            )
        }
        .dismissKeyboardOnTap()
        .onChange(of: isSidebarOpen) { _, newValue in
            if newValue {
                // Dismiss keyboard when sidebar opens
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil,
                    from: nil,
                    for: nil
                )
            }
        }
        .onChange(of: viewModel.inputText) { _, _ in
            viewModel.saveDraft()
        }
        .onAppear {
            // Reinitialize services with environment values
            let httpClient = HTTPClient(tokenManager: tokenManager)
            let authService = AuthService(
                httpClient: httpClient,
                tokenManager: tokenManager,
                modelContext: modelContext
            )

            conversationService = ConversationService(
                httpClient: httpClient,
                modelContext: modelContext
            )

            viewModel = ChatViewModel(
                chatService: ChatService(
                    httpClient: httpClient,
                    modelContext: modelContext,
                    tokenManager: tokenManager
                ),
                conversationService: conversationService,
                modelContext: modelContext,
                authService: authService,
                authState: authState
            )
        }
    }
}

#Preview {
    let tokenManager = TokenManager()
    let authState = AuthenticationState(tokenManager: tokenManager)

    ChatView()
        .modelContainer(ModelContainer.shared)
        .environment(authState)
        .environment(tokenManager)
        .environment(NetworkMonitor())
}
