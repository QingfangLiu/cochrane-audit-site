# Cochrane Benchmark Data

This folder is the intended per-review source of truth for audited Cochrane
benchmark data.

The current files include:

- `CD004366`: seeded from the 2026 Issue 1 source PDF, Cochrane RIS reference
  exports, and Cochrane analysis CSV exports.
- `CD011506`: seeded from the 2026 Issue 1 source PDF, Cochrane RIS reference
  exports, and Cochrane analysis CSV exports.
- `CD013524`: seeded from the 2026 Issue 1 source PDF, Cochrane RIS reference
  exports, and Cochrane analysis CSV exports.
- `CD014811_loop_diuretics_hf`: historical migration test seeded from existing
  provisional extraction artifacts.

## Layout

```text
benchmark_data/
  reviews.json
  CD004366/
    benchmark.json
    audit_findings.tsv
    status.json
  CD011506/
    benchmark.json
    audit_findings.tsv
    status.json
  CD013524/
    benchmark.json
    audit_findings.tsv
    status.json
```

- `reviews.json`: registry of reviews available to the audit site and,
  eventually, evaluation.
- `<review_id>/benchmark.json`: editable per-review benchmark source used by the
  audit site.
- `<review_id>/audit_findings.tsv`: exported or copied human audit findings for
  that review.
- `<review_id>/status.json`: lifecycle state and review-local notes.

Source PDFs for new benchmark work should live outside the old first-pass
folders:

```text
Cochrane_reviews/
  source_reviews/
    2026_issue_1/
      CD013524.pdf
      CD013524-SUP-07-dataPackage/
        CD013524-analysis-data/
          CD013524-data-rows.csv
          CD013524-overall-estimates-and-settings.csv
          CD013524-subgroup-estimates.csv
        CD013524-study-data/
          CD013524-included.ris
          CD013524-excluded.ris
          CD013524-ongoing.ris
          CD013524-study-information.csv
          CD013524-risk-of-bias.csv
          CD013524-study-arms.csv
          CD013524-study-results.csv
          CD013524.json
```

Use `source_reviews/<year>_issue_<issue>/` for new Cochrane reviews. The older
`first_pass`, `second_pass`, and `after_pilot` folders are historical staging
areas and should not be used for new benchmark intake.

When Cochrane provides a supplementary data package, keep the downloaded folder
intact beside the PDF. The active benchmark tools search recursively under the
issue folder for the expected review-specific filenames.

Each `benchmark.json` review metadata block can carry:

```json
{
  "source_collection": "2026_issue_1",
  "publication_year": "2026",
  "publication_issue": "1"
}
```

## Lifecycle

Use these states in `status.json`:

- `draft_extracted`: machine-generated seed data; not audited.
- `in_audit`: a human is checking the audit site against the Cochrane review.
- `verified`: audit findings have been resolved into `benchmark.json`.
- `frozen_for_evaluation`: evaluation can consume this review and the data
  should not be edited casually.

`reviews.json` also has `included_in_evaluation`. Keep it `false` until the
review is verified or frozen.

## Current Builders

The active intake path builds a review-level benchmark from a source PDF plus
Cochrane package files. The source scanner expects the PDF and data package to
live under `Cochrane_reviews/source_reviews/<year>_issue_<issue>/` and searches
the data package recursively for the review-specific files.
Search-method fields are staged separately in
`provisional_data/review_search_methods.tsv` because they come from review text
rather than the Cochrane data package and need a separate audit pass.

The legacy migration path can still build or refresh one benchmark from current
provisional data:

```bash
python3 Cochrane_reviews/benchmark_tools/build_review_benchmark_json.py CD014811_loop_diuretics_hf
```

This reads the existing TSV/JSON artifacts under `Cochrane_reviews/provisional_data/`
plus `Cochrane_reviews/review_pubmed_pmc_indexing.csv`, then writes the per-review
benchmark folder.

This is useful for testing the new structure and the audit site, but it is not
the preferred workflow for new 2026 reviews.

When provisional artifacts have been generated for a new PDF, pass source-review
metadata explicitly:

```bash
python3 Cochrane_reviews/benchmark_tools/build_review_benchmark_json.py CD013524 \
  --source-pdf Cochrane_reviews/source_reviews/2026_issue_1/CD013524.pdf \
  --review-title CD013524 \
  --publication-year 2026 \
  --publication-issue 1 \
  --source-collection 2026_issue_1
```

## Current RIS-Driven Workflow

For a new Cochrane review PDF, the preferred path is not to run every old
extractor. The current audit surface needs review protocol/eligibility,
included/excluded references, meta-analysis summaries, study rows, and
risk-of-bias symbols. Study characteristics and reproduced meta-analysis outputs
are not part of the human audit surface.

The target workflow should be:

1. Add or select one Cochrane review PDF under
   `Cochrane_reviews/source_reviews/<year>_issue_<issue>/`.
