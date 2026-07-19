# Family Life OS — no-command-line setup

This project is designed to be uploaded through the GitHub, Firebase, and Vercel websites. You do **not** need Terminal, npm, GitHub Desktop, or a local build.

## What is included

- All existing Family Life OS sections from the uploaded app
- Safe empty starting data; no personal/sample records
- Firebase email/password login
- Automatic realtime sync using the same login on desktop and mobile
- Private per-user Realtime Database paths
- Receipts & Coupons with metadata, search, return dates, expiration dates, camera capture, image/PDF upload, preview, edit, and delete
- Image/PDF attachments in Records
- Firebase Storage file validation and private rules
- Gemini nutrition endpoint and lesson-plan endpoint
- No service worker

## Before you begin

You need accounts for:

- GitHub
- Firebase / Google Cloud
- Vercel
- Google AI Studio

Cloud Storage for new Firebase projects requires the Firebase **Blaze pay-as-you-go plan**. Set a Google Cloud billing budget/alert. The app limits individual uploads to 10 MB, but Firebase/Google Cloud usage is still your responsibility.

---

# Part 1 — Create the new GitHub repository

1. Download and unzip `family-life-os-ready.zip`.
2. Sign in to GitHub.
3. Click the **+** button in the upper-right corner.
4. Click **New repository**.
5. Repository name: `family-life-os-new`.
6. Choose **Private**.
7. Leave **Add a README file**, `.gitignore`, and license turned off. This avoids conflicts because those files are already included.
8. Click **Create repository**.
9. On the empty repository page, click **uploading an existing file**. If that link is not shown, click **Add file > Upload files**.
10. Open the unzipped project folder on your computer.
11. Select and drag **all contents** into the GitHub upload page. Upload these at the repository root:

```text
api/
firebase-config.js
index.html
manifest.json
icon-192.svg
icon-512.svg
database.rules.json
storage.rules
vercel.json
README.md
START-HERE.txt
.gitignore
```

12. Verify that the `api` folder contains `nutrition.js` and `lesson-plan.js`.
13. In **Commit message**, enter `Initial clean Family Life OS project`.
14. Select **Commit directly to the main branch**.
15. Click **Commit changes**.

Do not upload the ZIP itself. Upload the unzipped contents.

---

# Part 2 — Create the new Firebase project

## 2A. Create the project

1. Open Firebase Console.
2. Click **Create a project**.
3. Project name: `Family Life OS New` or another new name.
4. Google Analytics is optional and not required by this app.
5. Finish creating the project.

## 2B. Register the web app and get the config

1. On the Firebase project Overview page, click the **Web** icon (`</>`).
2. App nickname: `Family Life OS Web`.
3. Do **not** select Firebase Hosting; Vercel will host the app.
4. Click **Register app**.
5. Firebase displays a `firebaseConfig` object. Keep this page open or copy the values somewhere temporarily.
6. You need these exact values:

```text
apiKey
authDomain
databaseURL
projectId
storageBucket
messagingSenderId
appId
```

If `databaseURL` is not displayed yet, return after creating Realtime Database and copy the updated config from **Project settings > General > Your apps > SDK setup and configuration > Config**.

## 2C. Enable Email/Password Authentication

1. In the Firebase left sidebar, open **Authentication**.
2. Click **Get started**.
3. Open **Sign-in method**.
4. Select **Email/Password**.
5. Enable **Email/Password**. Email-link/passwordless sign-in can remain off.
6. Click **Save**.

## 2D. Create Realtime Database

1. In the Firebase left sidebar, open **Realtime Database**.
2. Click **Create Database**.
3. Choose a database location near you. Keep this location because it cannot be changed later.
4. Choose **Start in locked mode**.
5. Click **Enable**.
6. Open the **Rules** tab.
7. On your computer, open the included `database.rules.json` file and copy all of it.
8. Replace everything in the Firebase Rules editor with that content.
9. Click **Publish**.

