//
//  AuthMiddleware.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Injects bearer auth into OpenAPI client requests.
struct AuthMiddleware: OpenAPIRuntime.ClientMiddleware, @unchecked Sendable {
    
    private let tokenManager: TokenManager

    init(tokenManager: TokenManager) {
        self.tokenManager = tokenManager
    }

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @concurrent @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = await tokenManager.accessToken {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        return try await next(request, body, baseURL)
    }
}

