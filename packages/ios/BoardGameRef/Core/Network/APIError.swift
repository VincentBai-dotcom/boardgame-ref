//
//  APIError.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

enum APIError: Error {
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int, String?)
    case decodingError(Error)
    case tokenExpired
    case noConnection
    case unknown

    var localizedDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .forbidden:
            return "You don't have permission to access this resource"
        case .notFound:
            return "Resource not found"
        case .serverError(let code, let message):
            if let message = message {
                return "Server error (\(code)): \(message)"
            }
            return "Server error (\(code))"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .tokenExpired:
            return "Your session has expired. Please log in again."
        case .noConnection:
            return "No internet connection"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}
