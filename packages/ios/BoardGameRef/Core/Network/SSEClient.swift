//
//  SSEClient.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

enum SSEEvent {
    case conversationId(String)
    case textDelta(String)
    case done
    case error(String)
}

actor SSEClient {
    private var task: Task<Void, Never>?

    func connect(
        url: URL,
        headers: [String: String],
        body: Data?,
        onEvent: @escaping @Sendable (SSEEvent) -> Void
    ) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.allHTTPHeaderFields = headers
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = body

        task = Task {
            do {
                let (bytes, response) = try await URLSession.shared.bytes(for: request)

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    onEvent(.error("Invalid response"))
                    return
                }

                var currentEvent = ""
                var currentData = ""

                for try await line in bytes.lines {
                    // Parse SSE format
                    if line.hasPrefix("event:") {
                        currentEvent = String(line.dropFirst(6).trimmingCharacters(in: .whitespaces))
                    } else if line.hasPrefix("data:") {
                        currentData = String(line.dropFirst(5).trimmingCharacters(in: .whitespaces))

                        // Process the data based on event type or content
                        if currentData == "[DONE]" {
                            onEvent(.done)
                            break
                        } else if currentEvent == "conversation_id" {
                            // Parse conversation ID from JSON
                            if let jsonData = currentData.data(using: .utf8),
                               let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                               let convId = json["conversationId"] as? String {
                                onEvent(.conversationId(convId))
                            }
                            currentEvent = ""
                        } else if currentEvent == "text_delta" || currentData.count > 0 {
                            // Text chunk
                            onEvent(.textDelta(currentData))
                            currentEvent = ""
                        }

                        currentData = ""
                    } else if line.isEmpty {
                        // Empty line marks end of event
                        continue
                    }
                }

                onEvent(.done)
            } catch {
                onEvent(.error(error.localizedDescription))
            }
        }

        await task?.value
    }

    func disconnect() {
        task?.cancel()
        task = nil
    }
}
