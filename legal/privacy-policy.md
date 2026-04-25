# Privacy Policy

**Effective Date:** {{EFFECTIVE_DATE}}
**Last Updated:** {{LAST_UPDATED}}

> ⚠️ **DRAFT — NOT LEGAL ADVICE.** This document must be reviewed and customized by qualified legal counsel before publication.

## 1. Introduction

This Privacy Policy explains how {{COMPANY_NAME}} ("**Appio**", "**we**", "**us**", "**our**") collects, uses, shares, and protects personal data when you use Appio. We are the **controller** of personal data processed in connection with the Service, except where this Policy expressly states otherwise.

This Policy applies to:

- The Appio mobile application
- The Appio website at https://appio.app
- The Appio API and backend services
- Communications with Appio support

It does **not** apply to third-party websites, services, or apps (including Generated Apps you publish or that other users build), even if linked from the Service. Generated Apps published by users are governed by the privacy practices of the publishing user.

## 2. Contact and Data Protection Officer

Controller: {{COMPANY_NAME}}, {{REGISTERED_ADDRESS}}, {{JURISDICTION}}.

For privacy questions, requests, or complaints, contact: {{LEGAL_EMAIL}}

If we are required to designate one, our EU/UK representative or Data Protection Officer can be contacted at the same address.

## 3. Personal Data We Collect

### 3.1 Data You Provide

| Category | Examples | Source |
|---|---|---|
| Identity & Account | Name, email address, profile photo | Sign-in via Google/Apple Firebase |
| Authentication | Firebase UID, OAuth tokens | Firebase Auth |
| User Content | Chat prompts, app names, descriptions, generated app specs | You |
| Payment Identifiers | Stripe customer ID, RevenueCat user ID, transaction IDs | Stripe / RevenueCat |
| Communications | Support emails, feedback, bug reports | You |

We do not collect payment card numbers. Apple, Google, and Stripe handle payment processing on their respective platforms.

### 3.2 Data Collected Automatically

| Category | Examples | Purpose |
|---|---|---|
| Device & App | Device model, OS version, app version, locale, timezone | Compatibility, debugging |
| Usage Events | Screen views, button clicks, generation counts, install events | Product analytics, abuse prevention |
| Diagnostic | Error logs, crash reports, performance metrics | Stability, security |
| Network | IP address (truncated where possible), approximate location derived from IP | Security, fraud prevention, rate limiting |
| API Cost Tracking | Tokens used per generation, cost per generation | Billing enforcement, cost control |

### 3.3 Data from Third Parties

- From **Apple/Google Sign-In and Firebase**: name, email, profile photo (per the scopes you authorize)
- From **RevenueCat**: subscription status, entitlements, receipt validation results
- From **Stripe**: payment status, subscription events, fraud signals

### 3.4 Data We Do **Not** Collect

- We do **not** collect special category data (race, religion, health, biometrics, sexual orientation, political opinions, etc.) in the normal operation of the Service. Do not include such data in your prompts.
- We do **not** collect children's data. The Service is not directed at children under 13 (or 16 in the EEA). If we learn we have collected such data, we will delete it.
- We do **not** sell personal data, and we do **not** share personal data for cross-context behavioral advertising.

## 4. How We Use Personal Data

We process personal data for the following purposes and on the following legal bases (under GDPR Art. 6 / UK GDPR):

| Purpose | Examples | Legal Basis (GDPR) |
|---|---|---|
| Provide the Service | Authenticate you, process generations, store apps, serve PWAs | Performance of contract (Art. 6(1)(b)) |
| Process payments | Bill subscriptions, manage entitlements | Performance of contract |
| Prevent abuse and fraud | Rate limiting, content moderation, AUP enforcement | Legitimate interests (Art. 6(1)(f)) — protecting the Service and users |
| Comply with legal obligations | DMCA, CSAM reporting, tax records, court orders | Legal obligation (Art. 6(1)(c)) |
| Communicate with you | Service emails, security notices, support replies | Performance of contract / legitimate interests |
| Marketing emails (optional) | Product updates, newsletters | Consent (Art. 6(1)(a)) — opt-in only, opt-out anytime |
| Analytics and product improvement | Funnels, feature adoption, A/B tests | Legitimate interests / consent where required |
| Train no AI on your data | We do **not** train AI models on your prompts | N/A |

We do not use automated decision-making that produces legal or similarly significant effects on you, except as needed to enforce rate limits and content moderation (which is not "solely automated" — humans are available to review).

## 5. AI Processing — Anthropic Claude

When you submit a prompt to generate or modify an app, the following data is transmitted to **Anthropic, PBC** (a U.S. company), which provides the Claude API:

- Your prompt text
- Relevant system prompt and template configuration
- Prior chat context within the same project (when iterating)

