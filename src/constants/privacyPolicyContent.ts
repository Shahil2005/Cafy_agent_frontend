export const PRIVACY_POLICY_LAST_UPDATED = '22 May 2026';
export const PRIVACY_POLICY_EFFECTIVE_FROM = '13 June 2026';

export const PRIVACY_POLICY_TABLE_OF_CONTENTS = [
  { id: '1-who-this-policy-applies-to', label: '1. Who This Policy Applies To' },
  { id: '2-what-we-collect', label: '2. What We Collect' },
  { id: '3-how-we-collect-your-data', label: '3. How We Collect Your Data' },
  { id: '4-why-we-use-your-data-lawful-bases', label: '4. Why We Use Your Data' },
  { id: '5-who-we-share-your-data-with', label: '5. Who We Share Your Data With' },
  { id: '6-international-transfers', label: '6. International Transfers' },
  { id: '7-how-long-we-keep-your-data', label: '7. How Long We Keep Your Data' },
  { id: '8-your-rights', label: '8. Your Rights' },
  { id: '9-security', label: '9. Security' },
  { id: '10-automated-decisions-and-ai', label: '10. Automated Decisions and AI' },
  { id: '11-children', label: '11. Children' },
  { id: '12-cookies', label: '12. Cookies' },
  { id: '13-changes-to-this-policy', label: '13. Changes To This Policy' },
  { id: '14-contact', label: '14. Contact' },
] as const;

