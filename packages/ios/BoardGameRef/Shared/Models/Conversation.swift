//
//  Conversation.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Model
final class Conversation {
    @Attribute(.unique) var id: String
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var draftMessage: String?

    var user: User?

    @Relationship(deleteRule: .cascade, inverse: \Message.conversation)
    var messages: [Message]?

    init(id: String, title: String, createdAt: Date, updatedAt: Date, draftMessage: String? = nil) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.draftMessage = draftMessage
    }
}
