import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { env } from "./env";
import { logger } from "../utils/logger";

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length > 0) return;

  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const resolved = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(resolved)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf-8"));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      initialized = true;
      logger.info("Firebase Admin initialized from service account file");
      return;
    }
    logger.warn(`Service account file not found at ${resolved}, trying inline credentials`);
  }

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
    "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  );
}

export function firebaseAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}
