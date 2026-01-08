//
//  SidebarDrawer.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/7/26.
//

import SwiftUI

struct Conversation: Identifiable {
    let id = UUID()
    let title: String
    let timestamp: Date
}

struct SidebarDrawer: View {
    @Binding var isOpen: Bool
    @State private var conversations: [Conversation] = [
        Conversation(title: "Help me create a chat app", timestamp: Date()),
        Conversation(
            title: "SwiftUI navigation patterns",
            timestamp: Date().addingTimeInterval(-3600)
        ),
        Conversation(
            title: "iOS design best practices",
            timestamp: Date().addingTimeInterval(-7200)
        ),
        Conversation(
            title: "Debugging UIKit issues",
            timestamp: Date().addingTimeInterval(-86400)
        ),
        Conversation(
            title: "Understanding @State and @Binding",
            timestamp: Date().addingTimeInterval(-172800)
        ),
    ]

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
                    .background(Color(UIColor.systemBackground))

                    Divider()

                    // Conversation list
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(conversations) { conversation in
                                Button(action: {
                                    // Handle conversation selection
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

                                            Text(timeAgo(from: conversation.timestamp))
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
                    .background(Color(UIColor.systemBackground))
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
}

#Preview {
    SidebarDrawer(isOpen: .constant(true))
}