export const privacyPolicyBodyContent = `
This Privacy Policy explains how CAREERSFORYOU LIMITED, trading as Cafy ("Cafy", "we", "us", "our"), collects, uses, stores, and protects your personal data when you use cafy.careers and our related services (the "Service").

We are the data controller for the personal data described in this Policy.

CAREERSFORYOU LIMITED is registered in England and Wales, company number 16384492, registered office 25 Cumbrae Gardens, Salford, England, M5 5DZ, United Kingdom.

This Policy complies with the UK GDPR and the Data Protection Act 2018.

## 1. WHO THIS POLICY APPLIES TO

This Policy applies to:
- Visitors to cafy.careers
- Free-tier users
- Paid-tier users
- Career mentors (separate counsellor agreement also applies)
- People who contact us via email, chat, or form

## 2. WHAT WE COLLECT

### 2.1 Account information
- Name
- Email address
- Password (stored hashed, never in plain text)
- University and course (optional)
- Country of origin (optional)
- Graduation year (optional)
- Visa status (optional, used to personalise recommendations)

### 2.2 Profile content
- CV documents you upload or generate
- Cover letters
- Job application records
- Notes you save
- LinkedIn data you choose to import

### 2.3 Payment information
- Billing name and address
- Card details: processed and stored ONLY by Stripe, never by Cafy
- We store a payment token and the last 4 digits of your card for reference

### 2.4 Usage data
- Pages visited, features used, clicks, search queries inside Cafy
- Time spent in app
- Errors and crash reports
- Device and browser type, screen size, approximate location (city level, derived from IP address)

### 2.5 Communications
- Messages you send to us
- Survey responses
- Feedback

## 3. HOW WE COLLECT YOUR DATA

### 3.1 Directly from you when you:
- Sign up
- Use any feature
- Make a payment
- Contact support

### 3.2 Automatically through cookies and similar technologies:
- Authentication cookies
- Analytics (Google Analytics 4, PostHog)
- Search Console (Google Search Console for SEO)

### 3.3 From third parties:
- LinkedIn (only if you choose to import your profile)
- Stripe (payment confirmation)

## 4. WHY WE USE YOUR DATA (LAWFUL BASES)

We process your data on the following lawful bases under UK GDPR:

### 4.1 CONTRACT (Article 6(1)(b))
To provide the Service you signed up for, including:
- Creating and managing your account
- Generating CVs and cover letters
- Matching you to jobs and verified sponsors
- Processing payments
- Providing customer support

### 4.2 LEGITIMATE INTERESTS (Article 6(1)(f))
- Improving the Service through usage analytics
- Preventing fraud, abuse, and security threats
- Communicating with you about features and product updates
- Defending legal claims

### 4.3 CONSENT (Article 6(1)(a))
- Marketing emails (you can opt in or out at any time)
- Non-essential cookies
- Use of identifiable User Content for product research (separate opt-in)

### 4.4 LEGAL OBLIGATION (Article 6(1)(c))
- Complying with tax, accounting, and consumer protection law
- Responding to lawful requests from authorities

## 5. WHO WE SHARE YOUR DATA WITH

We do NOT sell your personal data.

We share data with the following categories of recipients:

### 5.1 Service providers (processors), acting on our instructions:
- Stripe (payments): [stripe.com/privacy](https://stripe.com/privacy)
- Google (Analytics 4, Search Console): [policies.google.com/privacy](https://policies.google.com/privacy)
- Google Gemini (primary AI inference for CVs, cover letters, job matching, autofill and related features): [policies.google.com/privacy](https://policies.google.com/privacy)
- OpenAI (AI inference fallback / alternate provider for the same features): [openai.com/privacy](https://openai.com/privacy)
- Cal.com / Cal.eu (mentor scheduling, calendar invites and meeting links): [cal.com/privacy](https://cal.com/privacy)
- PostHog (product analytics): [posthog.com/privacy](https://posthog.com/privacy)
- Vercel (web hosting and edge delivery): [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy)
- Amazon Web Services / AWS (cloud infrastructure and storage): [aws.amazon.com/privacy](https://aws.amazon.com/privacy)
- Hostinger (domain registration and business email hosting): [hostinger.co.uk/privacy-policy](https://hostinger.co.uk/privacy-policy)
- Rewardful (referral and affiliate tracking, integrated with Stripe): [rewardful.com/privacy](https://rewardful.com/privacy)

### 5.2 Career mentors (only if you book a session)
- Your name, email, and any notes you add to the booking are shared with the mentor you book
- Mentors are bound by a confidentiality agreement

### 5.3 Professional advisers
- Accountants, lawyers, insurers (only when necessary)

### 5.4 Authorities
- When required by law

### 5.5 Successors
- If Cafy is sold, merges, or restructures, your data may transfer to the new owner under equivalent privacy commitments

## 6. INTERNATIONAL TRANSFERS

Some processors (Stripe, Google, Google Gemini, OpenAI, Cal.com / Cal.eu, PostHog, Vercel, AWS, Hostinger, Rewardful) may transfer or store data outside the UK, including in the European Economic Area (EEA) and the United States.

When data is transferred outside the UK, we rely on:
- UK adequacy regulations (where applicable)
- Standard Contractual Clauses (SCCs) with the UK Addendum
- The UK Extension to the EU-US Data Privacy Framework (where applicable)

You may request a copy of the safeguards in place by emailing [admin@cafy.careers](mailto:admin@cafy.careers).

## 7. HOW LONG WE KEEP YOUR DATA

### 7.1 Account data
While your account is active.

### 7.2 Inactive accounts
Data is deleted 24 months after your last login, after a final email notice.

### 7.3 Deleted accounts
When you delete your account in the app, we remove hosted profile data, files, and application history we control, and we cancel active Stripe subscriptions immediately. We retain your email on a deleted-users list for 10 days to prevent immediate re-registration and abuse; after that you may create a new account with the same email. Stripe payment/invoice records may be kept for tax and disputes (typically up to 6 years). Short-lived infrastructure backups may retain copies until they expire. Data already sent to employers or other third parties is outside our control.

### 7.4 Payment records
Retained for 6 years (UK tax law).

### 7.5 Marketing preferences
Retained until you opt out and for a short period after to honour the opt-out.

### 7.6 Backups
Deleted data may persist in encrypted backups for up to 90 days before being permanently overwritten.

## 8. YOUR RIGHTS

Under UK GDPR, you have the right to:

### 8.1 ACCESS
Request a copy of the personal data we hold about you.

### 8.2 RECTIFICATION
Correct inaccurate or incomplete data.

### 8.3 ERASURE ("right to be forgotten")
Request deletion, subject to legal exceptions.

### 8.4 RESTRICTION
Limit how we process your data in certain circumstances.

### 8.5 PORTABILITY
Receive your data in a structured, machine-readable format.

### 8.6 OBJECTION
Object to processing based on legitimate interests, or to direct marketing.

### 8.7 WITHDRAW CONSENT
For processing based on consent, at any time.

### 8.8 COMPLAIN
To the UK Information Commissioner's Office (ICO) at [ico.org.uk](https://ico.org.uk).

To exercise any right, email [admin@cafy.careers](mailto:admin@cafy.careers). We respond within 30 days. We may ask you to verify your identity.

## 9. SECURITY

We take security seriously. Measures include:
- TLS encryption in transit
- Encryption of sensitive data at rest
- Passwords hashed with industry-standard algorithms (bcrypt or argon2)
- Role-based access controls; only staff who need access can access data
- Regular security reviews and dependency patching
- Incident response process; we notify the ICO and you within 72 hours of a notifiable personal data breach

No system is perfectly secure. You are responsible for keeping your password confidential.

## 10. AUTOMATED DECISIONS AND AI

### 10.1 AI Generation
We use AI to generate CVs, cover letters, job matches, and related career tools. When you use these features, relevant content you submit (such as CV text, job details, preferences and prompts) is sent to our contracted AI providers to produce the output.

### 10.2 AI providers
- **Google Gemini** is our primary AI inference provider.
- **OpenAI** is used as a fallback or alternate inference provider if Gemini is unavailable or overridden for a request.

### 10.3 Final Decision
AI output is a suggestion. You make the final decision before using any output in a real job application.

### 10.4 Legal Effects
We do not make decisions that produce legal or similarly significant effects on you solely by automated means.

### 10.5 AI Training
We do not use your identifiable personal data to train third-party AI models without your explicit consent.

## 11. CHILDREN

The Service is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe we have, email [admin@cafy.careers](mailto:admin@cafy.careers) and we will delete it.

## 12. COOKIES

For details about cookies, see our Cookie Policy at [cafy.careers/cookies](https://cafy.careers/cookies).

## 13. CHANGES TO THIS POLICY

We may update this Policy from time to time. Material changes will be notified by email or in-app at least 14 days before they take effect.

## 14. CONTACT

For any privacy question, email:  
[**admin@cafy.careers**](mailto:admin@cafy.careers)  

Or write to:  
CAREERSFORYOU LIMITED  
25 Cumbrae Gardens, Salford, England, M5 5DZ  
United Kingdom  

You also have the right to complain to the UK Information Commissioner's Office:  
Information Commissioner's Office  
Wycliffe House, Water Lane  
Wilmslow, Cheshire SK9 5AF  
0303 123 1113: [ico.org.uk](https://ico.org.uk)
`;
