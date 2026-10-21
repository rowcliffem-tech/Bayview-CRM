# Dealer Workspace

A standalone dealership CRM foundation, independently built from public workflow references. No external CRM or DMS is required. It is not affiliated with GhostDrive.

## Current workflows

- Set a dealership name, locations and sales reps.
- Create leads, move pipeline stages, add notes and check in customers.
- Book dated appointments, assign reps, schedule follow-up tasks, complete or cancel activities, and check appointments into the showroom. The daily worklist supports open, today, overdue and historical filters; activities also appear on the opportunity record and dashboard.
- Add and edit vehicles, costs, advertised prices, odometers, dates received and stock status.
- Record a delivered sale with an optional linked lead, selling price, acquisition cost, recon and other costs. The sale, sold stock status and lead outcome save atomically.
- Review dashboards, inventory aging, source reports and a deal ledger, and export current views as CSV.
- Record marketing spend manually. Reports use the source entered on each deal and do not infer ad attribution.
- Explore a separate browser-local demo. Sample records never automatically import into the saved database.

## Storage and access

The Site uses a restricted platform allowlist. API routes additionally require ChatGPT identity. The owner uses the existing stable dealership workspace; the configured finance account shares that same workspace rather than receiving an empty separate CRM. Other accounts are denied. Finance can read customer files, capture licences, and update process stages and notes; store settings, stock entry and financial ledger writes remain owner-only. No password database or external identity provider is added. Further staff roles remain future work.

D1 stores one versioned JSON workspace per owner. Each save compares the expected revision: a stale tab gets HTTP 409 instead of overwriting a newer save. The entire state change is one atomic SQL operation. Server validation checks duplicate IDs, balanced gross, one delivery per inventory unit, linked records and consistent sold stock. Writes require the application JSON client header and matching Origin when supplied. Credentials never appear in browser code.

This initial design caps each request at 750,000 UTF-8 bytes and each collection at 3,000 records. Normalize and paginate storage before larger-scale use. Accounting, finance reserve, documents, staff permissions, audit history, automated messaging, ad synchronization and AI services are separate future modules. Financial reporting shows deal gross before overhead and tax, not accounting profit.

## Development

Use the Sites portable starter lifecycle. Dependencies are pinned in package-lock.json. Node 22.13 or newer and npm are required.

1. Run the Sites dependency installer when needed.
2. After editing ui/index.html, run node scripts/generate-shell.mjs.
3. Build through the Sites build helper to emit dist/server/wrangler.json.
4. Apply each new local SQL migration once using the starter Wrangler command. On Windows, use forward slashes for --import ./scripts/sites-env.mjs. Preview state belongs in .wrangler/state.
5. Start node scripts/run-framework.mjs dev --hostname 127.0.0.1. The starter provides local mock sign-in, excluded from production.

Production provisions its own D1 database and applies the committed Drizzle migration during deployment. Local preview records never populate the hosted workspace.

## Verification

- JavaScript syntax checks and TypeScript noEmit check.
- Sites production build.
- With preview running, node scripts/test-core-workflow.mjs checks scheduling, task completion, appointment edits, single check-in, explicit timed stages, marked-sold stock delivery, duplicate-sale prevention and linked record persistence.
- With preview running, node scripts/test-workspace.mjs checks missing identity, invalid gross, duplicate delivery, origin/client-header protection, durable saves and stale-revision protection. It restores the original local fixture with revision protection and never targets the hosted database.
- Browser exercise: stock entry, lead entry, linked sale, reload persistence, removal of sold stock from active inventory and isolation between demo and saved modes.


## CRM workflow update

The Opportunities board uses these requested stages: New opportunity, 24 hours, 48 hours, 72 hours, AI takeover, Lead lost / no answer, Income not approved, Booked appointment, Approved, Sold and Delivered. Cards can be dragged between lanes or edited in their detail panel. Separate named pipelines are configurable in Store Setup. Active opportunities are independent of financial reporting dates. Timed lanes are derived from arrival/customer-reply timestamps; booked, approved and closed outcomes remain fixed.

Conversations are attached to opportunity IDs and include contact details, text-permission and do-not-contact flags, human/AI control selection, persisted drafts, and manually logged historical messages. Sending SMS is disabled. A newly logged customer reply returns control to a human and discards pending template follow-ups; an explicit opt-out also disables text permission.

The AI Follow-up page stores the 72-hour threshold, new-opportunity control defaults, draft limits, a template and future AI instructions. The Prepare action creates reviewable template drafts for eligible unanswered logged outbound conversations. These drafts are explicitly labeled templates: no AI model is connected and no autonomous/background sending runs. No appointment, approval, closed, do-not-contact, missing-consent or human-controlled opportunity is eligible.

