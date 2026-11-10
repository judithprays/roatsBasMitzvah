# Google Apps Script setup

This backend replaces Supabase with one Google Sheet and one private Drive folder. The family dashboard uses a one-time code emailed to `themallingers@gmail.com`.

## 1. Create the Google Apps Script project

1. Sign into Google as **themallingers@gmail.com**.
2. Open https://script.google.com/home/projects/create
3. Name the project **Roat Bas Mitzvah Backend**.
4. Replace the starter contents of `Code.gs` with the contents of this repository's `google-apps-script/Code.gs`.
5. Save.

## 2. Create the spreadsheet and voice folder

1. In the Apps Script editor, choose `setup` in the function dropdown.
2. Click **Run**.
3. Approve the Google permissions requested (Sheets, Drive, and sending the dashboard sign-in email).
4. Open **Execution log**. It prints the spreadsheet URL and voice folder ID. The spreadsheet and folder are created in this Google account's Drive.

Keep the voice folder private. Do not change its sharing settings to "Anyone with the link".

## 3. Deploy the web app

1. Click **Deploy → New deployment**.
2. Select the gear icon and choose **Web app**.
3. Description: `Roat invitation backend`.
4. **Execute as:** Me (the Google account that owns the sheet and folder).
5. **Who has access:** Anyone.
6. Click **Deploy** and approve any additional authorization prompt.
7. Copy the Web app URL ending in `/exec`.

The public invitation needs the web app endpoint to accept guest submissions. The sheet and voice files remain private in the owner's Drive. Dashboard data is protected by a one-time code sent to the admin email.

## 4. Connect the website

The Apps Script URL will be added to both `app.js` and `admin.js` as `GOOGLE_SCRIPT_URL`. Once that is committed and deployed, the public forms and dashboard will use Google.

## 5. Test before sharing

- Submit one test RSVP.
- Submit one song.
- Record a 15–30 second voice message.
- Open `/admin.html`, request the one-time code, and verify that the records appear.
- Play and download the voice message while signed into the admin Google account.

## Important

- Never share your Google password or verification codes.
- Do not make the spreadsheet or voice folder public.
- Anyone with the invitation can submit an RSVP, song, or voice message. The admin dashboard requires the email code.
- Apps Script has Google service quotas. This setup is intended for a single family event, not a high-volume public application.
