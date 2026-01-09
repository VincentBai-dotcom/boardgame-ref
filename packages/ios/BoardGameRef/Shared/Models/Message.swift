//
//  Message.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Model
final class Message {
    @Attribute(.unique) var id: String
    var role: String // "user" or "assistant"
    var content: String
    var timestamp: Date

    var conversation: Conversation?

    init(id: String, role: String, content: String, timestamp: Date) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }
}
