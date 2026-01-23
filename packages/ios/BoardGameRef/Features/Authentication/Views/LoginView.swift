//
//  LoginView.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import SwiftData
import SwiftUI

struct LoginView: View {
    @State private var viewModel: AuthViewModel
    var onSwitchToRegister: () -> Void

    init(
        authService: AuthService,
        authState: AuthenticationState,
        networkMonitor: NetworkMonitor?,
        onSwitchToRegister: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: AuthViewModel(
            authService: authService,
            authState: authState,
            networkMonitor: networkMonitor
        ))
        self.onSwitchToRegister = onSwitchToRegister
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Welcome Back")
                .font(.system(size: 28, weight: .bold))
                .frame(maxWidth: .infinity, alignment: .leading)

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

                    SecureField("Enter your password", text: $viewModel.password)
                        .textFieldStyle(.plain)
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
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

            // Login button
            Button(action: {
                Task {
                    await viewModel.login()
                }
            }) {
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                } else {
                    Text("Log In")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                }
            }
            .background(Color.blue)
            .cornerRadius(12)
            .disabled(viewModel.isLoading)

            // Switch to register
            Button(action: onSwitchToRegister) {
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundColor(.secondary)
                    Text("Sign up")
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

    LoginView(
        authService: authService,
        authState: authState,
        networkMonitor: nil,
        onSwitchToRegister: {}
    )
}
