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
    let username: String
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

// MARK: - Response DTOs

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: UserDTO
}

struct UserDTO: Decodable {
    let id: String
    let email: String
    let username: String
    let createdAt: String
}

struct RefreshTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}
