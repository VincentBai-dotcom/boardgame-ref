//
//  View+Extensions.swift
//  BoardGameRef
//
//  Created by Claude on 1/16/26.
//

import SwiftUI
import UIKit

extension View {
    /// Adds a tap gesture to dismiss the keyboard when tapping outside input fields
    func dismissKeyboardOnTap() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
    }
}
