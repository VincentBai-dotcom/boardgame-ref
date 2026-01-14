//
//  APIEndpoint.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

enum APIEndpoint {
    // Authentication
    case register(email: String, password: String)
    case login(email: String, password: String)
    case refreshToken(refreshToken: String)
    case logout

    // User
    case getUser

    // Chat
    case newChat(message: String)
    case continueChat(id: String, message: String)
    case getChatMessages(id: String)

    // Conversations
    case getConversations
    case getConversation(id: String)
    case updateConversation(id: String, title: String)
    case deleteConversation(id: String)

    nonisolated var path: String {
        switch self {
        case .register:
            return "/auth/register"
        case .login:
            return "/auth/login"
        case .refreshToken:
            return "/auth/refresh"
        case .logout:
            return "/auth/logout"
        case .getUser:
            return "/user/me"
        case .newChat:
            return "/chat/new"
        case .continueChat(let id, _):
            return "/chat/continue/\(id)"
        case .getChatMessages(let id):
            return "/chat/messages/\(id)"
        case .getConversations:
            return "/chat/conversations"
        case .getConversation(let id):
            return "/chat/conversations/\(id)"
        case .updateConversation(let id, _):
            return "/chat/conversations/\(id)"
        case .deleteConversation(let id):
            return "/chat/conversations/\(id)"
        }
    }

    nonisolated var method: String {
        switch self {
        case .register, .login, .refreshToken, .logout, .newChat, .continueChat:
            return "POST"
        case .getUser, .getChatMessages, .getConversations, .getConversation:
            return "GET"
        case .updateConversation:
            return "PATCH"
        case .deleteConversation:
            return "DELETE"
        }
    }

    nonisolated var requiresAuth: Bool {
        switch self {
        case .register, .login, .refreshToken:
            return false
        default:
            return true
        }
    }
}
