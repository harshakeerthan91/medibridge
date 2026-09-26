# MediBridge Manual Setup Checklist

This is the quick-reference checklist for setting up MediBridge. For detailed step-by-step instructions with screenshots and links, refer to the **[WHAT I NEED TO DO MANUALLY — STEP-BY-STEP SETUP in README.md](./README.md#what-i-need-to-do-manually--step-by-step-setup)**.

### 1. Environment & API Keys 🔑
- [ ] Rename `.env.example` to `.env.local`.
- [ ] Create a Supabase Project.
- [ ] Copy Supabase URL to `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Copy Supabase Anon Key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Create an Groq API Key at `console.x.ai` (ensure billing is enabled).
- [ ] Copy Groq Key to `GROQ_API_KEY`.
- [ ] Create a Google Gemini API Key at Google AI Studio.
- [ ] Copy Gemini Key to `GEMINI_API_KEY`.
- [ ] Keep `NEXT_PUBLIC_APP_URL`, `GROQ_BASE_URL`, `GROQ_CHAT_MODEL`, and `GEMINI_DOCUMENT_MODEL` as their defaults for local dev.

### 2. Database & Storage Setup 🗄️
- [ ] Go to Supabase Dashboard > SQL Editor.
- [ ] Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it.
- [ ] Copy the contents of `supabase/migrations/003_grant_permissions.sql` and run it.
- [ ] Go to Supabase Dashboard > Storage and create a new bucket named `medical-records`. Make sure "Public" is **unchecked** (it MUST be private).
- [ ] Go back to SQL Editor, copy `supabase/migrations/002_storage_policies.sql`, and run it.

### 3. Authentication Configuration 🔒
- [ ] In Supabase > Authentication > Providers, ensure **Email** provider is enabled.
- [ ] In Supabase > Authentication > URL Configuration, set the **Site URL** to `http://localhost:3000`.

### 4. Local Execution 💻
- [ ] Ensure Node.js 18+ is installed.
- [ ] Run `npm install --legacy-peer-deps`.
- [ ] Run `npm run dev`.
- [ ] Open `http://localhost:3000` and verify the app runs.

### 5. Final Verification Test 🧪
- [ ] Create Account 1 and verify email.
- [ ] Change language to Telugu or Hindi; verify the UI translates.
- [ ] Upload a dummy PDF document.
- [ ] Verify AI extraction completes successfully (Gemini works).
- [ ] Review and save extracted data.
- [ ] Ask a question about the document in chat (Groq works).
- [ ] Create Account 2 and ensure they cannot see Account 1's documents (Security works).
- [ ] Delete a document and ensure it is removed from the storage bucket.

### 6. Public Deployment (Vercel) 🚀
- [ ] Run `npm i -g vercel`.
- [ ] Run `npx vercel` in the project root and link to a new project.
- [ ] Add all variables from `.env.local` to the Vercel project Settings > Environment Variables.
- [ ] Go to Supabase > Auth > URL Configuration, and add the new Vercel production URL to **Redirect URLs** and update the **Site URL**.
