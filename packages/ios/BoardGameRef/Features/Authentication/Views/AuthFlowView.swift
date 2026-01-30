//
//  AuthFlowView.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import SwiftUI
import AuthenticationServices
import SwiftData

struct AuthFlowView: View {
    @Environment(NetworkMonitor.self) private var networkMonitor
    @State private var viewModel: AuthViewModel
    @State private var showEmailSheet = false

    init(authService: AuthService, authState: AuthenticationState, networkMonitor: NetworkMonitor?) {
        _viewModel = State(initialValue: AuthViewModel(
            authService: authService,
            authState: authState,
            networkMonitor: networkMonitor
        ))
    }

    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()

            VStack {
                Spacer()
                welcomePanel
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
            }
        }
        .sheet(isPresented: $showEmailSheet, onDismiss: {
            viewModel.step = .welcome
        }) {
            emailSheet
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.step {
        case .welcome:
            VStack(spacing: 12) {
                oauthButtons

                Button("Sign up") {
                    viewModel.startEmailFlow()
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color(white: 0.2))
                .cornerRadius(12)

                Button("Log in") {
                    viewModel.startEmailFlow()
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white.opacity(0.9))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.clear)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
            }

        case .email:
            VStack(spacing: 12) {
                TextField("Email", text: $viewModel.email)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Color(white: 0.18))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )

                Button(action: {
                    Task { await viewModel.submitEmail() }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    } else {
                        Text("Continue")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                }
                .background(Color.white)
                .cornerRadius(12)

                divider

                googleButton
            }

        case .password:
            VStack(spacing: 12) {
                Text(viewModel.email)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)

                SecureField("Password", text: $viewModel.password)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color(white: 0.18))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )

                Button(action: {
                    Task { await viewModel.submitPasswordLogin() }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    } else {
                        Text("Log in")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                }
                .background(Color.white)
                .cornerRadius(12)

                Button("Use a different email") {
                    viewModel.resetToEmail()
                }
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
            }

        case .verifyCode:
            VStack(spacing: 12) {
                Text("Enter the 6-digit code sent to")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(viewModel.email)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                TextField("Verification code", text: $viewModel.code)
                    .textFieldStyle(.plain)
                    .keyboardType(.numberPad)
                    .padding(12)
                    .background(Color(white: 0.18))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )

                Button(action: {
                    Task { await viewModel.submitVerifyCode() }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    } else {
                        Text("Continue")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                }
                .background(Color.white)
                .cornerRadius(12)

                Button(viewModel.resendCooldownSeconds > 0
                       ? "Resend in \(viewModel.resendCooldownSeconds)s"
                       : "Resend code") {
                    Task { await viewModel.resendCode() }
                }
                .font(.system(size: 13))
                .foregroundColor(viewModel.resendCooldownSeconds > 0 ? .white.opacity(0.45) : .white.opacity(0.7))
                .disabled(viewModel.resendCooldownSeconds > 0 || viewModel.isLoading)

                Button("Use a different email") {
                    viewModel.resetToEmail()
                }
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
            }

        case .setPassword:
            VStack(spacing: 12) {
                SecureField("Create a password", text: $viewModel.password)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color(white: 0.18))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )

                Button(action: {
                    Task { await viewModel.submitSetPassword() }
                }) {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    } else {
                        Text("Create account")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                }
                .background(Color.white)
                .cornerRadius(12)

                Button("Use a different email") {
                    viewModel.resetToEmail()
                }
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
            }

        case .oauthSuggestion:
            VStack(spacing: 12) {
                Text("Continue with \(viewModel.suggestedProvider == .apple ? "Apple" : "Google")")
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)

                oauthButtons

                Button("Use a different email") {
                    viewModel.resetToEmail()
                }
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
            }
        }
    }

    private var emailSheet: some View {
        VStack(spacing: 0) {
            VStack(spacing: 16) {
                Circle()
                    .fill(Color.white)
                    .frame(width: 10, height: 10)
                    .padding(.top, 8)

                Text("Log in or sign up")
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundColor(.white)

                Text("You'll get smarter responses and can upload files, images and more.")
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)

                content

                if let info = viewModel.infoMessage {
                    Text(info)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.7))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            Spacer(minLength: 5)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .top)
        .cornerRadius(24)
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .presentationDetents([.fraction(0.92)])
        .presentationDragIndicator(.hidden)
        .presentationBackground(.clear)
    }

    private var welcomePanel: some View {
        VStack(spacing: 10) {
            oauthButtons

            Button(action: {
                viewModel.startEmailFlow()
                showEmailSheet = true
            }) {
                Text("Sign up")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .background(Color(white: 0.2))
            .cornerRadius(12)
            .buttonStyle(.plain)

            Button(action: {
                viewModel.startEmailFlow()
                showEmailSheet = true
            }) {
                Text("Log in")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white.opacity(0.9))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .background(Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Color(white: 0.13))
        .cornerRadius(20)
    }

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
            Text("OR")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(.white.opacity(0.5))
            Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
        }
    }

    private var oauthButtons: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
                    .frame(height: 44)
                SignInWithAppleButton(.signIn) { request in
                    viewModel.prepareAppleSignIn(request: request)
                } onCompletion: { result in
                    viewModel.completeAppleSignIn(result: result)
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 44)
            }

            googleButton
        }
    }

    private var googleButton: some View {
        Button(action: {
            if let anchor = UIApplication.shared.keyWindow {
                Task { await viewModel.loginWithGoogle(presentationAnchor: anchor) }
            }
        }) {
            HStack(spacing: 8) {
                Image(systemName: "g.circle.fill")
                Text("Continue with Google")
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(Color(white: 0.2))
            .cornerRadius(12)
        }
    }
}

#Preview {
    let modelContext = ModelContainer.shared.mainContext
    let tokenManager = TokenManager()
    let apiClient = APIClient(tokenManager: tokenManager)
    let authService = AuthService(apiClient: apiClient, tokenManager: tokenManager, modelContext: modelContext)
    let authState = AuthenticationState(tokenManager: tokenManager)
    let networkMonitor = NetworkMonitor()
    AuthFlowView(authService: authService, authState: authState, networkMonitor: networkMonitor)
        .environment(networkMonitor)
}
