//
//  AuthViewModel.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Observation
import AuthenticationServices

@Observable
class AuthViewModel {
    var email = ""
    var password = ""
    var errorMessage: String?
    var isLoading = false

    private let authService: AuthService
    private let authState: AuthenticationState
    private let networkMonitor: NetworkMonitor?
    private var appleNonce: String?
    private var appleCodeVerifier: String?
    private var appleState: String?

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

    func prepareAppleSignIn(request: ASAuthorizationAppleIDRequest) {
        let nonce = OAuthPKCE.generateNonce()
        let state = OAuthPKCE.generateState()
        let codeVerifier = OAuthPKCE.generateVerifier()

        appleNonce = nonce
        appleState = state
        appleCodeVerifier = codeVerifier

        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce
        request.state = state
    }

    func completeAppleSignIn(result: Result<ASAuthorization, Error>) {
        guard let nonce = appleNonce,
              let codeVerifier = appleCodeVerifier,
              let state = appleState else {
            errorMessage = "Apple sign-in setup failed. Please try again."
            return
        }

        Task {
            isLoading = true
            errorMessage = nil
            defer { isLoading = false }

            do {
                let authorization = try result.get()
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let codeData = credential.authorizationCode,
                      let code = String(data: codeData, encoding: .utf8) else {
                    throw APIError.invalidResponse
                }

                if let returnedState = credential.state, returnedState != state {
                    throw APIError.unauthorized
                }

                let user = try await authService.loginWithApple(
                    code: code,
                    nonce: nonce,
                    codeVerifier: codeVerifier
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
        }
    }

    func loginWithGoogle(presentationAnchor: ASPresentationAnchor) async {
        // Check network connectivity
        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.loginWithGoogle(presentationAnchor: presentationAnchor)
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
                password: password
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

        if isRegistration {
            guard password.count >= 8 else {
                errorMessage = "Password must be at least 8 characters"
                return false
            }
        } else {
            guard password.count >= 6 else {
                errorMessage = "Password must be at least 6 characters"
                return false
            }
        }

        return true
    }
}
