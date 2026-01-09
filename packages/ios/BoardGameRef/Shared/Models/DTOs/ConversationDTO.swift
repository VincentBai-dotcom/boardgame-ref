//
//  ConversationDTO.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

// MARK: - Response DTOs

struct ConversationDTO: Decodable {
    let id: String
    let userId: String
    let title: String
    let createdAt: String
    let updatedAt: String
}

// MARK: - Request DTOs

struct UpdateConversationRequest: Encodable {
    let title: String
}
