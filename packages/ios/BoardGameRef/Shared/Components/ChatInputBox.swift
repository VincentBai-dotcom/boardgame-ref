//
//  ChatInputBox.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/6/26.
//

import SwiftUI

struct ChatInputBox: View {
    @Binding var text: String
    var onSend: () -> Void

    @FocusState private var isFocused: Bool
    @State private var showExpandedView = false

    // Estimate if text exceeds 5 lines
    private var shouldShowExpandButton: Bool {
        let newlineCount = text.filter { $0 == "\n" }.count
        let estimatedLines = newlineCount + 1 + (text.count / 40)  // Rough estimate: ~40 chars per line
        return estimatedLines >= 5
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            // Text input field with embedded buttons
            ZStack {
                // Background and text field
                TextField("Message", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .padding(.trailing, 36)  // Make room for send button
                    .background(Color(.systemGray6))
                    .cornerRadius(20)
                    .lineLimit(1...10)
                    .focused($isFocused)
                    .onSubmit {
                        if !text.trimmingCharacters(in: .whitespacesAndNewlines)
                            .isEmpty
                        {
                            onSend()
                        }
                    }
                    .overlay(alignment: .topTrailing) {
                        // Expand button (top-right) - inline with first line of text
                        if shouldShowExpandButton {
                            Button(action: {
                                showExpandedView = true
                            }) {
                                Image(
                                    systemName:
                                        "arrow.up.left.and.arrow.down.right"
                                )
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(5)
                                .background(Color.blue)
                                .clipShape(Circle())
                            }
                            .padding(6)
                        }
                    }
                    .overlay(alignment: .bottomTrailing) {
                        // Send button (bottom-right) - using overlay for proper positioning
                        Button(action: {
                            if !text.trimmingCharacters(
                                in: .whitespacesAndNewlines
                            )
                            .isEmpty {
                                onSend()
                            }
                        }) {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 28))
                                .foregroundColor(
                                    text.trimmingCharacters(
                                        in: .whitespacesAndNewlines
                                    )
                                    .isEmpty ? Color(.systemGray3) : .blue
                                )
                        }
                        .disabled(
                            text.trimmingCharacters(in: .whitespacesAndNewlines)
                                .isEmpty
                        )
                        .padding(6)
                    }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
        .sheet(isPresented: $showExpandedView) {
            ExpandedTextView(
                text: $text,
                onSend: onSend,
                isPresented: $showExpandedView
            )
        }
    }
}

// Full-screen expanded text editor
struct ExpandedTextView: View {
    @Binding var text: String
    var onSend: () -> Void
    @Binding var isPresented: Bool
    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Large text editor with shrink button
                ZStack(alignment: .topTrailing) {
                    TextEditor(text: $text)
                        .padding()
                        .padding(.top, 32)  // Make room for shrink button
                        .focused($isFocused)
                        .onAppear {
                            isFocused = true
                        }

                    // Shrink button (top-right)
                    Button(action: {
                        isPresented = false
                    }) {
                        Image(systemName: "arrow.down.right.and.arrow.up.left")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(5)
                            .background(Color.blue)
                            .clipShape(Circle())
                    }
                    .padding()
                }

                // Bottom bar with send button
                HStack {
                    Spacer()
                    Button(action: {
                        if !text.trimmingCharacters(in: .whitespacesAndNewlines)
                            .isEmpty
                        {
                            isPresented = false
                            onSend()
                        }
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(
                                text.trimmingCharacters(
                                    in: .whitespacesAndNewlines
                                )
                                .isEmpty ? Color(.systemGray3) : .blue
                            )
                    }
                    .disabled(
                        text.trimmingCharacters(in: .whitespacesAndNewlines)
                            .isEmpty
                    )
                }
                .padding()
                .background(Color(.systemBackground))
            }
            .navigationBarHidden(true)
        }
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var text = ""

        var body: some View {
            VStack {
                Spacer()
                ChatInputBox(
                    text: $text,
                    onSend: {
                        print("Sending: \(text)")
                        text = ""
                    }
                )
            }
        }
    }

    return PreviewWrapper()
}
