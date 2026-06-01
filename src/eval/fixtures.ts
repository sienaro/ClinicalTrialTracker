import type { TrialSummary, Sex } from "@/lib/clinicalTrialsGov";

/**
 * Hand-labeled evaluation fixtures.
 *
 * Each fixture pairs a patient profile with a synthetic clinical trial that mirrors
 * the shape of a ClinicalTrials.gov record. Ground-truth labels are deliberately
 * unambiguous: each case is constructed so that the "correct" answer requires no
 * clinical judgment beyond what the eligibility text literally says.
 *
 * Categories are designed to expose known weaknesses of keyword matching:
 *  - clear-match: both methods should easily get it right
 *  - age-gate / sex-gate: deterministic eligibility rules
 *  - exclusion: the dramatic cases — keyword overlap rewards a literal token match
 *    ("insulin") that an explicit *exclusion* of that very thing should reverse.
 *    Gemini should read the exclusion; keyword cannot.
 *  - irrelevant: condition mismatch
 *  - borderline: deliberately ambiguous; excluded from binary metrics
 */

export type GroundTruth = "appropriate" | "inappropriate" | "borderline";

export type FixtureCategory =
  | "clear-match"
  | "age-gate"
  | "sex-gate"
  | "exclusion"
  | "irrelevant"
  | "borderline";

export type Fixture = {
  id: string;
  category: FixtureCategory;
  patient: {
    condition: string;
    age?: number;
    sex: Sex;
    sessionNotes?: string;
  };
  trial: TrialSummary;
  groundTruth: GroundTruth;
  rationale: string;
};

function synth(
  id: string,
  title: string,
  conditions: string[],
  eligibilityText: string,
): TrialSummary {
  return {
    nctId: id,
    title,
    overallStatus: "RECRUITING",
    conditions,
    eligibilityText,
    url: `https://clinicaltrials.gov/study/${id}`,
    sites: [],
  };
}

