// Emit a single site's Digital Asset Links statement to stdout.
const [packageName, ...fingerprints] = process.argv.slice(2);
const validPackage = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i;
const validFingerprint = /^(?:[0-9a-f]{2}:){31}[0-9a-f]{2}$/i;
if (!validPackage.test(packageName ?? "") ||
    !fingerprints.length || fingerprints.some(value => !validFingerprint.test(value))) {
  console.error("Usage: node tools/gen-twa-assetlinks.mjs <android-package> <SHA-256-cert-fingerprint> [additional-fingerprints...]");
  process.exitCode = 1;
} else {
  console.log(JSON.stringify([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: packageName,
      sha256_cert_fingerprints: [...new Set(fingerprints.map(value => value.toUpperCase()))]
    }
  }], null, 2));
}
