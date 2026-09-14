import admin from "firebase-admin";
import { env } from "./env";
import { logger } from "../utils/logger";

let initialized = false;

/** Vercel/Render deployments only ever carry inline credentials — no service-account file. */
export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) return;

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    initialized = true;
    logger.info("Firebase Admin initialized from inline credentials");
    return;
  }

  throw new Error(
    "Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  );
}

export function firebaseAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}
