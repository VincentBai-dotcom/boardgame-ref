//
//  AssistantMessageBlock.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/8/26.
//

import MarkdownUI
import SwiftUI

struct AssistantMessageBlock: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            Markdown(message)
                .markdownTextStyle(\.text) {
                    FontSize(16)
                }
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 60)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .onAppear {
            print("📝 Rendering markdown message: \(message.prefix(50))...")
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        AssistantMessageBlock(
            message: "Hello! I'm here to help you with your questions."
        )
        AssistantMessageBlock(
            message:
                "This text has **bold**, *italic*, and `inline code` formatting."
        )
        AssistantMessageBlock(
            message: "Here's a list:\n\n- Item 1\n- Item 2\n- Item 3"
        )
        AssistantMessageBlock(
            message:
                "Here's some code:\n\n```swift\nfunc example() {\n    print(\"Hello\")\n}\n```"
        )
        AssistantMessageBlock(message: "# fdsa")
    }
}
