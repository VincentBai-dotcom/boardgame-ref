//
//  ChatNavigationBar.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/7/26.
//

import SwiftUI

struct ChatNavigationBar: View {
    @Binding var isSidebarOpen: Bool
    var title: String

    var body: some View {
        HStack(spacing: 12) {
            // Menu button (left)
            Button(action: {
                withAnimation(.easeInOut(duration: 0.3)) {
                    isSidebarOpen.toggle()
                }
            }) {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44)
            }

            // Title (center)
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Right side buttons (optional - can add more actions here)
            Button(action: {
                // New chat action
            }) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.primary)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(Color(UIColor.systemBackground))
    }
}

#Preview {
    ChatNavigationBar(isSidebarOpen: .constant(false), title: "BoardGameRef")
}
