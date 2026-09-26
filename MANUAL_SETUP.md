# MediBridge Manual Setup Checklist

This is the quick-reference checklist for setting up MediBridge. For detailed step-by-step instructions, refer to the **[STEP-BY-STEP SETUP in README.md](./README.md#-what-i-need-to-do-manually--step-by-step-setup)**.

---

### 1. Environment & API Keys 🔑
- [ ] Rename `.env.example` to `.env.local`.
- [ ] Create a Supabase Project at [database.new](https://database.new/).
- [ ] Copy Supabase URL to `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Copy Supabase Anon Key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Create a **GROQ** API Key at [console.groq.com](https://console.groq.com/) (not Grok/xAI).
- [ ] Copy Groq Key to `GROQ_API_KEY`.
- [ ] Create a Google Gemini API Key at [Google AI Studio](https://aistudio.google.com/).
- [ ] Copy Gemini Key to `GEMINI_API_KEY`.
- [ ] Keep `NEXT_PUBLIC_APP_URL`, `GROQ_CHAT_MODEL`, and `GEMINI_DOCUMENT_MODEL` as defaults for local dev.

---

### 2. Database & Storage Setup 🗄️
- [ ] Go to Supabase Dashboard > SQL Editor.
- [ ] Run `supabase/migrations/001_initial_schema.sql`.
- [ ] Run `supabase/migrations/003_grant_permissions.sql`.
- [ ] Go to Storage and create bucket named `medical-records` — "Public" must be **OFF**.
- [ ] Run `supabase/migrations/002_storage_policies.sql`.
- [ ] Run `supabase/migrations/004_fix_auth_trigger.sql` (fixes Google OAuth profile creation).

---

### 3. Authentication Configuration 🔒
- [ ] Supabase > Authentication > Providers > **Email**: ensure it is enabled.
- [ ] Supabase > Authentication > URL Configuration > **Site URL**: set to `http://localhost:3000`.
- [ ] Supabase > Authentication > URL Configuration > **Redirect URLs**: add `http://localhost:3000/**`.
- [ ] After Vercel deployment, also add `https://medibridge-ten.vercel.app/**` to Redirect URLs.
- [ ] After Vercel deployment, update Site URL to `https://medibridge-ten.vercel.app`.

---

### 4. Enable Google Login — Manual Setup 🔵

> **Note:** The "Continue with Google" button is deployed and ready. It will show a clear error until Google is configured in Supabase. Follow these steps exactly.

#### Step A — Google Cloud Project & OAuth Consent Screen
1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Create a new project (or select an existing one). Name it e.g. `medibridge`.
3. Navigate to **APIs & Services > OAuth consent screen**.
4. Select **External** for User type (allows anyone with a Google account to sign in).
5. Fill in required fields:
   - App name: `MediBridge`
   - User support email: your email
   - Developer contact email: your email
6. On the **Scopes** page, add: `email`, `profile`, `openid` — these are the standard defaults.
7. On the **Test users** page: if your app is in **Testing** mode (not published), add the Google accounts you want to test with. **Users not in this list cannot sign in until the app is published.**
8. Click **Save and Continue**.

#### Step B — Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials > OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. Name: `MediBridge Web`.
5. **Authorised JavaScript origins** — add **none** for this flow (Supabase handles the redirect server-side; no JS origin is needed for the PKCE code flow).
6. **Authorised redirect URIs** — this is the critical field:
   - Go to your Supabase project > **Authentication > Providers > Google**.
   - Copy the **"Callback URL (for OAuth)"** shown there. It will look like:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Paste that **exact URL** into the Authorised redirect URIs field in Google Cloud.
   - ⚠️ **Do NOT add your Vercel URL or app callback URL here.** The only redirect URI Google sees is the Supabase one.
7. Click **Create**. You will receive a **Client ID** and **Client Secret**. Copy both.

#### Step C — Enable Google Provider in Supabase
1. Go to your Supabase project > **Authentication > Providers > Google**.
2. Toggle **Enable** on.
3. Paste the **Client ID** into the "Client ID (for OAuth)" field.
4. Paste the **Client Secret** into the "Client Secret (for OAuth)" field.
5. Click **Save**.

#### Step D — Verify the redirect chain
The complete OAuth flow is:
```
User clicks "Continue with Google"
  → Supabase redirects to Google consent screen
  → User approves
  → Google redirects to: https://<project>.supabase.co/auth/v1/callback
  → Supabase exchanges code, sets session, redirects to:
      https://medibridge-ten.vercel.app/api/auth/callback?next=/en/home
  → App callback sets cookies and redirects to: /en/home
```

No additional URLs need to be added to Vercel or your Next.js app.

#### Step E — Troubleshooting
| Error | Cause | Fix |
|-------|-------|-----|
| `redirect_uri_mismatch` | URI in Google Cloud doesn't exactly match Supabase callback | Copy the URI character-for-character from Supabase provider settings |
| `access_blocked: This app's request is invalid` | App is in Testing mode and test user not added | Add the Google account to test users in OAuth consent screen |
| `Google sign-in is not yet configured` (in app) | Supabase Google provider not enabled | Complete Step C above |
| `provider is not enabled` error | Same as above | Enable Google in Supabase > Authentication > Providers |
| Works locally but fails in production | Supabase Site URL still set to localhost | Update Site URL to `https://medibridge-ten.vercel.app` in Supabase |

---

### 5. Local Execution 💻
- [ ] Ensure Node.js 18+ is installed.
- [ ] Run `npm install --legacy-peer-deps`.
- [ ] Run `npm run dev`.
- [ ] Open `http://localhost:3000` and verify the app runs.

---

### 6. Final Verification Test 🧪
- [ ] Create Account 1 (email/password) and verify email.
- [ ] Sign in — verify redirect to `/en/home`.
- [ ] Change language to Telugu or Hindi; verify UI translates instantly.
- [ ] Upload a dummy PDF document.
- [ ] Verify AI extraction completes (Gemini works).
- [ ] Review and save extracted data.
- [ ] Ask a question in chat (Groq works).
- [ ] Test "Continue with Google" — should redirect to Google or show a clear error if unconfigured.
- [ ] Create Account 2 and confirm it cannot see Account 1's documents (RLS working).
- [ ] Delete a document; confirm it is removed from storage bucket.
- [ ] Test password reset email flow.
- [ ] Verify session persists after browser refresh.

---

### 7. Public Deployment (Vercel) 🚀
- [ ] Run `npx vercel login` and authenticate.
- [ ] Run `npx vercel --prod` from the project root.
- [ ] Set all variables from `.env.local` in Vercel Dashboard > Settings > Environment Variables.
- [ ] Set `NEXT_PUBLIC_APP_URL` to `https://medibridge-ten.vercel.app`.
- [ ] Update Supabase Auth Site URL and Redirect URLs (see Step 3 above).
- [ ] Redeploy after adding environment variables.

**Current Production URL:** https://medibridge-ten.vercel.app  
**GitHub Repository:** https://github.com/harshakeerthan91/medibridge
