(function () {
  const BENCHMARK_DATA_ROOT = "../benchmark_data/";
  const BENCHMARK_REGISTRY_PATH = `${BENCHMARK_DATA_ROOT}reviews.json`;
  const ROW_BUCKET_KEYS = [
    "summary",
    "curation",
    "reviewIndex",
    "protocol",
    "studies",
    "records",
    "reports",
    "registries",
    "excludedStudies",
    "excludedReports",
    "excludedRecords",
    "excludedRegistries",
    "excludedSummary",
    "referenceCandidates",
    "referenceCandidateReports",
    "referenceCandidateRecords",
    "referenceCandidateRegistries",
    "referenceCandidateSummary",
    "analysisResults",
    "analysisResultsRaw",
    "analysisStudyRows",
    "analysisRiskOfBiasRows",
    "analysisReproducedResults",
    "domainSources",
    "domainLabels",
  ];

  const GROUP_ORDER = ["first_pass", "second_pass", "after_pilot"];
  const GROUP_LABELS = {
    first_pass: "First pass",
    second_pass: "Second pass",
    after_pilot: "After pilot",
  };
  const INCLUDED_TRIAL_SORT_OPTIONS = [
    { key: "trials", label: "Trials" },
    { key: "pmidCoverage", label: "PMID coverage %" },
    { key: "pmcidAmongPmids", label: "PMCID/PMID %" },
    { key: "reviewTitle", label: "Review title" },
  ];
  const AUDIT_FINDINGS_STORAGE_KEY = "cochraneAuditFindings.v1";
  const AUDIT_REVIEWER_STORAGE_KEY = "cochraneAuditReviewer.v1";
  const AUDIT_FINDING_FIELDS = [
    "finding_id",
    "created_at",
    "review_id",
    "section",
    "item_type",
    "item_id",
    "source_file",
    "field_name",
    "displayed_value",
    "issue_type",
    "correct_value",
    "source_location",
    "source_excerpt",
    "notes",
    "reviewer",
    "status",
  ];
  const AUDIT_ISSUE_TYPES = [
    ["incorrect", "Incorrect value"],
    ["missing", "Missing value"],
    ["unclear", "Unclear / needs checking"],
    ["duplicate", "Duplicate"],
    ["wrong_match", "Wrong match"],
    ["not_in_source", "Not in source"],
    ["other", "Other"],
  ];

  const app = document.getElementById("app");
  let currentReviews = [];
  const state = {
    files: {},
    rows: {},
    selectedReviewId: "",
    selectedTrialRowIndex: "",
    selectedTrialSource: "included",
    reviewTocOpen: true,
    view: "home",
    includedTrialSortKey: "trials",
    includedTrialSortDirection: "desc",
    auditFindings: [],
    auditModalContext: null,
    auditReviewOpen: false,
    auditEditingFindingId: "",
    auditMessage: "",
  };
  let tocScrollSpyBound = false;
  let tocScrollSpyFrame = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function display(value, fallback = "None") {
    const text = String(value ?? "").trim();
    return text && text !== "." ? escapeHtml(text) : `<span class="muted">${escapeHtml(fallback)}</span>`;
  }

  function raw(value) {
    const text = String(value ?? "").trim();
    return text === "." ? "" : text;
  }

  function asNumber(value) {
    const text = raw(value).replaceAll(",", "");
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function finiteNumber(value) {
    const text = raw(value).replaceAll(",", "");
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function splitCell(value) {
    const text = raw(value);
    if (!text) {
      return [];
    }
    return text.split(";").map((item) => item.trim()).filter(Boolean);
  }

  function fragmentPart(value) {
    return raw(value).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
  }

  function analysisStudyRowsId(analysisId) {
    return `analysis-study-rows-${fragmentPart(analysisId)}`;
  }

  function sentenceCaseId(value) {
    return String(value || "")
      .replace(/^CD\d+_?/, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function reviewTitle(row) {
    return raw(row.review_title) || raw(row.extracted_title) || raw(row.pubmed_title) || sentenceCaseId(row.review_id || row.review_pdf || "Review");
  }

  function reviewCode(review) {
    const text = raw(review?.review_id) || raw(review?.review_pdf) || "Review";
    const match = text.match(/CD\d+/i);
    return match ? match[0].toUpperCase() : text;
  }

  function reviewIdFromPath(path) {
    return String(path || "")
      .split("/")
      .pop()
      .replace(/\.pdf$/i, "");
  }

  function groupSortIndex(group) {
    const index = GROUP_ORDER.indexOf(group);
    return index === -1 ? 99 : index;
  }

  function percent(numerator, denominator) {
    return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : "0.0%";
  }

  function countBy(rows, field) {
    return rows.reduce((counts, row) => {
      const value = raw(row[field]) || "none";
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
  }

  function statusSummary(counts) {
    return Object.entries(counts)
      .map(([status, count]) => `${status}: ${count}`)
      .join("; ");
  }

  function parseDelimited(text, delimiter = "\t") {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (!quoted && char === delimiter) {
        row.push(cell);
        cell = "";
        continue;
      }

      if (!quoted && (char === "\n" || char === "\r")) {
        if (char === "\r" && next === "\n") {
          index += 1;
        }
        row.push(cell);
        if (row.some((value) => value !== "")) {
          rows.push(row);
        }
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell);
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }

    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((values) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = values[index] ?? "";
      });
      return object;
    });
  }

  async function sha256(text) {
    if (!window.crypto?.subtle) {
      return "";
    }
    const buffer = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function benchmarkAssetPath(path) {
    const text = raw(path);
    if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/") || text.startsWith("../")) {
      return text;
    }
    return `${BENCHMARK_DATA_ROOT}${text}`;
  }

  function benchmarkSourceFile(reviewId) {
    const id = raw(reviewId) || "<review_id>";
    return `benchmark_data/${id}/benchmark.json`;
  }

  function benchmarkSourceLabel(review) {
    return `Rendered from ${benchmarkSourceFile(review?.review_id || state.selectedReviewId)}.`;
  }

  async function loadJsonFile(path, required = true) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      if (required) {
        throw new Error(`Could not load ${path}: HTTP ${response.status}`);
      }
      return { path, loaded: false, data: null, bytes: 0, hash: "" };
    }

    const text = await response.text();
    const data = JSON.parse(text);
    const hash = await sha256(text);
    return {
      path,
      loaded: true,
      data,
      bytes: text.length,
      hash,
    };
  }

  function emptyRowBuckets() {
    return ROW_BUCKET_KEYS.reduce((buckets, key) => {
      buckets[key] = [];
      return buckets;
    }, {});
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function withReviewIdentity(row, review) {
    const value = row && typeof row === "object" ? row : {};
    return {
      ...value,
      review_id: raw(value.review_id) || raw(review.review_id),
      review_title: raw(value.review_title) || raw(review.review_title),
      review_group: raw(value.review_group) || raw(review.review_group),
      review_pdf: raw(value.review_pdf) || raw(review.review_pdf) || raw(review.source_pdf_path),
    };
  }

  function adaptBenchmarkRows(benchmark, registryReview = {}) {
    const buckets = emptyRowBuckets();
    const review = {
      ...(registryReview || {}),
      ...(benchmark?.review || {}),
    };
    const reviewSummary = benchmark?.review_summary || {};
    const references = benchmark?.references || {};
    const metaAnalysis = benchmark?.meta_analysis || {};
    const summary = withReviewIdentity(reviewSummary.pubmed_pmc || {}, review);

    buckets.summary.push({
      ...summary,
      review_id: raw(summary.review_id) || raw(review.review_id),
      review_group: raw(summary.review_group) || raw(review.review_group),
      review_pdf: raw(summary.review_pdf) || raw(review.review_pdf),
    });
    buckets.curation.push(withReviewIdentity(reviewSummary.curation || {}, review));
    buckets.reviewIndex.push(withReviewIdentity(reviewSummary.review_index || {}, review));
    buckets.protocol.push(withReviewIdentity(benchmark?.protocol_and_eligibility || {}, review));
    buckets.domainSources.push(withReviewIdentity(reviewSummary.domain_source || {}, review));
    buckets.domainLabels.push(withReviewIdentity(reviewSummary.domain_label || {}, review));

    buckets.studies.push(...ensureArray(references.included_studies).map((row) => withReviewIdentity(row, review)));
    buckets.records.push(...ensureArray(references.included_pubmed_records).map((row) => withReviewIdentity(row, review)));
    buckets.reports.push(...ensureArray(references.included_report_candidates).map((row) => withReviewIdentity(row, review)));
    buckets.registries.push(...ensureArray(references.included_trial_registry_records).map((row) => withReviewIdentity(row, review)));
    buckets.excludedStudies.push(...ensureArray(references.excluded_studies).map((row) => withReviewIdentity(row, review)));
    buckets.excludedRecords.push(...ensureArray(references.excluded_pubmed_records).map((row) => withReviewIdentity(row, review)));
    buckets.excludedReports.push(...ensureArray(references.excluded_report_candidates).map((row) => withReviewIdentity(row, review)));
    buckets.excludedRegistries.push(...ensureArray(references.excluded_trial_registry_records).map((row) => withReviewIdentity(row, review)));
    buckets.excludedSummary.push(...ensureArray(references.excluded_pubmed_summary).map((row) => withReviewIdentity(row, review)));
    buckets.referenceCandidates.push(...ensureArray(references.reference_candidates).map((row) => withReviewIdentity(row, review)));
    buckets.referenceCandidateRecords.push(...ensureArray(references.reference_candidate_pubmed_records).map((row) => withReviewIdentity(row, review)));
    buckets.referenceCandidateReports.push(...ensureArray(references.reference_candidate_report_candidates).map((row) => withReviewIdentity(row, review)));
    buckets.referenceCandidateRegistries.push(...ensureArray(references.reference_candidate_trial_registry_records).map((row) => withReviewIdentity(row, review)));
    buckets.referenceCandidateSummary.push(...ensureArray(references.reference_candidate_summary).map((row) => withReviewIdentity(row, review)));

    buckets.analysisResults.push(...ensureArray(metaAnalysis.analysis_results).map((row) => withReviewIdentity(row, review)));
    buckets.analysisStudyRows.push(...ensureArray(metaAnalysis.analysis_study_rows).map((row) => withReviewIdentity(row, review)));
    buckets.analysisRiskOfBiasRows.push(...ensureArray(metaAnalysis.analysis_risk_of_bias_rows).map((row) => withReviewIdentity(row, review)));
    buckets.analysisReproducedResults.push(...ensureArray(metaAnalysis.analysis_reproduced_results).map((row) => withReviewIdentity(row, review)));

    return {
      rows: buckets,
      plots: metaAnalysis.analysis_reproduced_forest_plots || {},
    };
  }

  function appendBenchmarkRows(target, adapted, plots) {
    ROW_BUCKET_KEYS.forEach((key) => {
      target[key].push(...(adapted.rows[key] || []));
    });
    return {
      ...(plots || {}),
      ...(adapted.plots || {}),
    };
  }

  async function loadBenchmarkData() {
    const registryFile = await loadJsonFile(BENCHMARK_REGISTRY_PATH);
    const registryReviews = ensureArray(registryFile.data?.reviews);
    if (!registryReviews.length) {
      throw new Error(`No reviews listed in ${BENCHMARK_REGISTRY_PATH}`);
    }

    const rows = emptyRowBuckets();
    const loadedBenchmarks = await Promise.all(registryReviews.map(async (registryReview) => {
      const path = benchmarkAssetPath(registryReview.benchmark_path);
      const file = await loadJsonFile(path);
      const adapted = adaptBenchmarkRows(file.data, registryReview);
      return {
        registryReview,
        adapted,
        ...file,
      };
    }));
    let analysisReproducedForestPlots = {};
    loadedBenchmarks.forEach((file) => {
      analysisReproducedForestPlots = appendBenchmarkRows(rows, file.adapted, analysisReproducedForestPlots);
    });
    const benchmarkFiles = loadedBenchmarks.map(({ adapted, ...file }) => file);

    return {
      files: {
        benchmarkRegistry: registryFile,
        benchmarks: benchmarkFiles,
        analysisReproducedForestPlots: {
          loaded: true,
          data: { plots: analysisReproducedForestPlots },
        },
      },
      rows,
    };
  }

  function auditStorageAvailable() {
    return typeof window.localStorage !== "undefined";
  }

  function normalizeAuditFinding(row) {
    const normalized = {};
    AUDIT_FINDING_FIELDS.forEach((field) => {
      normalized[field] = raw(row?.[field]);
    });
    normalized.finding_id = normalized.finding_id || `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    normalized.created_at = normalized.created_at || new Date().toISOString();
    normalized.status = normalized.status || "open";
    return normalized;
  }

  function loadAuditFindings() {
    if (!auditStorageAvailable()) {
      state.auditFindings = [];
      return;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(AUDIT_FINDINGS_STORAGE_KEY) || "[]");
      state.auditFindings = Array.isArray(parsed) ? parsed.map(normalizeAuditFinding) : [];
    } catch (error) {
      state.auditFindings = [];
      state.auditMessage = "Could not load saved audit findings from this browser.";
    }
  }

  function saveAuditFindings() {
    if (!auditStorageAvailable()) {
      state.auditMessage = "Browser localStorage is unavailable; findings were not saved.";
      return;
    }
    window.localStorage.setItem(AUDIT_FINDINGS_STORAGE_KEY, JSON.stringify(state.auditFindings));
  }

  function savedReviewerName() {
    if (!auditStorageAvailable()) {
      return "";
    }
    return raw(window.localStorage.getItem(AUDIT_REVIEWER_STORAGE_KEY));
  }

  function saveReviewerName(value) {
    if (auditStorageAvailable() && raw(value)) {
      window.localStorage.setItem(AUDIT_REVIEWER_STORAGE_KEY, raw(value));
    }
  }

  function auditContextAttr(context) {
    return escapeHtml(JSON.stringify(context || {}));
  }

  function auditContextFromFinding(finding) {
    return {
      review_id: finding.review_id,
      section: finding.section,
      item_type: finding.item_type,
      item_id: finding.item_id,
      source_file: finding.source_file,
      field_name: finding.field_name,
      displayed_value: finding.displayed_value,
    };
  }

  function parseAuditContext(value) {
    try {
      const parsed = JSON.parse(value || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function auditFileDate() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function tsvCell(value) {
    const text = String(value ?? "");
    if (/[\t\r\n"]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  function auditFindingsTsv(findings) {
    const rows = [AUDIT_FINDING_FIELDS.join("\t")];
    (findings || []).forEach((finding) => {
      rows.push(AUDIT_FINDING_FIELDS.map((field) => tsvCell(finding[field])).join("\t"));
    });
    return `${rows.join("\n")}\n`;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportAuditFindings(format) {
    const findings = state.auditFindings || [];
    if (!findings.length) {
      state.auditMessage = "No audit findings to export.";
      render();
      return;
    }
    const stamp = auditFileDate();
    if (format === "json") {
      const payload = {
        artifact_version: "2026-06-02-manual-audit-findings-v1",
        exported_at: new Date().toISOString(),
        findings,
      };
      downloadText(
        `manual_audit_findings_${stamp}.json`,
        `${JSON.stringify(payload, null, 2)}\n`,
        "application/json",
      );
    } else {
      downloadText(
        `manual_audit_findings_${stamp}.tsv`,
        auditFindingsTsv(findings),
        "text/tab-separated-values",
      );
    }
    state.auditMessage = `Exported ${findings.length} audit finding${findings.length === 1 ? "" : "s"}.`;
    render();
  }

  function mergeAuditFindings(importedRows) {
    const merged = new Map();
    (state.auditFindings || []).forEach((finding) => merged.set(finding.finding_id, finding));
    (importedRows || []).map(normalizeAuditFinding).forEach((finding) => {
      merged.set(finding.finding_id, finding);
    });
    state.auditFindings = Array.from(merged.values()).sort((left, right) => {
      return raw(left.created_at).localeCompare(raw(right.created_at));
    });
    saveAuditFindings();
  }

  function importAuditFindingsFile(file) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const data = JSON.parse(text);
        const rows = Array.isArray(data) ? data : (Array.isArray(data.findings) ? data.findings : []);
        mergeAuditFindings(rows);
        state.auditMessage = `Imported ${rows.length} audit finding${rows.length === 1 ? "" : "s"} from JSON.`;
      } catch (jsonError) {
        try {
          const rows = parseDelimited(String(reader.result || ""), "\t");
          mergeAuditFindings(rows);
          state.auditMessage = `Imported ${rows.length} audit finding${rows.length === 1 ? "" : "s"} from TSV.`;
        } catch (tsvError) {
          state.auditMessage = "Could not import audit findings. Use exported JSON or TSV.";
        }
      }
      render();
    };
    reader.readAsText(file);
  }

  function renderAuditIssueActions(context, className = "") {
    const encoded = auditContextAttr(context);
    return `
      <div class="audit-issue-actions ${className}">
        <button class="small-button audit-action-button" type="button" data-audit-report data-audit-context="${encoded}">Report</button>
      </div>
    `;
  }

  function auditDisplayedValue(row, fields) {
    return fields
      .map((field) => {
        const value = raw(row?.[field]);
        return value ? `${field}: ${value}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function analysisStudyRowAuditDisplayedValue(row) {
    const rowValue = auditDisplayedValue(row, [
      "matched_reference_block_label",
      "study_label_raw",
      "data_type",
      "arm1_label",
      "arm1_events",
      "arm1_total",
      "arm1_mean",
      "arm1_sd",
      "arm2_label",
      "arm2_events",
      "arm2_total",
      "arm2_mean",
      "arm2_sd",
      "effect",
      "ci_lower",
      "ci_upper",
    ]);
    const riskOfBias = row?._riskOfBias || {};
    const robValue = "ABCDEFGHIJ".split("")
      .map((code) => {
        const symbol = raw(riskOfBias[`rob_${code}`]);
        return symbol ? `rob_${code}: ${symbol}` : "";
      })
      .filter(Boolean)
      .join("\n");
    return [rowValue, robValue].filter(Boolean).join("\n");
  }

  function auditIssueTypeLabel(value) {
    const issueType = raw(value);
    const match = AUDIT_ISSUE_TYPES.find(([key]) => key === issueType);
    return match ? match[1] : issueType;
  }

  function auditReviewPreview(value, fallback = "None") {
    const text = raw(value);
    if (!text) {
      return `<span class="muted">${escapeHtml(fallback)}</span>`;
    }
    const preview = text.length > 260 ? `${text.slice(0, 260)}...` : text;
    return escapeHtml(preview);
  }

  function auditTimestamp(value) {
    const text = raw(value);
    const parsed = new Date(text);
    if (!text || Number.isNaN(parsed.getTime())) {
      return display(text, "No timestamp");
    }
    return escapeHtml(parsed.toLocaleString());
  }

  function auditSourceEvidence(finding) {
    return [raw(finding?.source_location), raw(finding?.source_excerpt)].filter(Boolean).join("\n");
  }

  function renderAuditFindingControls() {
    const count = (state.auditFindings || []).length;
    return `
      <div class="sidebar-section audit-findings-panel">
        <h3>Audit Findings</h3>
        <p class="muted">${count} finding${count === 1 ? "" : "s"} saved in this browser.</p>
        <div class="button-row audit-review-row">
          <button class="small-button" type="button" data-audit-review-findings${count ? "" : " disabled"}>Review findings</button>
        </div>
        <div class="button-row audit-export-row">
          <button class="small-button" type="button" data-audit-export="tsv"${count ? "" : " disabled"}>Export TSV</button>
          <button class="small-button" type="button" data-audit-export="json"${count ? "" : " disabled"}>Export JSON</button>
        </div>
        <div class="button-row audit-import-row">
          <label class="small-button audit-import-label">
            Import
            <input type="file" accept=".json,.tsv,application/json,text/tab-separated-values,text/plain" data-audit-import-file>
          </label>
          <button class="small-button" type="button" data-audit-clear${count ? "" : " disabled"}>Clear local</button>
        </div>
        ${state.auditMessage ? `<p class="muted audit-message">${escapeHtml(state.auditMessage)}</p>` : ""}
      </div>
    `;
  }

  function renderAuditFindingsReviewModal() {
    if (!state.auditReviewOpen) {
      return "";
    }
    const findings = [...(state.auditFindings || [])].sort((left, right) => {
      return raw(right.created_at).localeCompare(raw(left.created_at));
    });
    return `
      <div class="audit-modal-backdrop" role="presentation">
        <section class="audit-modal audit-review-modal panel" role="dialog" aria-modal="true" aria-labelledby="audit-review-title">
          <div class="section-head audit-modal-head">
            <div>
              <h2 id="audit-review-title">Review Findings</h2>
              <p class="muted">${findings.length} local finding${findings.length === 1 ? "" : "s"} saved in this browser. Edit or delete mistaken rows before exporting.</p>
            </div>
            <button class="small-button" type="button" data-audit-close>Close</button>
          </div>
          ${findings.length ? `
            <div class="record-table-wrap audit-review-table">
              <table>
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Issue</th>
                    <th>Displayed / correction</th>
                    <th>Source evidence</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${findings.map((finding) => `
                    <tr>
                      <td>
                        <div class="audit-review-primary">${display(finding.review_id, "No review")}</div>
                        <div class="audit-review-detail">${display(finding.section, "No section")}</div>
                        <div class="audit-review-detail">${display(finding.item_id, "No item")}</div>
                        <div class="audit-review-detail">${display(finding.source_file, "No source file")}</div>
                      </td>
                      <td>
                        <div class="audit-review-primary">${display(auditIssueTypeLabel(finding.issue_type), "No issue type")}</div>
                        <div class="audit-review-detail">Field: ${display(finding.field_name, "None")}</div>
                        <div class="audit-review-detail">Reviewer: ${display(finding.reviewer, "None")}</div>
                        <div class="audit-review-detail">${auditTimestamp(finding.created_at)}</div>
                      </td>
                      <td class="audit-review-text">
                        <div><span class="audit-review-label">Displayed value</span>${auditReviewPreview(finding.displayed_value)}</div>
                        <div><span class="audit-review-label">Correct value</span>${auditReviewPreview(finding.correct_value)}</div>
                        <div><span class="audit-review-label">Notes</span>${auditReviewPreview(finding.notes)}</div>
                      </td>
                      <td class="audit-review-text">
                        <div><span class="audit-review-label">Evidence</span>${auditReviewPreview(auditSourceEvidence(finding))}</div>
                      </td>
                      <td>
                        <div class="audit-review-actions">
                          <button class="small-button" type="button" data-audit-edit-finding="${escapeHtml(finding.finding_id)}">Edit</button>
                          <button class="small-button audit-delete-button" type="button" data-audit-delete-finding="${escapeHtml(finding.finding_id)}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<p class="muted audit-review-empty">No audit findings are saved in this browser.</p>`}
        </section>
      </div>
    `;
  }

  function renderAuditModal() {
    const editingFinding = state.auditEditingFindingId
      ? state.auditFindings.find((finding) => finding.finding_id === state.auditEditingFindingId)
      : null;
    const isEditing = Boolean(editingFinding);
    const context = state.auditModalContext || (editingFinding ? auditContextFromFinding(editingFinding) : null);
    if (!context) {
      return "";
    }
    const reviewer = isEditing ? raw(editingFinding.reviewer) : savedReviewerName();
    const selectedIssueType = raw(editingFinding?.issue_type);
    const modalTitle = isEditing ? "Edit Finding" : "Report";
    const submitLabel = isEditing ? "Save changes" : "Save finding";
    return `
      <div class="audit-modal-backdrop" role="presentation">
        <section class="audit-modal panel" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title">
          <form data-audit-form>
            <div class="section-head audit-modal-head">
              <div>
                <h2 id="audit-modal-title">${modalTitle}</h2>
              </div>
              <button class="small-button" type="button" data-audit-close>Close</button>
            </div>
            <div class="audit-context-grid">
              <div>
                <span class="field-label">Review</span>
                <span>${display(context.review_id || state.selectedReviewId)}</span>
              </div>
              <div>
                <span class="field-label">Section</span>
                <span>${display(context.section)}</span>
              </div>
              <div>
                <span class="field-label">Item</span>
                <span>${display(context.item_id)}</span>
              </div>
              <div>
                <span class="field-label">Field</span>
                <span>${display(context.field_name)}</span>
              </div>
            </div>
            <label class="audit-form-field audit-displayed-value-field">
              <span>Displayed value</span>
              <textarea data-audit-displayed-value readonly>${escapeHtml(context.displayed_value || "")}</textarea>
            </label>
            <div class="audit-form-grid">
              <label class="audit-form-field">
                <span>Issue type</span>
                <select name="issue_type" required>
                  ${AUDIT_ISSUE_TYPES.map(([value, label]) => `<option value="${escapeHtml(value)}"${selectedIssueType === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}
                </select>
              </label>
              <label class="audit-form-field">
                <span>Reviewer</span>
                <input name="reviewer" value="${escapeHtml(reviewer)}" autocomplete="name">
              </label>
            </div>
            <label class="audit-form-field">
              <span class="audit-field-label-row">
                <span>Correct value</span>
                <span class="audit-field-actions">
                  <button class="small-button" type="button" data-audit-copy-displayed>Copy displayed</button>
                  <button class="small-button" type="button" data-audit-clear-correct>Clear</button>
                </span>
              </span>
              <textarea name="correct_value" data-audit-correct-value placeholder="Enter the corrected value, or leave blank if not applicable.">${escapeHtml(editingFinding?.correct_value || "")}</textarea>
            </label>
            <label class="audit-form-field">
              <span>Source evidence</span>
              <textarea name="source_evidence" placeholder="Page/section plus short supporting excerpt from the Cochrane review.">${escapeHtml(auditSourceEvidence(editingFinding))}</textarea>
            </label>
            <label class="audit-form-field">
              <span>Notes</span>
              <textarea name="notes" placeholder="Optional audit notes.">${escapeHtml(editingFinding?.notes || "")}</textarea>
            </label>
            <div class="button-row audit-form-actions">
              <button class="small-button" type="submit">${submitLabel}</button>
              <button class="small-button" type="button" data-audit-close>Cancel</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function keyForRecord(row) {
    return `${row.review_id || ""}|||${row.study_label || ""}`;
  }

  function prepareData() {
    const summary = state.rows.summary || [];
    const curationRows = state.rows.curation || [];
    const reviewIndexRows = state.rows.reviewIndex || [];
    const protocolRows = state.rows.protocol || [];
    const studies = state.rows.studies || [];
    const records = state.rows.records || [];
    const reports = state.rows.reports || [];
    const registries = state.rows.registries || [];
    const excludedStudies = state.rows.excludedStudies || [];
    const excludedReports = state.rows.excludedReports || [];
    const excludedRecords = state.rows.excludedRecords || [];
    const excludedRegistries = state.rows.excludedRegistries || [];
    const excludedSummary = state.rows.excludedSummary || [];
    const referenceCandidates = state.rows.referenceCandidates || [];
    const referenceCandidateReports = state.rows.referenceCandidateReports || [];
    const referenceCandidateRecords = state.rows.referenceCandidateRecords || [];
    const referenceCandidateRegistries = state.rows.referenceCandidateRegistries || [];
    const analysisResults = state.rows.analysisResults || [];
    const analysisResultsRaw = state.rows.analysisResultsRaw || [];
    const analysisStudyRows = state.rows.analysisStudyRows || [];
    const analysisRiskOfBiasRows = state.rows.analysisRiskOfBiasRows || [];
    const analysisReproducedResults = state.rows.analysisReproducedResults || [];
    const reproducedForestPlots = state.files.analysisReproducedForestPlots?.data?.plots || {};
    const domainSources = state.rows.domainSources || [];
    const domainLabels = state.rows.domainLabels || [];

    const recordsByStudy = new Map();
    records.forEach((record) => {
      const key = keyForRecord(record);
      if (!recordsByStudy.has(key)) {
        recordsByStudy.set(key, []);
      }
      recordsByStudy.get(key).push(record);
    });

    const reportsByStudy = new Map();
    reports.forEach((report) => {
      const key = keyForRecord(report);
      if (!reportsByStudy.has(key)) {
        reportsByStudy.set(key, []);
      }
      reportsByStudy.get(key).push(report);
    });

    const registriesByStudy = new Map();
    registries.forEach((registry) => {
      const key = keyForRecord(registry);
      if (!registriesByStudy.has(key)) {
        registriesByStudy.set(key, []);
      }
      registriesByStudy.get(key).push(registry);
    });

    const excludedRecordsByStudy = new Map();
    excludedRecords.forEach((record) => {
      const key = keyForRecord(record);
      if (!excludedRecordsByStudy.has(key)) {
        excludedRecordsByStudy.set(key, []);
      }
      excludedRecordsByStudy.get(key).push(record);
    });

    const excludedReportsByStudy = new Map();
    excludedReports.forEach((report) => {
      const key = keyForRecord(report);
      if (!excludedReportsByStudy.has(key)) {
        excludedReportsByStudy.set(key, []);
      }
      excludedReportsByStudy.get(key).push(report);
    });

    const excludedRegistriesByStudy = new Map();
    excludedRegistries.forEach((registry) => {
      const key = keyForRecord(registry);
      if (!excludedRegistriesByStudy.has(key)) {
        excludedRegistriesByStudy.set(key, []);
      }
      excludedRegistriesByStudy.get(key).push(registry);
    });

    const referenceCandidateRecordsByStudy = new Map();
    referenceCandidateRecords.forEach((record) => {
      const key = keyForRecord(record);
      if (!referenceCandidateRecordsByStudy.has(key)) {
        referenceCandidateRecordsByStudy.set(key, []);
      }
      referenceCandidateRecordsByStudy.get(key).push(record);
    });

    const referenceCandidateReportsByStudy = new Map();
    referenceCandidateReports.forEach((report) => {
      const key = keyForRecord(report);
      if (!referenceCandidateReportsByStudy.has(key)) {
        referenceCandidateReportsByStudy.set(key, []);
      }
      referenceCandidateReportsByStudy.get(key).push(report);
    });

    const referenceCandidateRegistriesByStudy = new Map();
    referenceCandidateRegistries.forEach((registry) => {
      const key = keyForRecord(registry);
      if (!referenceCandidateRegistriesByStudy.has(key)) {
        referenceCandidateRegistriesByStudy.set(key, []);
      }
      referenceCandidateRegistriesByStudy.get(key).push(registry);
    });

    const excludedSummaryByReview = new Map();
    excludedSummary.forEach((row) => {
      if (row.review_id) {
        excludedSummaryByReview.set(row.review_id, row);
      }
    });

    const analysisResultsRawByKey = new Map();
    analysisResultsRaw.forEach((row) => {
      analysisResultsRawByKey.set(`${row.review_id || ""}|||${row.analysis_id || ""}`, row);
    });

    const analysisResultsByReview = new Map();
    analysisResults.forEach((row, index) => {
      const reviewId = row.review_id || "";
      if (!analysisResultsByReview.has(reviewId)) {
        analysisResultsByReview.set(reviewId, []);
      }
      analysisResultsByReview.get(reviewId).push({
        ...row,
        _rowIndex: index + 1,
        _rawJson: analysisResultsRawByKey.get(`${reviewId}|||${row.analysis_id || ""}`) || null,
      });
    });

    const analysisRiskOfBiasByRow = new Map();
    analysisRiskOfBiasRows.forEach((row) => {
      const key = `${row.review_id || ""}|||${row.analysis_id || ""}|||${row.study_order || ""}`;
      analysisRiskOfBiasByRow.set(key, row);
    });

    const analysisStudyRowsByReview = new Map();
    analysisStudyRows.forEach((row, index) => {
      const reviewId = row.review_id || "";
      const riskOfBiasKey = `${reviewId}|||${row.analysis_id || ""}|||${row.study_order || ""}`;
      const withIndex = {
        ...row,
        _rowIndex: index + 1,
        _riskOfBias: analysisRiskOfBiasByRow.get(riskOfBiasKey) || null,
      };
      if (!analysisStudyRowsByReview.has(reviewId)) {
        analysisStudyRowsByReview.set(reviewId, []);
      }
      analysisStudyRowsByReview.get(reviewId).push(withIndex);
    });

    const analysisReproducedByReview = new Map();
    analysisReproducedResults.forEach((row, index) => {
      const reviewId = row.review_id || "";
      const analysisId = row.analysis_id || "";
      const subset = row.subset || "";
      const withIndex = {
        ...row,
        _rowIndex: index + 1,
        _forestPlot: reproducedForestPlots[`${reviewId}|||${analysisId}|||${subset}`] || null,
      };
      if (!analysisReproducedByReview.has(reviewId)) {
        analysisReproducedByReview.set(reviewId, []);
      }
      analysisReproducedByReview.get(reviewId).push(withIndex);
    });

    const curationByReview = new Map();
    curationRows.forEach((row) => {
      if (row.review_id) {
        curationByReview.set(row.review_id, row);
      }
    });

    const reviewIndexByPdfStem = new Map();
    reviewIndexRows.forEach((row) => {
      const stem = reviewIdFromPath(row.review_pdf);
      if (stem) {
        reviewIndexByPdfStem.set(stem, row);
      }
    });

    const protocolByReview = new Map();
    protocolRows.forEach((row) => {
      if (row.review_id) {
        protocolByReview.set(row.review_id, row);
      }
    });

    const domainSourceByReview = new Map();
    domainSources.forEach((row) => {
      if (row.review_id) {
        domainSourceByReview.set(row.review_id, row);
      }
    });

    const domainLabelByReview = new Map();
    domainLabels.forEach((row) => {
      if (row.review_id) {
        domainLabelByReview.set(row.review_id, row);
      }
    });

    const studiesByReview = new Map();
    studies.forEach((study, index) => {
      const reviewId = study.review_id || "";
      if (!studiesByReview.has(reviewId)) {
        studiesByReview.set(reviewId, []);
      }
      studiesByReview.get(reviewId).push({
        ...study,
        _rowIndex: index + 1,
        _records: recordsByStudy.get(keyForRecord(study)) || [],
        _reports: reportsByStudy.get(keyForRecord(study)) || [],
        _registries: registriesByStudy.get(keyForRecord(study)) || [],
      });
    });

    const excludedStudiesByReview = new Map();
    excludedStudies.forEach((study, index) => {
      const reviewId = study.review_id || "";
      if (!excludedStudiesByReview.has(reviewId)) {
        excludedStudiesByReview.set(reviewId, []);
      }
      excludedStudiesByReview.get(reviewId).push({
        ...study,
        _rowIndex: index + 1,
        _records: excludedRecordsByStudy.get(keyForRecord(study)) || [],
        _reports: excludedReportsByStudy.get(keyForRecord(study)) || [],
        _registries: excludedRegistriesByStudy.get(keyForRecord(study)) || [],
      });
    });

    const referenceCandidatesByReview = new Map();
    referenceCandidates.forEach((study, index) => {
      const reviewId = study.review_id || "";
      if (!referenceCandidatesByReview.has(reviewId)) {
        referenceCandidatesByReview.set(reviewId, []);
      }
      referenceCandidatesByReview.get(reviewId).push({
        ...study,
        _rowIndex: index + 1,
        _records: referenceCandidateRecordsByStudy.get(keyForRecord(study)) || [],
        _reports: referenceCandidateReportsByStudy.get(keyForRecord(study)) || [],
        _registries: referenceCandidateRegistriesByStudy.get(keyForRecord(study)) || [],
      });
    });

    return summary
      .map((review, index) => {
        const curation = curationByReview.get(review.review_id) || {};
        const domainSource = domainSourceByReview.get(review.review_id) || {};
        const reviewIndex = reviewIndexByPdfStem.get(reviewIdFromPath(review.review_pdf)) || {};
        return {
          ...review,
          _rowIndex: index + 1,
          _title: raw(curation.review_title) || raw(domainSource.review_title) || reviewTitle({ ...reviewIndex, ...review }),
          _studies: studiesByReview.get(review.review_id) || [],
          _excludedStudies: excludedStudiesByReview.get(review.review_id) || [],
          _referenceCandidates: referenceCandidatesByReview.get(review.review_id) || [],
          _excludedSummary: excludedSummaryByReview.get(review.review_id) || {},
          _analysisResults: analysisResultsByReview.get(review.review_id) || [],
          _analysisStudyRows: analysisStudyRowsByReview.get(review.review_id) || [],
          _analysisReproducedResults: analysisReproducedByReview.get(review.review_id) || [],
          _curation: curation,
          _reviewIndex: reviewIndex,
          _protocol: protocolByReview.get(review.review_id) || {},
          _domainSource: domainSource,
          _domainLabel: domainLabelByReview.get(review.review_id) || {},
        };
      })
      .sort((left, right) => {
        const groupDiff = groupSortIndex(left.review_group) - groupSortIndex(right.review_group);
        if (groupDiff !== 0) {
          return groupDiff;
        }
        return left._title.localeCompare(right._title);
      });
  }

  function reviewPdfHref(review) {
    const path = String(review.review_pdf || "").trim();
    if (!path) {
      return "";
    }
    if (path.startsWith("Cochrane_reviews/")) {
      return `../${path.replace("Cochrane_reviews/", "")}`;
    }
    return path.startsWith("../") ? path : `../${path}`;
  }

  function pubmedReviewHref(review) {
    const index = review._reviewIndex || {};
    const url = raw(index.pubmed_url);
    if (url) {
      return url;
    }
    const pmid = raw(index.pmid);
    return pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : "";
  }

  function cochraneReviewHref(review) {
    const index = review._reviewIndex || {};
    const doi = raw(index.pubmed_doi) || raw(index.extracted_doi);
    return doi ? `https://www.cochranelibrary.com/cdsr/doi/${doi}/full` : "";
  }

  function reviewSourceLinks(review) {
    const pdfHref = reviewPdfHref(review);
    return [
      { label: "Open PDF", href: pdfHref },
      { label: "Cochrane", href: cochraneReviewHref(review) },
      { label: "PubMed", href: pubmedReviewHref(review) },
    ].filter((link) => raw(link.href));
  }

  function renderReviewSourceActions(review, className = "") {
    const links = reviewSourceLinks(review);
    if (!links.length) {
      return "";
    }
    return `
      <div class="review-source-actions${className ? ` ${className}` : ""}">
        ${links.map((link) => `
          <a class="small-button" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>
        `).join("")}
      </div>
    `;
  }

  function isYes(value) {
    return String(value || "").trim().toLowerCase() === "yes";
  }

  function hasLookupError(study) {
    return Boolean(raw(study.lookup_errors));
  }

  function needsReview(study) {
    return !isYes(study.has_pubmed) || !isYes(study.has_pmc) || hasLookupError(study) || splitCell(study.matched_pmids).length > 1;
  }

  function trialCardClass(study) {
    if (!isYes(study.has_pubmed)) {
      return "no-pubmed";
    }
    if (hasLookupError(study) || splitCell(study.matched_pmids).length > 1) {
      return "needs-review";
    }
    if (isYes(study.has_pmc)) {
      return "has-pmc";
    }
    return "";
  }

  function trialStatus(study) {
    if (!isYes(study.has_pubmed)) {
      return { className: "source-chip source-missing", label: "No PMID" };
    }
    if (hasLookupError(study)) {
      return { className: "source-chip source-note", label: "Lookup note" };
    }
    if (!isYes(study.has_pmc)) {
      return { className: "source-chip source-pmid", label: "No PMCID" };
    }
    return { className: "source-chip source-pmc", label: "PMCID found" };
  }

  function includedTrialStats(review) {
    const studies = review._studies || [];
    const pmidRecords = new Map();
    studies.forEach((study) => {
      (study._records || []).forEach((record) => {
        const pmid = raw(record.pmid);
        if (!pmid) {
          return;
        }
        if (!pmidRecords.has(pmid)) {
          pmidRecords.set(pmid, {
            pmid,
            hasPmcid: false,
          });
        }
        if (raw(record.pmcid) || isYes(record.in_pmc)) {
          pmidRecords.get(pmid).hasPmcid = true;
        }
      });
    });
    const pmidRecordRows = Array.from(pmidRecords.values());
    return {
      review,
      total: studies.length,
      withPmid: studies.filter((study) => isYes(study.has_pubmed)).length,
      withPmcid: studies.filter((study) => isYes(study.has_pmc)).length,
      pmidRecords: pmidRecordRows.length,
      pmidRecordsWithPmcid: pmidRecordRows.filter((record) => record.hasPmcid).length,
    };
  }

  function ratioPercent(numerator, denominator) {
    return denominator ? (numerator / denominator) * 100 : 0;
  }

  function medianValue(values) {
    if (!values.length) {
      return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function formatStatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatStatPercent(value) {
    return `${formatStatNumber(value)}%`;
  }

  function countBinLabel(bin) {
    if (bin.label) {
      return bin.label;
    }
    if (bin.max === Infinity) {
      return `${bin.min}+`;
    }
    return bin.min === bin.max ? String(bin.min) : `${bin.min}-${bin.max}`;
  }

  function countInBin(value, bin) {
    return value >= bin.min && value <= bin.max;
  }

  function binnedCountSummary(rows, valueKey, customBins = null) {
    const bins = customBins || [
      { min: 0, max: 0 },
      { min: 1, max: 5 },
      { min: 6, max: 10 },
      { min: 11, max: 20 },
      { min: 21, max: 50 },
      { min: 51, max: Infinity },
    ];
    const maxCount = Math.max(...bins.map((bin) => rows.filter((row) => countInBin(row[valueKey], bin)).length), 1);
    return bins.map((bin) => {
      const count = rows.filter((row) => countInBin(row[valueKey], bin)).length;
      return {
        ...bin,
        label: countBinLabel(bin),
        count,
        width: (count / maxCount) * 100,
      };
    });
  }

  function includedTrialDistributionRows(reviews) {
    return reviews.map((review) => {
      const stats = includedTrialStats(review);
      return {
        ...stats,
        pmidCoveragePercent: ratioPercent(stats.withPmid, stats.total),
        pmcidAmongPmidsPercent: ratioPercent(stats.pmidRecordsWithPmcid, stats.pmidRecords),
      };
    });
  }

  function includedTrialDistributionMetrics(rows) {
    return [
      {
        key: "total",
        label: "Included trials",
        detail: "Trial blocks per review",
      },
      {
        key: "pmidCoveragePercent",
        label: "PMID coverage by review",
        detail: "Percent of included trial blocks with at least one PMID",
        unit: "percent",
        bins: [
          { min: 0, max: 0, label: "0%" },
          { min: 1, max: 49.999, label: "1-49%" },
          { min: 50, max: 74.999, label: "50-74%" },
          { min: 75, max: 89.999, label: "75-89%" },
          { min: 90, max: 99.999, label: "90-99%" },
          { min: 100, max: 100, label: "100%" },
        ],
      },
      {
        key: "pmcidAmongPmidsPercent",
        label: "PMCID among PMIDs by review",
        detail: "Percent of unique PubMed records with a PMCID",
        unit: "percent",
        bins: [
          { min: 0, max: 0, label: "0%" },
          { min: 1, max: 24.999, label: "1-24%" },
          { min: 25, max: 49.999, label: "25-49%" },
          { min: 50, max: 74.999, label: "50-74%" },
          { min: 75, max: 99.999, label: "75-99%" },
          { min: 100, max: 100, label: "100%" },
        ],
      },
    ].map((metric) => {
      const values = rows.map((row) => row[metric.key]);
      return {
        ...metric,
        total: values.reduce((sum, value) => sum + value, 0),
        min: values.length ? Math.min(...values) : 0,
        median: medianValue(values),
        max: values.length ? Math.max(...values) : 0,
        bins: binnedCountSummary(rows, metric.key, metric.bins),
      };
    });
  }

  function formatMetricValue(metric, value) {
    return metric.unit === "percent" ? formatStatPercent(value) : formatStatNumber(value);
  }

  function distributionFoot(metric, rows) {
    if (metric.key === "pmidCoveragePercent") {
      const withPmid = rows.reduce((sum, row) => sum + row.withPmid, 0);
      const total = rows.reduce((sum, row) => sum + row.total, 0);
      return `Range ${formatStatPercent(metric.min)}-${formatStatPercent(metric.max)}; aggregate ${withPmid}/${total} trials`;
    }
    if (metric.key === "pmcidAmongPmidsPercent") {
      const withPmcid = rows.reduce((sum, row) => sum + row.pmidRecordsWithPmcid, 0);
      const total = rows.reduce((sum, row) => sum + row.pmidRecords, 0);
      return `Range ${formatStatPercent(metric.min)}-${formatStatPercent(metric.max)}; aggregate ${withPmcid}/${total} PubMed records`;
    }
    return `Range ${formatMetricValue(metric, metric.min)}-${formatMetricValue(metric, metric.max)}; total ${metric.total}`;
  }

  function includedTrialSortValue(row, key) {
    if (key === "pmidCoverage") {
      return row.pmidCoveragePercent;
    }
    if (key === "pmcidAmongPmids") {
      return row.pmcidAmongPmidsPercent;
    }
    if (key === "reviewTitle") {
      return row.review._title || "";
    }
    if (key === "group") {
      return groupSortIndex(row.review.review_group);
    }
    return row.total;
  }

  function compareIncludedTrialRows(left, right) {
    const key = INCLUDED_TRIAL_SORT_OPTIONS.some((option) => option.key === state.includedTrialSortKey)
      ? state.includedTrialSortKey
      : "trials";
    const direction = state.includedTrialSortDirection === "asc" ? 1 : -1;
    const leftValue = includedTrialSortValue(left, key);
    const rightValue = includedTrialSortValue(right, key);
    let result = 0;

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      result = String(leftValue).localeCompare(String(rightValue));
    } else {
      result = leftValue - rightValue;
    }

    if (result !== 0) {
      return result * direction;
    }

    return (
      groupSortIndex(left.review.review_group) - groupSortIndex(right.review.review_group)
      || left.review._title.localeCompare(right.review._title)
    );
  }

  function renderIncludedTrialSortControls() {
    const selectedKey = INCLUDED_TRIAL_SORT_OPTIONS.some((option) => option.key === state.includedTrialSortKey)
      ? state.includedTrialSortKey
      : "trials";
    const selectedDirection = state.includedTrialSortDirection === "asc" ? "asc" : "desc";
    return `
      <div class="trial-sort-controls" aria-label="Included trial ranking controls">
        <label class="sort-control-label">
          <span>Rank by</span>
          <select class="filter-select" data-included-trial-sort-key>
            ${INCLUDED_TRIAL_SORT_OPTIONS.map((option) => `
              <option value="${escapeHtml(option.key)}"${option.key === selectedKey ? " selected" : ""}>${escapeHtml(option.label)}</option>
            `).join("")}
          </select>
        </label>
        <div class="sort-direction-buttons" role="group" aria-label="Sort direction">
          <button class="small-button${selectedDirection === "desc" ? " active" : ""}" type="button" data-included-trial-sort-direction="desc">Desc</button>
          <button class="small-button${selectedDirection === "asc" ? " active" : ""}" type="button" data-included-trial-sort-direction="asc">Asc</button>
        </div>
      </div>
    `;
  }

  function renderIncludedTrialDistribution(reviews) {
    const rows = includedTrialDistributionRows(reviews);
    const metrics = includedTrialDistributionMetrics(rows);
    const trialTotal = metrics.find((metric) => metric.key === "total")?.total || 0;
    const pmidCoverageMetric = metrics.find((metric) => metric.key === "pmidCoveragePercent") || {};
    const pmcidAmongPmidsMetric = metrics.find((metric) => metric.key === "pmcidAmongPmidsPercent") || {};
    const pmidTotal = rows.reduce((sum, row) => sum + row.withPmid, 0);
    const uniquePmidTotal = rows.reduce((sum, row) => sum + row.pmidRecords, 0);
    const pmidRecordsWithPmcidTotal = rows.reduce((sum, row) => sum + row.pmidRecordsWithPmcid, 0);
    const distributionMetrics = metrics.filter((metric) => metric.includeDistribution !== false);
    const sortedRows = [...rows].sort(compareIncludedTrialRows);

    return `
      <section class="panel included-trial-distribution-panel" id="included-trial-distribution">
        <div class="section-head">
          <div>
            <h2>Included Trial Distribution</h2>
            <p class="muted">Per-review counts from benchmark_data/reviews.json and each review benchmark.json.</p>
          </div>
          <div class="section-summary">${rows.length} reviews; ${trialTotal} included trials</div>
        </div>
        <div class="trial-distribution-stat-grid">
          <div class="stat-card">
            <div class="stat-label">Trials</div>
            <div class="stat-value">${formatStatNumber(metrics[0].median)}</div>
            <div class="stat-detail">Median included trials per review; ${trialTotal} total</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PMID Coverage</div>
            <div class="stat-value">${formatStatPercent(pmidCoverageMetric.median || 0)}</div>
            <div class="stat-detail">Median across review-level coverage; aggregate ${pmidTotal}/${trialTotal} trial blocks</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PMCID Among PMIDs</div>
            <div class="stat-value">${formatStatPercent(pmcidAmongPmidsMetric.median || 0)}</div>
            <div class="stat-detail">Median across review-level coverage; aggregate ${pmidRecordsWithPmcidTotal}/${uniquePmidTotal} PubMed records</div>
          </div>
        </div>
        <div class="trial-distribution-grid">
          ${distributionMetrics.map((metric) => `
            <section class="trial-distribution-card">
              <div class="trial-distribution-card-head">
                <div>
                  <h3>${escapeHtml(metric.label)}</h3>
                  <p class="muted">${escapeHtml(metric.detail)}</p>
                </div>
                <div class="trial-distribution-range">
                  <strong>${formatMetricValue(metric, metric.median)}</strong>
                  <span>median</span>
                </div>
              </div>
              <div class="trial-distribution-bars" aria-label="${escapeHtml(metric.label)} distribution">
                ${metric.bins.map((bin) => `
                  <div class="trial-distribution-bin">
                    <span class="trial-bin-label">${escapeHtml(bin.label)}</span>
                    <span class="trial-bin-track"><span style="width: ${bin.width.toFixed(1)}%"></span></span>
                    <span class="trial-bin-count">${bin.count}</span>
                  </div>
                `).join("")}
              </div>
              <p class="trial-distribution-foot">${escapeHtml(distributionFoot(metric, rows))}</p>
            </section>
          `).join("")}
        </div>
        ${renderIncludedTrialSortControls()}
        <div class="record-table-wrap included-trial-distribution-table">
          <table>
            <thead>
              <tr>
                <th>Review</th>
                <th>Trials</th>
                <th>With PMID</th>
                <th>PMCID among PMIDs</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRows.map((row) => {
                const review = row.review;
                const isSelected = state.view === "review" && review.review_id === state.selectedReviewId;
                return `
                  <tr class="${isSelected ? "selected-review-row" : ""}">
                    <td>
                      <button class="table-review-link" type="button" data-review-id="${escapeHtml(review.review_id)}">
                        ${escapeHtml(review._title)}
                      </button>
                    </td>
                    <td><strong>${row.total}</strong></td>
                    <td>${row.withPmid}/${row.total} <span class="muted">(${percent(row.withPmid, row.total)})</span></td>
                    <td>${row.pmidRecordsWithPmcid}/${row.pmidRecords} <span class="muted">(${percent(row.pmidRecordsWithPmcid, row.pmidRecords)})</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function clinicalDomain(review) {
    return raw((review._domainLabel || {}).clinical_domain) || "Unassigned";
  }

  function domainSummaries(reviews) {
    const summaries = new Map();
    reviews.forEach((review) => {
      const domain = clinicalDomain(review);
      if (!summaries.has(domain)) {
        summaries.set(domain, {
          domain,
          total: 0,
        });
      }
      const summary = summaries.get(domain);
      summary.total += 1;
    });
    return Array.from(summaries.values()).sort((left, right) => {
      const countDiff = right.total - left.total;
      if (countDiff !== 0) {
        return countDiff;
      }
      return left.domain.localeCompare(right.domain);
    });
  }

  const DOMAIN_COLORS = [
    "#0f6b8f",
    "#c2410c",
    "#177245",
    "#7c3aed",
    "#be123c",
    "#946200",
    "#0369a1",
    "#0f766e",
    "#475569",
    "#b45309",
  ];

  function polarToCartesian(centerX, centerY, radius, angleDegrees) {
    const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(angleRadians),
      y: centerY + radius * Math.sin(angleRadians),
    };
  }

  function pieSlicePath(centerX, centerY, radius, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.999) {
      const top = polarToCartesian(centerX, centerY, radius, 0);
      const bottom = polarToCartesian(centerX, centerY, radius, 180);
      return [
        `M ${centerX} ${centerY}`,
        `L ${top.x} ${top.y}`,
        `A ${radius} ${radius} 0 1 1 ${bottom.x} ${bottom.y}`,
        `A ${radius} ${radius} 0 1 1 ${top.x} ${top.y}`,
        "Z",
      ].join(" ");
    }

    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      `M ${centerX} ${centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      "Z",
    ].join(" ");
  }

  function domainPieSlices(summaries) {
    const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
    let startAngle = 0;
    return summaries.map((summary, index) => {
      const angle = total ? (summary.total / total) * 360 : 0;
      const slice = {
        ...summary,
        color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
        percent: ratioPercent(summary.total, total),
        startAngle,
        endAngle: startAngle + angle,
      };
      startAngle += angle;
      return slice;
    });
  }

  function renderDomainDistribution(reviews) {
    const summaries = domainSummaries(reviews);
    const slices = domainPieSlices(summaries);
    const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
    const center = 130;
    const radius = 116;
    return `
      <section class="panel domain-panel">
        <div class="section-head">
          <div>
            <h2>Domain Distribution</h2>
            <p class="muted">Clinical domains from each review benchmark.json; unverified until manual audit.</p>
          </div>
        </div>
        <div class="domain-pie-layout">
          <figure class="domain-pie-figure">
            <svg class="domain-pie-chart" viewBox="0 0 260 260" role="img" aria-label="Clinical domain distribution across ${total} reviews">
              ${slices.map((slice) => `
                <path d="${pieSlicePath(center, center, radius, slice.startAngle, slice.endAngle)}" fill="${escapeHtml(slice.color)}">
                  <title>${escapeHtml(`${slice.domain}: ${slice.total} reviews (${formatStatPercent(slice.percent)})`)}</title>
                </path>
              `).join("")}
              <circle class="domain-pie-ring" cx="${center}" cy="${center}" r="${radius}"></circle>
            </svg>
          </figure>
          <div class="domain-pie-legend" aria-label="Domain counts">
            ${slices.map((slice) => `
              <div class="domain-legend-row">
                <span class="domain-legend-swatch" style="background: ${escapeHtml(slice.color)}"></span>
                <span class="domain-legend-name">${escapeHtml(slice.domain)}</span>
                <span class="domain-legend-count">${slice.total}</span>
                <span class="domain-legend-percent">${escapeHtml(formatStatPercent(slice.percent))}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function reviewTocItems(review = null) {
    const hasReferenceCandidates = (review?._referenceCandidates || []).length > 0;
    return [
      { label: "Review header", href: "#review-header" },
      { label: "Protocol and eligibility", href: "#protocol-eligibility" },
      { label: "References", href: "#trials" },
      { label: "Included trials", href: "#included-trials", branch: true },
      { label: "Excluded trials", href: "#excluded-trials", branch: true },
      ...(hasReferenceCandidates ? [{ label: "Reference candidates", href: "#reference-candidates", branch: true }] : []),
      { label: "Meta analysis", href: "#analysis-study-rows" },
      { label: "Reproduced", href: "#reproduced-meta-analysis", branch: true },
    ];
  }

  function renderReviewToc(review) {
    if (state.view !== "review" || !review) {
      return "";
    }

    return `
      <div class="review-toc-inline">
        ${renderReviewSourceActions(review, "sidebar-source-actions")}
        <nav class="review-toc" aria-label="Current review sections">
          ${reviewTocItems(review).map((item) => `
            <a class="${item.branch ? "toc-branch" : ""}" href="${escapeHtml(item.href)}" data-section-id="${escapeHtml(item.href.replace(/^#/, ""))}">${escapeHtml(item.label)}</a>
          `).join("")}
        </nav>
      </div>
    `;
  }

  function renderSidebar(reviews) {
    return `
      <aside class="panel sidebar">
        <div class="sidebar-section">
          <h3>Audit</h3>
          <p class="muted">Use Home for the workload overview, or select a review for detailed inspection.</p>
          <div class="tab-row home-tab-row">
            <button class="tab-button${state.view === "home" ? " active" : ""}" type="button" data-view="home">Home</button>
            <button class="tab-button${state.view === "review" ? " active" : ""}" type="button" data-view="review">Review Check</button>
          </div>
        </div>
        ${renderAuditFindingControls()}
        <div class="sidebar-section">
          <div class="review-list">
            ${reviews.map((review) => `
              <button class="review-button${state.view === "review" && review.review_id === state.selectedReviewId ? " active" : ""}" type="button" data-review-id="${escapeHtml(review.review_id)}">
                <span class="review-title">${escapeHtml(reviewCode(review))}</span>
                ${raw(review._title) && raw(review._title) !== reviewCode(review) ? `<span class="review-button-subtitle">${escapeHtml(review._title)}</span>` : ""}
              </button>
              ${state.view === "review" && review.review_id === state.selectedReviewId && state.reviewTocOpen ? renderReviewToc(review) : ""}
            `).join("") || `<div class="empty-state">No reviews loaded.</div>`}
          </div>
        </div>
      </aside>
    `;
  }

  function renderHome(reviews) {
    return `
      <div class="content-stack">
        ${renderIncludedTrialDistribution(reviews)}
        ${renderDomainDistribution(reviews)}
      </div>
    `;
  }

  function renderReviewHeader(review) {
    const extractedTitle = raw((review._reviewIndex || {}).extracted_title);
    const subtitle = extractedTitle && extractedTitle !== raw(review._title)
      ? `<p class="review-subtitle">${escapeHtml(extractedTitle)}</p>`
      : "";
    return `
      <section class="panel review-header" id="review-header">
        <div>
          <h2>${escapeHtml(review._title)}</h2>
          ${subtitle}
        </div>
        ${renderReviewSourceActions(review, "review-header-actions")}
      </section>
    `;
  }

  function renderCurationField(label, value, wide = false, auditContext = null) {
    return `
      <div class="curation-field${wide ? " wide" : ""}">
        <div class="field-label">${escapeHtml(label)}</div>
        <div class="field-value">${display(value)}</div>
        ${auditContext ? renderAuditIssueActions(auditContext, "field-audit-actions") : ""}
      </div>
    `;
  }

  function renderProtocolEligibilityPanel(review) {
    const protocol = review._protocol || {};
    if (!raw(protocol.review_id)) {
      return `
        <section class="panel protocol-panel" id="protocol-eligibility">
          <div class="section-head">
            <div>
              <h2>Protocol And Eligibility</h2>
              <p class="muted">No protocol and eligibility data was loaded from ${escapeHtml(benchmarkSourceFile(review.review_id))}.</p>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="panel protocol-panel" id="protocol-eligibility">
        <div class="section-head">
          <div>
            <h2>Protocol And Eligibility</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))} Values should be checked against the full-text review.</p>
          </div>
          <div class="muted">${display(protocol.pdf_status, "No PDF status")}</div>
        </div>
        <div class="curation-grid">
          ${renderCurationField("Research question", protocol.research_question, true, {
            review_id: protocol.review_id,
            section: "Protocol and eligibility",
            item_type: "protocol_field",
            item_id: `${protocol.review_id}:research_question`,
            source_file: benchmarkSourceFile(protocol.review_id),
            field_name: "research_question",
            displayed_value: raw(protocol.research_question),
          })}
          ${renderCurationField("Inclusion criteria", protocol.eligibility_inclusion_criteria, true, {
            review_id: protocol.review_id,
            section: "Protocol and eligibility",
            item_type: "protocol_field",
            item_id: `${protocol.review_id}:eligibility_inclusion_criteria`,
            source_file: benchmarkSourceFile(protocol.review_id),
            field_name: "eligibility_inclusion_criteria",
            displayed_value: raw(protocol.eligibility_inclusion_criteria),
          })}
          ${renderCurationField("Exclusion criteria", protocol.eligibility_exclusion_criteria, true, {
            review_id: protocol.review_id,
            section: "Protocol and eligibility",
            item_type: "protocol_field",
            item_id: `${protocol.review_id}:eligibility_exclusion_criteria`,
            source_file: benchmarkSourceFile(protocol.review_id),
            field_name: "eligibility_exclusion_criteria",
            displayed_value: raw(protocol.eligibility_exclusion_criteria),
          })}
        </div>
      </section>
    `;
  }

  function sourceStatusClass(value) {
    const status = raw(value).toLowerCase();
    if (["overall_ci_extracted", "single_candidate_ci_extracted", "completed", "extracted"].includes(status)) {
      return "ok";
    }
    if ([
      "not_extractable",
      "not_extractable_no_data",
      "not_extractable_no_study_labels",
      "not_extractable_no_raw_block",
      "no_numeric_ci_found",
      "total_row_no_numeric_ci",
    ].includes(status)) {
      return "bad";
    }
    return "warn";
  }

  function parseJsonCell(value) {
    const text = raw(value);
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function robSymbolClass(symbol) {
    if (symbol === "+") {
      return "rob-low";
    }
    if (symbol === "-") {
      return "rob-high";
    }
    if (symbol === "?") {
      return "rob-unclear";
    }
    return "rob-missing";
  }

  function robStatusLabel(status) {
    if (status === "not_extracted_no_rob_block") {
      return "No RoB block";
    }
    if (status === "partial_count_mismatch") {
      return "Partial";
    }
    return sentenceCaseId(status || "Not extracted");
  }

  function robLegendForRows(rows) {
    for (const row of rows) {
      const legend = parseJsonCell(row._riskOfBias?.rob_legend_json);
      if (legend && Object.keys(legend).length) {
        return legend;
      }
    }
    return null;
  }

  function renderRiskOfBiasLegend(rows) {
    const legend = robLegendForRows(rows);
    if (!legend) {
      return "";
    }
    return `
      <details class="rob-legend">
        <summary>RoB legend</summary>
        <div class="rob-legend-list">
          ${Object.entries(legend).map(([code, label]) => `
            <span><strong>${escapeHtml(code)}</strong> ${escapeHtml(label)}</span>
          `).join("")}
        </div>
      </details>
    `;
  }

  function renderRiskOfBiasCell(row) {
    const riskOfBias = row._riskOfBias;
    if (!riskOfBias) {
      return `<span class="muted">No RoB row</span>`;
    }
    const status = raw(riskOfBias.rob_extraction_status);
    const symbols = "ABCDEFGHIJ".split("")
      .map((code) => [code, raw(riskOfBias[`rob_${code}`])])
      .filter(([, symbol]) => symbol);
    if (!symbols.length) {
      return `
        <span class="status-chip ${sourceStatusClass(status)}">${escapeHtml(robStatusLabel(status))}</span>
        ${raw(riskOfBias.rob_extraction_notes) ? `<div class="muted">${display(riskOfBias.rob_extraction_notes, "")}</div>` : ""}
      `;
    }
    return `
      <div class="rob-chip-list">
        ${symbols.map(([code, symbol]) => `
          <span class="rob-chip ${robSymbolClass(symbol)}">
            <span class="rob-domain">${escapeHtml(code)}</span>
            <span>${escapeHtml(symbol)}</span>
          </span>
        `).join("")}
      </div>
    `;
  }

  function subsetLabel(value) {
    const subset = raw(value);
    if (subset === "all_studies") {
      return "All studies";
    }
    if (subset === "pmcid_only") {
      return "PMCID only";
    }
    return sentenceCaseId(subset || "Subset");
  }

  function reproductionStatusClass(value) {
    const status = raw(value);
    if (status === "ci_iou_full") {
      return "reproduction-status repro-status-iou-full";
    }
    if (status === "ci_iou_high") {
      return "reproduction-status repro-status-iou-high";
    }
    if (status === "ci_iou_moderate") {
      return "reproduction-status repro-status-iou-moderate";
    }
    if (status === "ci_iou_low") {
      return "reproduction-status repro-status-iou-low";
    }
    if (status === "ci_iou_none") {
      return "reproduction-status repro-status-iou-none";
    }
    if (status === "matches_reported_2dp" || status === "close_to_reported") {
      return status === "matches_reported_2dp"
        ? "reproduction-status repro-status-match"
        : "reproduction-status repro-status-close";
    }
    if (status === "differs_from_reported") {
      return "reproduction-status repro-status-differs";
    }
    if (status === "not_reproducible") {
      return "reproduction-status repro-status-not-reproducible";
    }
    if (status === "reported_not_available") {
      return "reproduction-status repro-status-reported-missing";
    }
    return "reproduction-status repro-status-unknown";
  }

  function reproductionStatusLabel(value) {
    const status = raw(value);
    if (status === "ci_iou_full") {
      return "Full overlap";
    }
    if (status === "ci_iou_high") {
      return "High overlap";
    }
    if (status === "ci_iou_moderate") {
      return "Moderate overlap";
    }
    if (status === "ci_iou_low") {
      return "Low overlap";
    }
    if (status === "ci_iou_none") {
      return "No overlap";
    }
    if (status === "matches_reported_2dp") {
      return "Matches";
    }
    if (status === "close_to_reported") {
      return "Close";
    }
    if (status === "differs_from_reported") {
      return "Differs";
    }
    if (status === "not_reproducible") {
      return "Not reproducible";
    }
    if (status === "reported_not_available") {
      return "Reported missing";
    }
    return sentenceCaseId(status || "Unknown");
  }

  function formatIou(value) {
    const parsed = finiteNumber(value);
    return parsed === null ? "" : parsed.toFixed(2);
  }

  function renderReproductionStatusChip(status, iou = "", options = {}) {
    const iouText = options.showIou === false ? "" : formatIou(iou);
    const label = iouText ? `${reproductionStatusLabel(status)} ${iouText}` : reproductionStatusLabel(status);
    return `<span class="status-chip ${reproductionStatusClass(status)}">${escapeHtml(label)}</span>`;
  }

  function renderReproductionStatusLegend() {
    const items = [
      {
        status: "ci_iou_full",
        text: "CI IoU is at least 0.99; reproduced and Cochrane reported intervals are essentially the same.",
      },
      {
        status: "ci_iou_high",
        text: "CI IoU is at least 0.75 but below 0.99.",
      },
      {
        status: "ci_iou_moderate",
        text: "CI IoU is at least 0.50 but below 0.75.",
      },
      {
        status: "ci_iou_low",
        text: "CI IoU is above 0 but below 0.50; check extraction, missing rows, PMCID-only filtering, or method mismatch.",
      },
      {
        status: "ci_iou_none",
        text: "The reproduced and Cochrane reported CIs do not overlap.",
      },
      {
        status: "not_reproducible",
        text: "No usable study-level effect and CI rows were available for this subset.",
      },
    ];
    return `
      <div class="reproduction-status-legend" aria-label="Reproduced meta-analysis status legend">
        <div>
          <div class="legend-title">CI IoU status legend</div>
          <p class="muted">CI IoU = overlap length divided by union length for the reproduced and Cochrane reported 95% CIs.</p>
        </div>
        <div class="reproduction-legend-items">
          ${items.map((item) => `
            <div class="reproduction-legend-item">
              ${renderReproductionStatusChip(item.status, "", { showIou: false })}
              <span>${escapeHtml(item.text)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function formatEffectValue(value, digits = 2) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return "";
    }
    return parsed.toFixed(digits).replace(/\.?0+$/, "");
  }

  function formatOverallCi(effect, low, high) {
    if (finiteNumber(effect) === null || finiteNumber(low) === null || finiteNumber(high) === null) {
      return "";
    }
    return `${formatEffectValue(effect)} [${formatEffectValue(low)}, ${formatEffectValue(high)}]`;
  }

  function renderReproductionCi(row, prefix) {
    const text = formatOverallCi(row[`${prefix}_effect`], row[`${prefix}_ci_lower`], row[`${prefix}_ci_upper`]);
    return display(text);
  }

  function reproductionMethodText(row) {
    const model = raw(row.calculation_model) || "No model";
    const method = raw(row.calculation_method) || "No method";
    const scale = raw(row.calculation_scale) || "No scale";
    const cochrane = raw(row.cochrane_method_detected)
      ? `; Cochrane: ${raw(row.cochrane_method_detected)} ${raw(row.cochrane_model_detected)}`.trim()
      : "";
    return `${model}; ${method}; ${scale}${cochrane}`;
  }

  function reproductionMethodKey(row) {
    return [
      raw(row.calculation_model),
      raw(row.calculation_method),
      raw(row.calculation_scale),
      raw(row.cochrane_method_detected),
      raw(row.cochrane_model_detected),
    ].join("|||");
  }

  function reproductionMethodVaries(rows) {
    return new Set(rows.map(reproductionMethodKey)).size > 1;
  }

  function renderReproductionMethodInfo(rows) {
    const first = rows[0] || {};
    const varies = reproductionMethodVaries(rows);
    return `
      <div class="muted reproduction-method-line">
        <strong>Effect measure:</strong> ${display(first.effect_measure)}
      </div>
      <div class="muted reproduction-method-line">
        <strong>Model / method:</strong> ${escapeHtml(reproductionMethodText(first))}
        ${varies ? `<span class="status-chip warn">Varies by subset</span>` : ""}
      </div>
      <div class="muted reproduction-method-line">
        <strong>Reported overall CI:</strong> ${renderReproductionCi(first, "reported")}
      </div>
    `;
  }

  function nonEstimableReasons(rows) {
    const marker = "Excluded non-computable rows:";
    const reasons = new Set();
    rows.forEach((row) => {
      const notes = raw(row.notes);
      const index = notes.indexOf(marker);
      if (index < 0) {
        return;
      }
      notes.slice(index + marker.length).trim().split(/\s+\|\s+/).forEach((reason) => {
        const cleaned = reason.trim();
        if (cleaned) {
          reasons.add(cleaned);
        }
      });
    });
    return Array.from(reasons);
  }

  function renderReproductionEstimabilityInfo(rows) {
    const first = rows[0] || {};
    const total = raw(first.k_total_rows) || "0";
    const estimable = raw(first.k_estimable_rows) || "0";
    const nonEstimableCount = Math.max(0, asNumber(total) - asNumber(estimable));
    const reasons = nonEstimableReasons(rows);
    return `
      <div class="reproduction-estimability">
        <div>
          <strong>Estimable study rows:</strong> ${escapeHtml(estimable)} of ${escapeHtml(total)} Cochrane forest-plot rows
        </div>
        ${nonEstimableCount > 0 ? `
          <div class="muted">${nonEstimableCount} row${nonEstimableCount === 1 ? "" : "s"} not estimable for reproduction.</div>
          ${reasons.length ? `
            <ul class="compact-reason-list">
              ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
            </ul>
          ` : `<div class="muted">Reason not recorded in the saved reproduction notes.</div>`}
        ` : `<div class="muted">All saved study rows were estimable for reproduction.</div>`}
      </div>
    `;
  }

  function renderReproductionSubsetCard(row, showMethod) {
    return `
      <article class="reproduced-subset-card">
        <div class="reproduced-subset-card-head">
          <strong>${escapeHtml(subsetLabel(row.subset))}</strong>
          ${renderReproductionStatusChip(row.reported_match_status, row.ci_iou)}
        </div>
        <div class="reproduction-metric-grid">
          <div class="reproduction-metric">
            <div class="field-label">Rows used for reproduction</div>
            <div class="field-value">
              ${display(row.k_used, "0")}
            </div>
          </div>
          <div class="reproduction-metric">
            <div class="field-label">Reproduced overall CI</div>
            <div class="field-value">${renderReproductionCi(row, "reproduced")}</div>
          </div>
        </div>
        ${showMethod ? `<div class="muted reproduction-subset-method"><strong>Subset model / method:</strong> ${escapeHtml(reproductionMethodText(row))}</div>` : ""}
        <div class="reproduction-plot-block">
          ${row._forestPlot ? renderReproducedForestPlot(row._forestPlot) : `<p class="muted excerpt">No forest-plot payload was saved for this subset.</p>`}
          ${raw(row.notes) ? `<div class="excerpt"><strong>Calculation note:</strong> ${display(row.notes)}</div>` : ""}
        </div>
      </article>
    `;
  }

  function groupedReproducedRows(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const analysisId = raw(row.analysis_id) || "unknown";
      if (!grouped.has(analysisId)) {
        grouped.set(analysisId, []);
      }
      grouped.get(analysisId).push(row);
    });
    return Array.from(grouped.entries()).sort((left, right) => {
      const leftId = sortAnalysisIdParts(left[0]);
      const rightId = sortAnalysisIdParts(right[0]);
      return leftId[0] - rightId[0] || leftId[1] - rightId[1];
    });
  }

  function plotNumber(value) {
    const parsed = finiteNumber(value);
    if (parsed === null) {
      return "";
    }
    if (Math.abs(parsed) >= 100) {
      return parsed.toFixed(0);
    }
    if (Math.abs(parsed) >= 10) {
      return parsed.toFixed(1).replace(/\.0$/, "");
    }
    return parsed.toFixed(2).replace(/\.?0+$/, "");
  }

  function sampleLinesForPlotRow(row, showEvents) {
    const source = row?.source_row || {};
    if (row?.type === "pooled") {
      return [];
    }
    if (showEvents && (raw(source.events_arm_1) || raw(source.events_arm_2))) {
      return [`${raw(source.events_arm_1) || "."}/${raw(source.n_arm_1) || "."} vs ${raw(source.events_arm_2) || "."}/${raw(source.n_arm_2) || "."}`];
    }
    if (raw(source.mean_arm_1) || raw(source.mean_arm_2)) {
      return [
        `${raw(source.mean_arm_1) || "."} (${raw(source.sd_arm_1) || "."}), n=${raw(source.n_arm_1) || "."}`,
        `${raw(source.mean_arm_2) || "."} (${raw(source.sd_arm_2) || "."}), n=${raw(source.n_arm_2) || "."}`,
      ];
    }
    if (raw(source.n_arm_1) || raw(source.n_arm_2)) {
      return [`${raw(source.n_arm_1) || "."} vs ${raw(source.n_arm_2) || "."}`];
    }
    return [];
  }

  function logTicks(min, max) {
    return [0.001, 0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10, 100, 1000].filter((tick) => tick >= min && tick <= max);
  }

  function linearTicks(min, max, count = 5) {
    const span = max - min;
    if (span <= 0) {
      return [];
    }
    return Array.from({ length: count }, (_, index) => min + (span * index) / (count - 1));
  }

  function wrapSvgText(value, maxChars = 24, maxLines = 2) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    words.forEach((word) => {
      const current = lines[lines.length - 1] || "";
      if (!current) {
        lines.push(word);
      } else if (`${current} ${word}`.length <= maxChars) {
        lines[lines.length - 1] = `${current} ${word}`;
      } else {
        lines.push(word);
      }
    });
    if (lines.length <= maxLines) {
      return lines;
    }
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\.$/, "")}...`;
    return kept;
  }

  function renderSvgLines(value, x, y, className, maxChars = 24, maxLines = 2) {
    const lines = wrapSvgText(value, maxChars, maxLines);
    return `
      <text class="${className}">
        ${lines.map((line, index) => `<tspan x="${x}" y="${y + index * 14}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }

  function renderReproducedForestPlot(plot) {
    if (!plot || !Array.isArray(plot.rows)) {
      return `<p class="muted excerpt">No forest-plot payload was saved for this subset.</p>`;
    }
    const rows = plot.rows.filter((row) => finiteNumber(row.effect) !== null && finiteNumber(row.ci_low) !== null && finiteNumber(row.ci_high) !== null);
    const xMin = finiteNumber(plot.x_min);
    const xMax = finiteNumber(plot.x_max);
    if (!rows.length || xMin === null || xMax === null || xMax <= xMin) {
      return `<p class="muted excerpt">No plottable rows are available for this subset.</p>`;
    }
    const isLog = plot.x_scale === "log";
    if (isLog && (xMin <= 0 || xMax <= 0)) {
      return `<p class="muted excerpt">Invalid log-scale bounds for this plot.</p>`;
    }
    const showEvents = ["risk_ratio", "odds_ratio"].includes(raw(plot.effect_measure));
    const width = 940;
    const rowHeight = 48;
    const top = 78;
    const bottom = 52;
    const height = top + rows.length * rowHeight + bottom;
    const studyX = 20;
    const dataX = 160;
    const weightX = 308;
    const valueX = 378;
    const plotLeft = 520;
    const plotRight = 916;
    const plotWidth = plotRight - plotLeft;
    const nullX = finiteNumber(plot.null_x);
    const xScale = isLog
      ? (value) => plotLeft + ((Math.log(value) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin))) * plotWidth
      : (value) => plotLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const ticks = isLog ? logTicks(xMin, xMax) : linearTicks(xMin, xMax, 5);
    const axisY = top + rows.length * rowHeight + 12;
    return `
      <div class="reproduced-forest-card">
        <div class="reproduced-forest-scroll">
          <svg class="reproduced-forest-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(raw(plot.title) || "Forest plot")}">
            <rect class="forest-panel-bg" x="0" y="0" width="${width}" height="${height}" rx="8"></rect>
            <text class="forest-column-header" x="${studyX}" y="32">Study</text>
            <text class="forest-column-header" x="${dataX}" y="32">${showEvents ? "Events / total" : "Data"}</text>
            <text class="forest-column-header" x="${weightX}" y="32">Weight</text>
            <text class="forest-column-header" x="${valueX}" y="32">${escapeHtml(raw(plot.effect_measure_label) || "Effect")}</text>
            <text class="forest-column-header forest-plot-header" x="${(plotLeft + plotRight) / 2}" y="32">${escapeHtml(raw(plot.effect_measure_label) || "Effect")}</text>
            <line class="forest-header-line" x1="16" x2="${width - 16}" y1="52" y2="52"></line>
            <rect class="forest-plot-area" x="${plotLeft}" y="54" width="${plotWidth}" height="${rows.length * rowHeight + 34}"></rect>
            ${ticks.map((tick) => {
              const x = xScale(tick);
              return `
                <line class="forest-grid-line" x1="${x}" x2="${x}" y1="54" y2="${axisY}"></line>
                <line class="forest-axis-tick-mark" x1="${x}" x2="${x}" y1="${axisY}" y2="${axisY + 7}"></line>
                <text class="forest-axis-tick" x="${x}" y="${axisY + 22}">${escapeHtml(plotNumber(tick))}</text>
              `;
            }).join("")}
            ${nullX !== null && nullX >= xMin && nullX <= xMax ? `<line class="forest-null-line" x1="${xScale(nullX)}" x2="${xScale(nullX)}" y1="54" y2="${axisY}"></line>` : ""}
            ${rows.map((row, index) => {
              const y = top + index * rowHeight;
              const effect = finiteNumber(row.effect);
              const low = finiteNumber(row.ci_low);
              const high = finiteNumber(row.ci_high);
              const isPooled = row.type === "pooled";
              const weight = finiteNumber(row.weight_percent);
              const pointX = xScale(effect);
              const lowX = xScale(low);
              const highX = xScale(high);
              const square = isPooled ? 0 : 7 + Math.sqrt(Math.max(0, Math.min(100, weight || 0)) / 100) * 12;
              const valueText = `${plotNumber(effect)} [${plotNumber(low)}, ${plotNumber(high)}]`;
              const sampleLines = sampleLinesForPlotRow(row, showEvents);
              return `
                <g class="forest-row ${isPooled ? "forest-row-pooled" : "forest-row-study"}">
                  <rect class="forest-row-hit" x="12" y="${y - 24}" width="${width - 24}" height="42" rx="6"></rect>
                  ${renderSvgLines(row.label || "", studyX, y - 4, "forest-row-label", 18, 2)}
                  ${sampleLines.map((line, lineIndex) => `
                    <text class="forest-sample-label" x="${dataX}" y="${y + (sampleLines.length === 1 ? 5 : -2 + lineIndex * 13)}">${escapeHtml(line)}</text>
                  `).join("")}
                  <text class="forest-weight-label" x="${weightX}" y="${y + 5}">${weight === null ? "" : `${weight.toFixed(1)}%`}</text>
                  <text class="forest-value-label" x="${valueX}" y="${y + 5}">${escapeHtml(valueText)}</text>
                  ${isPooled ? "" : `<line class="forest-ci-line" x1="${lowX}" x2="${highX}" y1="${y}" y2="${y}"></line>`}
                  ${isPooled
                    ? `<polygon class="forest-point forest-diamond" points="${lowX},${y} ${pointX},${y - 10} ${highX},${y} ${pointX},${y + 10}"></polygon>`
                    : `<rect class="forest-point forest-square" x="${pointX - square / 2}" y="${y - square / 2}" width="${square}" height="${square}"></rect>`
                  }
                </g>
              `;
            }).join("")}
          </svg>
        </div>
      </div>
    `;
  }

  function renderReproducedMetaAnalysisPanel(review) {
    const rows = review._analysisReproducedResults || [];
    return `
      <section class="panel reproduced-meta-panel" id="reproduced-meta-analysis">
        <div class="section-head">
          <div>
            <h2>Reproduced</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))} Totals use CI-derived inverse-variance pooling from extracted study-level effects.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} subset rows` : "No rows"}</div>
        </div>
        ${renderReproductionStatusLegend()}
        ${rows.length ? `
          <div class="analysis-study-group-list reproduced-analysis-list">
            ${groupedReproducedRows(rows).map(([analysisId, analysisRows]) => {
              const first = analysisRows[0] || {};
              const methodsDiffer = reproductionMethodVaries(analysisRows);
              return `
                <section class="analysis-study-group" id="reproduced-analysis-${escapeHtml(analysisId)}">
                  <div class="analysis-study-group-head">
                    <div>
                      <strong>Analysis ${escapeHtml(analysisId)}</strong>
                      <div>${display(first.outcome)}</div>
                      <div class="muted">${display(first.comparison)}</div>
                      ${renderReproductionMethodInfo(analysisRows)}
                      ${renderReproductionEstimabilityInfo(analysisRows)}
                    </div>
                  </div>
                  <div class="reproduced-subset-grid">
                    ${analysisRows.map((row) => renderReproductionSubsetCard(row, methodsDiffer)).join("")}
                  </div>
                </section>
              `;
            }).join("")}
          </div>
        ` : `<p class="muted excerpt">No reproduced meta-analysis rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
      </section>
    `;
  }

  function sourceCoverageChip(row) {
    if (raw(row.study_has_pmc) === "yes") {
      return `<span class="status-chip source-chip source-pmc">PMCID</span>`;
    }
    if (raw(row.study_has_pubmed) === "yes") {
      return `<span class="status-chip source-chip source-pmid">PMID only</span>`;
    }
    return `<span class="status-chip source-chip source-missing">No PMID</span>`;
  }

  function renderStudyDataFields(row) {
    if (row.data_type === "dichotomous") {
      return `
        <div class="data-type-line"><span class="data-type-chip">Dichotomous</span></div>
        <div>${display(row.arm1_label)}: ${display(row.arm1_events)}/${display(row.arm1_total)}</div>
        <div>${display(row.arm2_label)}: ${display(row.arm2_events)}/${display(row.arm2_total)}</div>
      `;
    }
    if (row.data_type === "continuous") {
      return `
        <div class="data-type-line"><span class="data-type-chip">Continuous</span></div>
        <div>${display(row.arm1_label)}: mean ${display(row.arm1_mean)}, SD ${display(row.arm1_sd)}, n ${display(row.arm1_total)}</div>
        <div>${display(row.arm2_label)}: mean ${display(row.arm2_mean)}, SD ${display(row.arm2_sd)}, n ${display(row.arm2_total)}</div>
      `;
    }
    return `<span class="muted">${display(row.data_type, "No data type")}</span>`;
  }

  function renderStudyEffect(row) {
    const effect = raw(row.effect) ? `${row.effect} [${row.ci_lower}, ${row.ci_upper}]` : "";
    return `<div>${display(effect)}</div>`;
  }

  function groupStudyRowsByAnalysis(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const analysisId = row.analysis_id || "unknown";
      if (!grouped.has(analysisId)) {
        grouped.set(analysisId, []);
      }
      grouped.get(analysisId).push(row);
    });
    return Array.from(grouped.entries()).sort((left, right) => {
      const leftId = sortAnalysisIdParts(left[0]);
      const rightId = sortAnalysisIdParts(right[0]);
      return leftId[0] - rightId[0] || leftId[1] - rightId[1];
    });
  }

  function sortAnalysisIdParts(analysisId) {
    const parts = String(analysisId || "").split(".").map((part) => Number(part));
    return [
      Number.isFinite(parts[0]) ? parts[0] : 9999,
      Number.isFinite(parts[1]) ? parts[1] : 9999,
    ];
  }

  function analysisSummaryForStudyRows(analysisRows, analysisMeta = {}) {
    const first = analysisRows[0] || {};
    const comparisonLabel = raw(first.comparison_label_clean)
      || raw(first.comparison)
      || raw(analysisMeta.comparison_label_clean)
      || raw(analysisMeta.comparison)
      || (raw(first.comparison_id) ? `Comparison ${raw(first.comparison_id)}` : "");
    const effectMeasure = raw(analysisMeta.effect_measure);
    const overallEffect = raw(analysisMeta.overall_effect);
    const ciLower = raw(analysisMeta.ci_lower);
    const ciUpper = raw(analysisMeta.ci_upper);
    const overallCi = overallEffect || ciLower || ciUpper
      ? `${overallEffect || "?"} [${ciLower || "?"}, ${ciUpper || "?"}]`
      : "";
    const outcomeTitle = raw(analysisMeta.outcome || first.outcome);
    const displayedValue = [
      ["outcome", outcomeTitle],
      ["comparison", comparisonLabel],
      ["measure", effectMeasure],
      ["overall_ci", overallCi],
    ].map(([field, value]) => `${field}: ${value || ""}`).join("\n");
    return `
      <div class="analysis-summary-layout">
        <strong>Analysis ${display(first.analysis_id)}</strong>
        <div class="analysis-summary-bottom">
          <div class="analysis-study-group-meta analysis-summary-fields">
            <span><strong>Outcome:</strong> ${display(outcomeTitle)}</span>
            <span><strong>Comparison:</strong> ${display(comparisonLabel)}</span>
            <span><strong>Measure:</strong> ${display(effectMeasure)}</span>
            <span><strong>Overall CI:</strong> ${display(overallCi)}</span>
          </div>
          ${renderAuditIssueActions({
            review_id: first.review_id || analysisMeta.review_id,
            section: "Meta analysis",
            item_type: "analysis_summary",
            item_id: `${first.review_id || analysisMeta.review_id || ""}:analysis_${first.analysis_id || analysisMeta.analysis_id || ""}`,
            source_file: benchmarkSourceFile(first.review_id || analysisMeta.review_id),
            field_name: "analysis_summary",
            displayed_value: displayedValue,
          }, "analysis-summary-audit-actions")}
        </div>
      </div>
    `;
  }

  function renderAnalysisStudyRowsTable(rows) {
    return `
      <div class="record-table-wrap analysis-study-rows-table">
        <table>
          <thead>
            <tr>
              <th>Study</th>
              <th>Source coverage</th>
              <th>Data fields</th>
              <th>Effect</th>
              <th>Risk of bias</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${raw(row.study_has_pmc) === "no" ? "needs-source-review" : ""}">
                <td>
                  <strong>${display(row.matched_reference_block_label || row.study_label_raw, "No study label")}</strong>
                  <div class="muted">${display(row.study_label_raw)}</div>
                </td>
                <td>
                  ${sourceCoverageChip(row)}
                  <div class="muted">${display(row.study_matched_pmids, "No PMID")} / ${display(row.study_pmcids, "No PMCID")}</div>
                </td>
                <td>${renderStudyDataFields(row)}</td>
                <td>${renderStudyEffect(row)}</td>
                <td>${renderRiskOfBiasCell(row)}</td>
                <td>
                  ${renderAuditIssueActions({
                    review_id: row.review_id,
                    section: "Meta analysis",
                    item_type: "analysis_study_row",
                    item_id: `${row.review_id || ""}:analysis_${row.analysis_id || ""}:study_${row.study_order || row.study_label_raw || ""}`,
                    source_file: benchmarkSourceFile(row.review_id),
                    field_name: "analysis_study_row",
                    displayed_value: analysisStudyRowAuditDisplayedValue(row),
                  }, "table-audit-actions")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAnalysisStudyRowsPanel(review) {
    const rows = review._analysisStudyRows || [];
    const analysisMetaById = new Map(
      (review._analysisResults || []).map((row) => [raw(row.analysis_id), row]),
    );
    return `
      <section class="panel analysis-study-rows-panel" id="analysis-study-rows">
        <div class="section-head">
          <div>
            <h2>Meta Analysis</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))} Includes effect-measure, overall-CI, study-row, and row-level RoB data when available.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} rows` : "No rows"}</div>
        </div>
        ${rows.length ? `
          ${renderRiskOfBiasLegend(rows)}
          <div class="analysis-study-group-list">
            ${groupStudyRowsByAnalysis(rows).map(([analysisId, analysisRows]) => `
              <section class="analysis-study-group" id="${analysisStudyRowsId(analysisId)}">
                <div class="analysis-study-group-head">
                  ${analysisSummaryForStudyRows(analysisRows, analysisMetaById.get(raw(analysisId)) || {})}
                </div>
                ${renderAnalysisStudyRowsTable(analysisRows)}
              </section>
            `).join("")}
          </div>
        ` : `<p class="muted excerpt">No analysis study rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
      </section>
    `;
  }

  function renderListField(label, values, linkType = "") {
    const items = splitCell(values);
    let valueHtml = display(values);
    if (items.length) {
      valueHtml = items.map((item) => {
        if (linkType === "pmid") {
          return `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(item)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`;
        }
        if (linkType === "pmcid") {
          return `<a href="https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(item)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`;
        }
        if (linkType === "doi") {
          return `<a href="https://doi.org/${encodeURI(item)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`;
        }
        if (linkType === "registry") {
          const url = registryUrlForId(item);
          return url && url !== "#"
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`
            : escapeHtml(item);
        }
        return escapeHtml(item);
      }).join("<br>");
    }
    return `
      <div class="field">
        <div class="field-label">${escapeHtml(label)}</div>
        <div class="field-value">${valueHtml}</div>
      </div>
    `;
  }

  function renderCompactLinks(values, linkType = "") {
    const items = splitCell(values);
    if (!items.length) {
      return `<span class="muted">None</span>`;
    }
    return items.map((item) => {
      if (linkType === "pmid") {
        return `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(item)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`;
      }
      if (linkType === "pmcid") {
        return `<a href="https://pmc.ncbi.nlm.nih.gov/articles/${encodeURIComponent(item)}/" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`;
      }
      if (linkType === "registry") {
        const url = registryUrlForId(item);
        return url && url !== "#"
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item)}</a>`
          : escapeHtml(item);
      }
      return escapeHtml(item);
    }).join(", ");
  }

  function renderFoundCell(found, label) {
    const foundClass = label === "PMCID" ? "source-pmc" : "source-pmid";
    return found
      ? `<span class="status-chip source-chip ${foundClass}">${escapeHtml(label)} found</span>`
      : `<span class="status-chip source-chip source-missing">Not found</span>`;
  }

  function registryIdForRow(registry) {
    return raw(registry.registry_id) || raw(registry.nct_id);
  }

  function registryUrlForId(registryId) {
    const id = raw(registryId);
    if (/^NCT\d{8}$/i.test(id)) {
      return `https://clinicaltrials.gov/study/${encodeURIComponent(id.toUpperCase())}`;
    }
    if (/^EUCTR\d{4}-\d{6}-\d{2}-[A-Z]{2}$/i.test(id)) {
      return `https://trialsearch.who.int/Trial2.aspx?TrialID=${encodeURIComponent(id.toUpperCase())}`;
    }
    if (/^ISRCTN\d{4,10}$/i.test(id)) {
      return `https://www.isrctn.com/${encodeURIComponent(id.toUpperCase())}`;
    }
    if (/^DRKS\d{8}$/i.test(id)) {
      return `https://drks.de/search/en/trial/${encodeURIComponent(id.toUpperCase())}`;
    }
    if (/^ChiCTR\d+$/i.test(id)) {
      return `https://trialsearch.who.int/Trial2.aspx?TrialID=${encodeURIComponent(id)}`;
    }
    return "#";
  }

  function registryUrlForRow(registry) {
    return raw(registry.registry_url) || raw(registry.nct_url) || registryUrlForId(registryIdForRow(registry));
  }

  function registryIdsForStudy(study) {
    const registryIds = (study._registries || []).map(registryIdForRow).filter(Boolean);
    return registryIds.length ? registryIds.join(";") : (study.trial_registry_ids || study.nct_ids);
  }

  function renderRegistryLinks(study) {
    const registries = study._registries || [];
    if (registries.length) {
      return registries.map((registry) => {
        const registryId = registryIdForRow(registry);
        const url = registryUrlForRow(registry);
        if (!registryId) {
          return "";
        }
        return url && url !== "#"
          ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(registryId)}</a>`
          : escapeHtml(registryId);
      }).filter(Boolean).join(", ");
    }
    return renderCompactLinks(study.trial_registry_ids || study.nct_ids, "registry");
  }

  function reportCandidateType(report) {
    return raw(report.candidate_type).toLowerCase();
  }

  function sourceRecordCoverage(study) {
    const reports = study._reports || [];
    const registryCount = (study._registries || []).length;
    const doiReports = reports.filter((report) => reportCandidateType(report) === "doi");
    const explicitReports = reports.filter((report) => reportCandidateType(report) === "explicit_pmid");
    const titleReports = reports.filter((report) => reportCandidateType(report) === "title");
    const fallbackReports = reports.filter((report) => reportCandidateType(report) !== "nct_id");

    let rows = doiReports;
    let basis = "DOI";
    if (!rows.length) {
      rows = explicitReports;
      basis = "PMID";
    }
    if (!rows.length) {
      rows = titleReports;
      basis = "title";
    }
    if (!rows.length) {
      rows = fallbackReports;
      basis = "candidate";
    }

    const total = rows.length + registryCount;
    const matched = rows.filter((report) => isYes(report.has_pubmed)).length + registryCount;
    if (registryCount) {
      basis = rows.length ? `${basis}+registry` : "registry";
    }
    return { matched, total, basis };
  }

  function renderSourceRecordCoverage(study) {
    const coverage = sourceRecordCoverage(study);
    if (!coverage.total) {
      return `<span class="muted">None</span>`;
    }
    const className = coverage.matched === coverage.total ? "source-full" : (coverage.matched > 0 ? "source-partial" : "source-missing");
    let basisLabel = coverage.basis;
    if (coverage.matched === 0) {
      if (coverage.basis === "title") {
        basisLabel = "title lookup failed";
      } else if (coverage.basis === "DOI") {
        basisLabel = "DOI lookup failed";
      }
    }
    return `
      <div><span class="status-chip source-chip ${className}">${coverage.matched}/${coverage.total} source links</span></div>
      <div class="muted">${escapeHtml(basisLabel)}</div>
    `;
  }

  function renderTrialsPlaceholder() {
    return `
      <section class="panel trial-summary-panel trials-placeholder" id="trials">
        <div class="section-head">
          <div>
            <h2>References</h2>
          </div>
        </div>
      </section>
    `;
  }

  function renderTrialSummaryColgroup() {
    return `
      <colgroup>
        <col class="trial-col-name">
        <col class="trial-col-status">
        <col class="trial-col-status">
        <col class="trial-col-ids">
        <col class="trial-col-pmcids">
        <col class="trial-col-registry">
        <col class="trial-col-source">
      </colgroup>
    `;
  }

  function trialSummaryText(studies, noun = "trials") {
    const total = studies.length;
    const withPmid = studies.filter((study) => isYes(study.has_pubmed)).length;
    const withPmcid = studies.filter((study) => isYes(study.has_pmc)).length;
    return `${total} ${noun}; ${withPmid} with PMID; ${withPmcid} with PMCID`;
  }

  function renderIncludedTrialsTable(review) {
    const studies = review._studies || [];
    return `
      <section class="panel trial-summary-panel" id="included-trials">
        <div class="section-head">
          <div>
            <h2>Included trials</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))}</p>
          </div>
          <div class="section-summary">${escapeHtml(trialSummaryText(studies))}</div>
        </div>
        ${studies.length ? `
          <div class="record-table-wrap trial-summary-table">
            <table>
              ${renderTrialSummaryColgroup()}
              <thead>
                <tr>
                  <th>Trial</th>
                  <th>PMID record</th>
                  <th>PMC record</th>
                  <th>Matched PMIDs</th>
                  <th>PMCIDs</th>
                  <th>Registry</th>
                  <th>Source records</th>
                </tr>
              </thead>
              <tbody>
                ${studies.map((study) => `
                  <tr class="${state.selectedTrialSource === "included" && String(study._rowIndex) === String(state.selectedTrialRowIndex) ? "selected-trial-row" : ""}">
                    <td>
                      <button class="table-review-link trial-detail-link" type="button" data-trial-row-index="${escapeHtml(study._rowIndex)}" data-trial-source="included">
                        ${escapeHtml(study.study_label || "Unnamed study")}
                      </button>
                    </td>
                    <td>${renderFoundCell(isYes(study.has_pubmed), "PMID")}</td>
                    <td>${renderFoundCell(isYes(study.has_pmc), "PMCID")}</td>
                    <td>${renderCompactLinks(study.matched_pmids, "pmid")}</td>
                    <td>${renderCompactLinks(study.pmcids, "pmcid")}</td>
                    <td>${renderRegistryLinks(study)}</td>
                    <td>${renderSourceRecordCoverage(study)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <p class="muted excerpt">No included-trial rows were loaded for this review.</p>
        `}
      </section>
    `;
  }

  function renderReferenceCandidatesTable(review) {
    const studies = review._referenceCandidates || [];
    if (!studies.length) {
      return "";
    }
    return `
      <section class="panel trial-summary-panel reference-candidate-panel" id="reference-candidates">
        <div class="section-head">
          <div>
            <h2>Reference candidates</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))}</p>
          </div>
          <div class="section-summary">${escapeHtml(trialSummaryText(studies, "candidates"))}</div>
        </div>
        <div class="record-table-wrap trial-summary-table reference-candidate-table">
          <table>
            ${renderTrialSummaryColgroup()}
            <thead>
              <tr>
                <th>Reference</th>
                <th>PMID record</th>
                <th>PMC record</th>
                <th>Matched PMIDs</th>
                <th>PMCIDs</th>
                <th>Registry</th>
                <th>Source records</th>
              </tr>
            </thead>
            <tbody>
              ${studies.map((study) => `
                <tr class="${state.selectedTrialSource === "candidate" && String(study._rowIndex) === String(state.selectedTrialRowIndex) ? "selected-trial-row" : ""}">
                  <td>
                    <button class="table-review-link trial-detail-link" type="button" data-trial-row-index="${escapeHtml(study._rowIndex)}" data-trial-source="candidate">
                      ${escapeHtml(study.study_label || "Unnamed reference")}
                    </button>
                  </td>
                  <td>${renderFoundCell(isYes(study.has_pubmed), "PMID")}</td>
                  <td>${renderFoundCell(isYes(study.has_pmc), "PMCID")}</td>
                  <td>${renderCompactLinks(study.matched_pmids, "pmid")}</td>
                  <td>${renderCompactLinks(study.pmcids, "pmcid")}</td>
                  <td>${renderRegistryLinks(study)}</td>
                  <td>${renderSourceRecordCoverage(study)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderExcludedTrialsTable(review) {
    const studies = review._excludedStudies || [];

    return `
      <section class="panel trial-summary-panel excluded-trial-panel" id="excluded-trials">
        <div class="section-head">
          <div>
            <h2>Excluded trials</h2>
            <p class="muted">${escapeHtml(benchmarkSourceLabel(review))}</p>
          </div>
          <div class="section-summary">${escapeHtml(trialSummaryText(studies))}</div>
        </div>
        ${studies.length ? `
          <div class="record-table-wrap trial-summary-table excluded-trial-table">
            <table>
              ${renderTrialSummaryColgroup()}
              <thead>
                <tr>
                  <th>Trial</th>
                  <th>PMID record</th>
                  <th>PMC record</th>
                  <th>Matched PMIDs</th>
                  <th>PMCIDs</th>
                  <th>Registry</th>
                  <th>Source records</th>
                </tr>
              </thead>
              <tbody>
                ${studies.map((study) => `
                  <tr class="${state.selectedTrialSource === "excluded" && String(study._rowIndex) === String(state.selectedTrialRowIndex) ? "selected-trial-row" : ""}">
                    <td>
                      <button class="table-review-link trial-detail-link" type="button" data-trial-row-index="${escapeHtml(study._rowIndex)}" data-trial-source="excluded">
                        ${escapeHtml(study.study_label || "Unnamed excluded study")}
                      </button>
                    </td>
                    <td>${renderFoundCell(isYes(study.has_pubmed), "PMID")}</td>
                    <td>${renderFoundCell(isYes(study.has_pmc), "PMCID")}</td>
                    <td>${renderCompactLinks(study.matched_pmids, "pmid")}</td>
                    <td>${renderCompactLinks(study.pmcids, "pmcid")}</td>
                    <td>${renderRegistryLinks(study)}</td>
                    <td>${renderSourceRecordCoverage(study)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <p class="muted excerpt">No excluded-trial rows were loaded for this review.</p>
        `}
      </section>
    `;
  }

  function renderRawRows(row) {
    return `
      <details>
        <summary>Show raw benchmark row</summary>
        <div class="raw-table-wrap">
          <table>
            <tbody>
              ${Object.entries(row)
                .filter(([key]) => !key.startsWith("_"))
                .map(([key, value]) => `
                  <tr>
                    <th>${escapeHtml(key)}</th>
                    <td>${display(value, ".")}</td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function renderRawJson(row) {
    if (!row) {
      return "";
    }
    return `
      <details>
        <summary>Show raw JSON row</summary>
        <pre class="raw-json">${escapeHtml(JSON.stringify(row, null, 2))}</pre>
      </details>
    `;
  }

  function renderRecords(study, source = "included") {
    const records = study._records || [];
    const entity = source === "candidate" ? "reference" : "trial";
    if (!records.length) {
      return `<p class="muted excerpt">No PMID-level rows are available for this ${entity}.</p>`;
    }

    return `
      <div class="record-table-wrap">
        <table>
          <thead>
            <tr>
              <th>PMID</th>
              <th>PMCID</th>
              <th>Title</th>
              <th>Journal / year</th>
              <th>DOI</th>
              <th>Method</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr>
                <td>${raw(record.pubmed_url) ? `<a href="${escapeHtml(record.pubmed_url)}" target="_blank" rel="noopener noreferrer">${display(record.pmid)}</a>` : display(record.pmid)}</td>
                <td>${raw(record.pmc_url) ? `<a href="${escapeHtml(record.pmc_url)}" target="_blank" rel="noopener noreferrer">${display(record.pmcid)}</a>` : display(record.pmcid)}</td>
                <td>${display(record.title)}</td>
                <td>${display(record.journal)}<br><span class="muted">${display(record.year, "No year")}</span></td>
                <td>${raw(record.doi) ? `<a href="https://doi.org/${encodeURI(raw(record.doi))}" target="_blank" rel="noopener noreferrer">${display(record.doi)}</a>` : display(record.doi)}</td>
                <td>${display(record.match_methods)}</td>
                <td>
                  ${renderAuditIssueActions({
                    review_id: record.review_id,
                    section: "References",
                    item_type: "pubmed_record",
                    item_id: `${record.review_id || ""}:${record.study_label || ""}:pmid_${record.pmid || ""}`,
                    source_file: benchmarkSourceFile(record.review_id),
                    field_name: "pubmed_record",
                    displayed_value: auditDisplayedValue(record, [
                      "study_label",
                      "pmid",
                      "pmcid",
                      "title",
                      "journal",
                      "year",
                      "doi",
                      "match_methods",
                    ]),
                  }, "table-audit-actions")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReportCandidates(study, source = "included") {
    const reports = study._reports || [];
    const entity = source === "candidate" ? "reference" : "trial";
    if (!reports.length) {
      return `<p class="muted excerpt">No report-candidate rows are available for this ${entity}.</p>`;
    }

    return `
      <div class="record-table-wrap report-candidate-table">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Matched PMIDs</th>
              <th>PMCIDs</th>
              <th>Lookup method</th>
              <th>Lookup notes</th>
              <th>Matched PubMed titles</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            ${reports.map((report) => `
              <tr>
                <td>
                  <strong>${display(report.candidate_type, "candidate")}</strong>
                  <div>${display(report.candidate_text)}</div>
                  <div class="muted">report row ${display(report.report_index, "none")}</div>
                </td>
                <td>${renderCompactLinks(report.matched_pmids, "pmid")}</td>
                <td>${renderCompactLinks(report.pmcids, "pmcid")}</td>
                <td>${display(report.lookup_methods)}</td>
                <td>${display(report.lookup_errors)}</td>
                <td>${display(report.pubmed_titles)}</td>
                <td>
                  ${renderAuditIssueActions({
                    review_id: report.review_id,
                    section: "References",
                    item_type: "report_candidate",
                    item_id: `${report.review_id || ""}:${report.study_label || ""}:report_${report.report_index || ""}`,
                    source_file: benchmarkSourceFile(report.review_id),
                    field_name: "report_candidate",
                    displayed_value: auditDisplayedValue(report, [
                      "study_label",
                      "report_index",
                      "candidate_type",
                      "candidate_text",
                      "query_text",
                      "matched_pmids",
                      "pmcids",
                      "lookup_methods",
                      "lookup_errors",
                      "pubmed_titles",
                    ]),
                  }, "table-audit-actions")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialRegistryRecords(study, source = "included") {
    const registries = study._registries || [];
    if (!registries.length) {
      return "";
    }

    return `
      <div class="record-table-wrap registry-table">
        <table>
          <thead>
            <tr>
              <th>Registry</th>
              <th>Type</th>
              <th>Source</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            ${registries.map((registry) => `
              <tr>
                <td>${registryUrlForRow(registry) && registryUrlForRow(registry) !== "#" ? `<a href="${escapeHtml(registryUrlForRow(registry))}" target="_blank" rel="noopener noreferrer">${display(registryIdForRow(registry))}</a>` : display(registryIdForRow(registry))}</td>
                <td>${display(registry.registry_type)}</td>
                <td>${display(registry.source)}</td>
                <td>${display(registry.lookup_status)}</td>
                <td>${display(registry.notes)}</td>
                <td>
                  ${renderAuditIssueActions({
                    review_id: registry.review_id,
                    section: "References",
                    item_type: "trial_registry_record",
                    item_id: `${registry.review_id || ""}:${registry.study_label || ""}:${registryIdForRow(registry) || ""}`,
                    source_file: benchmarkSourceFile(registry.review_id),
                    field_name: "trial_registry_record",
                    displayed_value: auditDisplayedValue(registry, [
                      "study_label",
                      "registry_id",
                      "nct_id",
                      "registry_type",
                      "source",
                      "lookup_status",
                      "notes",
                    ]),
                  }, "table-audit-actions")}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialDetailCard(study, source = "included") {
    const status = trialStatus(study);
    const sourceFile = benchmarkSourceFile(study.review_id);
    const sectionLabel = source === "excluded"
      ? "Excluded trials"
      : (source === "candidate" ? "Reference candidates" : "Included trials");
    const itemType = source === "excluded"
      ? "excluded_trial"
      : (source === "candidate" ? "reference_candidate" : "included_trial");
    const unnamedLabel = source === "candidate" ? "Unnamed reference" : "Unnamed study";
    return `
      <article class="trial-card ${trialCardClass(study)}" id="trial-${source}-${study._rowIndex}" data-trial-detail>
        <div class="trial-head">
          <div>
            <div class="trial-title">
              <h3>${escapeHtml(study.study_label || unnamedLabel)}</h3>
              <span class="muted">${display(study.reference_status, "No reference status")}</span>
            </div>
            <p class="muted">Row ${study._rowIndex} in ${escapeHtml(sourceFile)}</p>
          </div>
          <div class="trial-head-actions">
            <span class="status-chip ${status.className}">${escapeHtml(status.label)}</span>
            ${renderAuditIssueActions({
              review_id: study.review_id,
              section: sectionLabel,
              item_type: itemType,
              item_id: `${study.review_id || ""}:${study.study_label || ""}:row_${study._rowIndex || ""}`,
              source_file: sourceFile,
              field_name: "study_block",
              displayed_value: auditDisplayedValue(study, [
                "study_label",
                "reference_status",
                "explicit_pmids",
                "dois",
                "nct_ids",
                "trial_registry_ids",
                "matched_pmids",
                "pmcids",
                "lookup_methods",
                "lookup_errors",
                "reference_excerpt",
              ]),
            }, "inline-audit-actions")}
          </div>
        </div>

        <div class="field-grid">
          ${renderListField("Explicit PMID/MEDLINE", study.explicit_pmids, "pmid")}
          ${renderListField("DOI", study.dois, "doi")}
          ${renderListField("Registry", registryIdsForStudy(study), "registry")}
          ${renderListField("Matched PMIDs", study.matched_pmids, "pmid")}
          ${renderListField("PMCIDs", study.pmcids, "pmcid")}
          ${renderListField("Lookup methods", study.lookup_methods)}
          ${renderListField("Title queries", study.title_queries)}
          ${renderListField("Lookup errors / notes", study.lookup_errors)}
        </div>

        <div class="excerpt">
          <strong>Reference excerpt:</strong>
          <div>${display(study.reference_excerpt, "No excerpt")}</div>
        </div>

        ${renderTrialRegistryRecords(study, source)}
        ${renderReportCandidates(study, source)}
        ${renderRecords(study, source)}
        ${renderRawRows(study)}
      </article>
    `;
  }

  function renderSelectedTrialDetail(review) {
    const selectedRows = state.selectedTrialSource === "excluded"
      ? (review._excludedStudies || [])
      : (state.selectedTrialSource === "candidate" ? (review._referenceCandidates || []) : (review._studies || []));
    const selectedStudy = selectedRows.find((study) => String(study._rowIndex) === String(state.selectedTrialRowIndex));
    if (!selectedStudy) {
      return "";
    }
    return `
      <section class="trial-list selected-trial-detail" id="trial-details">
        ${renderTrialDetailCard(selectedStudy, state.selectedTrialSource)}
      </section>
    `;
  }

  function renderReview(reviews) {
    const review = selectedReview(reviews);
    if (!review) {
      return `
        <div class="content-stack">
          <section class="empty-state">
            <h2>Select A Review</h2>
            <p class="muted">No review selected.</p>
          </section>
        </div>
      `;
    }

    return `
      <div class="content-stack">
        ${renderReviewHeader(review)}
        ${renderProtocolEligibilityPanel(review)}
        ${renderTrialsPlaceholder()}
        ${renderIncludedTrialsTable(review)}
        ${renderExcludedTrialsTable(review)}
        ${renderReferenceCandidatesTable(review)}
        ${renderSelectedTrialDetail(review)}
        ${renderAnalysisStudyRowsPanel(review)}
        ${renderReproducedMetaAnalysisPanel(review)}
      </div>
    `;
  }

  function selectedReview(reviews) {
    return reviews.find((item) => item.review_id === state.selectedReviewId);
  }

  function bindEvents(reviews) {
    document.querySelectorAll("[data-view='home']").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = "home";
        state.selectedReviewId = "";
        state.selectedTrialRowIndex = "";
        state.selectedTrialSource = "included";
        state.reviewTocOpen = true;
        if (window.location.hash) {
          history.pushState("", document.title, window.location.pathname + window.location.search);
        }
        render();
      });
    });

    document.querySelectorAll("[data-view='review']").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = "review";
        state.reviewTocOpen = true;
        if (reviews.some((review) => review.review_id === state.selectedReviewId)) {
          window.location.hash = state.selectedReviewId;
        }
        render();
      });
    });

    document.querySelectorAll("[data-included-trial-sort-key]").forEach((select) => {
      select.addEventListener("change", () => {
        const nextKey = select.value || "trials";
        state.includedTrialSortKey = INCLUDED_TRIAL_SORT_OPTIONS.some((option) => option.key === nextKey)
          ? nextKey
          : "trials";
        render();
      });
    });

    document.querySelectorAll("[data-included-trial-sort-direction]").forEach((button) => {
      button.addEventListener("click", () => {
        state.includedTrialSortDirection = button.getAttribute("data-included-trial-sort-direction") === "asc"
          ? "asc"
          : "desc";
        render();
      });
    });

    document.querySelectorAll("[data-review-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const reviewId = button.getAttribute("data-review-id") || "";
        const review = reviews.find((item) => item.review_id === reviewId);
        const isSidebarReviewButton = button.classList.contains("review-button");
        const isSelectedSidebarReview = isSidebarReviewButton && state.view === "review" && state.selectedReviewId === reviewId;
        if (isSelectedSidebarReview) {
          state.reviewTocOpen = !state.reviewTocOpen;
          render();
          return;
        }
        state.view = "review";
        state.selectedReviewId = reviewId;
        state.selectedTrialRowIndex = "";
        state.selectedTrialSource = "included";
        state.reviewTocOpen = true;
        window.location.hash = state.selectedReviewId;
        render();
      });
    });

    document.querySelectorAll("[data-audit-report]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.auditModalContext = parseAuditContext(button.getAttribute("data-audit-context"));
        state.auditReviewOpen = false;
        state.auditEditingFindingId = "";
        render();
      });
    });

    document.querySelectorAll("[data-audit-review-findings]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!state.auditFindings.length) {
          return;
        }
        state.auditModalContext = null;
        state.auditReviewOpen = true;
        state.auditEditingFindingId = "";
        render();
      });
    });

    document.querySelectorAll("[data-audit-export]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        exportAuditFindings(button.getAttribute("data-audit-export") || "tsv");
      });
    });

    document.querySelectorAll("[data-audit-import-file]").forEach((input) => {
      input.addEventListener("change", (event) => {
        event.preventDefault();
        event.stopPropagation();
        importAuditFindingsFile(input.files?.[0]);
      });
    });

    document.querySelectorAll("[data-audit-clear]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!state.auditFindings.length) {
          return;
        }
        if (window.confirm("Clear all audit findings saved in this browser? Export first if you need to keep them.")) {
          state.auditFindings = [];
          saveAuditFindings();
          state.auditReviewOpen = false;
          state.auditEditingFindingId = "";
          state.auditMessage = "Cleared local audit findings.";
          render();
        }
      });
    });

    document.querySelectorAll("[data-audit-close]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.auditModalContext = null;
        state.auditReviewOpen = false;
        state.auditEditingFindingId = "";
        render();
      });
    });

    document.querySelectorAll("[data-audit-edit-finding]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const findingId = button.getAttribute("data-audit-edit-finding") || "";
        const finding = state.auditFindings.find((candidate) => candidate.finding_id === findingId);
        if (!finding) {
          state.auditMessage = "Could not find that local audit finding.";
          render();
          return;
        }
        state.auditEditingFindingId = finding.finding_id;
        state.auditModalContext = auditContextFromFinding(finding);
        state.auditReviewOpen = false;
        render();
      });
    });

    document.querySelectorAll("[data-audit-delete-finding]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const findingId = button.getAttribute("data-audit-delete-finding") || "";
        if (!findingId) {
          return;
        }
        if (window.confirm("Delete this local audit finding?")) {
          state.auditFindings = state.auditFindings.filter((finding) => finding.finding_id !== findingId);
          saveAuditFindings();
          if (state.auditEditingFindingId === findingId) {
            state.auditEditingFindingId = "";
            state.auditModalContext = null;
          }
          state.auditMessage = "Deleted audit finding.";
          render();
        }
      });
    });

    document.querySelectorAll("[data-audit-copy-displayed]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const form = button.closest("[data-audit-form]");
        const correctValue = form?.querySelector("[data-audit-correct-value]");
        const displayedValue = form?.querySelector("[data-audit-displayed-value]")?.value || "";
        if (correctValue) {
          correctValue.value = displayedValue;
          correctValue.focus();
        }
      });
    });

    document.querySelectorAll("[data-audit-clear-correct]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const correctValue = button.closest("[data-audit-form]")?.querySelector("[data-audit-correct-value]");
        if (correctValue) {
          correctValue.value = "";
          correctValue.focus();
        }
      });
    });

    document.querySelectorAll("[data-audit-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const context = state.auditModalContext || {};
        const formData = new FormData(form);
        const reviewer = raw(formData.get("reviewer"));
        const sourceEvidence = raw(formData.get("source_evidence"));
        const existingFinding = state.auditEditingFindingId
          ? state.auditFindings.find((finding) => finding.finding_id === state.auditEditingFindingId)
          : null;
        saveReviewerName(reviewer);
        const finding = normalizeAuditFinding({
          finding_id: existingFinding?.finding_id || `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          created_at: existingFinding?.created_at || new Date().toISOString(),
          review_id: context.review_id || state.selectedReviewId,
          section: context.section,
          item_type: context.item_type,
          item_id: context.item_id,
          source_file: context.source_file,
          field_name: context.field_name,
          displayed_value: context.displayed_value,
          issue_type: formData.get("issue_type"),
          correct_value: formData.get("correct_value"),
          source_location: "",
          source_excerpt: sourceEvidence,
          notes: formData.get("notes"),
          reviewer,
          status: existingFinding?.status || "open",
        });
        if (existingFinding) {
          state.auditFindings = state.auditFindings.map((candidate) => (
            candidate.finding_id === existingFinding.finding_id ? finding : candidate
          ));
        } else {
          state.auditFindings = [...state.auditFindings, finding];
        }
        saveAuditFindings();
        state.auditModalContext = null;
        state.auditEditingFindingId = "";
        state.auditReviewOpen = Boolean(existingFinding);
        state.auditMessage = existingFinding ? "Updated audit finding." : "Saved audit finding.";
        render();
      });
    });

    setupReviewTocScrollSpy();
  }

  function visibleReviewTocSectionIds() {
    const review = selectedReview(currentReviews);
    return reviewTocItems(review)
      .map((item) => item.href.replace(/^#/, ""))
      .filter((id) => document.getElementById(id));
  }

  function updateReviewTocActive() {
    const links = Array.from(document.querySelectorAll(".review-toc a[data-section-id]"));
    if (!links.length || state.view !== "review") {
      return;
    }

    const ids = visibleReviewTocSectionIds();
    const markerY = Math.min(window.innerHeight * 0.28, 180);
    let activeId = "";
    let firstUpcomingId = "";

    ids.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) {
        return;
      }
      const rect = section.getBoundingClientRect();
      if (rect.top <= markerY && rect.bottom > 0) {
        activeId = id;
      } else if (!activeId && !firstUpcomingId && rect.top > markerY) {
        firstUpcomingId = id;
      }
    });

    activeId = activeId || firstUpcomingId || ids[ids.length - 1] || "";
    links.forEach((link) => {
      const isActive = link.getAttribute("data-section-id") === activeId;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function requestReviewTocUpdate() {
    if (tocScrollSpyFrame) {
      return;
    }
    tocScrollSpyFrame = window.requestAnimationFrame(() => {
      tocScrollSpyFrame = 0;
      updateReviewTocActive();
    });
  }

  function setupReviewTocScrollSpy() {
    if (!tocScrollSpyBound) {
      window.addEventListener("scroll", requestReviewTocUpdate, { passive: true });
      window.addEventListener("resize", requestReviewTocUpdate);
      tocScrollSpyBound = true;
    }
    requestReviewTocUpdate();
  }

  document.addEventListener("click", (event) => {
    const trialLink = event.target.closest("[data-trial-row-index]");
    if (trialLink) {
      event.preventDefault();
      state.selectedTrialRowIndex = trialLink.getAttribute("data-trial-row-index") || "";
      state.selectedTrialSource = trialLink.getAttribute("data-trial-source") || "included";
      render();
      requestAnimationFrame(() => {
        document.getElementById("trial-details")?.scrollIntoView({ block: "nearest" });
      });
      return;
    }

    if (state.selectedTrialRowIndex && !event.target.closest("[data-trial-detail]") && !event.target.closest(".review-toc")) {
      state.selectedTrialRowIndex = "";
      state.selectedTrialSource = "included";
      render();
    }
  });

  function render() {
    const reviews = prepareData();
    currentReviews = reviews;
    const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (hashId && reviews.some((review) => review.review_id === hashId)) {
      if (state.selectedReviewId !== hashId) {
        state.reviewTocOpen = true;
      }
      state.view = "review";
      state.selectedReviewId = hashId;
    }

    if (state.view === "review" && state.selectedReviewId && !reviews.some((review) => review.review_id === state.selectedReviewId)) {
      state.selectedReviewId = "";
    }

    app.innerHTML = `
      ${renderSidebar(reviews)}
      ${state.view === "home" ? renderHome(reviews) : renderReview(reviews)}
      ${renderAuditModal()}
      ${renderAuditFindingsReviewModal()}
    `;
    bindEvents(reviews);
  }

  function renderError(error) {
    app.innerHTML = `
      <section class="error-state">
        <h2>Could not load the benchmark data</h2>
        <p>${escapeHtml(error.message || error)}</p>
        <p class="muted">Serve the repository root with a local web server, then open /Cochrane_reviews/audit_site/.</p>
      </section>
    `;
  }

  async function init() {
    try {
      const loaded = await loadBenchmarkData();
      state.files = loaded.files;
      state.rows = loaded.rows;
      loadAuditFindings();
      render();
    } catch (error) {
      renderError(error);
    }
  }

  window.addEventListener("hashchange", () => {
    if (Object.keys(state.files).length) {
      const reviews = prepareData();
      const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (reviews.some((review) => review.review_id === hashId)) {
        render();
      }
    }
  });

  init();
}());