export const fixtures: Fixture[] = [
  // ── clear matches ────────────────────────────────────────────────────────
  {
    id: "t2d-clean-match",
    category: "clear-match",
    patient: {
      condition: "Type 2 diabetes",
      age: 45,
      sex: "female",
      sessionNotes: "On metformin monotherapy. HbA1c around 7.8%.",
    },
    trial: synth(
      "DEMO-001",
      "Phase II add-on therapy for adults with Type 2 diabetes inadequately controlled on metformin",
      ["Type 2 Diabetes Mellitus"],
      `Inclusion Criteria:
- Adults aged 18-75 with a confirmed diagnosis of Type 2 diabetes mellitus
- HbA1c 7.0%-10.0% at screening
- On a stable dose of metformin for at least 3 months

Exclusion Criteria:
- Type 1 diabetes
- Severe renal impairment (eGFR < 30 mL/min)
- Pregnancy`,
    ),
    groundTruth: "appropriate",
    rationale: "Condition, age, HbA1c band, and current therapy all match the inclusion criteria.",
  },
  {
    id: "bc-clean-match",
    category: "clear-match",
    patient: {
      condition: "Breast cancer",
      age: 52,
      sex: "female",
      sessionNotes: "Stage II ER-positive, post-surgery, no prior systemic therapy.",
    },
    trial: synth(
      "DEMO-002",
      "Adjuvant endocrine therapy in early-stage hormone-receptor-positive breast cancer",
      ["Breast Cancer", "Hormone-Receptor-Positive"],
      `Inclusion Criteria:
- Women aged 18 or older with histologically confirmed early-stage (I-II) breast cancer
- ER-positive and/or PR-positive tumor
- Post-surgical, prior to adjuvant therapy

Exclusion Criteria:
- Metastatic disease
- Prior systemic therapy for breast cancer`,
    ),
    groundTruth: "appropriate",
    rationale: "Direct match on stage, receptor status, and treatment timing.",
  },
  {
    id: "ra-clean-match",
    category: "clear-match",
    patient: {
      condition: "Rheumatoid arthritis",
      age: 60,
      sex: "male",
      sessionNotes: "Inadequate response to methotrexate after 6 months. DAS28 score elevated.",
    },
    trial: synth(
      "DEMO-003",
      "Oral JAK inhibitor for moderate-to-severe rheumatoid arthritis after MTX failure",
      ["Rheumatoid Arthritis"],
      `Inclusion Criteria:
- Adults aged 18-80 with active moderate-to-severe rheumatoid arthritis
- Inadequate response to methotrexate (>=3 months at stable dose)

Exclusion Criteria:
- Active or chronic infection
- Pregnancy or breastfeeding`,
    ),
    groundTruth: "appropriate",
    rationale: "MTX failure is the headline inclusion criterion; age within range.",
  },

  // ── age gates ────────────────────────────────────────────────────────────
  {
    id: "age-adult-vs-pediatric",
    category: "age-gate",
    patient: {
      condition: "Acute lymphoblastic leukemia",
      age: 45,
      sex: "male",
      sessionNotes: "Newly diagnosed, no prior therapy.",
    },
    trial: synth(
      "DEMO-004",
      "Pediatric Acute Lymphoblastic Leukemia (ALL) chemotherapy protocol",
      ["Acute Lymphoblastic Leukemia", "Pediatric"],
      `Inclusion Criteria:
- Children and adolescents aged 2-17 years
- Newly diagnosed Acute Lymphoblastic Leukemia

Exclusion Criteria:
- Prior systemic therapy
- Mature B-cell ALL`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient is 45; trial requires ages 2-17.",
  },
  {
    id: "age-young-vs-older-adult-alz",
    category: "age-gate",
    patient: {
      condition: "Early-onset Alzheimer's disease",
      age: 30,
      sex: "female",
      sessionNotes: "MMSE 22. Family history of dementia.",
    },
    trial: synth(
      "DEMO-005",
      "Disease-modifying therapy for sporadic late-onset Alzheimer's disease",
      ["Alzheimer Disease"],
      `Inclusion Criteria:
- Men and women aged 55-85 years
- Probable Alzheimer's disease, MMSE 18-26

Exclusion Criteria:
- Familial early-onset Alzheimer's`,
    ),
    groundTruth: "inappropriate",
    rationale: "Age 30 falls well outside the 55-85 inclusion window; the trial also explicitly excludes early-onset disease.",
  },
  {
    id: "age-young-vs-older-t2d",
    category: "age-gate",
    patient: {
      condition: "Type 2 diabetes",
      age: 42,
      sex: "male",
      sessionNotes: "Diagnosed 3 years ago.",
    },
    trial: synth(
      "DEMO-006",
      "Glycemic control in older adults with Type 2 diabetes",
      ["Type 2 Diabetes Mellitus", "Geriatric"],
      `Inclusion Criteria:
- Adults aged 65 years or older
- Type 2 diabetes diagnosed at least 5 years ago

Exclusion Criteria:
- Cognitive impairment that limits self-management`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient is 42 with 3-year history; trial requires 65+ with >=5 years duration.",
  },

  // ── sex gates ────────────────────────────────────────────────────────────
  {
    id: "sex-male-vs-female-only",
    category: "sex-gate",
    patient: {
      condition: "Breast cancer",
      age: 50,
      sex: "male",
      sessionNotes: "Diagnosed with male breast cancer; ER-positive.",
    },
    trial: synth(
      "DEMO-007",
      "Postmenopausal hormone therapy study for women with ER-positive breast cancer",
      ["Breast Cancer"],
      `Inclusion Criteria:
- Biological females, postmenopausal
- ER-positive breast cancer

Exclusion Criteria:
- Premenopausal status`,
    ),
    groundTruth: "inappropriate",
    rationale: "Trial restricts to biological females; patient is male even though condition matches.",
  },
  {
    id: "sex-female-vs-male-only",
    category: "sex-gate",
    patient: {
      condition: "Osteoporosis",
      age: 60,
      sex: "female",
      sessionNotes: "T-score -2.6 on DEXA.",
    },
    trial: synth(
      "DEMO-008",
      "Bone density and fracture risk study in men aged 50+",
      ["Osteoporosis"],
      `Inclusion Criteria:
- Men aged 50 or older
- Low bone mineral density (T-score <= -2.0)

Exclusion Criteria:
- Female`,
    ),
    groundTruth: "inappropriate",
    rationale: "Male-only trial, female patient.",
  },

  // ── exclusion-criteria (the dramatic ones for AI vs keyword) ─────────────
  {
    id: "exclusion-prior-insulin",
    category: "exclusion",
    patient: {
      condition: "Type 2 diabetes",
      age: 50,
      sex: "female",
      sessionNotes: "Currently on insulin glargine and metformin for the past 2 years.",
    },
    trial: synth(
      "DEMO-009",
      "Novel oral therapy for insulin-naïve Type 2 diabetes",
      ["Type 2 Diabetes Mellitus"],
      `Inclusion Criteria:
- Adults aged 18-70 with Type 2 diabetes
- HbA1c 7.0%-10.0%

Exclusion Criteria:
- Prior or current use of insulin for diabetes management
- Pregnancy`,
    ),
    groundTruth: "inappropriate",
    rationale:
      "Patient is on insulin; trial explicitly excludes prior/current insulin use. Keyword matching tends to *reward* the shared term 'insulin' rather than treat it as an exclusion.",
  },
  {
    id: "exclusion-prior-chemo",
    category: "exclusion",
    patient: {
      condition: "Breast cancer",
      age: 58,
      sex: "female",
      sessionNotes: "Completed 4 cycles of AC chemotherapy 6 months ago.",
    },
    trial: synth(
      "DEMO-010",
      "First-line systemic therapy for treatment-naïve early breast cancer",
      ["Breast Cancer"],
      `Inclusion Criteria:
- Women with histologically confirmed early-stage breast cancer
- No prior systemic therapy

Exclusion Criteria:
- Any prior systemic chemotherapy
- Prior endocrine therapy for cancer`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient had prior AC chemo; the trial requires no prior systemic therapy.",
  },
  {
    id: "exclusion-comorbid-diabetes",
    category: "exclusion",
    patient: {
      condition: "Hypertension",
      age: 55,
      sex: "male",
      sessionNotes: "Also has Type 2 diabetes (well-controlled on metformin).",
    },
    trial: synth(
      "DEMO-011",
      "Antihypertensive trial in adults without metabolic comorbidities",
      ["Hypertension"],
      `Inclusion Criteria:
- Adults aged 30-70 with Stage 1-2 hypertension

Exclusion Criteria:
- Diabetes mellitus (Type 1 or Type 2)
- Chronic kidney disease`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient's diabetes is an explicit exclusion. Keyword sees 'hypertension' match and may rank high.",
  },
  {
    id: "exclusion-current-ssri",
    category: "exclusion",
    patient: {
      condition: "Major depressive disorder",
      age: 35,
      sex: "female",
      sessionNotes: "Currently taking sertraline 100mg daily for the past 2 years.",
    },
    trial: synth(
      "DEMO-012",
      "Ketamine infusion for treatment-resistant depression",
      ["Depression", "Treatment-Resistant Depression"],
      `Inclusion Criteria:
- Adults aged 18-65 with major depressive disorder
- History of inadequate response to at least 2 antidepressants

Exclusion Criteria:
- Current use of any SSRI or SNRI within the last 2 weeks
- Active substance use disorder`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient is on a current SSRI; exclusion criterion is explicit. Keyword matching cannot read the temporal/exclusion logic.",
  },

  // ── irrelevant conditions ────────────────────────────────────────────────
  {
    id: "irrelevant-diabetes-vs-crohns",
    category: "irrelevant",
    patient: {
      condition: "Type 2 diabetes",
      age: 45,
      sex: "male",
    },
    trial: synth(
      "DEMO-013",
      "Biologic therapy for moderate-to-severe Crohn's disease",
      ["Crohn's Disease", "Inflammatory Bowel Disease"],
      `Inclusion Criteria:
- Adults aged 18-75 with moderate-to-severe Crohn's disease
- Inadequate response to conventional therapy

Exclusion Criteria:
- Active infection`,
    ),
    groundTruth: "inappropriate",
    rationale: "Patient does not have Crohn's disease; conditions do not overlap.",
  },
  {
    id: "irrelevant-hf-vs-asthma",
    category: "irrelevant",
    patient: {
      condition: "Heart failure",
      age: 60,
      sex: "female",
    },
    trial: synth(
      "DEMO-014",
      "Inhaled biologic for severe eosinophilic asthma",
      ["Asthma", "Eosinophilic Asthma"],
      `Inclusion Criteria:
- Adults aged 18-75 with severe eosinophilic asthma
- Blood eosinophil count >= 300 cells/uL

Exclusion Criteria:
- Other significant respiratory disease`,
    ),
    groundTruth: "inappropriate",
    rationale: "Conditions are unrelated; no overlap in inclusion criteria.",
  },

  // ── borderline (excluded from binary metrics, kept for visibility) ───────
  {
    id: "borderline-t2d-vs-prediabetes",
    category: "borderline",
    patient: {
      condition: "Type 2 diabetes",
      age: 50,
      sex: "male",
      sessionNotes: "HbA1c around 7.5% on metformin.",
    },
    trial: synth(
      "DEMO-015",
      "Lifestyle intervention for prediabetes (HbA1c 5.7-6.4%)",
      ["Prediabetes"],
      `Inclusion Criteria:
- Adults aged 30-65
- HbA1c 5.7%-6.4% (prediabetes range)
- No current diabetes medications

Exclusion Criteria:
- Diagnosed diabetes`,
    ),
    groundTruth: "borderline",
    rationale: "Closely related condition family, but patient has frank diabetes and is on metformin; trial restricts to prediabetes range. A reasonable system could rank this either way.",
  },
];
