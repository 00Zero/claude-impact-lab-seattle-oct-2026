# Public evidence and privacy boundaries

## What is published

An editorially de-identified journey, general note-style requirements, a delivered prompt with identifying wrapper/sample output removed, a proposed clarified starter, and project planning material.

## What is excluded

Original email/PDF and subject, signatures, customer/practice/supervisor names, emails, phone numbers, license identifiers, exact correspondence dates, professional biography, scheduling links, private CRM/config files, identifying paths, session-specific clinical passages, raw meeting transcripts, whiteboard photographs, and unreviewed attachments.

De-identification is not merely replacing the customer's name. Unique clinical quotations and biographical combinations are also excluded. No formal anonymization guarantee is claimed.

## Publication process

Start a fresh git history with an explicit file allowlist. Never commit raw sources and then redact in a later commit. Inspect all filenames and tracked contents before the first push. Do not copy the private marketing repository, its history, environment files, or customer directories.

The deny patterns in .gitignore reduce accidents; they are not a substitute for review.

## Proposed runtime

Local inference alone does not establish legal/regulatory compliance. Verify actual storage, logs, access, telemetry, exports, and network behavior. No automatic sharing of patient content or silent learning from edits. Clinical examples for the public demo must be fictional.
