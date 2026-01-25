//
//  OAuthWebSession.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import AuthenticationServices
import Foundation

final class OAuthWebSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<URL, Error>?
    private let presentationAnchor: ASPresentationAnchor

    init(presentationAnchor: ASPresentationAnchor) {
        self.presentationAnchor = presentationAnchor
    }

    func start(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL = callbackURL else {
                    continuation.resume(throwing: APIError.unknown)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session?.presentationContextProvider = self
            session?.prefersEphemeralWebBrowserSession = true
            _ = session?.start()
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentationAnchor
    }
}
