//
//  NetworkMonitor.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation
import Network
import Observation

@Observable
class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    var isConnected = true
    var connectionType: NWInterface.InterfaceType?

    init() {
        startMonitoring()
    }

    deinit {
        stopMonitoring()
    }

    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type

                if path.status == .satisfied {
                    print("✅ Network connected via \(path.availableInterfaces.first?.type.debugDescription ?? "unknown")")
                } else {
                    print("⚠️ Network disconnected")
                }
            }
        }

        monitor.start(queue: queue)
    }

    func stopMonitoring() {
        monitor.cancel()
    }
}

extension NWInterface.InterfaceType {
    var debugDescription: String {
        switch self {
        case .wifi: return "WiFi"
        case .cellular: return "Cellular"
        case .wiredEthernet: return "Ethernet"
        case .loopback: return "Loopback"
        case .other: return "Other"
        @unknown default: return "Unknown"
        }
    }
}