**Anthropic acts as our processor.** We have a Data Processing Agreement (DPA) in place with Anthropic. Per Anthropic's [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms), Anthropic does **not train its models on customer API inputs or outputs**. Anthropic retains API data only as long as needed for service provision and trust & safety operations (typically 30 days unless extended for compliance reasons).

You should not include personal data of third parties, confidential information, or special category data in prompts.

## 6. Cookies and Local Storage

We use a small number of strictly necessary cookies and local storage entries on the Website and in the Mobile App. We may also use analytics cookies/SDKs subject to consent where required by ePrivacy law.

See our [Cookie Policy](cookie-policy.md) for details and consent options.

**Generated Apps** served from `*.appiousercontent.com` may use localStorage, sessionStorage, or IndexedDB to store user data on the device. Such storage is controlled by the publisher of the Generated App, not by Appio. We do not access localStorage in Generated Apps.

## 7. How We Share Personal Data

We share personal data only as described below. **We do not sell personal data.**

### 7.1 Service Providers (Subprocessors)

We share personal data with the following categories of subprocessors. A current list with subprocessor names and locations is maintained at https://appio.app/subprocessors (or equivalent URL).

| Subprocessor | Function | Data Categories | Location |
|---|---|---|---|
| Anthropic, PBC | AI generation (Claude API) | Prompts, generated specs | USA |
| Cloudflare, Inc. | CDN, R2 storage, DNS, Workers | IP addresses, request logs, generated PWA files | USA / Global edge |
| Neon, Inc. | PostgreSQL database hosting | User accounts, app metadata, generation logs | USA |
| Fly.io, Inc. | Backend compute, builder microVMs | Backend logs, build artifacts | USA / Global |
| Google LLC (Firebase) | Authentication, Google Sign-In | Identity data, OAuth tokens | USA |
| RevenueCat, Inc. | Subscription management | User ID, subscription status | USA |
| Stripe, Inc. | Web payments | Payment metadata, customer ID | USA / EU |
| Apple Inc. | iOS in-app purchases | Receipt validation data | USA |
| Google LLC | Google Play in-app billing | Receipt validation data | USA |
| PostHog, Inc. | Product analytics | Anonymized usage events | USA / EU |
| Sentry (Functional Software, Inc.) | Error monitoring | Stack traces, error context | USA / EU |
| Resend / SendGrid | Transactional email | Email address, message content | USA |

Each subprocessor is bound by contractual confidentiality and data protection obligations. We perform due diligence before onboarding subprocessors and review them periodically.

### 7.2 Other Users

If you publish a Generated App to the Marketplace or share its public URL, the following may be visible to other users:

- App name, description, icon, screenshots
- Your creator name (or pseudonym)
- App install count and aggregate analytics

You can control what is published.

### 7.3 Legal and Safety

We may disclose personal data:

- To comply with law, court orders, subpoenas, or government requests
- To enforce these Terms, the AUP, or other agreements
- To protect the rights, property, or safety of Appio, users, or the public
- To respond to claims of intellectual property infringement (DMCA)
- To NCMEC, law enforcement, or other authorities in cases of suspected child sexual abuse material (legal obligation)
- In connection with a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets (subject to confidentiality)

### 7.4 With Your Consent

We may share personal data for any other purpose with your consent.

## 8. International Data Transfers

We are based in {{JURISDICTION}}, and our subprocessors are located in the United States and other jurisdictions. When personal data is transferred outside the EEA, UK, or Switzerland, we rely on appropriate safeguards, including:

- **Standard Contractual Clauses** (SCCs) approved by the European Commission
- **UK International Data Transfer Addendum** for UK transfers
- Anthropic's, Cloudflare's, and other subprocessors' Data Processing Addenda incorporating SCCs
- Where applicable, transfer impact assessments

You may request a copy of our SCCs at {{LEGAL_EMAIL}}.

## 9. Data Retention

We retain personal data only as long as necessary for the purposes described in this Policy:

| Data Category | Retention Period |
|---|---|
| Account data | Duration of account + 30 days after deletion request |
| User Content (apps, prompts) | Duration of account + 30 days after deletion request |
| Generated PWAs in R2 | While account is active OR up to 90 days after account deletion |
| Generation logs (prompt, cost) | 12 months for cost analysis and abuse detection, then anonymized |
| Payment records | 7 years (tax/accounting requirement) |
| Backups | Up to 35 days |
| Server access logs | 90 days |
| Moderation and abuse logs | 1 year minimum (legal/compliance) |
| CSAM-related records | As required by law (NCMEC reporting obligations) |
| Marketing email subscriber list | Until you unsubscribe |
| Anonymized analytics | Indefinite |

After retention periods expire, we delete or irreversibly anonymize personal data.

## 10. Your Rights

