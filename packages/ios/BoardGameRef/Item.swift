//
//  Item.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 12/16/25.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
