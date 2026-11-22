# Native wrapper build and release

Both sites can be installed as PWAs today where the browser supports installation. This guide prepares the Android Trusted Web Activity (TWA) path. It does not claim an APK, a verified association, or any store listing.

| Brand | Manifest to feed Bubblewrap or PWABuilder | Android association endpoint |
|---|---|---|
| ai.spaincos | `https://ai.spaincos.com/manifest.webmanifest` | `https://ai.spaincos.com/.well-known/assetlinks.json` |
| BoundView | `https://boundview.com/boundview-manifest.webmanifest` | `https://boundview.com/.well-known/assetlinks.json` |

## Android

1. Confirm the package ID with the owner. Use separate package IDs and working directories for the two brands. The package ID is permanent after publishing; do not guess it.
2. Install Bubblewrap (`npm install -g @bubblewrap/cli`) and follow `bubblewrap doctor` for its JDK and Android SDK prerequisites. Alternatively, give the matching manifest URL to PWABuilder and select its Android TWA package.
3. In an empty directory per brand, run `bubblewrap init --manifest=<manifest-url-from-table>`. Check the generated `twa-manifest.json`: the package ID must be the owner's, the host must match the brand, and the start path must match the manifest. Do not configure the other host as a trusted origin unless both origins are explicitly authorized for this same wrapper.
4. Run `bubblewrap build`. Keep keystores and passwords outside git. Use the app bundle for the Play Console release; use a locally signed APK for device testing.
5. For Play builds use the SHA-256 **App signing certificate** from Play Console → App integrity, not the upload key. For a locally signed test build, get the test certificate SHA-256 using `apksigner verify --print-certs <apk>`. Do not publish debug certificates on production origins.
6. Generate each site's statement using `node tools/gen-twa-assetlinks.mjs <package-id> <SHA-256-fingerprint>`. The checked-in public endpoint deliberately serves `[]` until signing details are confirmed. Before publishing populated files, arrange host-specific routing so each host serves only its own statement. Do not deploy both packages' statements indiscriminately on the shared endpoint. Commit only the approved public fingerprints, never private keys or credentials.
7. On each host, confirm `curl -i https://<host>/.well-known/assetlinks.json` returns direct HTTP 200, `application/json`, and the exact package and signing fingerprint. Then test the signed release on a real Android device: launch without browser chrome, check start URL and auth, then check deep links and external navigation. HTTP alone cannot prove TWA verification. Upload through the owner's Play Console and complete the required testing and review.

## iOS

Safari's Share → Add to Home Screen path is not an App Store app. Use a Capacitor scaffold with bundled application assets, and plan platform-specific behavior (auth callbacks, links, file handling and offline/error handling) before submission; a remote website shell alone does not establish App Store eligibility. An owner must provide the Apple Developer team and bundle ID, sign in Xcode, test via TestFlight on a real device, and submit through App Store Connect. No iOS wrapper or review result is claimed here.
