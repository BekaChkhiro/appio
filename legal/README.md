# Legal Foundation — Appio

> Status tracker and index for T1.8 deliverables.
> **These documents are first-pass drafts. They MUST be reviewed by qualified legal counsel before launch.**

## ⚠️ Disclaimer

The drafts in this directory are **not legal advice**. They are starting points to hand to a lawyer. Appio operates in multiple jurisdictions (potentially US, EU, UK), processes user-generated content, integrates third-party AI (Anthropic Claude), runs a marketplace with payouts, handles in-app purchases via Apple/Google, and may serve minors. Each of these areas has jurisdiction-specific legal requirements that this template cannot capture.

**Do not publish these documents to production without lawyer review.**

## Placeholders to Fill In

Search-and-replace across all `.md` files in this directory before review:

| Placeholder | Description | Example |
|---|---|---|
| `{{COMPANY_NAME}}` | Legal entity name | "Appio Technologies Ltd." |
| `{{JURISDICTION}}` | Country/state of incorporation | "England and Wales" |
| `{{REGISTERED_ADDRESS}}` | Registered office address | "123 Main St, London, UK" |
| `{{COMPANY_NUMBER}}` | Company registration number | "12345678" |
| `{{CONTACT_EMAIL}}` | General contact | `hello@appio.app` |
| `{{SUPPORT_EMAIL}}` | User support | `support@appio.app` |
| `{{ABUSE_EMAIL}}` | Abuse reports | `abuse@appio.app` |
| `{{LEGAL_EMAIL}}` | Legal/DPO | `legal@appio.app` |
| `{{DMCA_AGENT_NAME}}` | DMCA designated agent | "Jane Doe, c/o Appio" |
| `{{DMCA_AGENT_EMAIL}}` | DMCA contact | `dmca@appio.app` |
| `{{EFFECTIVE_DATE}}` | Date of publication | "2026-04-15" |
| `{{LAST_UPDATED}}` | Last revision date | "2026-04-15" |
| `{{GOVERNING_LAW}}` | Choice of law | "the laws of England and Wales" |
| `{{ARBITRATION_VENUE}}` | Arbitration venue | "London, United Kingdom" |

## Documents

| File | Purpose | Status |
|---|---|---|
| [terms-of-service.md](terms-of-service.md) | User agreement covering UGC, AI generation, prohibited content, IP ownership, liability | ✏️ Draft |
| [privacy-policy.md](privacy-policy.md) | GDPR/CCPA-compliant privacy notice covering platform data + Claude API processing | ✏️ Draft |
| [cookie-policy.md](cookie-policy.md) | ePrivacy/cookie disclosure for Appio platform AND generated PWAs | ✏️ Draft |
| [dmca-policy.md](dmca-policy.md) | DMCA takedown procedure and counter-notification flow | ✏️ Draft |
| [marketplace-seller-terms.md](marketplace-seller-terms.md) | Phase 5 — terms for creators publishing/selling on the marketplace | ✏️ Draft |
| [acceptable-use-policy.md](acceptable-use-policy.md) | Prohibited content/conduct enumeration referenced from ToS | ✏️ Draft |

## External Actions Required

T1.8 includes external registrations and agreements that **only you can complete**. Track them here:

### 1. DMCA Designated Agent Registration

- **Where**: https://dmca.copyright.gov/
- **Cost**: $6 (initial), renew every 3 years
- **Required for**: DMCA safe harbor protection (17 U.S.C. § 512)
- **Status**: ⬜ TODO
- **Notes**: Without this registration, you do NOT have safe harbor protection from copyright infringement claims for user-generated content. Register BEFORE accepting any UGC in beta.

### 2. NCMEC Electronic Service Provider Registration

- **Where**: https://report.cybertip.org/ispws/documents.html
- **Cost**: Free
- **Required for**: 18 U.S.C. § 2258A — mandatory CSAM reporting obligation for US-facing services
- **Status**: ⬜ TODO
- **Notes**: Required even if you have no plans to host user images. If your generated PWAs allow image uploads (even client-side), you may have reporting obligations.

### 3. Anthropic Data Processing Agreement (DPA)

