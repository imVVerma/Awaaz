# Awaaz: Product Requirements Document

**Version:** 0.1  
**Date:** October 19, 2026  
**Owner:** Vaibhav Verma  
**Challenge deadline:** November 10, 2026  
**Status:** Discovery and API validation

## 1. Product vision

Awaaz is a voice-first business operations assistant that helps small Indian distributors and shopkeepers interact with their business data using natural speech.

**Core idea:** Let business owners ask questions and prepare routine business actions without navigating complex software.

Awaaz should be a reliable interface to business data, not a generic chatbot.

## 2. Problem statement

Small businesses frequently manage inventory, outstanding payments, and customer communication across multiple tools and manual records.

Typing can be inconvenient during busy workdays, particularly when users prefer speaking in Hindi, English, or Hinglish.

Awaaz aims to make common business operations more accessible through voice while keeping results grounded in verified records.

## 3. Target users

- Small distributors and wholesalers.
- Shopkeepers managing stock and customer balances.
- Business owners who prefer voice interactions to extensive typing.

The initial prototype will use synthetic business data.

## 4. MVP features

### F1. Voice input and transcription
- Record a spoken request.
- Transcribe it using Gnani Prisma.
- Display the transcript.
- Allow the user to correct transcription errors.

### F2. Inventory queries
- Identify products below configured stock thresholds.
- Return product names and available quantities.
- Calculate results from the database.

### F3. Outstanding payment queries
- Retrieve customers with outstanding balances.
- Display customer names and verified amounts.
- Calculate totals using database queries.

### F4. Payment reminder drafting
- Generate a reminder using verified customer and balance information.
- Allow the user to review and copy the message.
- Do not send messages automatically.

### F5. Spoken responses
- Generate spoken responses using Gnani Timbre.
- Provide text responses when audio generation fails.
- Validate language and voice support before making claims.

### F6. Safe interaction
- Ask for clarification when a customer or product is ambiguous.
- Reject unsupported requests.
- Never invent business records or claim an action succeeded when it did not.

## 5. Proposed user journey

1. User opens Awaaz.
2. User records a business-related question.
3. Prisma transcribes the recording.
4. An LLM or structured parser extracts the intended operation.
5. The backend validates the request and executes a supported business function.
6. The application displays results from the database.
7. Timbre generates a spoken response when available.
8. The user reviews any proposed action before proceeding.

## 6. Technical approach

**Frontend:** Reuse the existing MediDist interface or components where appropriate. Audit the current React Native/Expo architecture before choosing whether to retain it or build a separate web interface.

**Backend:** Prefer the existing Express/TypeScript backend if it can support the voice workflow cleanly. Introduce FastAPI only if there is a demonstrated benefit.

**Database:** Reuse or adapt the existing SQLite setup for the synthetic demo dataset.

**AI services:** Integrate Prisma for speech-to-text and Timbre for text-to-speech. Evaluate Evon or another LLM for structured intent extraction only after the basic workflow works.

**Hosting:** Select deployment targets after checking the existing project's architecture and runtime requirements.

**Secrets:** Keep all API keys on the server. Never expose them in frontend code or public repositories.

## 7. Out of scope for the initial MVP

- Automatic WhatsApp messaging.
- Live production business data.
- Full ERP functionality.
- Multi-user authentication and complex access control.
- Custom model training.
- Multiple agents or unnecessary infrastructure.
- Unsupported language claims.

## 8. Evaluation plan

Prepare 20 to 30 scripted business requests covering:

- English and supported Hindi-English speech.
- Product names and numerical quantities.
- Inventory and payment queries.
- Ambiguous requests.
- Background noise.
- API failures and unsupported operations.

Measure transcription errors, intent accuracy, business-answer correctness, latency, API failures, and credit consumption.

Initial targets:
- 100% correct database results for supported fixed test cases.
- At least 90% intent recognition on the test set.
- Zero fabricated successful actions in the safety test set.

These are proposed targets, not measured results.

## 9. Success criteria

The MVP is ready for submission when:

- Prisma and Timbre work in the deployed application.
- All three business workflows operate end to end.
- Results are grounded in synthetic database records.
- Errors and ambiguous requests are handled transparently.
- The application works on a mobile browser or supported target device.
- A public demo and GitHub repository are available.
- Evaluation results and known limitations are documented.
- The project is demonstrated honestly in a public video.

## 10. Immediate action items

1. Audit the existing MediDist codebase using Antigravity.
2. Generate an architecture and reuse assessment.
3. Test Prisma and Timbre independently.
4. Record API behaviour, language support, latency, and credit consumption.
5. Update the architecture and MVP scope based on evidence.
6. Implement the smallest complete voice workflow.
7. Test, deploy, document, and submit before November 10.

## 11. Open decisions

- Should Awaaz extend MediDist or remain a separate application?
- Which existing frontend components can be reused?
- Does the current backend need restructuring?
- Which languages work reliably across both speech models?
- Which LLM should handle structured intent extraction?
- What is the measured cost and latency per interaction?
- Which deployment setup is simplest and reliable?
- What distinctive feature is achievable before the deadline?

**Next review:** After the Antigravity audit and initial Gnani API tests.