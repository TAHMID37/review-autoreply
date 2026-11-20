# Google OAuth verification: what to paste and record

For the Google Auth Platform in Cloud project `ibf-review-autoreply`.
App name: **ReviewTune** · Domain: `reviewtune.ibusinessformula.com.au`

## Links Google asks for

| Field | Value |
| --- | --- |
| App home page | https://reviewtune.ibusinessformula.com.au |
| Privacy policy | https://reviewtune.ibusinessformula.com.au/privacy |
| Terms of service | https://reviewtune.ibusinessformula.com.au/terms |
| Authorised domain | ibusinessformula.com.au |
| Support / developer email | support@ibusinessformula.com.au |
| Redirect URI | https://reviewtune.ibusinessformula.com.au/api/platform-accounts/google/callback |
| Logo | `brand/reviewtune-icon-512.png` |

## Scope requested

Only one: `https://www.googleapis.com/auth/business.manage`

## "How will the scopes be used?" (paste this)

ReviewTune helps a business manage the Google reviews on its own Business Profile from inside its HubSpot account. The business signs in with HubSpot and then connects its Google account.

We use `business.manage` for exactly three things:
1. **Read** the list of the business's accounts and locations, so the owner can choose which locations to manage.
2. **Read** the reviews on those locations, so we can show them in the ReviewTune dashboard and save each one on the matching contact in the business's HubSpot account.
3. **Reply** to those reviews. Replies are drafted from templates the business writes. Low-rated or sensitive reviews are held until a person approves them, and nothing is posted automatically unless the owner turns auto-reply on and confirms.

No narrower scope is available: Google offers no read-only or reply-only scope for Business Profile reviews, and posting a reply requires `business.manage`.

We use Google data only to provide these features to the business that connected the account. We do not sell it, use it for advertising, or use it to train AI models, and we do not share it with anyone other than the business's own HubSpot account and the service providers named in our privacy policy. Our use of Google user data follows the Google API Services User Data Policy, including the Limited Use requirements. Google access is revoked and erased when the app is uninstalled, and the business's data is deleted from our database 30 days later.

## Demo video (unlisted YouTube, English, about 3 to 4 minutes)

Record the screen with a clear voiceover. Google's reviewers check that the **consent screen, app name and URL bar** are visible. Use a test Google account that manages a real or test Business Profile, and a HubSpot test account.

1. **Intro (15 s).** Say what ReviewTune does in one sentence. Show the home page URL in the address bar.
2. **Sign-in (20 s).** Click "Sign in with HubSpot" and approve the install on HubSpot's screen.
3. **Connect Google (45 s).** Click "Connect Google". Keep the **Google consent screen** on screen for several seconds: show the app name ReviewTune, the requested permission, and the URL bar. Approve it.
4. **Locations (20 s).** Show the list of locations and choose one.
5. **Reviews (30 s).** Show the reviews that were pulled in, then open a HubSpot contact to show the review saved there.
6. **Reply (45 s).** Open a review, show the drafted reply, approve it, and show it appear on the live Google review.
7. **Safety (20 s).** Show a low-rated review being held for approval instead of posted.
8. **Privacy and removal (25 s).** Show the privacy policy page, then uninstall the app in HubSpot, and mention that access is erased and data is deleted after 30 days.

Before recording, make sure the privacy and terms pages are live at the URLs above, and that the app is deployed on the real domain.