- **Where**: Email `privacy@anthropic.com` or via Anthropic Console legal section
- **Cost**: Free
- **Required for**: GDPR Art. 28 (processor agreement) — you process EU user prompts through Claude
- **Status**: ⬜ TODO
- **Notes**: Required if you have ANY EU users. Anthropic provides a standard DPA on request. Keep signed copy on file.

### 4. Apple/Google Developer Agreements

- **Where**: Apple Developer Portal, Google Play Console
- **Status**: ✅ Done in T1.1 (account creation)
- **Notes**: Re-read DPAs. Verify you accept the latest Paid Apps Agreement (Apple) and Google Play Distribution Agreement.

### 5. Stripe / RevenueCat Service Agreements

- **Where**: Accepted automatically on signup; review terms
- **Status**: ⬜ TODO before T4.2 (Payment Integration)
- **Notes**: Stripe Connect terms apply for marketplace payouts in Phase 5.

### 6. Domain WHOIS Privacy

- **Status**: ⬜ TODO
- **Notes**: Verify `appio.app` and `appiousercontent.com` have WHOIS privacy enabled OR list a business address (not founder home address).

### 7. Trademark Search

- **Status**: ⬜ TODO (recommended before public launch)
- **Notes**: Search USPTO TESS, EUIPO, UK IPO for "Appio" in classes 9 (software), 42 (SaaS). Consider filing if clear.

### 8. Business Insurance

- **Status**: ⬜ TODO before public launch
- **Notes**: Consider Tech E&O / Cyber Liability insurance. UGC platforms have meaningful liability exposure.

## Lawyer Review Checklist

Before sending these drafts to a lawyer, gather:

- [ ] Company legal entity details (name, jurisdiction, address)
- [ ] List of countries you'll accept users from at launch
- [ ] Confirmation of age gating policy (13+? 16+? 18+?)
- [ ] Confirmation of payment flows (Stripe, Apple IAP, Google Play)
- [ ] Anthropic DPA (signed copy, if obtained)
- [ ] List of all subprocessors (Anthropic, Neon, Cloudflare, Fly.io, Firebase, RevenueCat, Stripe, PostHog, Sentry, Resend/SendGrid)
- [ ] Confirmation that generated PWAs do/do not have access to user device APIs (camera, geolocation, etc.)
- [ ] Marketplace commission structure (15% confirmed?)

## Key Legal Risks for Appio (flag these to your lawyer)

1. **AI-generated code liability**: If a generated PWA has a security flaw and exposes a user's data, who is liable? Need clear disclaimer that AI output is provided "as is" and user is responsible for their generated app.
2. **UGC + DMCA safe harbor**: User-described apps may infringe copyright (e.g., "make a Spotify clone"). DMCA registration + takedown procedure essential.
3. **Marketplace = potential publisher liability**: When you curate/feature apps, you risk losing some safe harbor protections. Editorial decisions matter.
4. **EU AI Act**: Appio may be a "GPAI deployer" or "high-risk AI provider" depending on how generated PWAs are used. Consult an AI-specialized lawyer for EU compliance.
5. **Anthropic ToS pass-through**: Anthropic prohibits certain use cases. You must pass these restrictions through to your users in your AUP.
6. **Apple App Store Guideline 4.7**: "Mini apps, mini games, streaming games, chatbots, plug-ins, and game emulators" — Appio is in a gray zone. Frame as PWA/website builder, not "app builder". Substantial standalone functionality required.
7. **Cookie/storage consent in generated PWAs**: ePrivacy directive applies to ANY storage, not just cookies. localStorage in generated PWAs needs consent for EU users.
8. **Children's data (COPPA/UK Age Appropriate Design Code)**: If users can build apps targeting children, additional rules apply.
9. **Marketplace tax obligations**: Stripe Tax, 1099-K (US), DAC7 (EU) — see T5.4.

## Maintenance

- Review all documents annually
- Update on material changes (new subprocessors, new features, new jurisdictions)
- Maintain version history (`CHANGELOG.md` in this directory)
- Notify users of material changes per ToS/Privacy Policy notification clauses
