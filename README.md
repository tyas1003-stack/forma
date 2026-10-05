# Forma — Virtual Try-On prototype

This is an offline-first, mobile-friendly web app. It has no account, analytics, network calls, or server upload: photos stay in the browser tab and are discarded when the tab is closed.

## What it does

- Validates full-body, top, and pants/skirt images (JPG/PNG/WEBP, 10 MB maximum).
- Uses height and weight for a transparent, coarse estimate of torso length and body width.
- Compares top chest width/length and bottom waist width/length against body estimates.
- Shows scaled top and bottom overlays with separate fit labels: tight, regular, comfortable, or oversized.

## Use it on a phone

The folder is an installable Progressive Web App (PWA). PWA installation requires a secure origin (HTTPS) on iPhone and Android; `file://` cannot provide that guarantee. Keep the folder local and serve it only from a trusted local HTTPS address on your own network, then select **Add to Home Screen** in the mobile browser. The app runs offline after its first secure load.

For a truly downloadable native app file (APK for Android or IPA for iPhone), this same local code can be wrapped in a native container. An Android build machine/signing key or an Apple developer signing account is required, so no fake or insecure install file is included here.

## Important limitation

Height, weight, and one photograph cannot reliably determine chest/waist/hip circumference, pose, fabric drape, garment cut, or how a garment will fit. The visual in this prototype is deliberately marked as a simulation and must not be used as a sizing guarantee.

## Production integration path

Replace the heuristic in `app.js` (`estimateBody` and the rendering block) with a server-side pipeline that:

1. Obtains consent and securely stores/deletes user images.
2. Uses pose/keypoint estimation and optional user-provided chest/waist/hip/inseam measurements.
3. Segments the person and garment, estimates garment category and mask, then calls a virtual try-on model.
4. Returns a generated result and a confidence/fit explanation. API keys must stay on the server, never in this browser app.
