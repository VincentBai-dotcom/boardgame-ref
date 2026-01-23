//
//  APIClient.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import Foundation
import OpenAPIURLSession

/// Thin wrapper around the generated OpenAPI client.
final class APIClient {
    let client: Client
    let serverURL: URL

    init(tokenManager: TokenManager) {
        let baseURL = Self.loadBaseURL()
        let transport = URLSessionTransport()
        let middleware = AuthMiddleware(tokenManager: tokenManager)
        self.serverURL = baseURL
        self.client = Client(
            serverURL: baseURL,
            transport: transport,
            middlewares: [middleware]
        )
    }

    private static func loadBaseURL() -> URL {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              !value.isEmpty,
              let url = URL(string: value) else {
            fatalError("Missing or invalid API_BASE_URL in Info.plist")
        }
        print("📍 Base URL loaded: \(value)")
        return url
    }
}
