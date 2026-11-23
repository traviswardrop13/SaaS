# Private iPhone upgrade test

This test opens the rebuilt app over an existing Sona install on one iPhone. The working branch stays separate from the App Store release.

## Private build status

The signed development build is version **1.0.12 (7)**. It includes the games-first Home, the Piano Tiles heart-loss fix, and the refreshed Fruit Slice board, Games cover and setup demo. The signature verifies locally, and the app identifier and signing team match the archived Sona build. Check that the connected phone is covered by the development profile before installation.

The 95 current migration tests passed. The earlier simulator upgrade preserved eight fictional players across four legacy storage locations. The signed build still needs to prove the migration, existing access and microphone behavior on a real phone.

## Before we install

1. Leave the current Sona installed. Use an iPhone with some saved practice, a book bookmark, and the access you want us to verify. A spare iPhone is a good first device if one is available.
2. Back up the phone in Finder on the Mac. Choose an encrypted local backup if available, and keep the backup password private. Keep a Sona backup code or file too if the installed app offers it. [Apple’s Finder backup steps](https://support.apple.com/en-us/108796)
3. Connect and unlock the iPhone. Accept the Trust prompt if it appears. Xcode may ask you to enable Developer Mode as the device pairs. [Apple’s device pairing steps](https://developer.apple.com/documentation/xcode/building-and-running-an-app) · [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
4. Confirm that I can install the private build over the current copy once the backup is complete. With the phone connected, I’ll compare its installed Sona version with the test build and confirm it’s the device covered by the signing profile. [Apple’s upgrade signing notes](https://developer.apple.com/library/archive/technotes/tn2319/)

## What we verify

- Record the old app’s player count, selected sounds, practice totals, rewards, book positions, sharing settings, and access state. Keep family names and credentials private.
- Launch the rebuild and compare those records. Check that each player still has their own settings and that existing paid or promised access is reflected on the device.
- Close and reopen twice. Check that records stay in place, that counts and rewards do not duplicate, and that a new action saves to the right player.
- Open **Pick a game** from Home and launch any game available to the active player. Verify that the game uses that player’s practice sound and does not require completing the daily adventure.
- Play a wave of Fruit Slice. Check that the fruit is easy to see against the new shoreline and that a slice, a heart loss and restarting the round behave as expected.
- Exercise one sound power, a new-life turn, and weekly report Settings. Test the real confirmation email only with a dedicated address you approve.