## Phone app and front licence capture

`/mobile` is an installable web app with Inventory, Customers, Scan licence and Finance files. The app shares the CRM database. On a phone, open the URL in Safari/Chrome and use Add to Home Screen / Install app. The in-app plus button gives installation instructions. Internet and a signed-in authorized account are required; this is not an App Store/Play Store package.

Capture the **front only** using the phone camera or an image file. Self-hosted PaddleOCR.js with official mobile models reads the printed text on the device and populates editable name, birth date, address, licence number and expiry fields where recognized. The complete photo is selected initially; cropping is optional. There is no barcode requirement, scanner registration, cloud OCR API, or AI API key. The operator must review/correct fields and confirm customer permission before saving. OCR accuracy depends on the card layout and image quality; this is capture and text extraction, not identity/authenticity verification. See docs/licence-scanner.md for provenance and test limits.

Saving uploads the reviewed front photo to private R2 and writes a separate owner-scoped D1 licence record. A CAS-guarded D1 batch updates the linked CRM customer and licence metadata together; duplicate capture IDs do not create duplicate clients. New captures may create a customer, or populate a selected existing opportunity. Name/address/contact data appear in the CRM; full licence numbers, birth dates and object keys stay out of general workspace data and CSV exports. Each file and image request checks identity and workspace ownership; images use private/no-store headers. The service worker caches only fixed, nonsensitive shell assets. Capture images, extracted text and API responses are never put in browser storage or the service-worker cache.

The authorized finance test account is `rowcliffem@gmail.com`; the owner is `mrowcliffe@me.com`. Server role configuration is in `lib/workspace-access.ts` and `lib/team-access.mjs`. Platform access must also allow the matching signed-in email. Licences are shared within this one dealership, not across unrelated user workspaces.

Customer progress adds **Test drive** and **In finance** to the requested pipeline; **Delivered** is labelled **Delivered / gone** in the phone app. Phone stage changes use an authenticated, bounded CRM action and become visible on desktop. A showroom visit changed to Test drive / At the desk also updates the customer process to Test drive / In finance. Sold/Delivered stock status changes do not invent a financial delivery ledger entry.

`scripts/test-license-workflow.mjs` targets localhost only and checks printed-text parsing, permission/review validation, finance role limits, photo persistence, masking, denied cross-owner reads, duplicate prevention, customer auto-fill and all requested process stages. It restores its local workspace and removes its own local document fixture. Browser QA additionally exercised actual OCR from a clearly fictional front image and checked the phone layout. Physical-device camera capture, installation and the finance account's own sign-in need device/account verification.

Lead Intake supports authenticated entry/import for Website, Facebook, Instagram, AutoTrader and CarGurus. Normalization accepts canonical contact fields or Meta field_data. A source plus external ID is idempotent. Live source accounts, Meta lead retrieval, marketplace delivery and a private-Site-compatible server relay are not connected; source selection does not activate an external account. The CRM action API is authenticated, same-origin protected and uses compare-and-swap retries.

Inventory has explicit Available, Reserved, Sold and Recon views. Reservations can link a customer and a hold-until time; holds require manual release. Marking sold is a stock/lifecycle action and does not invent a financial delivery. A recorded delivered deal sets the linked opportunity to Delivered, and delivered stock cannot be relisted without correcting that deal.

Appointments & Tasks stores each activity with its linked opportunity, date/time, assigned rep, duration, notes and status. A new appointment moves an open opportunity to Booked appointment while preserving Approved. Check in records one showroom visit and completes the appointment, preventing repeat check-ins. Cancelling or completing an activity keeps its history; it does not automatically change the sales outcome. Closed opportunities must be reopened before scheduling or rescheduling. Times use the browser's time zone. Reminders appear inside the CRM and send no notifications. Operational open-opportunity counts include all active leads regardless of the selected financial reporting period.

Run node scripts/test-crm.mjs with the local preview for timing, outcome exclusions, consent/opt-out, customer reply handoff, normalization, deduplication and review-draft persistence tests. Like the baseline test, it only targets localhost and restores its fixture with revision protection.
# Practice conversations

Clearly marked `TEST LEAD` opportunities can start a 72-hour practice scenario from Conversations. Play the dealership to chat with a scripted test customer, or play the customer to try scripted follow-up responses. Messages are marked as simulations and persist privately. This uses no AI provider or SMS service, does not record real text consent, and excludes test leads from normal follow-up eligibility. STOP halts the practice conversation until it is restarted.

