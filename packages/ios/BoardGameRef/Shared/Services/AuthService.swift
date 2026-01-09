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

    func register(email: String, password: String, username: String) async throws -> User {
        let request = RegisterRequest(email: email, password: password, username: username)

        let response: AuthResponse = try await httpClient.request(
            endpoint: .register(email: email, password: password, username: username),
            body: request
        )

        // Save tokens
        try tokenManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)

        // Parse date
        let dateFormatter = ISO8601DateFormatter()
        let createdAt = dateFormatter.date(from: response.user.createdAt) ?? Date()

        // Create and save user to SwiftData
        let user = User(
            id: response.user.id,
            email: response.user.email,
            username: response.user.username,
            createdAt: createdAt
        )

        modelContext.insert(user)
        try modelContext.save()

        print("✅ User registered successfully: \(username)")
        return user
    }

    func login(email: String, password: String) async throws -> User {
        let request = LoginRequest(email: email, password: password)

        let response: AuthResponse = try await httpClient.request(
            endpoint: .login(email: email, password: password),
            body: request
        )

        // Save tokens
        try tokenManager.saveTokens(access: response.accessToken, refresh: response.refreshToken)

        // Check if user exists locally
        let userId = response.user.id
        let descriptor = FetchDescriptor<User>()
        let existingUsers = try modelContext.fetch(descriptor)
            .filter { $0.id == userId }

        let user: User
        if let existingUser = existingUsers.first {
            // Update existing user
            existingUser.email = response.user.email
            existingUser.username = response.user.username
            user = existingUser
        } else {
            // Create new user
            let dateFormatter = ISO8601DateFormatter()
            let createdAt = dateFormatter.date(from: response.user.createdAt) ?? Date()

            user = User(
                id: response.user.id,
                email: response.user.email,
                username: response.user.username,
                createdAt: createdAt
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
