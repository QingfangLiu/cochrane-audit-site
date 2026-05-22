# Cochrane Audit Site

This folder contains a static, read-only dashboard for manual inspection during Cochrane benchmark curation.

The site is intentionally separate from `../README.md`:

- `../README.md` documents the review selection, source PDFs, TSV outputs, and curation assumptions.
- This README documents the browser viewer used to inspect those TSV outputs.

## Source Of Truth

The TSV/JSON files in `../provisional_data/` remain the current source of truth for this unaudited viewer. The website does not store canonical data, does not edit data, and does not contain a generated copy of the source rows.

At page load, `app.js` reads these files directly:

- `../provisional_data/review_curation_summary.tsv`
- `../provisional_data/review_protocol_eligibility.tsv`
- `../provisional_data/review_outcomes.tsv` when available
- `../provisional_data/pubmed_pmc_summary.tsv`
- `../provisional_data/included_study_indexing.tsv`
- `../provisional_data/included_report_indexing.tsv` when available
- `../provisional_data/included_trial_registry_records.tsv` when available
- `../provisional_data/included_pubmed_records.tsv`
- `../provisional_data/excluded_study_indexing.tsv` when available
- `../provisional_data/excluded_report_indexing.tsv` when available
- `../provisional_data/excluded_pubmed_records.tsv` when available
- `../provisional_data/excluded_pubmed_summary.tsv` when available
- `../provisional_data/reference_indexing_source_manifest.json` when available
- `../provisional_data/analysis_counts.tsv` when available
- `../provisional_data/study_characteristics_first_pass.tsv` when available
- `../provisional_data/study_characteristics_first_pass_raw.json` when available
- `../provisional_data/analysis_results_first_pass.tsv` when available
- `../provisional_data/analysis_results_first_pass_raw.json` when available
- `../provisional_data/analysis_comparisons_first_pass.tsv` when available
- `../provisional_data/analysis_study_rows_first_pass.tsv` when available
- `../provisional_data/analysis_study_rows_first_pass_raw.json` when available
- `../provisional_data/analysis_reproduced_results_first_pass.tsv` when available
- `../provisional_data/analysis_reproduced_forest_plots_first_pass.json` when available
- `../provisional_data/review_domain_source_raw.json` when available
- `../provisional_data/review_domain_labels_ai.json` when available

Because the site reads those source files at runtime, updating the audit is simple:

1. Update or regenerate the TSV/JSON files in `Cochrane_reviews/provisional_data/`.
2. Refresh the browser page.

No separate website-generation step is needed.

For the reproduced meta-analysis section, regenerate the source TSV/JSON from the repository root with:

```bash
python3 Cochrane_reviews/scripts/reproduce_cochrane_meta_analysis.py
```

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

- review-level curation context from `provisional_data/review_curation_summary.tsv`
- AI-prefilled, unverified research question, objective, population and intervention eligibility, and inclusion/exclusion fields from `provisional_data/review_protocol_eligibility.tsv`
- unverified planned/review-level outcome rows extracted from the PDF `Types of outcome measures` section in `provisional_data/review_outcomes.tsv`, including short `outcome_name` labels, full `outcome_text_raw` audit text, and heuristic mapping columns to saved analysis-result outcome labels when available
- AI-generated, unverified clinical-domain labels from `provisional_data/review_domain_labels_ai.json`, with raw PDF-derived editorial group and MeSH metadata from `provisional_data/review_domain_source_raw.json`
- one summary panel per review
- included and excluded Cochrane reference blocks generated from PubMed HTML-derived reference TSVs
- one card per Cochrane included study/trial entry
- source-record coverage fractions in the trial checklist, using DOI candidates when available, falling back to PMID/title candidates when DOI candidates are absent, and counting extracted trial registry records as identified source records
- report-candidate lookup rows within each selected trial
- detected explicit PMID/MEDLINE IDs, DOIs, trial registry records, matched PMIDs, and PMCIDs
- lookup methods, title queries, and lookup errors
- matched PubMed record metadata and links
- analysis-count scan totals and analysis ID lists from `provisional_data/analysis_counts.tsv`
- provisional first-pass study-characteristics rows from `provisional_data/study_characteristics_first_pass.tsv`
- provisional first-pass per-analysis overall-CI extraction status from `provisional_data/analysis_results_first_pass.tsv`
- provisional first-pass comparison families from `provisional_data/analysis_comparisons_first_pass.tsv`, including automatic sensitivity/subgroup role labels
- provisional first-pass forest-plot study rows from `provisional_data/analysis_study_rows_first_pass.tsv`, including matched Cochrane trials, per-arm data, weights, study-level effect estimates, and PMID/PMCID coverage
- provisional first-pass reproduced meta-analysis totals from `provisional_data/analysis_reproduced_results_first_pass.tsv`, with all-study and PMCID-only subsets
- SVG forest plots rendered directly from `provisional_data/analysis_reproduced_forest_plots_first_pass.json`; the website does not recalculate pooled effects
- raw TSV/JSON row details for checking displayed values against the source rows

In this site, a trial means one Cochrane included-study entry, usually headed by a study label such as `Smith 2021 {published data only}`. One trial entry may contain multiple publications, abstracts, registry records, or other reports for the same study. In the saved TSV files, legacy column names such as `study_blocks` still refer to these trial entries.

The review-outcome section shows planned or review-level outcomes, not necessarily outcomes that were included in a meta-analysis. Check the Analysis Results section and the `matched_analysis_*` columns in `review_outcomes.tsv` to see which planned outcomes currently map to saved meta-analysis rows.

The study-characteristics, analysis-result, comparison, forest-plot study-row, and reproduced-meta-analysis sections currently cover `first_pass` reviews only. Other groups will show no rows in those sections until their provisional files are generated or the scripts are rerun with broader scope and the site source paths are updated.

## Future Audit Components

This folder can grow into the broader manual inspection dashboard for the benchmark dataset. Future components can be added to the same static site, for example:

- manual PMID/PMCID match decisions
- full-text availability checks
- source-PDF comparison notes
- outcome extraction audit
- meta-analysis reproduction audit
- final benchmark include/drop decisions

Keep those decisions in separate TSV/CSV/JSON files, then add viewer code in `app.js` to render them. The website should remain a read-only view over public, shareable data files.
