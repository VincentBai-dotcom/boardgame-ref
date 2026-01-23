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
    private let apiClient: APIClient
    private let tokenManager: TokenManager
    private let modelContext: ModelContext

    init(apiClient: APIClient, tokenManager: TokenManager, modelContext: ModelContext) {
        self.apiClient = apiClient
        self.tokenManager = tokenManager
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func register(email: String, password: String) async throws -> User {
        let body = Operations.postAuthRegister.Input.Body.json(
            .init(email: email, password: password)
        )
        let output = try await apiClient.client.postAuthRegister(.init(body: body))
        let tokens = try extractTokens(from: output)
        try tokenManager.saveTokens(access: tokens.access, refresh: tokens.refresh)

        // Fetch user data separately
        let userPayload = try await fetchCurrentUserPayload()

        // Create and save user to SwiftData
        let user = upsertUser(from: userPayload)

        modelContext.insert(user)
        try modelContext.save()

        print("✅ User registered successfully: \(user.email)")
        return user
    }

    func login(email: String, password: String) async throws -> User {
        let body = Operations.postAuthLogin.Input.Body.json(
            .init(email: email, password: password)
        )
        let output = try await apiClient.client.postAuthLogin(.init(body: body))
        let tokens = try extractTokens(from: output)

        print("✅ Login response: accessToken=\(tokens.access.prefix(10))..., refreshToken=\(tokens.refresh.prefix(10))...")

        // Save tokens
        try tokenManager.saveTokens(access: tokens.access, refresh: tokens.refresh)

        // Fetch user data separately
        let userPayload = try await fetchCurrentUserPayload()

        // Check if user exists locally
        let userId = userPayload.id
        let descriptor = FetchDescriptor<User>()
        let existingUsers = try modelContext.fetch(descriptor)
            .filter { $0.id == userId }

        let user: User
        if let existingUser = existingUsers.first {
            // Update existing user with latest data from server
            existingUser.email = userPayload.email
            existingUser.emailVerified = false
            existingUser.role = userPayload.role.rawValue
            existingUser.oauthProvider = nil
            existingUser.oauthProviderUserId = nil
            existingUser.updatedAt = nil
            existingUser.lastLoginAt = nil
            user = existingUser
        } else {
            // Create new user
            user = upsertUser(from: userPayload)
            modelContext.insert(user)
        }

        try modelContext.save()

        print("✅ User logged in successfully: \(email)")
        return user
    }

    func logout() async throws {
        guard let refreshToken = tokenManager.refreshToken else {
            throw APIError.unauthorized
        }

        let body = Operations.postAuthLogout.Input.Body.json(
            .init(refreshToken: refreshToken)
        )
        let output = try await apiClient.client.postAuthLogout(.init(body: body))
        switch output {
        case .noContent:
            break
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }

        // Clear tokens
        try tokenManager.clearTokens()

        print("✅ User logged out successfully")
    }

    func getCurrentUser() async throws -> User {
        let payload = try await fetchCurrentUserPayload()
        return upsertUser(from: payload)
    }

    // MARK: - Private Methods

    private func fetchCurrentUserPayload() async throws -> Operations.getUserMe.Output.Ok.Body.jsonPayload {
        let output = try await apiClient.client.getUserMe(.init())
        switch output {
        case .ok(let ok):
            return try ok.body.json
        case .notFound:
            throw APIError.notFound
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func extractTokens(from output: Operations.postAuthRegister.Output) throws -> (access: String, refresh: String) {
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return (access: payload.accessToken, refresh: payload.refreshToken)
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.error)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func extractTokens(from output: Operations.postAuthLogin.Output) throws -> (access: String, refresh: String) {
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return (access: payload.accessToken, refresh: payload.refreshToken)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.error)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func upsertUser(from payload: Operations.getUserMe.Output.Ok.Body.jsonPayload) -> User {
        // Generated payload currently omits optional fields; fill with safe defaults.
        User(
            id: payload.id,
            email: payload.email,
            emailVerified: false,
            role: payload.role.rawValue,
            oauthProvider: nil,
            oauthProviderUserId: nil,
            createdAt: Date(),
            updatedAt: nil,
            lastLoginAt: nil
        )
    }
}
