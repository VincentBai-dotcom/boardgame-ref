//
//  AuthService.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData
import AuthenticationServices

@Observable
class AuthService {
    enum EmailIntent {
        case login
        case register
        case oauth(provider: Operations.postAuthEmailIntent.Output.Ok.Body.jsonPayload.providerPayload)
    }

    private let apiClient: APIClient
    private let tokenManager: TokenManager
    private let modelContext: ModelContext

    init(apiClient: APIClient, tokenManager: TokenManager, modelContext: ModelContext) {
        self.apiClient = apiClient
        self.tokenManager = tokenManager
        self.modelContext = modelContext
    }

    // MARK: - Public Methods

    func emailIntent(email: String) async throws -> EmailIntent {
        let body = Operations.postAuthEmailIntent.Input.Body.json(.init(email: email))
        let output = try await apiClient.client.postAuthEmailIntent(.init(body: body))
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            switch payload.intent {
            case .login:
                return .login
            case .register:
                return .register
            case .oauth:
                if let provider = payload.provider {
                    return .oauth(provider: provider)
                }
                return .oauth(provider: .google)
            }
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    struct RegisterStartResult {
        let cooldownSeconds: Double
        let alreadySent: Bool?
    }

    func registerStart(email: String) async throws -> RegisterStartResult {
        let body = Operations.postAuthRegisterStart.Input.Body.json(.init(email: email))
        let output = try await apiClient.client.postAuthRegisterStart(.init(body: body))
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return RegisterStartResult(
                cooldownSeconds: payload.cooldownSeconds,
                alreadySent: payload.alreadySent
            )
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .tooManyRequests(let rateLimit):
            let payload = try rateLimit.body.json
            throw APIError.serverError(429, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    func registerResend(email: String) async throws -> RegisterStartResult {
        let body = Operations.postAuthRegisterResend.Input.Body.json(.init(email: email))
        let output = try await apiClient.client.postAuthRegisterResend(.init(body: body))
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return RegisterStartResult(
                cooldownSeconds: payload.cooldownSeconds,
                alreadySent: payload.alreadySent
            )
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .tooManyRequests(let rateLimit):
            let payload = try rateLimit.body.json
            throw APIError.serverError(429, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    func registerVerify(email: String, code: String) async throws -> String {
        let body = Operations.postAuthRegisterVerify.Input.Body.json(.init(email: email, code: code))
        let output = try await apiClient.client.postAuthRegisterVerify(.init(body: body))
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return payload.registrationToken
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .tooManyRequests(let rateLimit):
            let payload = try rateLimit.body.json
            throw APIError.serverError(429, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    func registerComplete(email: String, password: String, registrationToken: String) async throws -> User {
        let body = Operations.postAuthRegisterComplete.Input.Body.json(
            .init(email: email, password: password, registrationToken: registrationToken)
        )
        let output = try await apiClient.client.postAuthRegisterComplete(.init(body: body))
        let tokens = try extractTokens(from: output)
        try tokenManager.saveTokens(access: tokens.access, refresh: tokens.refresh)
        let userPayload = try await fetchCurrentUserPayload()
        let user = upsertUser(from: userPayload)
        modelContext.insert(user)
        try modelContext.save()
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

    func loginWithApple(code: String, nonce: String, codeVerifier: String) async throws -> User {
        try await exchangeOAuthCode(provider: .apple, code: code, nonce: nonce, codeVerifier: codeVerifier)
    }

    func loginWithGoogle(presentationAnchor: ASPresentationAnchor) async throws -> User {
        // ASPresentationAnchor comes from AuthenticationServices
        let state = OAuthPKCE.generateState()
        let nonce = OAuthPKCE.generateNonce()
        let codeVerifier = OAuthPKCE.generateVerifier()
        let codeChallenge = OAuthPKCE.challenge(from: codeVerifier)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")
        components?.queryItems = [
            .init(name: "client_id", value: OAuthConfig.googleClientId),
            .init(name: "redirect_uri", value: OAuthConfig.googleRedirectURI),
            .init(name: "response_type", value: "code"),
            .init(name: "scope", value: "openid email profile"),
            .init(name: "state", value: state),
            .init(name: "nonce", value: nonce),
            .init(name: "code_challenge", value: codeChallenge),
            .init(name: "code_challenge_method", value: "S256")
        ]

        guard let url = components?.url else {
            throw APIError.invalidURL
        }

        let session = OAuthWebSession(presentationAnchor: presentationAnchor)
        let callbackURL = try await session.start(url: url, callbackScheme: OAuthConfig.redirectScheme)

        guard let callbackComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let items = callbackComponents.queryItems else {
            throw APIError.invalidResponse
        }

        let returnedState = items.first { $0.name == "state" }?.value
        guard returnedState == state else {
            throw APIError.unauthorized
        }

        guard let code = items.first(where: { $0.name == "code" })?.value else {
            throw APIError.invalidResponse
        }

        return try await exchangeOAuthCode(provider: .google, code: code, nonce: nonce, codeVerifier: codeVerifier)
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
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
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
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .notFound:
            throw APIError.notFound
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func extractTokens(from output: Operations.postAuthRegisterComplete.Output) throws -> (access: String, refresh: String) {
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return (access: payload.accessToken, refresh: payload.refreshToken)
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func extractTokens(from output: Operations.postAuthLogin.Output) throws -> (access: String, refresh: String) {
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            return (access: payload.accessToken, refresh: payload.refreshToken)
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }
    }

    private func exchangeOAuthCode(
        provider: Operations.postAuthOauthByProviderToken.Input.Path.providerPayload,
        code: String,
        nonce: String,
        codeVerifier: String
    ) async throws -> User {
        let path = Operations.postAuthOauthByProviderToken.Input.Path(provider: provider)
        let body = Operations.postAuthOauthByProviderToken.Input.Body.json(
            .init(code: code, nonce: nonce, codeVerifier: codeVerifier)
        )
        let output = try await apiClient.client.postAuthOauthByProviderToken(path: path, body: body)
        switch output {
        case .ok(let ok):
            let payload = try ok.body.json
            try tokenManager.saveTokens(access: payload.accessToken, refresh: payload.refreshToken)
        case .badRequest(let bad):
            let payload = try bad.body.json
            throw APIError.serverError(400, payload.errorMessage)
        case .unauthorized(let unauthorized):
            let payload = try unauthorized.body.json
            throw APIError.serverError(401, payload.errorMessage)
        case .conflict(let conflict):
            let payload = try conflict.body.json
            throw APIError.serverError(409, payload.errorMessage)
        case .internalServerError(let error):
            let payload = try error.body.json
            throw APIError.serverError(500, payload.errorMessage)
        case .undocumented(let statusCode, _):
            throw APIError.serverError(statusCode, nil)
        }

        let userPayload = try await fetchCurrentUserPayload()
        let user = upsertUser(from: userPayload)
        modelContext.insert(user)
        try modelContext.save()
        return user
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
