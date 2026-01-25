//
//  OAuthConfig.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import Foundation

enum OAuthConfig {
    static var googleClientId: String {
        plistValue("OAUTH_GOOGLE_CLIENT_ID")
    }

    static var googleRedirectURI: String {
        plistValue("OAUTH_GOOGLE_REDIRECT_URI")
    }

    static var redirectScheme: String {
        guard let scheme = URL(string: googleRedirectURI)?.scheme else {
            fatalError("OAUTH_GOOGLE_REDIRECT_URI must be a valid URL with scheme")
        }
        return scheme
    }

    private static func plistValue(_ key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty else {
            fatalError("Missing \(key) in Info.plist")
        }
        return value
    }
}
