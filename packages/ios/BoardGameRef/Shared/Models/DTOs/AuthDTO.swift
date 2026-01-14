//
//  AuthDTO.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

// MARK: - Request DTOs

struct RegisterRequest: Encodable {
    let email: String
    let password: String
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

struct LogoutRequest: Encodable {
    let refreshToken: String
}

// MARK: - Response DTOs

struct LoginResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct RegisterResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct RefreshTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

// MARK: - User DTOs (separate endpoint)

enum UserRole: String, Decodable {
    case user
    case admin
}

struct UserDTO: Decodable {
    let id: String
    let email: String
    let emailVerified: Bool?
    let role: UserRole
    let oauthProvider: String?
    let oauthProviderUserId: String?
    let createdAt: Date?
    let updatedAt: Date?
    let lastLoginAt: Date?
}

// MARK: - Error Response

struct ErrorResponse: Decodable {
    let error: String
}
