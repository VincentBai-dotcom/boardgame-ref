//
//  ChatInputBox.swift
//  BoardGameRef
//
//  Created by 白皓诚 on 1/6/26.
//

import SwiftUI
import UIKit

struct ChatInputBox: View {
    @Binding var text: String
    var onSend: () -> Void

    @FocusState private var isFocused: Bool
    @State private var showExpandedView = false
    @State private var textFieldWidth: CGFloat = 0

    // Accurately calculate if text exceeds 5 lines
    private var shouldShowExpandButton: Bool {
        guard textFieldWidth > 0, !text.isEmpty else { return false }

        let lines = numberOfLines(
            text: text,
            font: UIFont.preferredFont(forTextStyle: .body),
            width: textFieldWidth - 24 - 36  // Subtract padding
        )
        return lines >= 5
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
                    .background(
                        GeometryReader { geometry in
                            Color(.systemGray6)
                                .onAppear {
                                    textFieldWidth = geometry.size.width
                                }
                                .onChange(of: geometry.size.width) {
                                    _,
                                    newWidth in
                                    textFieldWidth = newWidth
                                }
                        }
                    )
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
        NavigationStack {
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

// Accurate line counting using UIKit's NSLayoutManager
func numberOfLines(
    text: String,
    font: UIFont,
    width: CGFloat
) -> Int {
    let textStorage = NSTextStorage(
        string: text,
        attributes: [
            .font: font
        ]
    )

    let layoutManager = NSLayoutManager()
    let textContainer = NSTextContainer(
        size: CGSize(width: width, height: .greatestFiniteMagnitude)
    )

    textContainer.lineFragmentPadding = 0
    textContainer.maximumNumberOfLines = 0

    layoutManager.addTextContainer(textContainer)
    textStorage.addLayoutManager(layoutManager)

    var lineCount = 0
    var index = 0
    let glyphCount = layoutManager.numberOfGlyphs

    while index < glyphCount {
        var range = NSRange()
        layoutManager.lineFragmentRect(
            forGlyphAt: index,
            effectiveRange: &range
        )
        index = NSMaxRange(range)
        lineCount += 1
    }

    return lineCount
}

#Preview {
    struct PreviewWrapper: View {
        @State private var text =
            "fdsafdsafdsafdsafdsafdsafdafdsafdasfdsafdsafdsafdsafdsafdsafdsafdsafdafdsafdasfdsafdsafdsafdsafdsafdsafdsafdsafdafdsafdasfdsafdsafdsafdsafdsafdsafdsafdsafdafdsafdasfdfsafdsas"

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
