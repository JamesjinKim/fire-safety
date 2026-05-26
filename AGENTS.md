# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a planning and reference-data workspace for a Korean fire safety inspection workflow system. The intended future app structure is documented, but not yet scaffolded.

- `README.md`: project entry point and current decisions.
- `docs/01-overview.md`: product overview and decision history.
- `docs/01-plan/features/`: PDCA Plan documents.
- `docs/02-design/features/`: domain models, architecture, and implementation guidance.
- `data/fire-duty-master.json`: legal-document master data SSoT.
- `data/validate-master.mjs`: validator for the master JSON.
- `reference/checklists.json`: digitized checklist data from 별지 제4호.
- `reference/*.html`: HTML references for legal forms.
- `reference/*.pdf` and `sample/*.pdf`: local-only references; PDFs are ignored by Git.

Future source code should follow the documented layout: `apps/web` for the Next.js app and `packages/{types,fire-data,law-client}` for shared modules.

## Build, Test, and Development Commands

No app build system is installed yet. Use the available validation command:

```bash
node data/validate-master.mjs
```

This checks `data/fire-duty-master.json` for required fields, enum values, legal reference format, duplicate IDs, and minimum verified-node count.

For repository inspection, prefer:

```bash
rg "TODO|Open Questions" docs data
rg --files
```

## Coding Style & Naming Conventions

Use two-space indentation for JSON, JavaScript, TypeScript, Markdown examples, and future config files. Keep filenames descriptive and lowercase where practical. Existing feature docs use kebab-case, for example `fire-inspection-system.plan.md`.

Use English identifiers in code and JSON keys, but keep Korean legal labels, form titles, and source names exactly as written in official references. Do not invent legal facts; use `TODO: 검증필요` for unverified values.

## Testing Guidelines

Run `node data/validate-master.mjs` before every commit that changes `data/fire-duty-master.json`. When future app code is added, place tests beside the owning package or app and document the command here. Test names should describe behavior, for example `deriveInspectionScope.apartment.test.ts`.

## Commit & Pull Request Guidelines

Follow the current history style: short imperative commit messages, such as `Stop tracking PDF reference files`. Keep commits focused.

Pull requests should include a short summary, changed paths, validation results, and screenshots for visual HTML/form changes. Link related issues or docs decisions when applicable.

## Security & Configuration Tips

Do not commit `.env*`, local agent state, or PDFs. Legal source PDFs may remain on disk for reference, but Git should track only extracted, reviewed data and lightweight HTML/JSON assets.

# 항상 한글로 답변 할것!  