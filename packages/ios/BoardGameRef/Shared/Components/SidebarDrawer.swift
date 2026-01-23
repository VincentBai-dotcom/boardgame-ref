//
//  SidebarDrawer.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/7/26.
//

import SwiftUI
import SwiftData

struct SidebarDrawer: View {
    @Binding var isOpen: Bool
    @Query(sort: \Conversation.updatedAt, order: .reverse) private var conversations: [Conversation]
    @Environment(\.modelContext) private var modelContext

    let onSelectConversation: (String) -> Void
    let onNewChat: () -> Void
    let onLogout: () async throws -> Void

    @State private var errorMessage: String?
    @State private var isLoggingOut = false

    private let conversationService: ConversationService

    init(
        isOpen: Binding<Bool>,
        conversationService: ConversationService,
        onSelectConversation: @escaping (String) -> Void,
        onNewChat: @escaping () -> Void,
        onLogout: @escaping () async throws -> Void
    ) {
        self._isOpen = isOpen
        self.conversationService = conversationService
        self.onSelectConversation = onSelectConversation
        self.onNewChat = onNewChat
        self.onLogout = onLogout
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background overlay
                if isOpen {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                isOpen = false
                            }
                        }
                }

                // Sidebar content
                HStack(spacing: 0) {
                    // Sidebar panel
                    VStack(spacing: 0) {
                        // Header
                        HStack {
                            Text("Conversations")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(.primary)
                            Spacer()
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    isOpen = false
                                }
                            }) {
                                Image(systemName: "xmark")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(.secondary)
                                    .frame(width: 32, height: 32)
                            }
                        }
                        .padding()
                        .background(Color(.systemBackground))

                        Divider()

                        // New Chat Button
                        Button(action: {
                            onNewChat()
                            withAnimation(.easeInOut(duration: 0.3)) {
                                isOpen = false
                            }
                        }) {
                            HStack {
                                Image(systemName: "square.and.pencil")
                                    .font(.system(size: 16, weight: .medium))
                                Text("New Chat")
                                    .font(.system(size: 16, weight: .medium))
                                Spacer()
                            }
                            .foregroundColor(.blue)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)

                        Divider()

                        // Error message with retry
                        if let error = errorMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                    .font(.system(size: 12))
                                Text(error)
                                    .font(.system(size: 12))
                                    .foregroundColor(.red)
                                    .lineLimit(2)
                                Spacer()
                                Button("Retry") {
                                    Task {
                                        await refreshConversations()
                                    }
                                }
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.blue)

                                Button("Dismiss") {
                                    errorMessage = nil
                                }
                                .font(.system(size: 12))
                                .foregroundColor(.secondary)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.red.opacity(0.1))
                        }

                        // Conversation list
                        ScrollView {
                            // Note: .refreshable handles the loading indicator automatically

                            if conversations.isEmpty {
                                // Empty state
                                VStack(spacing: 12) {
                                    Image(systemName: "bubble.left.and.bubble.right")
                                        .font(.system(size: 48))
                                        .foregroundColor(.secondary)
                                    Text("No conversations yet")
                                        .font(.system(size: 16))
                                        .foregroundColor(.secondary)
                                    Text("Start a new chat to begin")
                                        .font(.system(size: 14))
                                        .foregroundColor(.secondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 60)
                            } else {
                                VStack(spacing: 0) {
                                    ForEach(conversations) { conversation in
                                        Button(action: {
                                            onSelectConversation(conversation.id)
                                            withAnimation(.easeInOut(duration: 0.3)) {
                                                isOpen = false
                                            }
                                        }) {
                                            HStack {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    Text(conversation.title)
                                                        .font(.system(size: 15))
                                                        .foregroundColor(.primary)
                                                        .lineLimit(2)
                                                        .multilineTextAlignment(.leading)

                                                    Text(timeAgo(from: conversation.updatedAt))
                                                        .font(.system(size: 13))
                                                        .foregroundColor(.secondary)
                                                }
                                                Spacer()
                                            }
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 12)
                                            .contentShape(Rectangle())
                                        }
                                        .buttonStyle(PlainButtonStyle())

                                        Divider()
                                            .padding(.leading, 16)
                                    }
                                }
                            }
                        }
                        .refreshable {
                            await refreshConversations()
                        }
                        .background(Color(.systemBackground))
                        
                        // Logout Button at bottom
                        Divider()
                        
                        Button(action: {
                            Task {
                                await handleLogout()
                            }
                        }) {
                            HStack {
                                if isLoggingOut {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle())
                                        .scaleEffect(0.8)
                                } else {
                                    Image(systemName: "rectangle.portrait.and.arrow.right")
                                        .font(.system(size: 16, weight: .medium))
                                }
                                Text(isLoggingOut ? "Logging out..." : "Log Out")
                                    .font(.system(size: 16, weight: .medium))
                                Spacer()
                            }
                            .foregroundColor(.red)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }
                        .disabled(isLoggingOut)
                        .background(Color(.systemBackground))
                    }
                    .frame(width: geometry.size.width * 0.8)
                    .background(Color(UIColor.systemBackground))
                    .offset(x: isOpen ? 0 : -geometry.size.width * 0.8)

                    Spacer()
                }
            }
        }
    }

    private func timeAgo(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func refreshConversations() async {
        // Don't set @State here - it triggers SwiftUI re-render which cancels the .refreshable Task!
        // The .refreshable modifier handles the loading indicator automatically.

        do {
            _ = try await conversationService.fetchConversations()
        } catch {
            if let urlError = error as? URLError, urlError.code == .cancelled {
                // Refresh was cancelled (e.g., user navigated away) - ignore silently
                return
            }
            await MainActor.run {
                errorMessage = "Failed to refresh: \(error.localizedDescription)"
            }
        }
    }
    
    private func handleLogout() async {
        isLoggingOut = true
        errorMessage = nil
        
        do {
            try await onLogout()
            print("✅ Logout successful")
            // Close sidebar after successful logout
            withAnimation(.easeInOut(duration: 0.3)) {
                isOpen = false
            }
        } catch {
            errorMessage = "Failed to logout: \(error.localizedDescription)"
            print("⚠️ Error logging out: \(error)")
        }
        
        isLoggingOut = false
    }
}

#Preview {
    let tokenManager = TokenManager()
    let apiClient = APIClient(tokenManager: tokenManager)
    let modelContext = ModelContainer.shared.mainContext
    let conversationService = ConversationService(
        apiClient: apiClient,
        modelContext: modelContext
    )

    SidebarDrawer(
        isOpen: .constant(true),
        conversationService: conversationService,
        onSelectConversation: { _ in },
        onNewChat: { },
        onLogout: {
            print("Logout called")
        }
    )
    .modelContainer(ModelContainer.shared)
}
