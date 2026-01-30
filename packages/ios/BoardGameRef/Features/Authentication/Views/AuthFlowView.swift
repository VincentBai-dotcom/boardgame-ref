//
//  AuthFlowView.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import SwiftUI
import AuthenticationServices

struct AuthFlowView: View {
    @Environment(NetworkMonitor.self) private var networkMonitor
    @State private var viewModel: AuthViewModel

    init(authService: AuthService, authState: AuthenticationState, networkMonitor: NetworkMonitor?) {
        _viewModel = State(initialValue: AuthViewModel(
            authService: authService,
            authState: authState,
            networkMonitor: networkMonitor
        ))
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.92)
                .ignoresSafeArea()

            VStack {
                Spacer()

                VStack(spacing: 16) {
                    Text("Log in or sign up")
                        .font(.system(size: 22, weight: .semibold))
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
                .padding(20)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(22)
                .padding(.horizontal, 20)

                Spacer()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.step {
        case .email:
            VStack(spacing: 12) {
                TextField("Email", text: $viewModel.email)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(10)

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
                .cornerRadius(10)

                divider

                oauthButtons
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
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(10)

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
                .cornerRadius(10)

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
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(10)

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
                .cornerRadius(10)

                Button("Resend code") {
                    Task { await viewModel.resendCode() }
                }
                .font(.system(size: 13))
                .foregroundColor(viewModel.resendCooldownSeconds > 0 ? .white.opacity(0.4) : .white.opacity(0.7))
                .disabled(viewModel.resendCooldownSeconds > 0 || viewModel.isLoading)

                if viewModel.resendCooldownSeconds > 0 {
                    Text("You can resend in \(viewModel.resendCooldownSeconds)s")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.5))
                }

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
                    .background(Color(UIColor.tertiarySystemBackground))
                    .cornerRadius(10)

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
                .cornerRadius(10)

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
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.black.opacity(0.04))
                    .frame(height: 44)
                SignInWithAppleButton(.signIn) { request in
                    viewModel.prepareAppleSignIn(request: request)
                } onCompletion: { result in
                    viewModel.completeAppleSignIn(result: result)
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 44)
            }

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
                .background(Color.white.opacity(0.08))
                .cornerRadius(10)
            }
        }
    }
}
