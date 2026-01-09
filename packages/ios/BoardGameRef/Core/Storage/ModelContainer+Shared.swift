//
//  ModelContainer+Shared.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import SwiftData

extension ModelContainer {
    static var shared: ModelContainer = {
        let schema = Schema([
            User.self,
            Conversation.self,
            Message.self
        ])

        let config = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )

        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }()
}
