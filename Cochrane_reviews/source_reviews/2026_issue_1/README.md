# Cochrane 2026 Issue 1 downloaded-data reviews

This folder contains PDFs for 18 Cochrane Database of Systematic Reviews 2026 Issue 1 reviews. This README summarizes the 10 reviews that currently have downloaded Cochrane data packages and are the immediate reproduction candidates. The other 8 PDFs are left for a later pass.

## Count sources

- Studies: rows in `<ID>-study-data/<ID>-study-information.csv`.
- Data-package analyses: rows in `<ID>-analysis-data/<ID>-overall-estimates-and-settings.csv`.
- Analysis input rows: rows in `<ID>-analysis-data/<ID>-data-rows.csv`.
- `CD015415` is a diagnostic test accuracy review, so its data-package analyses count comes from `<ID>-analysis-data/<ID>-parameters.csv`.

Data-package analyses are exported RevMan analysis definitions, not necessarily forest plots displayed inline in the PDF. Analysis input rows are study-level contribution rows in the exported Cochrane analysis data; the same study can appear multiple times across outcomes, subgroups, and sensitivity analyses.

## Downloaded data packages

| ID | Review | Studies | Data-package analyses | Analysis input rows | Note |
| --- | --- | ---: | ---: | ---: | --- |
| `CD002118` | Blastocyst-stage versus cleavage-stage embryo transfer in assisted reproductive technology | 36 | 30 | 447 |  |
| `CD004366` | Exercise for depression | 73 | 27 | 660 |  |
| `CD007798` | Clinically indicated removal versus routine removal of peripheral venous catheters | 14 | 44 | 410 |  |
| `CD008112` | Spinal manipulative therapy for adults with chronic low back pain | 76 | 98 | 2297 |  |
| `CD011506` | Cerebral near-infrared spectroscopy monitoring for prevention of death or neurodevelopmental disability in very preterm infants | 5 | 13 | 49 |  |
| `CD012589` | Patient-specific cutting guides for total knee arthroplasty | 44 | 36 | 377 |  |
| `CD013524` | Cladribine for people with multiple sclerosis | 15 | 37 | 160 |  |
| `CD014353` | Enteral lipid supplements for the prevention and treatment of parenteral nutrition-associated liver disease in infants | 11 | 28 | 66 |  |
| `CD015234` | Methods of induction of labour: a network meta-analysis | 106 | 29 | 661 | Network meta-analysis |
| `CD015415` | Liver and spleen stiffness as assessed by vibration-controlled transient elastography for diagnosing clinically significant portal hypertension in comparison with other elastography-based techniques in adults with chronic liver disease | 49 | 65 | 392 | Diagnostic test accuracy review; non-interventional |
