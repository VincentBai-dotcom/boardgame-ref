//
//  AuthViewModel.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Observation

@Observable
class AuthViewModel {
    var email = ""
    var password = ""
    var username = ""
    var errorMessage: String?
    var isLoading = false

    private let authService: AuthService
    private let authState: AuthenticationState
    private let networkMonitor: NetworkMonitor?

    init(authService: AuthService, authState: AuthenticationState, networkMonitor: NetworkMonitor? = nil) {
        self.authService = authService
        self.authState = authState
        self.networkMonitor = networkMonitor
    }

    // MARK: - Public Methods

    func login() async {
        guard validate(isRegistration: false) else { return }

        // Check network connectivity
        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.login(email: email, password: password)
            await MainActor.run {
                authState.login(userId: user.id)
            }
        } catch {
            await MainActor.run {
                if let apiError = error as? APIError {
                    errorMessage = apiError.localizedDescription
                } else {
                    errorMessage = error.localizedDescription
                }
            }
        }

        await MainActor.run {
            isLoading = false
        }
    }

    func register() async {
        guard validate(isRegistration: true) else { return }

        // Check network connectivity
        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.register(
                email: email,
                password: password,
                username: username
            )
            await MainActor.run {
                authState.login(userId: user.id)
            }
        } catch {
            await MainActor.run {
                if let apiError = error as? APIError {
                    errorMessage = apiError.localizedDescription
                } else {
                    errorMessage = error.localizedDescription
                }
            }
        }

        await MainActor.run {
            isLoading = false
        }
    }

    // MARK: - Private Methods

    private func validate(isRegistration: Bool) -> Bool {
        errorMessage = nil

        guard !email.isEmpty else {
            errorMessage = "Email is required"
            return false
        }

        guard email.contains("@") && email.contains(".") else {
            errorMessage = "Please enter a valid email address"
            return false
        }

        guard password.count >= 6 else {
            errorMessage = "Password must be at least 6 characters"
            return false
        }

        if isRegistration {
            guard !username.isEmpty else {
                errorMessage = "Username is required"
                return false
            }

            guard username.count >= 3 else {
                errorMessage = "Username must be at least 3 characters"
                return false
            }
        }

        return true
    }
}
