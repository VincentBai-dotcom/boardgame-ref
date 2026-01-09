//
//  ChatDTO.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

// MARK: - Request DTOs

struct NewChatRequest: Encodable {
    let userText: String
}

struct ContinueChatRequest: Encodable {
    let userText: String
}

// MARK: - Response DTOs

struct MessageContentDTO: Decodable {
    let type: String
    let text: String?
}

struct MessageDTO: Decodable {
    let role: String
    let content: [MessageContentDTO]
}

struct GetMessagesResponse: Decodable {
    let messages: [MessageDTO]
    let hasMore: Bool
}