2. Add the matching Cochrane data-package folder beside the PDF when available.
   The tools find included/excluded RIS exports under `*-study-data/`.
3. Add Cochrane analysis CSV exports when available. The tools find
   `<review_id>-overall-estimates-and-settings.csv` and
   `<review_id>-data-rows.csv` under `*-analysis-data/`.
4. Build a review-level PubMed/PMC index for the Cochrane review article.
5. Convert the RIS exports into included/excluded reference TSV artifacts.
6. Run the review-text extractor for protocol/eligibility.
7. Run the review-text extractor for search methods and search strategies.
8. Build `<review_id>/benchmark.json` from the header/protocol/search/reference
   outputs.
9. Update the benchmark `meta_analysis` block directly from the Cochrane CSV
   exports.
10. Load the review in the audit site through `reviews.json`.
11. Refresh `benchmark_questions.tsv` so the agent can launch the review by
    number or review ID.
12. Export human audit findings.
13. Resolve findings by editing `benchmark.json`.
14. Mark the review `verified` or `frozen_for_evaluation`.

Example CD013524 command sequence:

```bash
WORK=/private/tmp/cochrane_cd013524_ris_pubmed

mkdir -p "$WORK"

python3 Cochrane_reviews/benchmark_tools/audit_cochrane_review_pubmed_pmc.py \
  Cochrane_reviews/source_reviews \
  --output "$WORK/review_pubmed_pmc_indexing.csv" \
  --cache "$WORK/review_pubmed_pmc_lookup_cache.json"

python3 Cochrane_reviews/benchmark_tools/build_reference_indexing_from_cochrane_ris.py \
  Cochrane_reviews/source_reviews \
  --review-id CD013524 \
  --output-dir "$WORK" \
  --cache "$WORK/cochrane_ris_reference_cache.json"

python3 Cochrane_reviews/benchmark_tools/update_cochrane_review_protocol_eligibility.py \
  Cochrane_reviews/source_reviews \
  --output "$WORK/review_protocol_eligibility.tsv" \
  --prefill-from-review-text \
  --overwrite-prefill \
  --source pdf \
  --quiet

python3 Cochrane_reviews/benchmark_tools/update_cochrane_review_search_methods.py \
  Cochrane_reviews/source_reviews \
  --output "$WORK/review_search_methods.tsv" \
  --prefill-from-review-text \
  --overwrite-prefill \
  --source pdf \
  --quiet

python3 Cochrane_reviews/benchmark_tools/build_review_benchmark_json.py CD013524 \
  --provisional-dir "$WORK" \
  --review-index "$WORK/review_pubmed_pmc_indexing.csv" \
  --source-pdf Cochrane_reviews/source_reviews/2026_issue_1/CD013524.pdf \
  --review-title CD013524 \
  --publication-year 2026 \
  --publication-issue 1 \
  --source-collection 2026_issue_1 \
  --status draft_extracted

python3 Cochrane_reviews/benchmark_tools/update_review_benchmark_from_cochrane_analysis_csv.py \
  CD013524

python3 Cochrane_reviews/benchmark_tools/update_benchmark_questions.py
```

The final update step searches recursively under the review source collection
folder, then reads `CD013524-overall-estimates-and-settings.csv` and
`CD013524-data-rows.csv` directly from the Cochrane data package. It replaces
the benchmark `meta_analysis` block without writing intermediate analysis TSV
files.

The benchmark question refresh reads `benchmark_data/reviews.json`, writes the
root `benchmark_questions.tsv`, and preserves existing manual question wording
unless `--overwrite` is passed.

If the Cochrane analysis CSV exports are not available for a future review, the
older PDF text extractors can still be used for meta-analysis summaries, study
rows, and risk-of-bias rows.

If RIS exports are not available for a future review, use the PubMed references
page as a fallback candidate list with
`extract_pubmed_html_reference_blocks.py` and
`build_reference_indexing_from_pubmed_html.py`. That fallback should create
`reference_candidate_*` artifacts, not verified included/excluded references.

After this is stable, a wrapper command can orchestrate those steps for a new
PDF. The wrapper should call the existing extraction scripts instead of
duplicating extraction logic.

## Audit Findings

The audit site stores findings in browser local storage until export. Exported
findings should be saved or copied into the review folder:

```text
benchmark_data/<review_id>/audit_findings.tsv
```

Audit findings do not automatically change `benchmark.json`. They are a review
queue for manual or scripted triage. A future tool should read
`audit_findings.tsv`, show each finding alongside the current `benchmark.json`
value, and help decide whether to update the benchmark, mark the finding
resolved, or leave it for discussion.

## Editing Rule

Once a review enters audit, prefer editing only the review-local
`benchmark.json`. Do not keep fixing scattered global provisional TSV files for
that review unless the extraction code itself needs to be rerun.
