//
//  UserMessageBubble.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/8/26.
//

import SwiftUI

struct UserMessageBubble: View {
    let message: String

    var body: some View {
        HStack {
            Spacer(minLength: 60)

            Text(message)
                .font(.system(size: 16))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.blue)
                .cornerRadius(18)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }
}

#Preview {
    VStack(spacing: 12) {
        UserMessageBubble(message: "Hello, how are you?")
        UserMessageBubble(
            message:
                "This is a longer message that should wrap to multiple lines when it gets too long for a single line."
        )
        UserMessageBubble(message: "Short!")
    }
    .background(Color(UIColor.systemBackground))
}
