//
//  HTTPClient.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

// Empty response type for endpoints that don't return data
struct EmptyResponse: Decodable {
    init() {}
}

actor HTTPClient {
    private let baseURL: String
    private let session: URLSession
    private var tokenManager: TokenManager?
    private var isRefreshing = false

    init(tokenManager: TokenManager? = nil) {
        self.tokenManager = tokenManager
        self.baseURL = HTTPClient.loadBaseURL()
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        self.session = URLSession(configuration: config)
    }

    // MARK: - Public Methods

    func request<T: Decodable>(
        endpoint: APIEndpoint,
        body: Encodable? = nil,
        allowRefresh: Bool = true
    ) async throws -> T {
        let urlRequest = try await buildRequest(endpoint: endpoint, body: body)

        do {
            let (data, response) = try await session.data(for: urlRequest)
            try validateResponse(response)

            // Debug: Print raw response
            if let jsonString = String(data: data, encoding: .utf8) {
                print("📦 Response JSON: \(jsonString)")
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                print("❌ Decoding error: \(error)")
                if let decodingError = error as? DecodingError {
                    switch decodingError {
                    case .keyNotFound(let key, let context):
                        print("   Missing key: \(key.stringValue) - \(context.debugDescription)")
                    case .typeMismatch(let type, let context):
                        print("   Type mismatch for type: \(type) - \(context.debugDescription)")
                    case .valueNotFound(let type, let context):
                        print("   Value not found for type: \(type) - \(context.debugDescription)")
                    case .dataCorrupted(let context):
                        print("   Data corrupted: \(context.debugDescription)")
                    @unknown default:
                        print("   Unknown decoding error")
                    }
                }
                throw error
            }

        } catch let error as APIError where error.unauthorized {
            // Token expired - try refreshing
            guard let tokenManager = tokenManager else {
                throw APIError.unauthorized
            }

            guard allowRefresh else {
                try? await tokenManager.clearTokens()
                throw APIError.tokenExpired
            }

            // Prevent multiple simultaneous refresh attempts
            if isRefreshing {
                // Wait a bit and retry
                try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                return try await request(endpoint: endpoint, body: body, allowRefresh: allowRefresh)
            }

            isRefreshing = true
            defer { isRefreshing = false }

            // Attempt token refresh
            do {
                try await refreshToken()
                // Retry original request with new token
                return try await request(endpoint: endpoint, body: body, allowRefresh: false)
            } catch {
                // Refresh failed - clear tokens and throw
                try? await tokenManager.clearTokens()
                throw APIError.tokenExpired
            }
        }
    }

    func requestWithoutResponse(
        endpoint: APIEndpoint,
        body: Encodable? = nil,
        allowRefresh: Bool = true
    ) async throws {
        let urlRequest = try await buildRequest(endpoint: endpoint, body: body)

        do {
            let (_, response) = try await session.data(for: urlRequest)
            try validateResponse(response)
        } catch let error as APIError where error.unauthorized {
            // Token expired - try refreshing
            guard let tokenManager = tokenManager else {
                throw APIError.unauthorized
            }

            guard allowRefresh else {
                try? await tokenManager.clearTokens()
                throw APIError.tokenExpired
            }

            if isRefreshing {
                try await Task.sleep(nanoseconds: 1_000_000_000)
                return try await requestWithoutResponse(endpoint: endpoint, body: body, allowRefresh: allowRefresh)
            }

            isRefreshing = true
            defer { isRefreshing = false }

            do {
                try await refreshToken()
                return try await requestWithoutResponse(endpoint: endpoint, body: body, allowRefresh: false)
            } catch {
                try? await tokenManager.clearTokens()
                throw APIError.tokenExpired
            }
        }
    }

    // MARK: - Private Methods

    private func buildRequest(endpoint: APIEndpoint, body: Encodable?) async throws -> URLRequest {
        guard let url = URL(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add authorization header if needed
        if endpoint.requiresAuth, let accessToken = await tokenManager?.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        // Encode body if present
        if let body = body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(body)
        }

        return request
    }

    private static func loadBaseURL() -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              !value.isEmpty else {
            fatalError("Missing API_BASE_URL in Info.plist")
        }
        print("📍 Base URL loaded: \(value)")
        return value
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode, nil)
        default:
            throw APIError.serverError(httpResponse.statusCode, "Unknown error")
        }
    }

    private func refreshToken() async throws {
        guard let tokenManager = tokenManager,
              let currentRefreshToken = await tokenManager.refreshToken else {
            throw APIError.unauthorized
        }

        struct RefreshRequest: Encodable {
            let refreshToken: String
        }

        struct RefreshResponse: Decodable {
            let accessToken: String
            let refreshToken: String
        }

        let refreshEndpoint = APIEndpoint.refreshToken(refreshToken: currentRefreshToken)
        let refreshReq = try buildRefreshRequest(endpoint: refreshEndpoint, refreshToken: currentRefreshToken)

        let (data, response) = try await session.data(for: refreshReq)
        try validateResponse(response)

        let decoder = JSONDecoder()
        let refreshResponse = try decoder.decode(RefreshResponse.self, from: data)

        // Save new tokens
        try await tokenManager.saveTokens(
            access: refreshResponse.accessToken,
            refresh: refreshResponse.refreshToken
        )

        print("✅ Token refreshed successfully")
    }

    private func buildRefreshRequest(endpoint: APIEndpoint, refreshToken: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        struct RefreshBody: Encodable {
            let refreshToken: String
        }

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(RefreshBody(refreshToken: refreshToken))

        return request
    }
}

extension APIError {
    var unauthorized: Bool {
        if case .unauthorized = self {
            return true
        }
        return false
    }
}
