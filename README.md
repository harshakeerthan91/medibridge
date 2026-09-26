# MediBridge

MediBridge is a **PATIENT-ONLY, multilingual medical-record hub**.

*Promise: “Your medical records. Clear explanations. In your language.”*

## 🚀 Deployment Status & Required Actions

**Action Required:** Automated deployment to GitHub and Vercel could not be completed because `git` and `gh` CLI are not installed, and `vercel` CLI is not logged in. Please perform the following steps to deploy the application:

1. **Install Git:** Download and install [Git for Windows](https://gitforwindows.org/).
2. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create medibridge --private --source=. --remote=origin --push
   ```
3. **Deploy to Vercel:**
   ```bash
   npx vercel login
   npx vercel --prod
   ```
4. **Configure Vercel Environment Variables:** In the Vercel Dashboard, set the following environment variables (found in `.env.local`):
   - `NEXT_PUBLIC_APP_URL` (set to your new Vercel production URL)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `GROQ_API_KEY`
   - `GROQ_CHAT_MODEL`
   - `GEMINI_API_KEY`
   - `GEMINI_DOCUMENT_MODEL`
   After setting these, redeploy the project in Vercel.
5. **Configure Supabase Auth Redirects:** Go to your Supabase project > Authentication > URL Configuration.
   - Set **Site URL** to `https://<YOUR_VERCEL_PROJECT_URL>`.
   - Add `https://<YOUR_VERCEL_PROJECT_URL>/**` to **Redirect URLs**.

Once deployed, update this README with your actual Repository URL and Production URL.

## 🛠 WHAT I NEED TO DO MANUALLY — STEP-BY-STEP SETUP

This project requires manual configuration of third-party services (Supabase, Google Gemini, and Groq Groq). **You cannot use the application fully until these steps are completed.**

---

### 1. Environment Variables

We use `.env.local` for local development. **Never commit `.env.local` or any API keys to Git.**

**Action:** Rename the provided `.env.example` to `.env.local`. 

Here are the required variables and what they do:

| Variable | Required? | Public/Secret? | Where to get it |
|----------|-----------|----------------|-----------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public | Default: `http://localhost:3000` locally. Set to your Vercel URL in production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public | Supabase Project Settings > API > Project API Keys (anon, public) |
| `GROQ_API_KEY` | Yes | Secret | Groq Console > API Keys. *DO NOT EXPOSE TO BROWSER.* |
| `GROQ_BASE_URL` | Yes | Public | Default: `https://api.groq.com/v1` |
| `GROQ_CHAT_MODEL` | Yes | Public | Default: `llama-3.3-70b-versatile` |
| `GEMINI_API_KEY` | Yes | Secret | Google AI Studio > API Keys. *DO NOT EXPOSE TO BROWSER.* |
| `GEMINI_DOCUMENT_MODEL` | Yes | Public | Default: `gemini-1.5-flash` |

---

### 2. Supabase Database Setup

All data, user accounts, and private files are stored in Supabase.

1. **Create Project:** Go to [database.new](https://database.new/) and create a new project. Wait for the database to provision.
2. **Apply Initial Schema:** 
   - Navigate to **SQL Editor** in the Supabase left sidebar.
   - Click "New Query".
   - Open `supabase/migrations/001_initial_schema.sql` from this codebase, copy all the text, paste it into the SQL Editor, and hit **Run**.
   - *Success looks like:* "Success. No rows returned."
   - Next, open `supabase/migrations/003_grant_permissions.sql`, copy the text, paste it into a new SQL Editor tab, and hit **Run**. This securely grants the application access to read/write the tables under Row Level Security.
3. **Verify:** Go to the **Table Editor**. You should see tables like `documents`, `profiles`, `lab_results`, etc. Row Level Security (RLS) policies are already baked into the SQL script.

---

### 3. Authentication Configuration

MediBridge uses Supabase Email/Password authentication.

1. Go to **Authentication > Providers** and ensure **Email** is enabled (it usually is by default).
2. Go to **Authentication > URL Configuration**.
3. Under **Site URL**, enter exactly: `http://localhost:3000`
4. *Important for later:* When you deploy to Vercel, you must return here and change the Site URL to your Vercel URL (e.g., `https://medibridge-demo.vercel.app`) so password reset emails route correctly.

---

### 4. Private File Storage

MediBridge allows patients to upload their private medical PDFs and images. **These must be secured.**

1. Go to **Storage** in the Supabase left sidebar.
2. Click **New Bucket**.
3. Name it **EXACTLY**: `medical-records`
4. **CRITICAL:** Ensure the "Public bucket" toggle is **OFF**. Medical files must be private.
5. Apply Storage Security Policies:
   - Go back to the **SQL Editor**.
   - Open `supabase/migrations/002_storage_policies.sql`, copy all the text, paste it into a new query, and hit **Run**.
   - *Verification:* This ensures patients can only upload 10MB limits, only PDF/images, and can only download their own files.

---

### 5. Groq / Groq Configuration

Groq handles generating patient-friendly explanations, translating medical jargon, assembling visit briefs, and answering chat questions.

1. Go to [console.x.ai](https://console.x.ai/).
2. You must configure billing. *Note: A consumer X Premium subscription does not grant API access; API credits must be purchased separately.*
3. Go to **API Keys** and generate a new key.
4. Copy the key and paste it into `.env.local` as `GROQ_API_KEY`.
5. *Troubleshooting:* If chats instantly fail with an error, check your Groq billing console to ensure you have positive credit balance.

---

### 6. Gemini Configuration

Gemini Flash is used exclusively for OCR (Optical Character Recognition) and structured data extraction from uploaded PDFs and images.

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API Key** and create a new key.
3. Paste it into `.env.local` as `GEMINI_API_KEY`.
4. *Quota:* The free tier is sufficient for testing.

---

### 7. Run Locally

With your `.env.local` fully populated and your database provisioned:

1. Requires Node.js v18+.
2. Install dependencies: 
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000). 
   *Note: If you change `.env.local` variables while the server is running, you must stop the server (Ctrl+C) and restart `npm run dev`.*

---

### 8. Deploy Publicly (Vercel)

To host the site publicly over HTTPS, we use Vercel.

1. Install the Vercel CLI locally: `npm i -g vercel`
2. Run the deployment command:
   ```bash
   npx vercel
   ```
3. Log in with your GitHub/Vercel account via the browser prompt.
4. Answer the CLI setup questions (hitting `Enter` to accept all defaults is fine).
5. **CRITICAL:** Once deployed, go to the [Vercel Dashboard](https://vercel.com). Select your new project > **Settings** > **Environment Variables**.
6. Copy every variable from your `.env.local` file into the Vercel dashboard. (Remember to change `NEXT_PUBLIC_APP_URL` to your new production Vercel domain).
7. Trigger a new deployment in Vercel to bake in the environment variables.
8. Go to **Supabase > Auth > URL Configuration** and add your new Vercel domain to the **Redirect URLs**.

---

### 9. Other Manual Dependencies

- **Emails:** Password resets and email verification emails are sent via Supabase's built-in sandbox SMTP server. You have a strict rate limit of emails per hour on the free tier.
- **In-App Schedules / Calendars:** The medication schedule and follow-up trackers are entirely in-app checklists. No external notification systems (Push, SMS, or Google Calendar API) are implemented or required.

---

### 10. Final Verification Checklist

Once running locally or deployed, perform this test:

- [ ] **Login:** Create an account. You should receive a Supabase verification email. (If testing locally, you can disable "Confirm email" in Supabase Auth settings to skip this step).
- [ ] **Language:** Click the language selector on the login screen. Verify the UI changes instantly.
- [ ] **Upload:** Go to "My Records" and upload a sample medical PDF.
- [ ] **Extraction Review:** Wait for the AI extraction to complete. Click "Review extracted data" and ensure Gemini correctly parsed the lab results/medicines. Click Confirm.
- [ ] **Groq Chat:** Go to "Ask MediBridge". Ask "What do my results mean?". Verify Groq responds with citations linking to your document.
- [ ] **Security/Isolation:** Open an Incognito window. Create a second account. Ensure the second account cannot see the first account's uploaded documents.
- [ ] **Deletion:** Delete your uploaded document. Verify it disappears from the UI, and optionally check the Supabase Storage dashboard to confirm the raw PDF was actually deleted.

### Common Errors & Fixes
- **Error: "The AI service is currently unavailable."**
  - *Fix:* Your Groq or Gemini API key is missing or out of credits. Check `.env.local`. Do NOT disable AI features in code.
- **Error: Document stuck in "Processing..." forever.**
  - *Fix:* Check your terminal console for Next.js server errors. The API request to Gemini likely timed out or failed.
- **Error: Login fails silently or throws generic error.**
  - *Fix:* Your `NEXT_PUBLIC_SUPABASE_URL` is incorrect, or you forgot to run the SQL migration script so the `profiles` table doesn't exist.
