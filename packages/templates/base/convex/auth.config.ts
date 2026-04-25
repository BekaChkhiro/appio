// Firebase Auth → Convex identity bridge.
//
// FIREBASE_PROJECT_ID is injected at build time per generated app. The
// Convex deployment validates the issuer + audience automatically against
// Firebase's published JWKS.

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ?? "appio-sandbox";

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      applicationID: FIREBASE_PROJECT_ID,
    },
  ],
};
