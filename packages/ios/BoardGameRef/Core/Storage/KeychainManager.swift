//
//  KeychainManager.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Security

enum KeychainError: Error {
    case unableToSave
    case unableToRetrieve
    case unableToDelete
    case itemNotFound

    var localizedDescription: String {
        switch self {
        case .unableToSave:
            return "Failed to save item to Keychain"
        case .unableToRetrieve:
            return "Failed to retrieve item from Keychain"
        case .unableToDelete:
            return "Failed to delete item from Keychain"
        case .itemNotFound:
            return "Item not found in Keychain"
        }
    }
}

class KeychainManager {
    static let shared = KeychainManager()

    private let accessTokenKey = "com.boardgameref.accessToken"
    private let refreshTokenKey = "com.boardgameref.refreshToken"

    private init() {}

    // MARK: - Public Methods

    func saveAccessToken(_ token: String) throws {
        try save(token, forKey: accessTokenKey)
    }

    func getAccessToken() throws -> String? {
        return try get(forKey: accessTokenKey)
    }

    func saveRefreshToken(_ token: String) throws {
        try save(token, forKey: refreshTokenKey)
    }

    func getRefreshToken() throws -> String? {
        return try get(forKey: refreshTokenKey)
    }

    func deleteAllTokens() throws {
        try delete(forKey: accessTokenKey)
        try delete(forKey: refreshTokenKey)
    }

    // MARK: - Private Methods

    private func save(_ value: String, forKey key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.unableToSave
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        // Delete existing item if it exists
        SecItemDelete(query as CFDictionary)

        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unableToSave
        }
    }

    private func get(forKey key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw KeychainError.unableToRetrieve
        }

        return string
    }

    private func delete(forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)

        // Success if deleted or item didn't exist
        if status != errSecSuccess && status != errSecItemNotFound {
            throw KeychainError.unableToDelete
        }
    }
}
