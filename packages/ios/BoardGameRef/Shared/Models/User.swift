//
//  User.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Model
final class User {
    @Attribute(.unique) var id: String
    var email: String
    var username: String
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \Conversation.user)
    var conversations: [Conversation]?

    init(id: String, email: String, username: String, createdAt: Date) {
        self.id = id
        self.email = email
        self.username = username
        self.createdAt = createdAt
    }
}
