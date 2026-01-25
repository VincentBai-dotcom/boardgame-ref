//
//  OAuthPKCE.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import CryptoKit
import Foundation

enum OAuthPKCE {
    static func generateVerifier() -> String {
        let bytes = [UInt8].random(count: 32)
        return base64URLEncode(data: Data(bytes))
    }

    static func challenge(from verifier: String) -> String {
        let data = Data(verifier.utf8)
        let hashed = SHA256.hash(data: data)
        return base64URLEncode(data: Data(hashed))
    }

    static func generateState() -> String {
        base64URLEncode(data: Data([UInt8].random(count: 16)))
    }

    static func generateNonce() -> String {
        base64URLEncode(data: Data([UInt8].random(count: 16)))
    }

    private static func base64URLEncode(data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private extension Array where Element == UInt8 {
    static func random(count: Int) -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: count)
        let status = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        precondition(status == errSecSuccess)
        return bytes
    }
}