The rule ensures a signed-in user can only read and write `/users/their-own-uid`.

## 2E. Create Cloud Storage

1. In the Firebase left sidebar, open **Storage**.
2. Click **Get started**.
3. Firebase currently requires the **Blaze** plan for new Cloud Storage buckets. Follow the upgrade prompt and attach a Google Cloud billing account.
4. Choose a Storage location. A US free-tier-eligible region can reduce costs when appropriate for you.
5. Finish creating the bucket.
6. Open the **Rules** tab.
7. On your computer, open the included `storage.rules` file and copy all of it.
8. Replace everything in the Storage Rules editor.
9. Click **Publish**.

The rule allows only the signed-in owner to access their files, limits each file to under 10 MB, and accepts only images and PDFs.

## 2F. Copy the final Firebase config

1. Click the gear next to **Project Overview**.
2. Click **Project settings**.
3. Open **General**.
4. Scroll to **Your apps**.
5. Select `Family Life OS Web`.
6. Under **SDK setup and configuration**, choose **Config**.
7. Copy the values from the displayed `firebaseConfig` object.

---

# Part 3 — Put the Firebase config into GitHub

1. Return to your new GitHub repository.
2. Click `firebase-config.js`.
3. Click the pencil icon (**Edit this file**).
4. Replace the placeholder object with your Firebase values. Keep this exact wrapper:

```js
window.FAMILY_OS_FIREBASE_CONFIG = {
  apiKey: "YOUR_REAL_VALUE",
  authDomain: "YOUR_REAL_VALUE",
  databaseURL: "YOUR_REAL_VALUE",
  projectId: "YOUR_REAL_VALUE",
  storageBucket: "YOUR_REAL_VALUE",
  messagingSenderId: "YOUR_REAL_VALUE",
  appId: "YOUR_REAL_VALUE"
};
```

5. Do not paste `const firebaseConfig =` from Firebase. The file must start with `window.FAMILY_OS_FIREBASE_CONFIG =` as shown above.
6. Click **Commit changes...**.
7. Commit message: `Connect new Firebase project`.
8. Choose **Commit directly to the main branch**.
9. Click **Commit changes**.

Firebase web config is not a private secret. The Database and Storage security rules plus Authentication protect the data. Never put the Gemini API key in this file.

---

# Part 4 — Create the Gemini API key

1. Open Google AI Studio.
2. Open **API Keys**.
3. Click **Create API key**.
4. Copy the new key.
5. Store it temporarily in a password manager or another secure location.
6. Do not commit it to GitHub.

The Vercel API functions default to `gemini-2.5-flash-lite`. You can override the model later with the optional `GEMINI_MODEL` environment variable.

---

# Part 5 — Connect the GitHub repository to Vercel

1. Sign in to Vercel.
2. From the dashboard, click **Add New... > Project**.
3. Under **Import Git Repository**, connect GitHub if prompted.
4. Find `family-life-os-new` and click **Import**.
5. Project name: keep the default or enter `family-life-os-new`.
6. Framework Preset: select **Other** if Vercel does not detect a framework.
7. Root Directory: leave as `./`.
8. Leave Build Command, Output Directory, and Install Command at their defaults/blank. This is a static site with Vercel functions and has no build step.
9. Expand **Environment Variables** before deploying.
10. Add the first variable:

```text
Name: GEMINI_API_KEY
Value: the Gemini API key from Google AI Studio
Environments: Production, Preview, Development
```

11. Add the second variable:

```text
Name: FIREBASE_WEB_API_KEY
Value: the exact apiKey from firebase-config.js
Environments: Production, Preview, Development
```

12. Optional third variable:

```text
Name: GEMINI_MODEL
Value: gemini-2.5-flash-lite
```

13. Click **Deploy**.
14. When deployment finishes, click **Visit** and copy the hostname. It looks similar to:

```text
family-life-os-new.vercel.app
```

