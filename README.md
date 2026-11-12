# Roat Invitation

A small, mobile-friendly invitation site for Roat's Bas Mitzvah.

## What's included

- Public invitation page (anyone with the link can view it)
- RSVP form: name, email, phone, attendance, guest count
- Song submissions by song/artist text or URL
- In-browser voice recording with no duration limit (subject to upload-size limits)
- Private Supabase storage for voice recordings
- Supabase schema with public insert / private family-read policies

## 1. Create the GitHub repository

Create an empty repository named `roat-invitation` under your GitHub account. Do not add a README, license, or `.gitignore` during GitHub's creation flow because this starter already includes them.

## 2. Download and unzip

Unzip the starter bundle. In Terminal, move into the unzipped `roat-invitation` folder.

## 3. Connect Supabase

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase/schema.sql`, replace both instances of `REPLACE_WITH_FAMILY_ADMIN_EMAIL` with the email address you'll use for family admin access, then run the SQL.
4. In Supabase, open **Project Settings → API** and copy the Project URL and anon/public key.
5. In `app.js`, paste them into `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

The anon/public key is designed to be used in a browser. Never put a Supabase `service_role` key in this project.

## 4. Run locally

You need Node.js installed. From the project folder:

```bash
npx serve .
```

Open the local URL printed by the command (usually http://localhost:3000).

Microphone recording requires localhost or HTTPS and browser permission. It will not work from an insecure non-local HTTP origin.

## 5. Push to GitHub

From inside the project folder:

```bash
git init
git add .
git commit -m "Initial Roat invitation site"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/roat-invitation.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your GitHub username.

## 6. Publish the invitation

For a simple static site, you can use GitHub Pages:

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose `main` and `/ (root)`, then Save.
4. Wait for GitHub Pages to publish and use the URL shown there.

For microphone recording on the published site, use the HTTPS GitHub Pages URL.

## Important MVP notes

- The invitation page is public. RSVP and song data are not publicly readable through Supabase.
- Voice files are stored in a private bucket. Only the family admin email configured in the SQL can read/download them.
- This starter includes the secure data foundation, but a polished family dashboard / magic-link login flow still needs to be added before launch. Until then, use the Supabase dashboard to review submissions and download voice files.
- The SQL allows public uploads, but does not include spam protection or rate limiting yet. Before sharing widely, consider adding CAPTCHA or another abuse-prevention layer.
- Test microphone recording on the actual phones and browsers guests are likely to use.
