// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SonaSpeech",
    platforms: [.iOS(.v14)],
    products: [
        .library(name: "SonaSpeech", targets: ["SonaSpeechPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0")
    ],
    targets: [
        .target(
            name: "SonaSpeechPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/SonaSpeechPlugin")
    ]
)