Environment-variable changes apply only to new deployments. If you add or change a variable after deployment, open **Deployments**, use the three-dot menu on the latest deployment, and click **Redeploy**.

---

# Part 6 — Authorize the Vercel domain in Firebase

This is required for Firebase login on the Vercel website.

1. Return to Firebase Console.
2. Open **Authentication**.
3. Open **Settings**.
4. Find **Authorized domains**.
5. Click **Add domain**.
6. Paste only the hostname, without `https://` and without a slash. Example:

```text
family-life-os-new.vercel.app
```

7. Save it.

If you later add a custom domain in Vercel, add that hostname here too.

---

# Part 7 — First login and sync test

1. Open the Vercel website.
2. Click **Create account**.
3. Enter your email and a password with at least six characters.
4. Add one test task on desktop.
5. Open the same Vercel URL on your phone.
6. Sign in with the exact same email/password.
7. Confirm the task appears automatically.
8. Add a second task on the phone and confirm it appears on desktop.
9. Open **Records**, create a record, save it, then use **Camera** or **Image/PDF** on the record card.
10. Open **Receipts**, create a receipt or coupon, save it, then attach an image or PDF.
11. Test **Kitchen > Recipes > AI Calc** after entering ingredients and servings.

---

# Part 8 — Bring over data from the old app

Do this only after the new app passes the sync and upload tests.

1. In the old app, open **Family Sync**.
2. Choose **Share my data > Download as file**.
3. Save the JSON backup somewhere safe.
4. In the new app, open the side menu.
5. Click **Backup / Import**.
6. Choose **Import from family**.
7. Upload the old JSON file.
8. Check Tasks, Calendar, Groceries, Kitchen, Home Care, Trips, Parties, Child, and Records.

The new Receipts & Coupons list starts empty because it did not exist in the old app.

Do not delete or disconnect the old production project until you have tested the imported data and kept at least one backup file.

---

# Editing files later using only GitHub

1. Open the repository on GitHub.
2. Click the file you want to change.
3. Click the pencil icon.
4. Make the change.
5. Click **Commit changes...**.
6. Commit directly to `main`.
7. Vercel automatically creates a new deployment from that commit.

For replacing several files at once, use **Add file > Upload files**, drag the changed files/folders, and commit them.

---

# Troubleshooting

## The site says “Firebase setup needed”

`firebase-config.js` still contains a `PASTE_` value, or the config object was pasted with the wrong wrapper. Use `window.FAMILY_OS_FIREBASE_CONFIG = { ... };`.

## Login says the domain is not authorized

Add the exact Vercel hostname in Firebase **Authentication > Settings > Authorized domains**.

## “Permission denied” when syncing

Republish the included `database.rules.json` in **Realtime Database > Rules** and confirm you are signed in.

## Upload fails

Check all of these:

- Firebase project is on Blaze
- Storage bucket exists
- Included `storage.rules` were published
- File is an image or PDF
- File is smaller than 10 MB
- `storageBucket` in `firebase-config.js` exactly matches Firebase config

## AI Calc or lesson plan fails

1. In Vercel, open the project.
2. Open **Environment Variables**.
3. Confirm `GEMINI_API_KEY` and `FIREBASE_WEB_API_KEY` exist.
4. Confirm `FIREBASE_WEB_API_KEY` matches the Firebase config `apiKey` exactly.
5. Redeploy because variable changes do not affect old deployments.
6. In Google AI Studio, confirm the key is active and allowed to use the Gemini API.

## Phone and desktop show different data

Confirm both devices are signed in with the exact same Firebase email account and are opening the same Vercel project URL.

## Important security notes

- Keep the GitHub repository private.
- Never put `GEMINI_API_KEY` in GitHub or `firebase-config.js`.
- Do not use test-mode public Database or Storage rules.
- Use the included private rules.
- Set billing alerts for the Firebase/Google Cloud project.
- The app intentionally has no service worker, so new deployments are less likely to be hidden by stale offline caches.
