# Interval — iPhone app

This folder contains a native iOS/Xcode wrapper around the Interval web app.
The app loads `index.html` locally inside a WKWebView, so the workout UI and logic are bundled into the app. The native wrapper also keeps the iPhone screen awake while the app is visible.

## Free: install on your own iPhone for testing

You do NOT need the paid Apple Developer Program just to run this on your own device.

1. Use a Mac and install Xcode from the Mac App Store.
2. Open `IntervalApp.xcodeproj`.
3. In Xcode, add your Apple Account under **Xcode > Settings > Accounts**.
4. Select the **Interval** target, then **Signing & Capabilities**.
5. Turn on **Automatically manage signing** and choose your **Personal Team**.
6. Change the Bundle Identifier to something unique, such as `com.yourname.interval`.
7. Connect your iPhone to the Mac, unlock it, and select it as the run destination.
8. If prompted, enable Developer Mode on the iPhone and trust the Mac.
9. Press **Run** in Xcode.

With a free Personal Team, Apple currently limits provisioning to 7 days, so the app must be rebuilt/reinstalled periodically.

## Paid: TestFlight / App Store

Join the Apple Developer Program ($99 USD/year, subject to local pricing), then use the same project with your paid team selected under **Signing & Capabilities**. Xcode can automatically manage the signing assets. For TestFlight/App Store distribution, create the app record in App Store Connect with the same Bundle ID, then archive and distribute from Xcode.
