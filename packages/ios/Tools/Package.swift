// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Tools",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "Tools", targets: ["Tools"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.0.0")
    ],
    targets: [
        .target(name: "Tools")
    ]
)
