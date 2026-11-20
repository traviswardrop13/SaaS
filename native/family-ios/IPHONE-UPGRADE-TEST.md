# Private iPhone upgrade test

This test opens the rebuilt app over an existing Sona install on one iPhone. The working branch stays separate from the App Store release.

## Before we install

1. Leave the current Sona installed. Use an iPhone with some saved practice, a book bookmark, and the access you want us to verify. A spare iPhone is a good first device if one is available.
2. Back up the phone in Finder on the Mac. Choose an encrypted local backup if available, and keep the backup password private. Keep a Sona backup code or file too if the installed app offers it. [Apple’s Finder backup steps](https://support.apple.com/en-us/108796)
3. Connect and unlock the iPhone. Accept the Trust prompt if it appears. Xcode may ask you to enable Developer Mode as the device pairs. [Apple’s device pairing steps](https://developer.apple.com/documentation/xcode/building-and-running-an-app) · [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
4. Sign into Xcode with an account on the team that signs the current family app. I’ll check that the test build uses Sona’s existing app ID, signing identity and matching entitlements. Once the backup and signing checks pass, confirm that I can install the test build over the current copy on this phone. [Apple’s upgrade signing notes](https://developer.apple.com/library/archive/technotes/tn2319/)

## What we verify

- Record the old app’s player count, selected sounds, practice totals, rewards, book positions, sharing settings, and access state. Keep family names and credentials private.
- Launch the rebuild and compare those records. Check that each player still has their own settings and that existing paid or promised access is reflected on the device.
- Close and reopen twice. Check that records stay in place, that counts and rewards do not duplicate, and that a new action saves to the right player.
- Exercise one sound power, a new-life turn, and weekly report Settings. Test the real confirmation email only with a dedicated address you approve.
