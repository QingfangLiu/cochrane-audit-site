(function () {
  const SOURCE_FILES = [
    {
      key: "curation",
      label: "Review curation summary",
      path: "../provisional_data/review_curation_summary.tsv",
      required: true,
    },
    {
      key: "reviewIndex",
      label: "Review PubMed/PMC index",
      path: "../review_pubmed_pmc_indexing.csv",
      required: false,
      delimiter: ",",
    },
    {
      key: "protocol",
      label: "Review protocol and eligibility",
      path: "../provisional_data/review_protocol_eligibility.tsv",
      required: true,
    },
    {
      key: "outcomes",
      label: "Outcomes",
      path: "../provisional_data/review_outcomes.tsv",
      required: false,
    },
    {
      key: "summary",
      label: "Review summary",
      path: "../provisional_data/pubmed_pmc_summary.tsv",
      required: true,
    },
    {
      key: "studies",
      label: "Included trials",
      path: "../provisional_data/included_study_indexing.tsv",
      required: true,
    },
    {
      key: "records",
      label: "Matched PubMed records",
      path: "../provisional_data/included_pubmed_records.tsv",
      required: true,
    },
    {
      key: "reports",
      label: "Included report candidates",
      path: "../provisional_data/included_report_indexing.tsv",
      required: false,
    },
    {
      key: "registries",
      label: "Included trial registry records",
      path: "../provisional_data/included_trial_registry_records.tsv",
      required: false,
    },
    {
      key: "excludedStudies",
      label: "Excluded trials",
      path: "../provisional_data/excluded_study_indexing.tsv",
      required: false,
    },
    {
      key: "excludedReports",
      label: "Excluded report candidates",
      path: "../provisional_data/excluded_report_indexing.tsv",
      required: false,
    },
    {
      key: "excludedRecords",
      label: "Excluded PubMed records",
      path: "../provisional_data/excluded_pubmed_records.tsv",
      required: false,
    },
    {
      key: "excludedRegistries",
      label: "Excluded trial registry records",
      path: "../provisional_data/excluded_trial_registry_records.tsv",
      required: false,
    },
    {
      key: "excludedSummary",
      label: "Excluded PubMed summary",
      path: "../provisional_data/excluded_pubmed_summary.tsv",
      required: false,
    },
    {
      key: "analysisCounts",
      label: "Analysis counts",
      path: "../provisional_data/analysis_counts.tsv",
      required: false,
    },
    {
      key: "studyCharacteristics",
      label: "Study characteristics",
      path: "../provisional_data/study_characteristics_first_pass.tsv",
      required: false,
    },
    {
      key: "studyCharacteristicsRaw",
      label: "Study characteristics raw JSON",
      path: "../provisional_data/study_characteristics_first_pass_raw.json",
      required: false,
      format: "json",
    },
    {
      key: "analysisResults",
      label: "Summary of analysis results",
      path: "../provisional_data/analysis_results_first_pass.tsv",
      required: false,
    },
    {
      key: "analysisResultsRaw",
      label: "Summary of analysis results raw JSON",
      path: "../provisional_data/analysis_results_first_pass_raw.json",
      required: false,
      format: "json",
    },
    {
      key: "analysisComparisons",
      label: "Comparisons",
      path: "../provisional_data/analysis_comparisons_first_pass.tsv",
      required: false,
    },
    {
      key: "analysisStudyRows",
      label: "Details of analysis results",
      path: "../provisional_data/analysis_study_rows_first_pass.tsv",
      required: false,
    },
    {
      key: "analysisStudyRowsRaw",
      label: "Details of analysis results raw JSON",
      path: "../provisional_data/analysis_study_rows_first_pass_raw.json",
      required: false,
      format: "json",
    },
    {
      key: "analysisReproducedResults",
      label: "Reproduced meta-analysis results",
      path: "../provisional_data/analysis_reproduced_results_first_pass.tsv",
      required: false,
    },
    {
      key: "analysisReproducedForestPlots",
      label: "Reproduced forest plot payloads",
      path: "../provisional_data/analysis_reproduced_forest_plots_first_pass.json",
      required: false,
      format: "json",
    },
    {
      key: "domainSources",
      label: "Domain source metadata",
      path: "../provisional_data/review_domain_source_raw.json",
      required: false,
      format: "json",
    },
    {
      key: "domainLabels",
      label: "AI domain labels",
      path: "../provisional_data/review_domain_labels_ai.json",
      required: false,
      format: "json",
    },
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

  const app = document.getElementById("app");
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

  function analysisResultId(analysisId) {
    return `analysis-result-${fragmentPart(analysisId)}`;
  }

  function analysisComparisonId(comparisonId) {
    return `analysis-comparison-${fragmentPart(comparisonId)}`;
  }

  function sentenceCaseId(value) {
    return String(value || "")
      .replace(/^CD\d+_?/, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function reviewTitle(row) {
    return sentenceCaseId(row.review_id || row.review_pdf || "Review");
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

  async function loadSource(file) {
    const response = await fetch(file.path, { cache: "no-store" });
    if (!response.ok) {
      if (file.required) {
        throw new Error(`Could not load ${file.path}: HTTP ${response.status}`);
      }
      return { ...file, loaded: false, rows: [], bytes: 0, hash: "" };
    }

    const text = await response.text();
    const data = file.format === "json" ? JSON.parse(text) : null;
    const rows = file.format === "json"
      ? (Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : (Array.isArray(data?.reviews) ? data.reviews : [])))
      : parseDelimited(text, file.delimiter || "\t");
    const hash = await sha256(text);
    return {
      ...file,
      loaded: true,
      rows,
      data,
      bytes: text.length,
      hash,
    };
  }

  function keyForRecord(row) {
    return `${row.review_id || ""}|||${row.study_label || ""}`;
  }

  function prepareData() {
    const summary = state.rows.summary || [];
    const curationRows = state.rows.curation || [];
    const reviewIndexRows = state.rows.reviewIndex || [];
    const protocolRows = state.rows.protocol || [];
    const outcomeRows = state.rows.outcomes || [];
    const studies = state.rows.studies || [];
    const records = state.rows.records || [];
    const reports = state.rows.reports || [];
    const registries = state.rows.registries || [];
    const excludedStudies = state.rows.excludedStudies || [];
    const excludedReports = state.rows.excludedReports || [];
    const excludedRecords = state.rows.excludedRecords || [];
    const excludedRegistries = state.rows.excludedRegistries || [];
    const excludedSummary = state.rows.excludedSummary || [];
    const analysisCounts = state.rows.analysisCounts || [];
    const studyCharacteristics = state.rows.studyCharacteristics || [];
    const studyCharacteristicsRaw = state.rows.studyCharacteristicsRaw || [];
    const analysisResults = state.rows.analysisResults || [];
    const analysisResultsRaw = state.rows.analysisResultsRaw || [];
    const analysisComparisons = state.rows.analysisComparisons || [];
    const analysisStudyRows = state.rows.analysisStudyRows || [];
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

    const excludedSummaryByReview = new Map();
    excludedSummary.forEach((row) => {
      if (row.review_id) {
        excludedSummaryByReview.set(row.review_id, row);
      }
    });

    const analysisByReview = new Map();
    analysisCounts.forEach((row) => {
      analysisByReview.set(row.review_id || row.pdf_stem || reviewIdFromPath(row.pdf), row);
    });

    const studyCharacteristicsRawByKey = new Map();
    studyCharacteristicsRaw.forEach((row) => {
      studyCharacteristicsRawByKey.set(`${row.review_id || ""}|||${row.study_label || ""}`, row);
    });

    const studyCharacteristicsByReview = new Map();
    studyCharacteristics.forEach((row, index) => {
      const reviewId = row.review_id || "";
      if (!studyCharacteristicsByReview.has(reviewId)) {
        studyCharacteristicsByReview.set(reviewId, []);
      }
      studyCharacteristicsByReview.get(reviewId).push({
        ...row,
        _rowIndex: index + 1,
        _rawJson: studyCharacteristicsRawByKey.get(`${reviewId}|||${row.study_label || ""}`) || null,
      });
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

    const analysisComparisonsByReview = new Map();
    const analysisComparisonByKey = new Map();
    analysisComparisons.forEach((row, index) => {
      const reviewId = row.review_id || "";
      if (!analysisComparisonsByReview.has(reviewId)) {
        analysisComparisonsByReview.set(reviewId, []);
      }
      const withIndex = { ...row, _rowIndex: index + 1 };
      analysisComparisonsByReview.get(reviewId).push(withIndex);
      analysisComparisonByKey.set(`${reviewId}|||${row.comparison_id || ""}`, withIndex);
    });

    const analysisStudyRowsByReview = new Map();
    const analysisStudyRowsByAnalysis = new Map();
    analysisStudyRows.forEach((row, index) => {
      const reviewId = row.review_id || "";
      const withIndex = { ...row, _rowIndex: index + 1 };
      if (!analysisStudyRowsByReview.has(reviewId)) {
        analysisStudyRowsByReview.set(reviewId, []);
      }
      analysisStudyRowsByReview.get(reviewId).push(withIndex);
      const key = `${reviewId}|||${row.analysis_id || ""}`;
      if (!analysisStudyRowsByAnalysis.has(key)) {
        analysisStudyRowsByAnalysis.set(key, []);
      }
      analysisStudyRowsByAnalysis.get(key).push(withIndex);
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

    analysisResultsByReview.forEach((analysisRows) => {
      analysisRows.forEach((analysisRow) => {
        analysisRow._comparisonMeta = analysisComparisonByKey.get(
          `${analysisRow.review_id || ""}|||${String(analysisRow.analysis_id || "").split(".")[0]}`,
        ) || {};
        analysisRow._studyRows = analysisStudyRowsByAnalysis.get(`${analysisRow.review_id || ""}|||${analysisRow.analysis_id || ""}`) || [];
      });
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

    const outcomesByReview = new Map();
    outcomeRows.forEach((row, index) => {
      const reviewId = row.review_id || "";
      if (!reviewId) {
        return;
      }
      if (!outcomesByReview.has(reviewId)) {
        outcomesByReview.set(reviewId, []);
      }
      outcomesByReview.get(reviewId).push({
        ...row,
        _rowIndex: index + 1,
      });
    });
    outcomesByReview.forEach((rows) => {
      rows.sort((left, right) => (
        asNumber(left.section_order) - asNumber(right.section_order)
        || asNumber(left.outcome_order) - asNumber(right.outcome_order)
        || left._rowIndex - right._rowIndex
      ));
    });
    analysisResultsByReview.forEach((analysisRows, reviewId) => {
      const plannedRows = outcomesByReview.get(reviewId) || [];
      analysisRows.forEach((analysisRow) => {
        analysisRow._plannedOutcomeMatches = plannedRows.filter((plannedRow) => (
          splitCell(plannedRow.matched_analysis_ids).includes(analysisRow.analysis_id)
        ));
      });
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

    return summary
      .map((review, index) => {
        const curation = curationByReview.get(review.review_id) || {};
        const domainSource = domainSourceByReview.get(review.review_id) || {};
        const reviewIndex = reviewIndexByPdfStem.get(reviewIdFromPath(review.review_pdf)) || {};
        return {
          ...review,
          _rowIndex: index + 1,
          _title: raw(curation.review_title) || raw(domainSource.review_title) || reviewTitle(review),
          _studies: studiesByReview.get(review.review_id) || [],
          _excludedStudies: excludedStudiesByReview.get(review.review_id) || [],
          _excludedSummary: excludedSummaryByReview.get(review.review_id) || {},
          _analysis: analysisByReview.get(review.review_id) || {},
          _studyCharacteristics: studyCharacteristicsByReview.get(review.review_id) || [],
          _analysisResults: analysisResultsByReview.get(review.review_id) || [],
          _analysisComparisons: analysisComparisonsByReview.get(review.review_id) || [],
          _analysisStudyRows: analysisStudyRowsByReview.get(review.review_id) || [],
          _analysisReproducedResults: analysisReproducedByReview.get(review.review_id) || [],
          _curation: curation,
          _reviewIndex: reviewIndex,
          _protocol: protocolByReview.get(review.review_id) || {},
          _outcomes: outcomesByReview.get(review.review_id) || [],
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
    return [
      { label: "Open PDF", href: reviewPdfHref(review) },
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
            <p class="muted">Per-review counts from provisional_data/included_study_indexing.tsv.</p>
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
            <p class="muted">AI-derived clinical domains from provisional_data/review_domain_labels_ai.json; unverified until manual audit.</p>
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

  function reviewTocItems() {
    return [
      { label: "Review header", href: "#review-header" },
      { label: "Data contents", href: "#data-contents" },
      { label: "Review curation summary", href: "#review-curation-summary" },
      { label: "Protocol and eligibility", href: "#protocol-eligibility" },
      { label: "References", href: "#trials" },
      { label: "Included trials", href: "#included-trials", branch: true },
      { label: "Excluded trials", href: "#excluded-trials", branch: true },
      { label: "Outcomes", href: "#review-outcomes" },
      { label: "Comparisons", href: "#analysis-comparisons" },
      { label: "Analysis quick check", href: "#analysis-count-scan" },
      { label: "Summary of analysis results", href: "#analysis-results", branch: true },
      { label: "Details of analysis results", href: "#analysis-study-rows", branch: true },
      { label: "Reproduced meta-analysis", href: "#reproduced-meta-analysis", branch: true },
      { label: "Study characteristics", href: "#study-characteristics" },
      { label: "Risk of bias", href: "#risk-of-bias" },
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
          ${reviewTocItems().map((item) => `
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
        <div class="sidebar-section">
          <div class="review-list">
            ${reviews.map((review) => `
              <button class="review-button${state.view === "review" && review.review_id === state.selectedReviewId ? " active" : ""}" type="button" data-review-id="${escapeHtml(review.review_id)}">
                <span class="review-title">${escapeHtml(review._title)}</span>
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
    return `
      <section class="panel review-header" id="review-header">
        <div>
          <h2>${escapeHtml(review._title)}</h2>
        </div>
        ${renderReviewSourceActions(review, "review-header-actions")}
      </section>
    `;
  }

  function renderCurationField(label, value, wide = false) {
    return `
      <div class="curation-field${wide ? " wide" : ""}">
        <div class="field-label">${escapeHtml(label)}</div>
        <div class="field-value">${display(value)}</div>
      </div>
    `;
  }

  function renderReviewCurationPanel(review) {
    const curation = review._curation || {};
    const domainSource = review._domainSource || {};
    const domainLabel = review._domainLabel || {};
    const editorialGroup = raw(domainSource.cochrane_editorial_group?.value);
    const objective = raw(domainSource.objective?.value);
    const meshTerms = Array.isArray(domainSource.index_terms?.mesh_terms)
      ? domainSource.index_terms.mesh_terms.join("; ")
      : raw(domainSource.index_terms?.mesh_terms_raw);
    const meshCheckWords = Array.isArray(domainSource.index_terms?.mesh_check_words)
      ? domainSource.index_terms.mesh_check_words.join("; ")
      : raw(domainSource.index_terms?.mesh_check_words_raw);
    const extractionWarnings = Array.isArray(domainSource.extraction_warnings)
      ? domainSource.extraction_warnings.join("; ")
      : raw(domainSource.extraction_warnings);

    if (!raw(curation.review_id)) {
      return `
        <section class="panel curation-panel" id="review-curation-summary">
          <div class="section-head">
            <div>
              <h2>Review Curation Summary</h2>
              <p class="muted">No matching row was loaded from provisional_data/review_curation_summary.tsv for this review.</p>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="panel curation-panel" id="review-curation-summary">
        <div class="section-head">
          <div>
            <h2>Review Curation Summary</h2>
            <p class="muted">Rendered from review curation TSV plus domain source/label JSON. Clinical-domain labels are AI-generated from Cochrane metadata and should be audited before benchmark use.</p>
          </div>
          <div class="muted">${display(curation.pdf_status, "No PDF status")}</div>
        </div>
        <div class="curation-grid">
          ${renderCurationField("Clinical domain (AI)", domainLabel.clinical_domain)}
          ${renderCurationField("Domain confidence", domainLabel.confidence)}
          ${renderCurationField("Domain rationale", domainLabel.domain_rationale, true)}
          ${renderCurationField("Cochrane editorial group", editorialGroup, true)}
          ${renderCurationField("MeSH terms", meshTerms, true)}
          ${renderCurationField("MeSH check words", meshCheckWords, true)}
          ${renderCurationField("Detailed domain", curation.domain)}
          ${renderCurationField("Published", curation.published_issue)}
          ${raw(objective) ? renderCurationField("Objective source text", objective, true) : ""}
          ${raw(extractionWarnings) ? renderCurationField("Domain extraction warnings", extractionWarnings, true) : ""}
          ${renderCurationField("Studies", curation.studies_summary)}
          ${renderCurationField("Reports / refs", curation.reports_refs_summary)}
          ${renderCurationField("Comparisons", curation.comparisons, true)}
          ${renderCurationField("Outcomes", curation.outcomes, true)}
          ${renderCurationField("Timepoint burden", curation.timepoint_burden, true)}
          ${renderCurationField("Curation notes", curation.curation_notes, true)}
          ${raw(curation.manual_status) ? renderCurationField("Manual status", curation.manual_status) : ""}
          ${raw(curation.manual_audit_notes) ? renderCurationField("Manual audit notes", curation.manual_audit_notes, true) : ""}
        </div>
      </section>
    `;
  }

  function curationFieldCount(curation) {
    return [
      "domain",
      "published_issue",
      "studies_summary",
      "reports_refs_summary",
      "comparisons",
      "outcomes",
      "timepoint_burden",
      "curation_notes",
    ].filter((field) => raw(curation[field])).length;
  }

  function protocolFieldCount(protocol) {
    return [
      "research_question",
      "review_objective",
      "population",
      "intervention",
      "eligibility_study_designs",
      "eligibility_setting",
      "eligibility_inclusion_criteria",
      "eligibility_exclusion_criteria",
      "protocol_notes",
    ].filter((field) => raw(protocol[field])).length;
  }

  function renderDataContents(review) {
    const curation = review._curation || {};
    const protocol = review._protocol || {};
    const domainSource = review._domainSource || {};
    const domainLabel = review._domainLabel || {};
    const outcomes = review._outcomes || [];
    const studies = review._studies || [];
    const excludedStudies = review._excludedStudies || [];
    const excludedSummary = review._excludedSummary || {};
    const analysis = review._analysis || {};
    const studyCharacteristics = review._studyCharacteristics || [];
    const analysisResults = review._analysisResults || [];
    const analysisComparisons = review._analysisComparisons || [];
    const analysisStudyRows = review._analysisStudyRows || [];
    const analysisReproducedResults = review._analysisReproducedResults || [];
    const pubmedRecords = studies.reduce((sum, study) => sum + (study._records || []).length, 0);
    const reportCandidates = studies.reduce((sum, study) => sum + (study._reports || []).length, 0);
    const nctRecords = studies.reduce((sum, study) => sum + (study._registries || []).length, 0);
    const matchedReportCandidates = studies.reduce(
      (sum, study) => sum + (study._reports || []).filter((report) => isYes(report.has_pubmed)).length,
      0,
    );
    const curationFields = curationFieldCount(curation);
    const protocolFields = protocolFieldCount(protocol);
    const pubmedTrials = studies.filter((study) => isYes(study.has_pubmed)).length;
    const pmcTrials = studies.filter((study) => isYes(study.has_pmc)).length;
    const needsAttention = studies.filter(needsReview).length;
    const excludedPubmedTrials = excludedStudies.filter((study) => isYes(study.has_pubmed)).length;
    const excludedPmcTrials = excludedStudies.filter((study) => isYes(study.has_pmc)).length;
    const characteristicStatusCounts = countBy(studyCharacteristics, "characteristics_status");
    const analysisStatusCounts = countBy(analysisResults, "extraction_status");
    const analysisStudyRowStatusCounts = countBy(analysisStudyRows, "row_extraction_status");
    const reproducedStatusCounts = countBy(analysisReproducedResults, "reported_match_status");
    const outcomeStatusCounts = countBy(outcomes, "extraction_status");
    const domainSourceFields = [
      domainSource.cochrane_editorial_group?.value,
      domainSource.objective?.value,
      Array.isArray(domainSource.index_terms?.mesh_terms) && domainSource.index_terms.mesh_terms.length ? "mesh_terms" : "",
    ].filter((field) => raw(field)).length;

    const rows = [
      {
        section: "Review curation summary",
        href: "#review-curation-summary",
        source: "provisional_data/review_curation_summary.tsv",
        availability: raw(curation.review_id) ? `${curationFields}/8 fields populated` : "Missing",
        notes: "Detailed domain, publication issue, studies, reports, comparisons, outcomes, timepoint burden, notes",
      },
      {
        section: "Clinical domain source",
        href: "#review-curation-summary",
        source: "provisional_data/review_domain_source_raw.json + provisional_data/review_domain_labels_ai.json",
        availability: raw(domainLabel.clinical_domain) ? `${raw(domainLabel.clinical_domain)} label; ${domainSourceFields}/3 raw sources` : "Missing",
        notes: "AI label plus raw editorial group, objective, and MeSH/index terms extracted from the PDF",
      },
      {
        section: "Protocol and eligibility",
        href: "#protocol-eligibility",
        source: "provisional_data/review_protocol_eligibility.tsv",
        availability: raw(protocol.review_id) ? `${protocolFields}/9 displayed fields populated` : "Missing",
        notes: "Research question, objective, population and intervention criteria, study designs, inclusion/exclusion criteria",
      },
      {
        section: "References",
        href: "#trials",
        source: "provisional_data/included_study_indexing.tsv + provisional_data/excluded_study_indexing.tsv",
        availability: `${studies.length} included trials; ${excludedStudies.length} excluded trials`,
        notes: "Parent section for included and excluded Cochrane trial audits",
      },
      {
        section: "Included trials",
        href: "#included-trials",
        source: "provisional_data/included_study_indexing.tsv + provisional_data/included_trial_registry_records.tsv",
        availability: `${studies.length} trials`,
        notes: `${pubmedTrials} with PMID; ${pmcTrials} with PMCID; ${nctRecords} registry records; ${needsAttention} needing attention`,
      },
      {
        section: "Excluded trials",
        href: "#excluded-trials",
        source: "provisional_data/excluded_study_indexing.tsv + provisional_data/excluded_report_indexing.tsv + provisional_data/excluded_pubmed_records.tsv + provisional_data/excluded_trial_registry_records.tsv",
        availability: excludedStudies.length
          ? `${excludedStudies.length} trials; ${excludedPubmedTrials} with PMID; ${excludedPmcTrials} with PMCID`
          : "No excluded-trial rows for this review",
        notes: raw(excludedSummary.unique_pmids)
          ? `${raw(excludedSummary.unique_pmids)} unique excluded PMIDs; used only as audit/evaluation ground truth`
          : "Cochrane References to studies excluded from this review, when extracted",
      },
      {
        section: "Detailed citation cards",
        href: "#trial-details",
        source: "provisional_data/included_study_indexing.tsv + provisional_data/excluded_study_indexing.tsv + report, PubMed, and registry detail TSVs",
        availability: state.selectedTrialRowIndex ? "One selected trial shown" : "Hidden until a checklist link is clicked",
        notes: `${reportCandidates} report candidates; ${matchedReportCandidates} with PMID; ${pubmedRecords} matched PubMed record rows`,
      },
      {
        section: "Outcomes",
        href: "#review-outcomes",
        source: "provisional_data/review_outcomes.tsv",
        availability: outcomes.length
          ? `${outcomes.length} rows; ${statusSummary(outcomeStatusCounts)}`
          : "No outcome rows loaded",
        notes: "Planned/review-level outcome extraction; mapping columns link to saved analysis-result rows when heuristic matches exist",
      },
      {
        section: "Comparisons",
        href: "#analysis-comparisons",
        source: "provisional_data/analysis_comparisons_first_pass.tsv",
        availability: analysisComparisons.length ? `${analysisComparisons.length} comparison rows` : "No rows for this review",
        notes: "Comparison family, sensitivity/subgroup role, parent comparison, and intervention/comparator parsing",
      },
      {
        section: "Analysis quick check",
        href: "#analysis-count-scan",
        source: "provisional_data/analysis_counts.tsv",
        availability: raw(analysis.analysis_count) ? `${analysis.analysis_count} analyses` : "Missing",
        notes: raw(analysis.analysis_count)
          ? `${raw(analysis.estimable_analysis_count) || "0"} estimable; ${raw(analysis.uncertain_analysis_count) || "0"} uncertain; ${raw(analysis.not_estimable_analysis_count) || "0"} not estimable`
          : "No matching analysis-count row loaded",
      },
      {
        section: "Summary of analysis results",
        href: "#analysis-results",
        source: "provisional_data/analysis_results_first_pass.tsv + raw JSON",
        availability: analysisResults.length
          ? `${analysisResults.length} analyses; ${statusSummary(analysisStatusCounts)}`
          : "No rows for this review",
        notes: "Overall CI is filled only when a Total (95% CI) row is detected; first-pass reviews only for now",
      },
      {
        section: "Details of analysis results",
        href: "#analysis-study-rows",
        source: "provisional_data/analysis_study_rows_first_pass.tsv",
        availability: analysisStudyRows.length
          ? `${analysisStudyRows.length} study rows; ${statusSummary(analysisStudyRowStatusCounts)}`
          : "No rows for this review",
        notes: "Trial rows, per-arm data, weights, study-level effect estimates, and PMID/PMCID coverage",
      },
      {
        section: "Reproduced meta-analysis",
        href: "#reproduced-meta-analysis",
        source: "provisional_data/analysis_reproduced_results_first_pass.tsv + forest-plot JSON",
        availability: analysisReproducedResults.length
          ? `${analysisReproducedResults.length} subset rows; ${statusSummary(reproducedStatusCounts)}`
          : "No reproduced rows for this review",
        notes: "CI-derived inverse-variance reproduction for all studies and PMCID-only subsets; first-pass reviews only for now",
      },
      {
        section: "Study characteristics",
        href: "#study-characteristics",
        source: "provisional_data/study_characteristics_first_pass.tsv + raw JSON",
        availability: studyCharacteristics.length
          ? `${studyCharacteristics.length} rows; ${statusSummary(characteristicStatusCounts)}`
          : "No rows for this review",
        notes: "Provisional Cochrane characteristics-table extraction; first-pass reviews only for now",
      },
      {
        section: "Risk of bias",
        href: "#risk-of-bias",
        source: "not extracted yet",
        availability: "Placeholder",
        notes: "Reserved for Cochrane risk-of-bias judgements and domain-level support once the audit extractor is added",
      },
    ];

    return `
      <section class="panel contents-panel" id="data-contents">
        <div class="section-head">
          <div>
            <h2>Data Contents</h2>
            <p class="muted">Per-review map of the data currently available in this audit page.</p>
          </div>
        </div>
        <div class="record-table-wrap contents-table">
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Available data</th>
                <th>What to check</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td title="Source data: ${escapeHtml(row.source)}">
                    <a href="${escapeHtml(row.href)}" aria-label="${escapeHtml(`${row.section}. Source data: ${row.source}`)}">${escapeHtml(row.section)}</a>
                  </td>
                  <td>${escapeHtml(row.availability)}</td>
                  <td>${escapeHtml(row.notes)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
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
              <p class="muted">No matching row was loaded from provisional_data/review_protocol_eligibility.tsv for this review.</p>
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
            <p class="muted">Rendered from provisional_data/review_protocol_eligibility.tsv. AI-prefilled values are marked unverified and should be checked against the full-text review.</p>
          </div>
          <div class="muted">${display(protocol.pdf_status, "No PDF status")}</div>
        </div>
        <div class="curation-grid">
          ${renderCurationField("Research question", protocol.research_question, true)}
          ${renderCurationField("Review objective", protocol.review_objective, true)}
          ${renderCurationField("Population", protocol.population, true)}
          ${renderCurationField("Intervention", protocol.intervention, true)}
          ${renderCurationField("Study designs", protocol.eligibility_study_designs)}
          ${renderCurationField("Setting", protocol.eligibility_setting)}
          ${renderCurationField("Inclusion criteria", protocol.eligibility_inclusion_criteria, true)}
          ${renderCurationField("Exclusion criteria", protocol.eligibility_exclusion_criteria, true)}
          ${renderCurationField("Protocol notes", protocol.protocol_notes, true)}
          ${raw(protocol.manual_status) ? renderCurationField("Manual status", protocol.manual_status) : ""}
          ${raw(protocol.manual_audit_notes) ? renderCurationField("Manual audit notes", protocol.manual_audit_notes, true) : ""}
        </div>
      </section>
    `;
  }

  function groupOutcomeRows(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const section = raw(row.outcome_section) || "Outcomes";
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section).push(row);
    });

    return Array.from(grouped.entries()).sort((left, right) => {
      const leftOrder = asNumber(left[1][0]?.section_order);
      const rightOrder = asNumber(right[1][0]?.section_order);
      return leftOrder - rightOrder || left[0].localeCompare(right[0]);
    });
  }

  function renderOutcomeAnalysisMapping(row) {
    const analysisIds = splitCell(row.matched_analysis_ids);
    const analysisOutcomes = splitCell(row.matched_analysis_outcomes);
    if (analysisIds.length) {
      return `
        <div class="outcome-map">
          <strong>Mapped saved analysis rows:</strong>
          ${analysisIds.map((id) => `<a href="#${analysisResultId(id)}">${escapeHtml(id)}</a>`).join(", ")}
          ${analysisOutcomes.length ? `<div class="muted">Analysis outcome labels: ${escapeHtml(analysisOutcomes.join("; "))}</div>` : ""}
        </div>
      `;
    }

    const status = raw(row.analysis_mapping_status);
    let message = "No saved analysis-result outcome label was automatically matched to this planned outcome.";
    if (status === "analysis_results_not_available") {
      message = "No saved analysis-result rows are available for this review.";
    }

    return `
      <div class="outcome-map muted">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function renderReviewOutcomesPanel(review) {
    const rows = review._outcomes || [];
    const statusCounts = countBy(rows, "extraction_status");
    return `
      <section class="panel outcomes-panel" id="review-outcomes">
        <div class="section-head">
          <div>
            <h2>Outcomes</h2>
            <p class="muted">Rendered from provisional_data/review_outcomes.tsv. These are planned/review-level outcomes from the PDF Types of outcome measures section; actual meta-analyzed outcomes must be checked against Summary of analysis results.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} rows; ${escapeHtml(statusSummary(statusCounts))}` : "No rows"}</div>
        </div>
        <div class="excerpt">
          <strong>Scope note:</strong> Outcome rows here are planned or review-level outcomes. The mapping fields show whether the saved analysis-result extraction currently contains a matching meta-analysis outcome label.
        </div>
        ${rows.length ? `
          <div class="outcome-section-list">
            ${groupOutcomeRows(rows).map(([section, sectionRows]) => `
              <section class="outcome-section">
                <h3>${escapeHtml(section)}</h3>
                <ol>
                  ${sectionRows.map((row) => `
                    <li id="planned-outcome-${escapeHtml(row._rowIndex)}">
                      <div>${display(raw(row.outcome_name) || raw(row.outcome_text_raw), "No outcome text")}</div>
                      ${renderOutcomeAnalysisMapping(row)}
                    </li>
                  `).join("")}
                </ol>
              </section>
            `).join("")}
          </div>
        ` : `<p class="muted excerpt">No review-outcome rows were loaded for this review.</p>`}
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

  function renderStudyCharacteristicsPanel(review) {
    const rows = review._studyCharacteristics || [];
    return `
      <section class="panel study-characteristics-panel collapsed-panel" id="study-characteristics">
        <details>
          <summary class="section-head">
            <div>
              <h2>Study Characteristics</h2>
              <p class="muted">Rendered from provisional_data/study_characteristics_first_pass.tsv. These are provisional PDF-table extractions for first-pass reviews only.</p>
            </div>
            <div class="muted">${rows.length ? `${rows.length} rows` : "No rows"}</div>
          </summary>
          ${rows.length ? `
            <div class="record-table-wrap study-characteristics-table">
              <table>
                <thead>
                  <tr>
                    <th>Trial</th>
                    <th>Status</th>
                    <th>Design / methods</th>
                    <th>Population</th>
                    <th>Interventions</th>
                    <th>Notes / reason</th>
                    <th>Raw row</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td>
                        <strong>${escapeHtml(row.study_label || "Unnamed study")}</strong>
                        <div class="muted">row ${escapeHtml(row._rowIndex)}</div>
                      </td>
                      <td><span class="status-chip ${sourceStatusClass(row.characteristics_status)}">${display(row.characteristics_status, "none")}</span></td>
                      <td>${display(raw(row.study_design) || raw(row.methods_text))}</td>
                      <td>${display(raw(row.population_description) || raw(row.participants_text))}</td>
                      <td>${display(raw(row.interventions_text) || raw(row.intervention_groups_json))}</td>
                      <td>${display(raw(row.non_extraction_reason) || raw(row.parse_warnings) || raw(row.notes))}</td>
                      <td>${renderRawRows(row)}${renderRawJson(row._rawJson)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<p class="muted excerpt">No study-characteristics rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
        </details>
      </section>
      `;
    }

  function renderRiskOfBiasPlaceholderPanel() {
    return `
      <section class="panel risk-of-bias-panel" id="risk-of-bias">
        <div class="section-head">
          <div>
            <h2>Risk of bias</h2>
            <p class="muted">Placeholder for a future Cochrane risk-of-bias audit component.</p>
          </div>
          <div class="muted">Not extracted yet</div>
        </div>
        <div class="excerpt">
          This section is reserved for study-level and domain-level risk-of-bias judgements from the Cochrane review. No RoB source artifact is currently loaded for this audit page.
        </div>
      </section>
    `;
  }

  function renderPlannedOutcomeMatches(row) {
    const matches = row._plannedOutcomeMatches || [];
    if (!matches.length) {
      return `<span class="muted">No mapped planned outcome in review_outcomes.tsv</span>`;
    }

    return `
      <div class="planned-match-list">
        ${matches.map((match) => `
          <div>
            <a href="#planned-outcome-${escapeHtml(match._rowIndex)}">${display(match.outcome_name || match.outcome_text_raw, "Unnamed planned outcome")}</a>
            <div class="muted">${display(match.outcome_section, "Outcome section")} row ${escapeHtml(match._rowIndex)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function roleLabel(value) {
    return sentenceCaseId(value || "unclear");
  }

  function comparisonRoleClass(value) {
    const role = raw(value).toLowerCase();
    if (role === "main_comparison") {
      return "role-main";
    }
    if (role === "sensitivity_analysis" || role === "subgroup_variant" || role === "alternative_model") {
      return "role-derived";
    }
    return "role-unclear";
  }

  function renderComparisonRoleChip(value) {
    return `<span class="status-chip role-chip ${comparisonRoleClass(value)}">${escapeHtml(roleLabel(value))}</span>`;
  }

  function renderComparisonLink(row) {
    const comparisonId = raw(row.comparison_id) || raw(row.analysis_id).split(".")[0];
    if (!comparisonId || !row._comparisonMeta?.comparison_id) {
      return `<span class="muted">No comparison row</span>`;
    }
    const roleValue = row._comparisonMeta.comparison_role;
    const parentId = raw(row._comparisonMeta.parent_comparison_id);
    return `
      <div class="comparison-link">
        <a href="#${analysisComparisonId(comparisonId)}">Comparison ${escapeHtml(comparisonId)}</a>
        ${renderComparisonRoleChip(roleValue)}
        ${parentId ? `<div class="muted">Parent: <a href="#${analysisComparisonId(parentId)}">Comparison ${escapeHtml(parentId)}</a></div>` : ""}
      </div>
    `;
  }

  function renderAnalysisLinks(values) {
    const ids = splitCell(values);
    if (!ids.length) {
      return display(values);
    }
    return ids.map((id) => `<a href="#${analysisResultId(id)}">${escapeHtml(id)}</a>`).join(", ");
  }

  function renderAnalysisComparisonsPanel(review) {
    const rows = review._analysisComparisons || [];
    const comparisonLabel = (row) => {
      const clean = raw(row.comparison_label_clean);
      const original = raw(row.comparison_label_raw);
      const canonical = raw(row.comparison_label_canonical);
      const primary = clean || original;
      const details = [];
      if (canonical && canonical.toLowerCase() !== primary.toLowerCase()) {
        details.push(`Canonical: ${escapeHtml(canonical)}`);
      }
      if (original && primary && original !== primary) {
        details.push(`Raw: ${escapeHtml(original)}`);
      }
      return `
        <div>${display(primary)}</div>
        ${details.length ? `<div class="muted">${details.join("<br>")}</div>` : ""}
      `;
    };
    return `
      <section class="panel analysis-comparisons-panel" id="analysis-comparisons">
        <div class="section-head">
          <div>
            <h2>Comparisons</h2>
            <p class="muted">Rendered from provisional_data/analysis_comparisons_first_pass.tsv. Roles and parent links are automatic and unverified.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} rows` : "No rows"}</div>
        </div>
        ${rows.length ? `
          <div class="record-table-wrap analysis-comparisons-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Role</th>
                  <th>Parent</th>
                  <th>Comparison</th>
                  <th>Intervention</th>
                  <th>Comparator</th>
                  <th>Analyses</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr id="${analysisComparisonId(row.comparison_id)}">
                    <td><strong>${display(row.comparison_id)}</strong></td>
                    <td>${renderComparisonRoleChip(row.comparison_role)}</td>
                    <td>${display(row.parent_comparison_id)}</td>
                    <td>${comparisonLabel(row)}</td>
                    <td>${display(row.intervention)}</td>
                    <td>${display(row.comparator)}</td>
                    <td>${renderAnalysisLinks(row.analysis_ids)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted excerpt">No analysis-comparison rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
      </section>
    `;
  }

  function renderStudyRowCount(row) {
    const studyRows = row._studyRows || [];
    if (!studyRows.length) {
      return `<span class="muted">No study rows</span>`;
    }
    const noPmc = studyRows.filter((studyRow) => raw(studyRow.study_has_pmc) === "no").length;
    const partial = studyRows.filter((studyRow) => raw(studyRow.row_extraction_status) !== "extracted").length;
    const parts = [`${studyRows.length} rows`];
    if (noPmc) {
      parts.push(`${noPmc} without PMCID`);
    }
    if (partial) {
      parts.push(`${partial} partial`);
    }
    return `<a href="#analysis-study-rows-${escapeHtml(row.analysis_id || "")}">${escapeHtml(parts.join("; "))}</a>`;
  }

  function renderAnalysisResultsPanel(review) {
    const rows = review._analysisResults || [];
    return `
      <section class="panel analysis-results-panel" id="analysis-results">
        <div class="section-head">
          <div>
            <h2>Summary of analysis results</h2>
            <p class="muted">Rendered from provisional_data/analysis_results_first_pass.tsv. Planned-outcome matches come from mapping columns in provisional_data/review_outcomes.tsv.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} rows` : "No rows"}</div>
        </div>
        ${rows.length ? `
          <div class="record-table-wrap analysis-results-table">
            <table>
              <thead>
                <tr>
                  <th>Analysis</th>
                  <th>Comparison</th>
                  <th>Outcome</th>
                  <th>Planned outcome match</th>
                  <th>Measure</th>
                  <th>Study rows</th>
                  <th>Status</th>
                  <th>Overall CI</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => {
                  const overall = raw(row.overall_effect)
                    ? `${row.overall_effect} [${row.ci_lower}, ${row.ci_upper}]`
                    : "";
                  return `
                    <tr id="${analysisResultId(row.analysis_id)}">
                      <td>
                        <strong>${escapeHtml(row.analysis_id || "Analysis")}</strong>
                        <div>${display(raw(row.comparison) || raw(row.analysis_title))}</div>
                      </td>
                      <td>${renderComparisonLink(row)}</td>
                      <td>${display(raw(row.outcome) || raw(row.analysis_title))}</td>
                      <td>${renderPlannedOutcomeMatches(row)}</td>
                      <td>${display(row.effect_measure)}</td>
                      <td>${renderStudyRowCount(row)}</td>
                      <td><span class="status-chip ${sourceStatusClass(row.extraction_status)}">${display(row.extraction_status, "none")}</span></td>
                      <td>${display(overall)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<p class="muted excerpt">No analysis-result rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
      </section>
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
            <h2>Reproduced Meta-Analysis</h2>
            <p class="muted">Rendered from provisional_data/analysis_reproduced_results_first_pass.tsv and analysis_reproduced_forest_plots_first_pass.json. Totals use CI-derived inverse-variance pooling from extracted study-level effects.</p>
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
        <div>${display(row.arm1_label)}: ${display(row.arm1_events)}/${display(row.arm1_total)}</div>
        <div>${display(row.arm2_label)}: ${display(row.arm2_events)}/${display(row.arm2_total)}</div>
      `;
    }
    if (row.data_type === "continuous") {
      return `
        <div>${display(row.arm1_label)}: mean ${display(row.arm1_mean)}, SD ${display(row.arm1_sd)}, n ${display(row.arm1_total)}</div>
        <div>${display(row.arm2_label)}: mean ${display(row.arm2_mean)}, SD ${display(row.arm2_sd)}, n ${display(row.arm2_total)}</div>
      `;
    }
    return `<span class="muted">${display(row.data_type, "No data type")}</span>`;
  }

  function renderStudyEffect(row) {
    const effect = raw(row.effect) ? `${row.effect} [${row.ci_lower}, ${row.ci_upper}]` : "";
    return `
      <div>${display(effect)}</div>
      <div class="muted">weight ${display(row.weight)}${raw(row.weight) ? "%" : ""}; ${display(row.row_result_status)}</div>
    `;
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

  function analysisSummaryForStudyRows(analysisRows) {
    const first = analysisRows[0] || {};
    const withPmc = analysisRows.filter((row) => raw(row.study_has_pmc) === "yes").length;
    const noPmc = analysisRows.filter((row) => raw(row.study_has_pmc) === "no").length;
    const partial = analysisRows.filter((row) => raw(row.row_extraction_status) !== "extracted").length;
    const bits = [`${analysisRows.length} study rows`];
    bits.push(`${withPmc} with PMCID`);
    bits.push(`${noPmc} without PMCID`);
    if (partial) {
      bits.push(`${partial} partial/not extracted`);
    }
    return `
      <div>
        <strong>Analysis ${display(first.analysis_id)}</strong>
        <div>${display(first.outcome)}</div>
        <div class="muted">Comparison ${display(first.comparison_id)}; ${display(roleLabel(first.comparison_role))}; ${bits.join("; ")}</div>
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
              <th>Status</th>
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
                <td>
                  <span class="status-chip ${sourceStatusClass(row.row_extraction_status)}">${display(row.row_extraction_status)}</span>
                  <div class="muted">${display(row.row_extraction_notes, "")}</div>
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
    return `
      <section class="panel analysis-study-rows-panel" id="analysis-study-rows">
        <div class="section-head">
          <div>
            <h2>Details of analysis results</h2>
            <p class="muted">Rendered from provisional_data/analysis_study_rows_first_pass.tsv. These are provisional forest-plot rows matched to included Cochrane trials.</p>
          </div>
          <div class="muted">${rows.length ? `${rows.length} rows` : "No rows"}</div>
        </div>
        ${rows.length ? `
          <div class="analysis-study-group-list">
            ${groupStudyRowsByAnalysis(rows).map(([analysisId, analysisRows]) => `
              <section class="analysis-study-group" id="analysis-study-rows-${escapeHtml(analysisId)}">
                <div class="analysis-study-group-head">
                  ${analysisSummaryForStudyRows(analysisRows)}
                </div>
                ${renderAnalysisStudyRowsTable(analysisRows)}
              </section>
            `).join("")}
          </div>
        ` : `<p class="muted excerpt">No analysis study rows were loaded for this review. The current saved extraction covers the first-pass group only.</p>`}
      </section>
    `;
  }

  function renderAnalysisIds(label, values, className = "") {
    const ids = splitCell(values);
    return `
      <div class="analysis-id-group ${className}">
        <div class="field-label">${escapeHtml(label)}</div>
        <div class="analysis-id-list">
          ${ids.length ? ids.map((id) => `<span class="analysis-id">${escapeHtml(id)}</span>`).join("") : `<span class="muted">None</span>`}
        </div>
      </div>
    `;
  }

  function renderAnalysisScanPanel(review) {
    const analysis = review._analysis || {};
    if (!raw(analysis.analysis_count)) {
      return `
        <section class="panel analysis-panel" id="analysis-count-scan">
          <div class="section-head">
            <div>
              <h2>Analysis quick check</h2>
              <p class="muted">No matching row was loaded from provisional_data/analysis_counts.tsv for this review.</p>
            </div>
          </div>
        </section>
      `;
    }

    const stats = [
      ["Total analyses", analysis.analysis_count, "Unique Cochrane Analysis X.Y labels"],
      ["Estimable", analysis.estimable_analysis_count, "Heuristic effect-estimate pattern found"],
      ["Uncertain", analysis.uncertain_analysis_count, "Found, but not clearly estimable"],
      ["Not estimable", analysis.not_estimable_analysis_count, "No-data or not-estimable marker found"],
    ];

    return `
      <section class="panel analysis-panel" id="analysis-count-scan">
        <div class="section-head">
          <div>
            <h2>Analysis quick check</h2>
            <p class="muted">Rendered from provisional_data/analysis_counts.tsv. Treat estimability as a triage heuristic, not final manual verification.</p>
          </div>
          <div class="muted">${display(analysis.pdf, "No PDF path")}</div>
        </div>
        <div class="analysis-stat-grid">
          ${stats.map(([label, value, detail]) => `
            <div class="analysis-stat">
              <div class="stat-label">${escapeHtml(label)}</div>
              <div class="stat-value">${display(value, "0")}</div>
              <div class="stat-detail">${escapeHtml(detail)}</div>
            </div>
          `).join("")}
        </div>
        <div class="analysis-id-grid">
          ${renderAnalysisIds("All analysis IDs", analysis.analysis_ids)}
          ${renderAnalysisIds("Estimable IDs", analysis.estimable_analysis_ids, "ok")}
          ${renderAnalysisIds("Uncertain IDs", analysis.uncertain_analysis_ids, "warn")}
          ${renderAnalysisIds("Not-estimable IDs", analysis.not_estimable_analysis_ids, "bad")}
        </div>
        ${raw(analysis.error) ? `<div class="excerpt"><strong>Scan error:</strong> ${display(analysis.error)}</div>` : ""}
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

  function trialSummaryText(studies) {
    const total = studies.length;
    const withPmid = studies.filter((study) => isYes(study.has_pubmed)).length;
    const withPmcid = studies.filter((study) => isYes(study.has_pmc)).length;
    return `${total} trials; ${withPmid} with PMID; ${withPmcid} with PMCID`;
  }

  function renderIncludedTrialsTable(review) {
    const studies = review._studies || [];
    return `
      <section class="panel trial-summary-panel" id="included-trials">
        <div class="section-head">
          <div>
            <h2>Included trials</h2>
            <p class="muted">Rendered from provisional_data/included_study_indexing.tsv.</p>
          </div>
          <div class="section-summary">${escapeHtml(trialSummaryText(studies))}</div>
        </div>
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
            <p class="muted">Rendered from provisional_data/excluded_study_indexing.tsv.</p>
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
        <summary>Show raw TSV row</summary>
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

  function renderRecords(study) {
    const records = study._records || [];
    if (!records.length) {
      return `<p class="muted excerpt">No PMID-level rows are available for this trial.</p>`;
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
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReportCandidates(study) {
    const reports = study._reports || [];
    if (!reports.length) {
      return `<p class="muted excerpt">No report-candidate rows are available for this trial.</p>`;
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
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialRegistryRecords(study) {
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
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialDetailCard(study, source = "included") {
    const status = trialStatus(study);
    const sourceFile = source === "excluded"
      ? "provisional_data/excluded_study_indexing.tsv"
      : "provisional_data/included_study_indexing.tsv";
    return `
      <article class="trial-card ${trialCardClass(study)}" id="trial-${source}-${study._rowIndex}" data-trial-detail>
        <div class="trial-head">
          <div>
            <div class="trial-title">
              <h3>${escapeHtml(study.study_label || "Unnamed study")}</h3>
              <span class="muted">${display(study.reference_status, "No reference status")}</span>
            </div>
            <p class="muted">Row ${study._rowIndex} in ${sourceFile}</p>
          </div>
          <span class="status-chip ${status.className}">${escapeHtml(status.label)}</span>
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

        ${renderTrialRegistryRecords(study)}
        ${renderReportCandidates(study)}
        ${renderRecords(study)}
        ${renderRawRows(study)}
      </article>
    `;
  }

  function renderSelectedTrialDetail(review) {
    const selectedRows = state.selectedTrialSource === "excluded"
      ? (review._excludedStudies || [])
      : (review._studies || []);
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
    const review = reviews.find((item) => item.review_id === state.selectedReviewId);
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
        ${renderDataContents(review)}
        ${renderReviewCurationPanel(review)}
        ${renderProtocolEligibilityPanel(review)}
        ${renderTrialsPlaceholder()}
        ${renderIncludedTrialsTable(review)}
        ${renderExcludedTrialsTable(review)}
        ${renderSelectedTrialDetail(review)}
        ${renderReviewOutcomesPanel(review)}
        ${renderAnalysisComparisonsPanel(review)}
        ${renderAnalysisScanPanel(review)}
        ${renderAnalysisResultsPanel(review)}
        ${renderAnalysisStudyRowsPanel(review)}
        ${renderReproducedMetaAnalysisPanel(review)}
        ${renderStudyCharacteristicsPanel(review)}
        ${renderRiskOfBiasPlaceholderPanel()}
      </div>
    `;
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

    setupReviewTocScrollSpy();
  }

  function visibleReviewTocSectionIds() {
    return reviewTocItems()
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
    `;
    bindEvents(reviews);
  }

  function renderError(error) {
    app.innerHTML = `
      <section class="error-state">
        <h2>Could not load the TSV files</h2>
        <p>${escapeHtml(error.message || error)}</p>
        <p class="muted">Serve the repository root with a local web server, then open /Cochrane_reviews/audit_site/.</p>
      </section>
    `;
  }

  async function init() {
    try {
      const loaded = await Promise.all(SOURCE_FILES.map(loadSource));
      loaded.forEach((file) => {
        state.files[file.key] = file;
        state.rows[file.key] = file.rows;
      });
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
