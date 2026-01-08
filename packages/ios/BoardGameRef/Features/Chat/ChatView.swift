//
//  ChatView.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/6/26.
//

import SwiftUI

struct ChatView: View {
    @State private var messageText = ""
    @State private var isSidebarOpen = false

    var body: some View {
        ZStack {
            // Main chat interface
            VStack(spacing: 0) {
                // Navigation bar
                ChatNavigationBar(
                    isSidebarOpen: $isSidebarOpen,
                    title: "BoardGameRef"
                )

                // Chat messages area
                ScrollView {
                    VStack(spacing: 16) {
                        // Placeholder for messages
                        Text("Start a conversation")
                            .font(.system(size: 17))
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding()
                    }
                }

                // Input box at the bottom
                ChatInputBox(text: $messageText) {
                    // Handle send
                    print("Sending: \(messageText)")
                    messageText = ""
                }
            }
            .background(Color(UIColor.systemBackground))

            // Sidebar drawer overlay
            SidebarDrawer(isOpen: $isSidebarOpen)
        }
    }
}

#Preview {
    ChatView()
}
