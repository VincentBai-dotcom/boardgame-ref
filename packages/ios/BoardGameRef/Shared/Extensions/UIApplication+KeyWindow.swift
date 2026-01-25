//
//  UIApplication+KeyWindow.swift
//  BoardGameRef
//
//  Created by Codex on 1/23/26.
//

import UIKit

extension UIApplication {
    var keyWindow: UIWindow? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}
