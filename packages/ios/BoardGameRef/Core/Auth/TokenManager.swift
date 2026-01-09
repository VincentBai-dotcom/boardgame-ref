//
//  TokenManager.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Observation

@Observable
class TokenManager {
    private let keychainManager: KeychainManager
    private(set) var accessToken: String?
    private(set) var refreshToken: String?

    var isAuthenticated: Bool {
        accessToken != nil && refreshToken != nil
    }

    init(keychainManager: KeychainManager = .shared) {
        self.keychainManager = keychainManager
        loadTokens()
    }

    // MARK: - Public Methods

    func loadTokens() {
        do {
            accessToken = try keychainManager.getAccessToken()
            refreshToken = try keychainManager.getRefreshToken()
        } catch {
            print("⚠️ Failed to load tokens from Keychain: \(error.localizedDescription)")
            accessToken = nil
            refreshToken = nil
        }
    }

    func saveTokens(access: String, refresh: String) throws {
        try keychainManager.saveAccessToken(access)
        try keychainManager.saveRefreshToken(refresh)
        accessToken = access
        refreshToken = refresh
        print("✅ Tokens saved successfully")
    }

    func clearTokens() throws {
        try keychainManager.deleteAllTokens()
        accessToken = nil
        refreshToken = nil
        print("✅ Tokens cleared successfully")
    }

    func updateAccessToken(_ newToken: String) throws {
        try keychainManager.saveAccessToken(newToken)
        accessToken = newToken
        print("✅ Access token updated successfully")
    }
}
