/**
 * TypeScript types mirroring docs/analysis/ml-explainability-design.md §7
 * (FROZEN artifact contract). One type per schema object; keep in sync with the
 * design doc, not invented here.
 */

export interface ExplainabilityProviderMix {
  [provider: string]: number;
}

export interface ExplainabilityFold {
  fold: number;
  train_days: number;
  test_days: number;
  n_train: number;
  n_test: number;
  r2_oos: number;
  rmse_log: number;
  provider_mix_test: ExplainabilityProviderMix;
}

export interface ExplainabilityHoldout {
  n_days: number;
  n_test: number;
  r2_oos: number;
  r2_oos_pooled: number;
  rmse_log: number;
}

export interface ExplainabilityR2HoldoutByProvider {
  [provider: string]: number;
}

export interface ExplainabilityRobustnessCD {
  holdout_r2_oos: number;
  n_days: number;
}

export interface ExplainabilityMetrics {
  folds: ExplainabilityFold[];
  holdout: ExplainabilityHoldout;
  r2_holdout_by_provider: ExplainabilityR2HoldoutByProvider;
  anova_explained_same_days: number;
  gap: number;
  permuted_target_r2: number;
  robustness_c_d: ExplainabilityRobustnessCD;
}

export interface ExplainabilityMetadata {
  trained_at: string;
  sku: string;
  trained_providers: string[];
  corpus_through: string;
  corpus_rows: number;
  n_rows_after_dedup: number;
  era_coverage: string[];
  code_version: string;
  xgboost_version: string;
  fixture_hash: string;
}

export interface ShapTopFeature {
  rank: number;
  feature: string;
  mean_abs_shap: number;
}

export interface ShapSummary {
  n_sample: number;
  top_features: ShapTopFeature[];
}

export interface HostSensitivity {
  threshold: number;
  icc: number;
  n_hosts: number;
}

export interface HostTenureDays {
  min: number;
  median: number;
  max: number;
}

export interface HostAnalysis {
  icc: number;
  fe_r2_increment: number;
  n_hosts: number;
  n_host_days: number;
  min_days_threshold: number;
  sensitivity: HostSensitivity[];
  tenure_days: HostTenureDays;
}

export interface ExplainabilityArtifact {
  schema_version: string;
  metadata: ExplainabilityMetadata;
  metrics: ExplainabilityMetrics;
  shap_summary: ShapSummary;
  host_analysis: HostAnalysis;
  caveats: string[];
  model_file: string;
}
