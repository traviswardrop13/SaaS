#if canImport(UIKit)
import SwiftUI
import UIKit

/// Canonical authored artwork only. The global bundle preserves paths below
/// /assets directly (crafted/..., books/..., adventure/...). The two setup
/// originals outside those directories have dedicated, collision-free names.
enum NativeSetupArtworkLoader {
    private static let cache = NSCache<NSString, UIImage>()
    static func image(path: String, crop: CGRect? = nil) -> UIImage? {
        let key = (path + (crop.map { "#\($0)" } ?? "")) as NSString
        if let held = cache.object(forKey: key) { return held }
        let special = ["/assets/rachel-wardrop-profile.jpg": "setup-rachel", "/icon-192.png": "setup-app-icon"]
        var original: UIImage?
        if let name = special[path] { original = UIImage(named: name) }
        else if path.hasPrefix("/assets/") {
            let relative = String(path.dropFirst("/assets/".count))
            let pieces = relative.split(separator: "/", omittingEmptySubsequences: false)
            guard !pieces.isEmpty, pieces.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }),
                  relative.range(of: "%|:|\\\\", options: .regularExpression) == nil else { return nil }
            if let bundle = Bundle.main.resourceURL {
                original = UIImage(contentsOfFile: bundle.appendingPathComponent(relative).path)
            }
            if original == nil { original = UIImage(named: URL(fileURLWithPath: relative).deletingPathExtension().lastPathComponent) }
        }
        guard let original else { return nil }
        let result: UIImage
        if let crop {
            guard let cg = original.cgImage?.cropping(to: crop) else { return nil }
            result = UIImage(cgImage: cg, scale: original.scale, orientation: original.imageOrientation)
        } else { result = original }
        cache.setObject(result, forKey: key)
        return result
    }
}

struct NativeSetupArtworkImage: View {
    let path: String
    var contentMode: ContentMode = .fit
    var body: some View {
        Group {
            if let image = NativeSetupArtworkLoader.image(path: path) {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else {
                // The shipping page leaves failed artwork empty; it does not
                // substitute a new illustration or move the parent's controls.
                Color.clear
            }
        }
    }
}

enum NativeSetupArtworkStyle {
    static let ink = color(0x3d342e), muted = color(0x786959), coral = color(0xbe533e)
    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

struct NativeSetupRachelView: View {
    private let credential = "Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship."
    var body: some View {
        VStack(spacing: 20) {
            NativeSetupArtworkImage(path: "/assets/rachel-wardrop-profile.jpg", contentMode: .fill)
                .frame(width: 245, height: 270)
                .clipShape(RoundedRectangle(cornerRadius: 17))
                .padding(8)
                .background(NativeSetupArtworkStyle.color(0xffd47c), in: RoundedRectangle(cornerRadius: 24))
                .rotationEffect(.degrees(3))
                .accessibilityLabel("Rachel Wardrop")
            VStack(spacing: 12) {
                Text("Built with Rachel,\nMS, CF-SLP")
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .foregroundStyle(NativeSetupArtworkStyle.ink)
                Text("a pediatric speech-language pathologist in her clinical fellowship.")
                    .font(.system(size: 15, design: .rounded)).foregroundStyle(NativeSetupArtworkStyle.muted)
            }
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(credential)
            .accessibilityAddTraits(.isHeader)
            Text("Sona co-founder")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(NativeSetupArtworkStyle.coral)
                .padding(.horizontal, 15).padding(.vertical, 8)
                .background(Color.white, in: Capsule())
                .overlay(Capsule().stroke(NativeSetupArtworkStyle.color(0xead7bf)))
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("setup-rachel")
    }
}
#endif
