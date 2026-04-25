// Firebase config stub — replaced by the orchestrator at generation time.
//
// When this template is used as a generation starting point, the orchestrator
// overwrites this file with the real per-app Firebase config. The values
// below are the appio-prod Firebase Web App used for the T2.3 mobile
// validation harness — they are safe to commit (Firebase Web apiKeys are
// public-by-design; project security comes from Firebase Auth rules and
// Convex's JWT validation).

import type { FirebaseConfig } from "../components/ui/useAuth";

export const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyCtSBjsj2cW3A6SSktbJcoMEsNdACoL-0s",
  authDomain: "appio-prod.firebaseapp.com",
  projectId: "appio-prod",
  storageBucket: "appio-prod.firebasestorage.app",
  messagingSenderId: "405060998452",
  appId: "1:405060998452:web:d2bb07c12c24910b5d4161",
};
