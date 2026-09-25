import UIKit
import Capacitor

// iOS 27 requires a scene lifecycle for apps built with the iOS 27 SDK.
// Main.storyboard still owns the existing Capacitor bridge and its configuration.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // Preserve the window lookup used by native Capacitor plugins.
        (UIApplication.shared.delegate as? AppDelegate)?.window = window
        window?.rootViewController?.loadViewIfNeeded()
        // Cold launches deliver links here instead of to AppDelegate.
        forward(connectionOptions.urlContexts)
        for activity in connectionOptions.userActivities {
            forward(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        forward(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forward(userActivity)
    }

    private func forward(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: options)
        }
    }

    private func forward(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}
