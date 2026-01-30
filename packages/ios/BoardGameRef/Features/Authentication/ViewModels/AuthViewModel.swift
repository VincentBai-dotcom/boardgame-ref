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
    enum AuthStep {
        case email
        case password
        case verifyCode
        case setPassword
        case oauthSuggestion
    }

    var email = ""
    var password = ""
    var code = ""
    var errorMessage: String?
    var isLoading = false
    var step: AuthStep = .email
    var suggestedProvider: Operations.postAuthEmailIntent.Output.Ok.Body.jsonPayload.providerPayload?

    private let authService: AuthService
    private let authState: AuthenticationState
    private let networkMonitor: NetworkMonitor?
    private var appleNonce: String?
    private var appleCodeVerifier: String?
    private var appleState: String?
    private var registrationToken: String?

    init(authService: AuthService, authState: AuthenticationState, networkMonitor: NetworkMonitor? = nil) {
        self.authService = authService
        self.authState = authState
        self.networkMonitor = networkMonitor
    }

    // MARK: - Public Methods

    func submitEmail() async {
        guard validateEmail() else { return }

        // Check network connectivity
        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let intent = try await authService.emailIntent(email: email)
            await MainActor.run {
                switch intent {
                case .login:
                    step = .password
                case .register:
                    step = .verifyCode
                case .oauth(let provider):
                    suggestedProvider = provider
                    step = .oauthSuggestion
                }
            }
            if case .register = intent {
                try await authService.registerStart(email: email)
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

    func submitPasswordLogin() async {
        guard validatePassword(minLength: 6, message: "Password must be at least 6 characters") else { return }

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

    func submitVerifyCode() async {
        guard !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Verification code is required"
            return
        }

        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let token = try await authService.registerVerify(email: email, code: code)
            registrationToken = token
            await MainActor.run {
                step = .setPassword
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

    func resendCode() async {
        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await authService.registerResend(email: email)
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

    func submitSetPassword() async {
        guard validatePassword(minLength: 8, message: "Password must be at least 8 characters") else { return }
        guard let token = registrationToken else {
            errorMessage = "Missing registration token. Please verify again."
            return
        }

        if let monitor = networkMonitor, !monitor.isConnected {
            errorMessage = "No internet connection. Please check your network and try again."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.registerComplete(
                email: email,
                password: password,
                registrationToken: token
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

    func resetToEmail() {
        errorMessage = nil
        password = ""
        code = ""
        registrationToken = nil
        suggestedProvider = nil
        step = .email
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

    // MARK: - Private Methods

    private func validateEmail() -> Bool {
        errorMessage = nil

        guard !email.isEmpty else {
            errorMessage = "Email is required"
            return false
        }

        guard email.contains("@") && email.contains(".") else {
            errorMessage = "Please enter a valid email address"
            return false
        }

        return true
    }

    private func validatePassword(minLength: Int, message: String) -> Bool {
        errorMessage = nil

        guard password.count >= minLength else {
            errorMessage = message
            return false
        }

        return true
    }
}