Depending on your jurisdiction, you may have the following rights:

### 10.1 EEA / UK / Switzerland (GDPR / UK GDPR)

- **Access** — request a copy of personal data we hold about you
- **Rectification** — request correction of inaccurate data
- **Erasure** — request deletion of your data ("right to be forgotten")
- **Restriction** — request that we restrict processing
- **Portability** — receive your data in a portable format
- **Objection** — object to processing based on legitimate interests
- **Withdraw consent** — for processing based on consent
- **Lodge a complaint** with your local supervisory authority (e.g., your country's data protection authority)

### 10.2 California (CCPA / CPRA)

- **Right to know** — what personal information we collect, use, disclose
- **Right to delete** — request deletion of personal information
- **Right to correct** — request correction of inaccurate personal information
- **Right to opt out of sale/sharing** — we do not sell or share personal information for cross-context behavioral advertising
- **Right to limit** — limit use of sensitive personal information (we do not collect sensitive PI in the CCPA sense)
- **Right to non-discrimination** — we will not discriminate against you for exercising your rights

### 10.3 Other Jurisdictions

We extend equivalent rights to users in other jurisdictions where required by law (e.g., Brazil LGPD, Quebec Law 25, Australia Privacy Act).

### 10.4 How to Exercise Rights

Submit requests by emailing {{LEGAL_EMAIL}} from the email address associated with your account, or by using the in-app account settings. We will respond within 30 days (or as required by your local law). We may need to verify your identity before processing requests.

You may use an authorized agent to submit requests on your behalf, subject to verification.

## 11. Security

We implement appropriate technical and organizational measures to protect personal data, including:

- Encryption in transit (TLS 1.2+)
- Encryption at rest for databases and object storage
- Token-based authentication (Firebase JWT); we do not use cookies for authentication
- Strict CORS policies
- Hardware-isolated builder microVMs (Firecracker) with nsjail sandboxing
- Pre-build code scanning for security risks
- Separate domain (`appiousercontent.com`) for Generated Apps to prevent cookie tossing and session hijacking
- Content Security Policy (CSP) headers on Generated Apps
- Rate limiting and abuse detection
- Access controls and audit logging for administrative actions
- Annual review of subprocessors

No system is perfectly secure. If we become aware of a security breach affecting your personal data, we will notify you and the relevant supervisory authorities as required by law.

## 12. Children's Privacy

The Service is not directed at children under 13 years old (or 16 in the EEA, or the higher minimum age in your jurisdiction). We do not knowingly collect personal data from children below the minimum age. If we learn we have collected such data, we will delete it promptly. If you believe a child has provided us with personal data, contact {{LEGAL_EMAIL}}.

Generated Apps may be created by users for any purpose. If a Generated App targets or knowingly collects data from children, the publishing user is solely responsible for compliance with COPPA, the UK Age Appropriate Design Code, and similar laws.

## 13. Automated Decision-Making

We use automated systems for:

- Rate limiting and abuse prevention
- Content moderation (forbidden patterns scanning, AI-generated content review)
- Generation cost tracking and budget enforcement

These systems may temporarily restrict your ability to use the Service. You may request human review of any decision by contacting {{SUPPORT_EMAIL}}.

We do not use automated decision-making for purposes that produce legal effects concerning you (e.g., creditworthiness, employment) within the meaning of GDPR Art. 22.

## 14. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or through the Service at least 30 days in advance (unless an immediate update is required by law). The "Last Updated" date at the top of this Policy reflects the most recent revision.

A version history is maintained at https://appio.app/legal/privacy-history (or equivalent URL).

## 15. Specific Disclosures by Region

### 15.1 California Residents

In the past 12 months, we have collected the categories of personal information described in Section 3. We have disclosed this information for the business purposes described in Section 4 to the categories of recipients in Section 7.

We do not "sell" personal information or "share" it for cross-context behavioral advertising as defined under CCPA/CPRA.

To exercise California rights, email {{LEGAL_EMAIL}} or use the in-app settings. Authorized agents may submit requests with proof of authorization.

### 15.2 European Economic Area, United Kingdom, and Switzerland

The legal bases for processing are described in Section 4. The controller is {{COMPANY_NAME}}. For data subject requests, email {{LEGAL_EMAIL}}. You have the right to lodge a complaint with your local supervisory authority.

### 15.3 Brazil

If you are in Brazil, our processing is governed by the Lei Geral de Proteção de Dados (LGPD). Our legal bases generally correspond to those listed in Section 4. You may exercise rights under Articles 18–22 of the LGPD by contacting {{LEGAL_EMAIL}}.

### 15.4 Other

If your jurisdiction has specific privacy requirements not addressed here, contact {{LEGAL_EMAIL}}.

---

**Questions?** Contact us at {{LEGAL_EMAIL}}.
