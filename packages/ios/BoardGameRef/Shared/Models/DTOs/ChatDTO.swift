//
//  ChatDTO.swift
//  BoardGameRef
//
//  Created by Claude on 1/8/26.
//

import Foundation

// MARK: - Request DTOs

struct NewChatRequest: Encodable {
    let userText: String
}

struct ContinueChatRequest: Encodable {
    let userText: String
}

// MARK: - Response DTOs

enum MessageContentDTO: Decodable {
    case text(String)
    case image(imageUrl: String, alt: String?)
    case toolCall(toolCallId: String, toolName: String, arguments: [String: AnyCodable])
    case toolResult(toolCallId: String, toolName: String, result: AnyCodable)

    enum CodingKeys: String, CodingKey {
        case type, text, imageUrl, alt, toolCallId, toolName, arguments, result
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "text":
            let text = try container.decode(String.self, forKey: .text)
            self = .text(text)
        case "image":
            let imageUrl = try container.decode(String.self, forKey: .imageUrl)
            let alt = try container.decodeIfPresent(String.self, forKey: .alt)
            self = .image(imageUrl: imageUrl, alt: alt)
        case "tool_call":
            let toolCallId = try container.decode(String.self, forKey: .toolCallId)
            let toolName = try container.decode(String.self, forKey: .toolName)
            let arguments = try container.decode([String: AnyCodable].self, forKey: .arguments)
            self = .toolCall(toolCallId: toolCallId, toolName: toolName, arguments: arguments)
        case "tool_result":
            let toolCallId = try container.decode(String.self, forKey: .toolCallId)
            let toolName = try container.decode(String.self, forKey: .toolName)
            let result = try container.decode(AnyCodable.self, forKey: .result)
            self = .toolResult(toolCallId: toolCallId, toolName: toolName, result: result)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown message content type: \(type)"
            )
        }
    }
}

// Helper type for decoding arbitrary JSON values
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}

struct MessageMetadata: Decodable {
    let provider: String?
}

struct MessageDTO: Decodable {
    let role: String
    let content: [MessageContentDTO]
    let metadata: MessageMetadata?
}

struct GetMessagesResponse: Decodable {
    let messages: [MessageDTO]
    let hasMore: Bool
}
