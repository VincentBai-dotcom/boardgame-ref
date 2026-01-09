//
//  AuthenticationState.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Observation
import SwiftData

@Observable
class AuthenticationState {
    private(set) var isAuthenticated = false
    private(set) var currentUserId: String?
    private let tokenManager: TokenManager

    init(tokenManager: TokenManager) {
        self.tokenManager = tokenManager
        self.isAuthenticated = tokenManager.isAuthenticated
    }

    func login(userId: String) {
        currentUserId = userId
        isAuthenticated = true
        print("✅ User logged in: \(userId)")
    }

    func logout() {
        currentUserId = nil
        isAuthenticated = false
        do {
            try tokenManager.clearTokens()
            print("✅ User logged out successfully")
        } catch {
            print("⚠️ Error clearing tokens during logout: \(error.localizedDescription)")
        }
    }
}
