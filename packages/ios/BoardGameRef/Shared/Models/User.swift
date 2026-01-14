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
    var emailVerified: Bool
    var role: String // "user" or "admin"
    var oauthProvider: String?
    var oauthProviderUserId: String?
    var createdAt: Date
    var updatedAt: Date?
    var lastLoginAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \Conversation.user)
    var conversations: [Conversation]?

    init(
        id: String,
        email: String,
        emailVerified: Bool = false,
        role: String = "user",
        oauthProvider: String? = nil,
        oauthProviderUserId: String? = nil,
        createdAt: Date,
        updatedAt: Date? = nil,
        lastLoginAt: Date? = nil
    ) {
        self.id = id
        self.email = email
        self.emailVerified = emailVerified
        self.role = role
        self.oauthProvider = oauthProvider
        self.oauthProviderUserId = oauthProviderUserId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.lastLoginAt = lastLoginAt
    }
    
    // Convenience computed property
    var isAdmin: Bool {
        role == "admin"
    }
}
