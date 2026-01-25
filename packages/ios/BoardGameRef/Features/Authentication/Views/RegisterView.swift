//
//  RegisterView.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import SwiftData
import SwiftUI
import AuthenticationServices

struct RegisterView: View {
    @State private var viewModel: AuthViewModel
    var onSwitchToLogin: () -> Void

    init(
        authService: AuthService,
        authState: AuthenticationState,
        networkMonitor: NetworkMonitor?,
        onSwitchToLogin: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: AuthViewModel(
            authService: authService,
            authState: authState,
            networkMonitor: networkMonitor
        ))
        self.onSwitchToLogin = onSwitchToLogin
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Create Account")
                .font(.system(size: 28, weight: .bold))
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 12) {
                SignInWithAppleButton(.signUp) { request in
                    viewModel.prepareAppleSignIn(request: request)
                } onCompletion: { result in
                    viewModel.completeAppleSignIn(result: result)
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 48)

                Button(action: {
                    if let anchor = UIApplication.shared.keyWindow {
                        Task { await viewModel.loginWithGoogle(presentationAnchor: anchor) }
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "g.circle.fill")
                        Text("Continue with Google")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                }
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(10)
            }

            HStack(spacing: 12) {
                Rectangle().fill(Color.secondary.opacity(0.2)).frame(height: 1)
                Text("or")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)
                Rectangle().fill(Color.secondary.opacity(0.2)).frame(height: 1)
            }

            VStack(spacing: 16) {
                // Email field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Email")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)

                    TextField("Enter your email", text: $viewModel.email)
                        .textFieldStyle(.plain)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                }

                // Password field
                VStack(alignment: .leading, spacing: 8) {
                    Text("Password")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)

                    SecureField("Choose a password", text: $viewModel.password)
                        .textFieldStyle(.plain)
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)

                    Text("At least 8 characters")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
            }

            // Error message
            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Register button
            Button(action: {
                Task {
                    await viewModel.register()
                }
            }) {
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                } else {
                    Text("Sign Up")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                }
            }
            .background(Color.blue)
            .cornerRadius(12)
            .disabled(viewModel.isLoading)

            // Switch to login
            Button(action: onSwitchToLogin) {
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .foregroundColor(.secondary)
                    Text("Log in")
                        .foregroundColor(.blue)
                        .fontWeight(.semibold)
                }
                .font(.system(size: 15))
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .dismissKeyboardOnTap()
    }
}

#Preview {
    let tokenManager = TokenManager()
    let authState = AuthenticationState(tokenManager: tokenManager)
    let apiClient = APIClient(tokenManager: tokenManager)
    let authService = AuthService(
        apiClient: apiClient,
        tokenManager: tokenManager,
        modelContext: ModelContainer.shared.mainContext
    )

    RegisterView(
        authService: authService,
        authState: authState,
        networkMonitor: nil,
        onSwitchToLogin: {}
    )
}
