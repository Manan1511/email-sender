# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Vite, TypeScript, Tailwind, shadcn/ui; Netlify Free; Supabase Free.

## Users

Small CSI VIT chapter team members prepare sponsorship outreach batches to send individually from their own Google accounts. Each Gmail account belongs to one sender; all team members share the app, not each other's batch data.

## Product Purpose

Import a sponsor contact sheet, write a reusable personalized email, preview each recipient's message, send through the signed-in member's Gmail, and track per-recipient outcomes.

## Operating Context

Desktop-led web workflow with mobile support. Typical sends: up to 100 spreadsheet rows per batch and 2,000 send attempts per month across the app. Source template workbook contains the headers Company Name, POC Name, Email ID, Designation.

## Capabilities and Constraints

Google sign-in and separately consented Gmail sending. Support CSV and XLSX, editable rich-text messages, column and sender placeholders, multiple shared attachments, test mail, per-recipient results, retry after confirmation, private templates, and private history. Skip invalid and duplicate contacts with a reason; never retry confirmed success automatically. Email acceptance is not inbox-delivery confirmation. Keep batch data and attachments 30 days. Limit each upload to 100 nonblank rows and total attachments to 10 MB. Keep this small-team deployment within Netlify and Supabase free-plan quotas; no purchased domain available. The Google app remains unverified for the initial under-20-member team, with Google's consent warning and new-user cap.

## Evidence on Hand

The project contains the user-provided `template.xlsx`, with headers Company Name, POC Name, Email ID, and Designation. No logos, app secrets, event brochure, or actual recipient list have been supplied. Do not invent sponsor data or represent the app as configured for live email without OAuth/backend credentials.

## Product Principles

- Review every personalized recipient before sending the batch.
- Send individual messages, one contact per email.
- Save every recipient outcome so interrupted work can resume safely.
- Store account tokens and batch data privately per user.
- Explain quota limits, skipped rows, send failures, and ambiguous attempts clearly.
