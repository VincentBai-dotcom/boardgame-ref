//
//  AuthService.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

@Observable
class AuthService {
    private let httpClient: HTTPClient
    private let tokenManager: TokenManager
    private let modelContext: ModelContext

    init(httpClient: HTTPClient, tokenManager: TokenManager, modelContext: ModelContext) {
        self.httpClient = httpClient
        self.tokenManager = tokenManager
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func register(email: String, password: String) async throws -> User {
        let request = RegisterRequest(email: email, password: password)

        let response: RegisterResponse = try await httpClient.request(
            endpoint: .register(email: email, password: password),
            body: request
        )

        // Save tokens
        try tokenManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)

        // Fetch user data separately
        let userDTO: UserDTO = try await httpClient.request(endpoint: .getUser)

        // Create and save user to SwiftData
        let user = User(
            id: userDTO.id,
            email: userDTO.email,
            emailVerified: userDTO.emailVerified ?? false,
            role: userDTO.role.rawValue,
            oauthProvider: userDTO.oauthProvider,
            oauthProviderUserId: userDTO.oauthProviderUserId,
            createdAt: userDTO.createdAt ?? Date(),
            updatedAt: userDTO.updatedAt,
            lastLoginAt: userDTO.lastLoginAt
        )

        modelContext.insert(user)
        try modelContext.save()

        print("✅ User registered successfully: \(userDTO.email)")
        return user
    }

    func login(email: String, password: String) async throws -> User {
        let request = LoginRequest(email: email, password: password)

        let response: LoginResponse = try await httpClient.request(
            endpoint: .login(email: email, password: password),
            body: request
        )
        
        print("✅ Login response: accessToken=\(response.accessToken.prefix(10))..., refreshToken=\(response.refreshToken.prefix(10))...")

        // Save tokens
        try tokenManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)

        // Fetch user data separately
        let userDTO: UserDTO = try await httpClient.request(endpoint: .getUser)

        // Check if user exists locally
        let userId = userDTO.id
        let descriptor = FetchDescriptor<User>()
        let existingUsers = try modelContext.fetch(descriptor)
            .filter { $0.id == userId }

        let user: User
        if let existingUser = existingUsers.first {
            // Update existing user with latest data from server
            existingUser.email = userDTO.email
            existingUser.emailVerified = userDTO.emailVerified ?? false
            existingUser.role = userDTO.role.rawValue
            existingUser.oauthProvider = userDTO.oauthProvider
            existingUser.oauthProviderUserId = userDTO.oauthProviderUserId
            existingUser.updatedAt = userDTO.updatedAt
            existingUser.lastLoginAt = userDTO.lastLoginAt
            user = existingUser
        } else {
            // Create new user
            user = User(
                id: userDTO.id,
                email: userDTO.email,
                emailVerified: userDTO.emailVerified ?? false,
                role: userDTO.role.rawValue,
                oauthProvider: userDTO.oauthProvider,
                oauthProviderUserId: userDTO.oauthProviderUserId,
                createdAt: userDTO.createdAt ?? Date(),
                updatedAt: userDTO.updatedAt,
                lastLoginAt: userDTO.lastLoginAt
            )
            modelContext.insert(user)
        }

        try modelContext.save()

        print("✅ User logged in successfully: \(email)")
        return user
    }

    func logout() async throws {
        // Call backend logout endpoint
        try await httpClient.requestWithoutResponse(endpoint: .logout)

        // Clear tokens
        try tokenManager.clearTokens()

        print("✅ User logged out successfully")
    }

    func getCurrentUser() async throws -> UserDTO {
        let userDTO: UserDTO = try await httpClient.request(endpoint: .getUser)
        return userDTO
    }
}
