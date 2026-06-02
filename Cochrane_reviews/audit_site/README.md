# Cochrane Audit Site

This folder contains a static dashboard for manual inspection during Cochrane
benchmark curation.

The site is intentionally separate from `../README.md`:

- `../README.md` documents the broader review selection and curation history.
- This README documents the browser viewer used to inspect the current
  per-review benchmark files.

## Source Of Truth

The per-review files in `../benchmark_data/` are the current source of truth for
this viewer. The website renders `benchmark.json` directly and stores reviewer
findings only in browser local storage until the reviewer exports them.

At page load, `app.js` reads these files directly:

- `../benchmark_data/reviews.json`
- `../benchmark_data/<review_id>/benchmark.json`
- `../benchmark_data/<review_id>/status.json` when available

Because the site reads those source files at runtime, updating the audit is
simple:

1. Update or regenerate `Cochrane_reviews/benchmark_data/<review_id>/benchmark.json`.
2. Add or update that review in `Cochrane_reviews/benchmark_data/reviews.json`.
2. Refresh the browser page.

No separate website-generation step is needed.

## Open The Site

Serve the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/Cochrane_reviews/audit_site/
```

Opening `index.html` directly from the filesystem may not work because browsers often block JavaScript from reading adjacent source files through `file://`.

## What The Site Shows

The current viewer shows these provisional audit components:

- one summary panel per review from `benchmark_data/reviews.json`
- review header metadata and links to the local PDF, Cochrane, and PubMed when
  available
- research question and inclusion/exclusion criteria from `benchmark.json`
- included and excluded Cochrane references, usually generated from Cochrane RIS
  exports
- meta-analysis summaries and study rows generated from Cochrane analysis CSV
  exports when available
- risk-of-bias symbols and the review-level RoB legend
- report buttons for auditable benchmark fields
- local audit findings with review, edit, import, and export controls

In this site, a trial means one Cochrane included-study entry, usually headed by a study label such as `Smith 2021 {published data only}`. One trial entry may contain multiple publications, abstracts, registry records, or other reports for the same study. In the saved TSV files, legacy column names such as `study_blocks` still refer to these trial entries.

## Future Audit Components

This folder can grow into the broader manual inspection dashboard for the benchmark dataset. Future components can be added to the same static site, for example:

- manual PMID/PMCID match decisions
- full-text availability checks
- source-PDF comparison notes
- outcome extraction audit
- final benchmark include/drop decisions

Keep those decisions in separate TSV/CSV/JSON files, then add viewer code in `app.js` to render them. The website should remain a read-only view over public, shareable data files.
