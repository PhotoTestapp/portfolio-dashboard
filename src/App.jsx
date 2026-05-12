import { useEffect, useMemo, useState } from 'react'
import { ACTUAL_HOLDING_COUNT, businessMap, buyMap, sections, sellMap, thesisMap } from './data/portfolioData'
import { conditionDefinitions, conditionLabels, normalizeStocks } from './utils/stockUtils'

const marketOrder = ['日本株', '米国株']
const STORAGE_KEY = 'portfolio-dashboard-holdings-v1'
const SETTINGS_KEY = 'portfolio-dashboard-settings-v1'
const HISTORY_KEY = 'portfolio-dashboard-decision-history-v1'
const AUDIT_KEY = 'portfolio-dashboard-audit-log-v1'
const INTEGRITY_KEY = 'portfolio-dashboard-integrity-v1'
const CHECKLIST_KEY = 'portfolio-dashboard-operational-checklist-v1'
const CHECKLIST_SCHEMA_VERSION = '2026.05-operational-checklist-v1'
const DEFAULT_USD_JPY = 155
const DECISION_HISTORY_VERSION = '2026.05-decision-action-v1'
const AUDIT_LOG_VERSION = '2026.05-audit-log-v1'
const APP_SCHEMA_VERSION = '2026.05-integrity-v1'
const RISK_WEIGHT_KEY = 'portfolio-dashboard-risk-weight-config-v1'
const RISK_SCORE_VERSION = '2026.05-risk-weight-v1'
const IMPORT_VALIDATION_REPORT_KEY = 'portfolio-dashboard-import-validation-report-v1'
const SAFE_MODE_KEY = 'portfolio-dashboard-safe-mode-v1'
const SAFE_MODE_VERSION = '2026.05-safe-mode-v1'
const GUIDED_WORKFLOW_KEY = 'portfolio-dashboard-guided-workflow-v1'
const GUIDED_WORKFLOW_VERSION = '2026.05-guided-workflow-v1'


const unresolvedRiskDefinitions = [
  {
    key: 'AUTO_DATA_FETCH',
    label: '株価・為替・財務データ自動取得なし',
    category: 'DATA_COLLECTION',
    staticLimit: 'GitHub Pages単体では外部APIの秘匿キー管理ができないため完全自動取得は不可。',
    mitigation: '日次・四半期データ更新パックと一括貼り付け入力で手動更新の漏れを減らす。',
    nextAction: '価格・為替・財務の不足/期限切れ項目を優先して入力候補へ回す。',
  },
  {
    key: 'SOURCE_BODY_VERIFICATION',
    label: '根拠URL本文との自動照合なし',
    category: 'EVIDENCE',
    staticLimit: '静的サイトから外部PDF/IRページ本文を安定取得して照合することは困難。',
    mitigation: 'URL・ページ・引用・採用値・入力値一致チェックで再確認可能性を上げる。',
    nextAction: 'WEAK/MULTIPLE/MISMATCH/UNVERIFIEDを優先して証跡修正。',
  },
  {
    key: 'LOCAL_STORAGE_DEPENDENCY',
    label: 'localStorage依存・複数端末同期なし',
    category: 'PERSISTENCE',
    staticLimit: 'ブラウザ内保存のため端末間同期・サーバー永続化は不可。',
    mitigation: 'JSONバックアップ、完全性ハッシュ、復元ログ、週次バックアップタスクで損失を抑制。',
    nextAction: '最終バックアップ日時と完全性スコアを監視し、期限切れならJSON保存。',
  },
  {
    key: 'AUTHORIZATION',
    label: '認証・権限管理なし',
    category: 'SECURITY',
    staticLimit: '静的公開サイトのため厳密なユーザー認証・権限分離は不可。',
    mitigation: 'safeMode、危険操作確認、auditLogで誤操作を抑制。',
    nextAction: '編集モードのまま放置しない。重要操作は監査ログで確認。',
  },
  {
    key: 'BROKER_ACCOUNT_INTEGRATION',
    label: '証券口座・約定データ連携なし',
    category: 'EXECUTION',
    staticLimit: '証券口座APIや認証付き約定データ取得は静的サイト単体では不可。',
    mitigation: 'actionTrackingで実行日・価格・株数・遵守率を手動記録。',
    nextAction: 'SELL/REDUCE未実行と逆行実行を優先処理。',
  },
  {
    key: 'OUTCOME_DATA_COVERAGE',
    label: '結果評価データ不足',
    category: 'BACKTEST',
    staticLimit: '判定成績はoutcome入力がないと測定不能。',
    mitigation: 'outcomeEvaluationとriskWeightDiagnosticsで評価済み履歴を使う。',
    nextAction: '評価済み履歴を増やし、NEED_DATAを減らす。',
  },
]

const unresolvedLevelTone = {
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-800',
  MEDIUM: 'border-sky-200 bg-sky-50 text-sky-800',
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const DEFAULT_RISK_WEIGHT_CONFIG = {
  riskScoreVersion: RISK_SCORE_VERSION,
  riskWeightReviewedAt: '',
  riskWeightChangeReason: '初期リスク重み設定',
  riskWeightRegime: 'NORMAL',
  levels: { critical: 120, high: 80, medium: 45 },
  weights: {
    decisionSell: 100,
    decisionReduce: 80,
    blockingDecision: 70,
    decisionBuy: 25,
    severityCritical: 35,
    severityHigh: 20,
    positionOver8: 35,
    positionOver5: 18,
    sectorOver25: 30,
    sectorOver20: 15,
    lossOver20: 30,
    lossOver10: 15,
    validationError: 30,
    verificationError: 25,
    evidenceError: 25,
    multipleEvidenceError: 20,
    mismatchedEvidenceError: 25,
    staleData: 22,
    missingData: 16,
    sellReduceNotExecuted: 45,
    contradictedAction: 45,
    nonCompliantAction: 30,
    outcomeMissing: 10,
  },
}

const riskWeightDefinitions = [
  { key: 'decisionSell', label: 'SELL判定', min: 0, max: 300 },
  { key: 'decisionReduce', label: 'REDUCE判定', min: 0, max: 300 },
  { key: 'blockingDecision', label: '停止判定', min: 0, max: 300 },
  { key: 'decisionBuy', label: 'BUY判定', min: 0, max: 300 },
  { key: 'severityCritical', label: '重大度CRITICAL', min: 0, max: 200 },
  { key: 'severityHigh', label: '重大度HIGH', min: 0, max: 200 },
  { key: 'positionOver8', label: '個別比率8%以上', min: 0, max: 200 },
  { key: 'positionOver5', label: '個別比率5%以上', min: 0, max: 200 },
  { key: 'sectorOver25', label: 'セクター比率25%以上', min: 0, max: 200 },
  { key: 'sectorOver20', label: 'セクター比率20%以上', min: 0, max: 200 },
  { key: 'lossOver20', label: '含み損-20%以下', min: 0, max: 200 },
  { key: 'lossOver10', label: '含み損-10%以下', min: 0, max: 200 },
  { key: 'validationError', label: '異常値', min: 0, max: 200 },
  { key: 'verificationError', label: '根拠未確認', min: 0, max: 200 },
  { key: 'evidenceError', label: '証跡不足', min: 0, max: 200 },
  { key: 'multipleEvidenceError', label: '複数証跡値未指定', min: 0, max: 200 },
  { key: 'mismatchedEvidenceError', label: '証跡値不一致', min: 0, max: 200 },
  { key: 'staleData', label: '期限切れ・更新日問題', min: 0, max: 200 },
  { key: 'missingData', label: '必須データ未入力', min: 0, max: 200 },
  { key: 'sellReduceNotExecuted', label: 'SELL/REDUCE未実行', min: 0, max: 300 },
  { key: 'contradictedAction', label: '逆行実行', min: 0, max: 300 },
  { key: 'nonCompliantAction', label: '非遵守実行', min: 0, max: 300 },
  { key: 'outcomeMissing', label: '結果未評価', min: 0, max: 100 },
]

const riskLevelDefinitions = [
  { key: 'critical', label: 'CRITICAL閾値', min: 1, max: 500 },
  { key: 'high', label: 'HIGH閾値', min: 1, max: 500 },
  { key: 'medium', label: 'MEDIUM閾値', min: 1, max: 500 },
]

const riskRegimeOptions = [
  { value: 'RISK_ON', label: 'RISK_ON / 強気' },
  { value: 'NORMAL', label: 'NORMAL / 通常' },
  { value: 'RISK_OFF', label: 'RISK_OFF / 防御' },
]

const toConfigNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const sanitizeRiskWeightConfig = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const weights = {}
  for (const definition of riskWeightDefinitions) {
    const fallback = DEFAULT_RISK_WEIGHT_CONFIG.weights[definition.key]
    weights[definition.key] = String(toConfigNumber(source?.weights?.[definition.key], fallback))
  }
  const levels = {}
  for (const definition of riskLevelDefinitions) {
    const fallback = DEFAULT_RISK_WEIGHT_CONFIG.levels[definition.key]
    levels[definition.key] = String(toConfigNumber(source?.levels?.[definition.key], fallback))
  }
  const regime = String(source.riskWeightRegime || DEFAULT_RISK_WEIGHT_CONFIG.riskWeightRegime)
  return {
    riskScoreVersion: String(source.riskScoreVersion || DEFAULT_RISK_WEIGHT_CONFIG.riskScoreVersion),
    riskWeightReviewedAt: String(source.riskWeightReviewedAt || ''),
    riskWeightChangeReason: String(source.riskWeightChangeReason || DEFAULT_RISK_WEIGHT_CONFIG.riskWeightChangeReason),
    riskWeightRegime: riskRegimeOptions.some((option) => option.value === regime) ? regime : DEFAULT_RISK_WEIGHT_CONFIG.riskWeightRegime,
    weights,
    levels,
  }
}

const getRiskWeight = (config, key) => toConfigNumber(config?.weights?.[key], DEFAULT_RISK_WEIGHT_CONFIG.weights[key] || 0)

const readSafeModeSetting = () => {
  try {
    const saved = window.localStorage.getItem(SAFE_MODE_KEY)
    return saved ? JSON.parse(saved) : { mode: 'READ_ONLY', changedAt: '', version: SAFE_MODE_VERSION }
  } catch {
    return { mode: 'READ_ONLY', changedAt: '', version: SAFE_MODE_VERSION }
  }
}

const sanitizeSafeModeSetting = (value) => {
  const mode = value?.mode === 'EDIT' ? 'EDIT' : 'READ_ONLY'
  return {
    mode,
    changedAt: String(value?.changedAt || ''),
    version: String(value?.version || SAFE_MODE_VERSION),
  }
}

const getRiskLevelThreshold = (config, key) => toConfigNumber(config?.levels?.[key], DEFAULT_RISK_WEIGHT_CONFIG.levels[key] || 0)

const validateRiskWeightConfig = (config) => {
  const errors = []
  const reviewedAt = String(config?.riskWeightReviewedAt || '')
  if (!reviewedAt) errors.push('リスク重み確認日が未入力')
  else {
    const reviewedDate = new Date(reviewedAt)
    if (Number.isNaN(reviewedDate.getTime())) errors.push('リスク重み確認日が日付ではない')
    else if (reviewedDate.getTime() > Date.now()) errors.push('リスク重み確認日が未来日')
    else if (Math.floor((Date.now() - reviewedDate.getTime()) / 86400000) > 180) errors.push('リスク重み確認日が180日超過')
  }
  if (!String(config?.riskScoreVersion || '').trim()) errors.push('リスクスコアバージョンが未入力')
  if (String(config?.riskWeightChangeReason || '').trim().length < 5) errors.push('リスク重み変更理由が短すぎる')
  for (const definition of riskWeightDefinitions) {
    const value = Number(config?.weights?.[definition.key])
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) errors.push(`${definition.label}が許容範囲外`)
  }
  for (const definition of riskLevelDefinitions) {
    const value = Number(config?.levels?.[definition.key])
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) errors.push(`${definition.label}が許容範囲外`)
  }
  const critical = getRiskLevelThreshold(config, 'critical')
  const high = getRiskLevelThreshold(config, 'high')
  const medium = getRiskLevelThreshold(config, 'medium')
  if (!(critical > high && high > medium)) errors.push('リスクレベル閾値は CRITICAL > HIGH > MEDIUM の順にする必要あり')
  return errors
}

const operationalChecklistDefinitions = [
  { id: 'daily-price-fx', cadence: 'DAILY', label: '価格・USD/JPY更新', description: '現在価格、USD/JPY、価格更新日を更新し、STALE_DATAを発生させない。', maxAgeDays: 1, impact: 'HIGH' },
  { id: 'daily-blocking-decisions', cadence: 'DAILY', label: '停止判定確認', description: 'INVALID / UNVERIFIED / WEAK / MULTIPLE / MISMATCH / PROFILE / RULE / STALE / NO_DATAを確認。', maxAgeDays: 1, impact: 'HIGH' },
  { id: 'daily-sell-reduce', cadence: 'DAILY', label: 'SELL / REDUCE確認', description: 'SELL・REDUCE銘柄を確認し、実行記録または未実行理由を残す。', maxAgeDays: 1, impact: 'HIGH' },
  { id: 'weekly-evidence-audit', cadence: 'WEEKLY', label: '証跡・監査ログ確認', description: '根拠URL、引用文、採用証跡値、監査ログのHIGH影響変更を確認。', maxAgeDays: 7, impact: 'HIGH' },
  { id: 'weekly-action-outcome', cadence: 'WEEKLY', label: '実行・結果未入力確認', description: 'actionTrackingとoutcomeEvaluationの未入力履歴を確認。', maxAgeDays: 7, impact: 'MEDIUM' },
  { id: 'weekly-backup', cadence: 'WEEKLY', label: 'JSONバックアップ保存', description: 'JSON保存を実行し、backupIntegrityHashとlastBackupAtを更新。', maxAgeDays: 7, impact: 'HIGH' },
  { id: 'monthly-operation-report', cadence: 'MONTHLY', label: '月次運用レポート出力', description: 'Markdown / JSONの運用レポートを出力し、判定・遵守率・成績・完全性を固定。', maxAgeDays: 31, impact: 'HIGH' },
  { id: 'monthly-rule-review', cadence: 'MONTHLY', label: 'ルール設定確認', description: 'ruleVersion、ruleReviewedAt、閾値、riskRegime、ruleChangeReasonを確認。', maxAgeDays: 31, impact: 'HIGH' },
  { id: 'monthly-decision-history', cadence: 'MONTHLY', label: '判定履歴保存', description: '現在判定を履歴保存し、バックテスト用スナップショットを残す。', maxAgeDays: 31, impact: 'MEDIUM' },
  { id: 'quarterly-financial-refresh', cadence: 'QUARTERLY', label: '四半期財務データ更新', description: '配当性向、営業CF、EPS、自己資本比率、業種別専用指標、証跡を更新。', maxAgeDays: 100, impact: 'HIGH' },
  { id: 'quarterly-profile-metrics', cadence: 'QUARTERLY', label: '業種別専用指標棚卸し', description: 'BANK / REIT / UTILITY / CYCLICAL / GROWTH_TECH / HEALTHCARE / FINANCIALの専用指標を確認。', maxAgeDays: 100, impact: 'MEDIUM' },
]

const cadenceLabels = {
  DAILY: '日次',
  WEEKLY: '週次',
  MONTHLY: '月次',
  QUARTERLY: '四半期',
}


const guidedWorkflowDefinitions = [
  {
    id: 'daily-workflow',
    cadence: 'DAILY',
    label: '日次ワークフロー',
    objective: '価格・為替・停止判定・SELL/REDUCEを順番に確認し、日次リスク処理の抜けを防ぐ。',
    steps: [
      { id: 'daily-risk-rank', label: 'リスク優先度上位を確認', checklistId: 'daily-blocking-decisions', description: 'riskPriorityScore上位、停止判定、SELL/REDUCEを上から確認。', output: '確認対象を上位から処理' },
      { id: 'daily-price-fx', label: '価格・USD/JPY更新', checklistId: 'daily-price-fx', description: '現在価格、価格更新日、USD/JPY、USD/JPY更新日を更新。', output: 'STALE_DATA削減' },
      { id: 'daily-blocking', label: '停止判定を処理', checklistId: 'daily-blocking-decisions', description: 'INVALID / UNVERIFIED / WEAK / MULTIPLE / MISMATCH / PROFILE / RULE / STALE / NO_DATAを処理。', output: '通常判定可能銘柄を増やす' },
      { id: 'daily-sell-reduce', label: 'SELL / REDUCEを確認', checklistId: 'daily-sell-reduce', description: 'SELL / REDUCE銘柄の実行記録または未実行理由を入力。', output: '未実行SELL/REDUCEを減らす' },
    ],
  },
  {
    id: 'weekly-workflow',
    cadence: 'WEEKLY',
    label: '週次ワークフロー',
    objective: '証跡、監査ログ、実行・結果未入力、バックアップを週次で固定する。',
    steps: [
      { id: 'weekly-evidence', label: '証跡・監査ログ確認', checklistId: 'weekly-evidence-audit', description: 'HIGH影響変更、証跡不足、証跡不一致、監査ログを確認。', output: '根拠不明・転記ミスを減らす' },
      { id: 'weekly-action-outcome', label: '実行・結果未入力を確認', checklistId: 'weekly-action-outcome', description: 'actionTrackingとoutcomeEvaluationの未入力を確認。', output: '遵守率・成績評価の欠損を減らす' },
      { id: 'weekly-coverage', label: 'カバレッジと不足入力候補を出力', checklistId: 'weekly-action-outcome', description: 'カバレッジ診断、不足入力CSV、貼付用TSVを出力して不足を処理。', output: '次に埋めるデータを固定' },
      { id: 'weekly-backup', label: 'JSONバックアップ保存', checklistId: 'weekly-backup', description: 'JSON保存を実行し、backupIntegrityHashとlastBackupAtを更新。', output: '復元可能状態を確保' },
    ],
  },
  {
    id: 'monthly-workflow',
    cadence: 'MONTHLY',
    label: '月次ワークフロー',
    objective: '判定履歴・運用レポート・ルール設定・リスク重みを月次で固定する。',
    steps: [
      { id: 'monthly-history', label: '現在判定を履歴保存', checklistId: 'monthly-decision-history', description: '現在判定をdecisionHistoryへ保存し、バックテスト用スナップショットを残す。', output: '判定結果を後で検証可能にする' },
      { id: 'monthly-report', label: '運用レポート出力', checklistId: 'monthly-operation-report', description: 'MD / JSONレポートを出力し、資産・判定・遵守・成績・完全性を固定。', output: '月次レビュー資料を生成' },
      { id: 'monthly-rule-review', label: 'ルール設定確認', checklistId: 'monthly-rule-review', description: 'ruleVersion、ruleReviewedAt、riskRegime、閾値、変更理由を確認。', output: 'RULE_CONFIG_REQUIREDを防ぐ' },
      { id: 'monthly-risk-weight', label: 'リスク重み診断を確認', checklistId: 'monthly-rule-review', description: 'riskWeightDiagnosticsのINCREASE / DECREASE / NEED_DATAを確認。', output: '重み改善候補を確認' },
    ],
  },
  {
    id: 'quarterly-workflow',
    cadence: 'QUARTERLY',
    label: '四半期ワークフロー',
    objective: '決算更新、業種別専用指標、証跡、ルール妥当性を四半期で棚卸しする。',
    steps: [
      { id: 'quarterly-financial', label: '財務データ更新', checklistId: 'quarterly-financial-refresh', description: '配当性向、営業CF、売上、EPS、自己資本比率、有利子負債倍率を更新。', output: '財務STALE_DATAを解消' },
      { id: 'quarterly-profile', label: '業種別専用指標更新', checklistId: 'quarterly-profile-metrics', description: 'BANK / REIT / UTILITY / CYCLICAL / GROWTH_TECH等の専用指標を更新。', output: 'PROFILE_DATA_REQUIREDを解消' },
      { id: 'quarterly-evidence', label: '根拠・証跡を再確認', checklistId: 'quarterly-financial-refresh', description: 'sourceUrl、sourceQuote、selectedEvidenceValue、sourcePageを最新資料で確認。', output: 'UNVERIFIED / WEAK / MISMATCHを削減' },
      { id: 'quarterly-rule', label: 'ルール・重みを棚卸し', checklistId: 'monthly-rule-review', description: 'ruleConfigとriskWeightConfigの変更理由、成績診断、NEED_DATAを確認。', output: '次期ルール改善候補を固定' },
    ],
  },
]

const sanitizeGuidedWorkflow = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { version: GUIDED_WORKFLOW_VERSION, activeWorkflowId: '', startedAt: '', completedSteps: {}, lastCompletedAt: '' }
  }
  const completedSteps = value.completedSteps && typeof value.completedSteps === 'object' && !Array.isArray(value.completedSteps) ? value.completedSteps : {}
  return {
    version: String(value.version || GUIDED_WORKFLOW_VERSION),
    activeWorkflowId: String(value.activeWorkflowId || ''),
    startedAt: String(value.startedAt || ''),
    completedSteps: Object.fromEntries(Object.entries(completedSteps).map(([key, val]) => [key, String(val || '')])),
    lastCompletedAt: String(value.lastCompletedAt || ''),
  }
}

const getGuidedStepKey = (workflowId, stepId) => `${workflowId}:${stepId}`

const sanitizeChecklist = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([id, item]) => [id, {
    completedAt: String(item?.completedAt || ''),
    note: String(item?.note || ''),
  }]))
}

const getChecklistStatus = (definition, entry) => {
  if (!entry?.completedAt) return { status: 'OVERDUE', ageDays: null, label: '未実施' }
  const completedDate = new Date(entry.completedAt)
  if (Number.isNaN(completedDate.getTime())) return { status: 'OVERDUE', ageDays: null, label: '日付不正' }
  const ageDays = Math.floor((Date.now() - completedDate.getTime()) / 86400000)
  if (ageDays > definition.maxAgeDays) return { status: 'OVERDUE', ageDays, label: `${ageDays}日経過` }
  return { status: 'DONE', ageDays, label: ageDays === 0 ? '本日実施' : `${ageDays}日前` }
}

const checklistTone = {
  DONE: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  OVERDUE: 'bg-red-50 border-red-200 text-red-800',
}


const decisionLabels = {
  INVALID_DATA: 'INVALID_DATA',
  UNVERIFIED_DATA: 'UNVERIFIED_DATA',
  WEAK_EVIDENCE: 'WEAK_EVIDENCE',
  MISMATCHED_EVIDENCE: 'MISMATCHED_EVIDENCE',
  MULTIPLE_EVIDENCE_VALUES: 'MULTIPLE_EVIDENCE_VALUES',
  PROFILE_DATA_REQUIRED: 'PROFILE_DATA_REQUIRED',
  STALE_DATA: 'STALE_DATA',
  BUY: 'BUY',
  HOLD: 'HOLD',
  WATCH: 'WATCH',
  REDUCE: 'REDUCE',
  SELL: 'SELL',
  NO_DATA: 'NO_DATA',
}

const decisionTone = {
  INVALID_DATA: 'bg-red-100 border-red-400 text-red-900',
  UNVERIFIED_DATA: 'bg-purple-50 border-purple-300 text-purple-800',
  WEAK_EVIDENCE: 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800',
  MISMATCHED_EVIDENCE: 'bg-rose-50 border-rose-300 text-rose-800',
  MULTIPLE_EVIDENCE_VALUES: 'bg-pink-50 border-pink-300 text-pink-800',
  PROFILE_DATA_REQUIRED: 'bg-indigo-50 border-indigo-300 text-indigo-800',
  STALE_DATA: 'bg-orange-50 border-orange-300 text-orange-800',
  BUY: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  HOLD: 'bg-sky-50 border-sky-300 text-sky-800',
  WATCH: 'bg-slate-50 border-slate-300 text-slate-700',
  REDUCE: 'bg-amber-50 border-amber-300 text-amber-800',
  SELL: 'bg-red-50 border-red-300 text-red-800',
  NO_DATA: 'bg-zinc-100 border-zinc-300 text-zinc-700',
}

const severityTone = {
  CRITICAL: 'text-red-700',
  HIGH: 'text-amber-700',
  MEDIUM: 'text-slate-700',
  LOW: 'text-emerald-700',
}

const holdingFields = [
  'shares',
  'averagePrice',
  'currentPrice',
  'annualDividend',
  'payoutRatio',
  'operatingCashFlowYoY',
  'revenueYoY',
  'epsYoY',
  'equityRatio',
  'debtToEquity',
  'dividendCut',
  'ruleProfile',
  'bankCapitalRatio',
  'bankNplRatio',
  'bankCreditCostRatio',
  'bankNetInterestMargin',
  'reitLtv',
  'reitOccupancyRate',
  'reitNavRatio',
  'reitFfoYoY',
  'utilityCapexToSales',
  'utilityFuelCostYoY',
  'cyclicalMarketIndexYoY',
  'inventoryYoY',
  'capacityUtilization',
  'growthFcfYoY',
  'operatingMargin',
  'rdToSales',
  'pipelineProgress',
  'financialAumYoY',
  'financialCreditCostRatio',
  'priceUpdatedAt',
  'financialUpdatedAt',
  'sourceName',
  'sourceUrl',
  'fiscalPeriod',
  'dataType',
  'confirmedAt',
  'sourcePage',
  'sourceQuote',
  'selectedEvidenceValue',
  'sourceMetricName',
  'sourceUnit',
  'evidenceMemo',
]

const dateFields = ['priceUpdatedAt', 'financialUpdatedAt', 'confirmedAt']
const evidenceFields = ['sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit', 'evidenceMemo']
const numericFields = holdingFields.filter((field) => field !== 'dividendCut' && field !== 'ruleProfile' && !dateFields.includes(field) && !evidenceFields.includes(field))
const nonNegativeFields = ['shares', 'averagePrice', 'currentPrice', 'annualDividend', 'payoutRatio', 'equityRatio', 'debtToEquity']
const signedFields = ['operatingCashFlowYoY', 'revenueYoY', 'epsYoY']

const validationRules = {
  shares: { label: '保有数', min: 0, max: 10000000, minExclusive: false },
  averagePrice: { label: '取得単価', min: 0, max: 10000000, minExclusive: true },
  currentPrice: { label: '現在価格', min: 0, max: 10000000, minExclusive: true },
  annualDividend: { label: '年間配当', min: 0, max: 1000000, minExclusive: false },
  payoutRatio: { label: '配当性向', min: 0, max: 300, minExclusive: false },
  operatingCashFlowYoY: { label: '営業CF前年比', min: -500, max: 500, minExclusive: false },
  revenueYoY: { label: '売上前年比', min: -500, max: 500, minExclusive: false },
  epsYoY: { label: 'EPS前年比', min: -500, max: 500, minExclusive: false },
  equityRatio: { label: '自己資本比率', min: 0, max: 100, minExclusive: false },
  debtToEquity: { label: '有利子負債倍率', min: 0, max: 100, minExclusive: false },
  bankCapitalRatio: { label: '銀行自己資本比率', min: 0, max: 30, minExclusive: false },
  bankNplRatio: { label: '不良債権比率', min: 0, max: 20, minExclusive: false },
  bankCreditCostRatio: { label: '与信費用率', min: 0, max: 10, minExclusive: false },
  bankNetInterestMargin: { label: '純金利マージン', min: -5, max: 10, minExclusive: false },
  reitLtv: { label: 'REIT LTV', min: 0, max: 100, minExclusive: false },
  reitOccupancyRate: { label: 'REIT 稼働率', min: 0, max: 100, minExclusive: false },
  reitNavRatio: { label: 'NAV倍率', min: 0, max: 5, minExclusive: false },
  reitFfoYoY: { label: 'FFO前年比', min: -500, max: 500, minExclusive: false },
  utilityCapexToSales: { label: '設備投資/売上比率', min: 0, max: 200, minExclusive: false },
  utilityFuelCostYoY: { label: '燃料費前年比', min: -500, max: 500, minExclusive: false },
  cyclicalMarketIndexYoY: { label: '市況指数前年比', min: -500, max: 500, minExclusive: false },
  inventoryYoY: { label: '在庫前年比', min: -500, max: 500, minExclusive: false },
  capacityUtilization: { label: '設備稼働率', min: 0, max: 100, minExclusive: false },
  growthFcfYoY: { label: 'FCF前年比', min: -500, max: 500, minExclusive: false },
  operatingMargin: { label: '営業利益率', min: -100, max: 100, minExclusive: false },
  rdToSales: { label: '研究開発費率', min: 0, max: 100, minExclusive: false },
  pipelineProgress: { label: 'パイプライン進捗率', min: 0, max: 100, minExclusive: false },
  financialAumYoY: { label: '運用資産前年比', min: -500, max: 500, minExclusive: false },
  financialCreditCostRatio: { label: '金融与信費用率', min: 0, max: 10, minExclusive: false },
}

const usdJpyRule = { label: 'USD/JPY', min: 50, max: 300, minExclusive: false }
const staleRules = {
  price: { label: '現在価格', maxAgeDays: 7 },
  financial: { label: '財務データ', maxAgeDays: 100 },
  fx: { label: 'USD/JPY', maxAgeDays: 7 },
}

const dataTypeOptions = [
  { value: 'actual', label: '実績' },
  { value: 'company_forecast', label: '会社予想' },
  { value: 'analyst_forecast', label: 'アナリスト予想' },
]
const allowedDataTypes = dataTypeOptions.map((option) => option.value)

const ruleProfileOptions = [
  { value: 'GENERAL', label: 'GENERAL / 一般事業会社' },
  { value: 'BANK', label: 'BANK / 銀行' },
  { value: 'REIT', label: 'REIT / REIT' },
  { value: 'UTILITY', label: 'UTILITY / 電力・通信・公益' },
  { value: 'CYCLICAL', label: 'CYCLICAL / 景気敏感' },
  { value: 'GROWTH_TECH', label: 'GROWTH_TECH / 成長IT' },
  { value: 'HEALTHCARE', label: 'HEALTHCARE / 医薬・ヘルスケア' },
  { value: 'FINANCIAL', label: 'FINANCIAL / 証券・リース・金融' },
]
const allowedRuleProfiles = ruleProfileOptions.map((option) => option.value)


const coverageFieldLabels = {
  shares: '保有数', averagePrice: '取得単価', currentPrice: '現在価格', annualDividend: '年間配当',
  payoutRatio: '配当性向', operatingCashFlowYoY: '営業CF前年比', revenueYoY: '売上前年比', epsYoY: 'EPS前年比', equityRatio: '自己資本比率', debtToEquity: '有利子負債倍率', dividendCut: '減配有無',
  priceUpdatedAt: '価格更新日', financialUpdatedAt: '財務更新日', fxUpdatedAt: 'USD/JPY更新日',
  sourceName: '取得元名', sourceUrl: '根拠URL', fiscalPeriod: '対象決算期', dataType: 'データ種別', confirmedAt: '根拠確認日', sourcePage: '根拠ページ', sourceQuote: '引用文', selectedEvidenceValue: '採用証跡値', sourceMetricName: '参照指標名', sourceUnit: '単位', evidenceMemo: '証跡補足', ruleProfile: '判定プロファイル',
  bankCapitalRatio: '銀行自己資本比率', bankNplRatio: '不良債権比率', bankCreditCostRatio: '与信費用率', bankNetInterestMargin: '純金利マージン',
  reitLtv: 'REIT LTV', reitOccupancyRate: 'REIT 稼働率', reitNavRatio: 'NAV倍率', reitFfoYoY: 'FFO前年比',
  utilityCapexToSales: '設備投資/売上', utilityFuelCostYoY: '燃料費前年比', cyclicalMarketIndexYoY: '市況指数前年比', inventoryYoY: '在庫前年比', capacityUtilization: '設備稼働率',
  growthFcfYoY: 'FCF前年比', operatingMargin: '営業利益率', rdToSales: 'R&D/売上', pipelineProgress: 'パイプライン進捗率', financialAumYoY: '運用資産前年比', financialCreditCostRatio: '金融与信費用率',
  decisionHistory: '判定履歴', actionTracking: '実行記録', outcomeEvaluation: '結果評価',
}
const getCoverageFieldLabel = (field) => coverageFieldLabels[field] || validationRules[field]?.label || field

const missingDataTemplateHints = {
  shares: { reason: '評価額・保有比率・損益計算に必要', hint: '保有株数。未保有なら0。', sourceRequired: '取引履歴 / 証券口座' },
  averagePrice: { reason: '取得額・含み損益率の計算に必要', hint: '平均取得単価。通貨は銘柄通貨。', sourceRequired: '取引履歴 / 証券口座' },
  currentPrice: { reason: '評価額・利回り・集中度の計算に必要', hint: '現在価格。価格更新日も同時更新。', sourceRequired: '市場価格 / 証券口座' },
  annualDividend: { reason: '年間配当・配当利回り計算に必要', hint: '1株あたり年間配当。', sourceRequired: 'IR / 配当情報' },
  payoutRatio: { reason: 'SELL / REDUCE / BUY判定に必要', hint: '配当性向%。', sourceRequired: '決算短信 / 10-K / IR資料' },
  operatingCashFlowYoY: { reason: 'キャッシュフロー悪化判定に必要', hint: '営業CF前年比%。', sourceRequired: '決算資料 / キャッシュフロー計算書' },
  revenueYoY: { reason: '売上成長・景気悪化判定に必要', hint: '売上前年比%。', sourceRequired: '決算資料 / 損益計算書' },
  epsYoY: { reason: '利益悪化・BUY条件判定に必要', hint: 'EPS前年比%。', sourceRequired: '決算資料 / EPS実績' },
  equityRatio: { reason: '財務安全性判定に必要', hint: '自己資本比率%。', sourceRequired: '決算資料 / 貸借対照表' },
  debtToEquity: { reason: '負債リスク判定に必要', hint: '有利子負債倍率。', sourceRequired: '決算資料 / 財務指標' },
  dividendCut: { reason: '強制SELL判定に必要', hint: 'true/false または あり/なし。', sourceRequired: '配当履歴 / IR発表' },
  priceUpdatedAt: { reason: '価格データ鮮度判定に必要', hint: 'YYYY-MM-DD。', sourceRequired: '価格確認日' },
  financialUpdatedAt: { reason: '財務データ鮮度判定に必要', hint: 'YYYY-MM-DD。', sourceRequired: '財務データ確認日' },
  fxUpdatedAt: { reason: '米国株円換算の鮮度判定に必要', hint: 'YYYY-MM-DD。', sourceRequired: '為替確認日' },
  sourceName: { reason: '根拠未確認判定を防ぐために必要', hint: '例: 決算短信 / Form 10-K / IR Presentation。', sourceRequired: '根拠資料名' },
  sourceUrl: { reason: '根拠URL検証に必要', hint: 'https:// で始まるURL。', sourceRequired: 'IR資料URL' },
  fiscalPeriod: { reason: '決算期ズレ防止に必要', hint: '例: FY2025 Q2。', sourceRequired: '対象決算期' },
  dataType: { reason: '実績・予想の混同防止に必要', hint: 'actual / company_forecast / analyst_forecast。', sourceRequired: 'データ種別' },
  confirmedAt: { reason: '根拠確認日の検証に必要', hint: 'YYYY-MM-DD。', sourceRequired: '確認日' },
  sourcePage: { reason: '証跡ページ特定に必要', hint: '1以上の整数。', sourceRequired: 'PDF/資料ページ' },
  sourceQuote: { reason: '引用値照合に必要', hint: '数値を含む引用文。', sourceRequired: '資料内の該当文言' },
  selectedEvidenceValue: { reason: '複数数値引用時の採用値特定に必要', hint: '実際に入力値へ採用した数値。', sourceRequired: '引用文内の採用数値' },
  sourceMetricName: { reason: '引用値と入力項目の対応付けに必要', hint: '例: 配当性向 / EPS前年比。', sourceRequired: '指標名' },
  sourceUnit: { reason: '単位ミス防止に必要', hint: '例: % / 倍 / 円 / USD。', sourceRequired: '単位' },
  ruleProfile: { reason: '業種別ルール判定に必要', hint: 'GENERAL / BANK / REIT等。', sourceRequired: '銘柄分類' },
  decisionHistory: { reason: 'ルール成績評価の母集団に必要', hint: '現在判定を履歴保存する。', sourceRequired: 'アプリ操作' },
  actionTracking: { reason: '判定遵守率・未実行検出に必要', hint: '実行有無・価格・株数を入力。', sourceRequired: '売買履歴' },
  outcomeEvaluation: { reason: '判定成績・重み診断に必要', hint: '結果価格・配当・確認日を入力。', sourceRequired: '結果確認データ' },
}
const getMissingDataTemplateHint = (field) => missingDataTemplateHints[field] || { reason: `${getCoverageFieldLabel(field)}が判定・診断に必要`, hint: '根拠資料に基づき入力。', sourceRequired: '確認が必要' }

const profileMetricDefinitions = {
  BANK: [
    { field: 'bankCapitalRatio', label: '銀行自己資本比率(%)', placeholder: '例: 10.5' },
    { field: 'bankNplRatio', label: '不良債権比率(%)', placeholder: '例: 1.2' },
    { field: 'bankCreditCostRatio', label: '与信費用率(%)', placeholder: '例: 0.4' },
    { field: 'bankNetInterestMargin', label: '純金利マージン(%)', placeholder: '例: 1.1', signed: true },
  ],
  REIT: [
    { field: 'reitLtv', label: 'LTV(%)', placeholder: '例: 45' },
    { field: 'reitOccupancyRate', label: '稼働率(%)', placeholder: '例: 98' },
    { field: 'reitNavRatio', label: 'NAV倍率(倍)', placeholder: '例: 1.05' },
    { field: 'reitFfoYoY', label: 'FFO前年比(%)', placeholder: '例: 3', signed: true },
  ],
  UTILITY: [
    { field: 'utilityCapexToSales', label: '設備投資/売上(%)', placeholder: '例: 35' },
    { field: 'utilityFuelCostYoY', label: '燃料費前年比(%)', placeholder: '例: 12', signed: true },
  ],
  CYCLICAL: [
    { field: 'cyclicalMarketIndexYoY', label: '市況指数前年比(%)', placeholder: '例: -8', signed: true },
    { field: 'inventoryYoY', label: '在庫前年比(%)', placeholder: '例: 15', signed: true },
    { field: 'capacityUtilization', label: '設備稼働率(%)', placeholder: '例: 78' },
  ],
  GROWTH_TECH: [
    { field: 'growthFcfYoY', label: 'FCF前年比(%)', placeholder: '例: 18', signed: true },
    { field: 'operatingMargin', label: '営業利益率(%)', placeholder: '例: 25', signed: true },
    { field: 'rdToSales', label: 'R&D/売上(%)', placeholder: '例: 14' },
  ],
  HEALTHCARE: [
    { field: 'rdToSales', label: 'R&D/売上(%)', placeholder: '例: 18' },
    { field: 'pipelineProgress', label: 'パイプライン進捗率(%)', placeholder: '例: 60' },
  ],
  FINANCIAL: [
    { field: 'financialAumYoY', label: '運用資産前年比(%)', placeholder: '例: 6', signed: true },
    { field: 'financialCreditCostRatio', label: '金融与信費用率(%)', placeholder: '例: 0.5' },
  ],
  GENERAL: [],
}

const getProfileMetrics = (profile) => profileMetricDefinitions[profile] || []

const getProfileDataRequiredReasons = (stock) => {
  const metrics = getProfileMetrics(stock.ruleProfile)
  return metrics
    .filter((metric) => stock[metric.field] === null)
    .map((metric) => `${stock.ruleProfile}: 専用指標「${metric.label.replace(/\(.+?\)/g, '')}」が未入力`)
}

const inferRuleProfile = (stock) => {
  const text = `${stock.code} ${stock.name} ${stock.market} ${stock.group} ${stock.business} ${(stock.tags || []).join(' ')}`
  if (stock.code === 'O' || text.includes('REIT')) return 'REIT'
  if (text.includes('銀行') || ['8304', '8410', '8713'].includes(stock.code)) return 'BANK'
  if (text.includes('証券') || text.includes('リース') || text.includes('金融持株') || ['8473', '8593', '8614', '8616'].includes(stock.code)) return 'FINANCIAL'
  if (text.includes('電力') || text.includes('公益') || text.includes('通信') || ['9432', '9436', '9503', '9513', 'DUK', 'ES', 'NEE', 'T', 'VZ'].includes(stock.code)) return 'UTILITY'
  if (text.includes('医薬') || text.includes('医療') || text.includes('ワクチン') || text.includes('ヘルスケア') || ['ABBV', 'JNJ', '4502', '4503', '4539', '8086'].includes(stock.code)) return 'HEALTHCARE'
  if (text.includes('鉄鋼') || text.includes('海運') || text.includes('自動車') || text.includes('航空') || text.includes('建設機械') || ['5401', '5406', '5408', '5411', '9104', '9110', '9202', 'DAL', 'F'].includes(stock.code)) return 'CYCLICAL'
  if (text.includes('AI') || text.includes('クラウド') || text.includes('半導体') || ['MSFT', 'GOOGL', 'AVGO', 'AMZN', 'ADBE', 'ORCL', 'TYL'].includes(stock.code)) return 'GROWTH_TECH'
  return 'GENERAL'
}

const todayInputDate = () => new Date().toISOString().slice(0, 10)

const parseInputDate = (value) => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const daysSince = (value) => {
  const date = parseInputDate(value)
  if (!date) return null
  const today = parseInputDate(todayInputDate())
  return Math.floor((today.getTime() - date.getTime()) / 86400000)
}

const validateDateValue = (label, value) => {
  if (value === '' || value === null || value === undefined) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return `${label}がYYYY-MM-DD形式ではありません`
  const age = daysSince(value)
  if (age === null) return `${label}が有効な日付ではありません`
  if (age < 0) return `${label}が未来日です`
  return null
}


const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const toBooleanOrNull = (value) => {
  if (value === true || value === 'true' || value === 'あり' || value === '1') return true
  if (value === false || value === 'false' || value === 'なし' || value === '0') return false
  return null
}

const normalizeBoolean = (value) => {
  const bool = toBooleanOrNull(value)
  return bool === null ? '' : String(bool)
}

const formatNumber = (value, digits = 0) => {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

const formatJPY = (value) => {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPercent = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '-'
  return `${formatNumber(value, digits)}%`
}

const parseCsvLine = (line) => {
  const cells = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      insideQuotes = !insideQuotes
      continue
    }

    if (char === ',' && !insideQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

const parseCsvText = (text) => {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return headers.reduce((record, header, index) => {
      record[header] = cells[index] ?? ''
      return record
    }, {})
  })

  return { headers, rows }
}

const getCsvValue = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key]
  }
  return ''
}

const normalizeImportNumber = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  return String(value).replace(/,/g, '').trim()
}

const validateNumericValue = (field, value, customRule = null) => {
  if (value === '' || value === null || value === undefined) return null

  const normalized = String(value).replace(/,/g, '').trim()
  if (normalized === '') return null

  const number = Number(normalized)
  const rule = customRule || validationRules[field]
  const label = rule?.label || field

  if (!Number.isFinite(number)) return `${label}が数値ではありません`
  if (rule?.min !== undefined) {
    const invalidMin = rule.minExclusive ? number <= rule.min : number < rule.min
    if (invalidMin) return `${label}が下限値を下回っています（${rule.minExclusive ? '>' : '≧'}${rule.min}）`
  }
  if (rule?.max !== undefined && number > rule.max) return `${label}が上限値を超えています（≦${rule.max}）`

  return null
}

const isImportableNumberForField = (field, value) => validateNumericValue(field, value) === null

const validateHoldingInput = (holding, stock, usdJpyInputValue, fxUpdatedAtValue) => {
  const errors = []
  const fieldErrors = {}

  for (const field of numericFields) {
    const error = validateNumericValue(field, holding?.[field])
    if (error) {
      fieldErrors[field] = error
      errors.push(error)
    }
  }

  const dividendCutValue = holding?.dividendCut
  if (dividendCutValue !== '' && dividendCutValue !== undefined && dividendCutValue !== null && toBooleanOrNull(dividendCutValue) === null) {
    const error = '減配有無が true / false / あり / なし ではありません'
    fieldErrors.dividendCut = error
    errors.push(error)
  }

  const priceDateError = validateDateValue('価格更新日', holding?.priceUpdatedAt)
  if (priceDateError) {
    fieldErrors.priceUpdatedAt = priceDateError
    errors.push(priceDateError)
  }

  const financialDateError = validateDateValue('財務更新日', holding?.financialUpdatedAt)
  if (financialDateError) {
    fieldErrors.financialUpdatedAt = financialDateError
    errors.push(financialDateError)
  }

  if (stock?.currency === 'USD') {
    const error = validateNumericValue('usdJpy', usdJpyInputValue, usdJpyRule)
    if (error) {
      fieldErrors.usdJpy = error
      errors.push(error)
    }
    const fxDateError = validateDateValue('USD/JPY更新日', fxUpdatedAtValue)
    if (fxDateError) {
      fieldErrors.fxUpdatedAt = fxDateError
      errors.push(fxDateError)
    }
  }

  return { errors: [...new Set(errors)], fieldErrors }
}

const normalizeImportedHolding = (raw) => {
  const normalized = {}
  for (const field of numericFields) {
    normalized[field] = normalizeImportNumber(raw[field])
  }
  normalized.dividendCut = normalizeBoolean(raw.dividendCut)
  normalized.priceUpdatedAt = String(raw.priceUpdatedAt || '').trim()
  normalized.financialUpdatedAt = String(raw.financialUpdatedAt || '').trim()
  normalized.sourceName = String(raw.sourceName || '').trim()
  normalized.sourceUrl = String(raw.sourceUrl || '').trim()
  normalized.fiscalPeriod = String(raw.fiscalPeriod || '').trim()
  normalized.dataType = String(raw.dataType || '').trim()
  normalized.confirmedAt = String(raw.confirmedAt || '').trim()
  normalized.sourcePage = String(raw.sourcePage || '').trim()
  normalized.sourceQuote = String(raw.sourceQuote || '').trim()
  normalized.selectedEvidenceValue = String(raw.selectedEvidenceValue || '').replace(/,/g, '').trim()
  normalized.sourceMetricName = String(raw.sourceMetricName || '').trim()
  normalized.sourceUnit = String(raw.sourceUnit || '').trim()
  normalized.evidenceMemo = String(raw.evidenceMemo || '').trim()
  return normalized
}

const isValidImportedHolding = (holding) => {
  const dateLabels = { priceUpdatedAt: '価格更新日', financialUpdatedAt: '財務更新日', confirmedAt: '根拠確認日' }
  return numericFields.every((field) => isImportableNumberForField(field, holding[field])) &&
    ['', 'true', 'false'].includes(holding.dividendCut) &&
    dateFields.every((field) => validateDateValue(dateLabels[field] || field, holding[field]) === null)
}


const normalizeMissingDataImportValue = (fieldName, value) => {
  const raw = String(value ?? '').trim()
  if (!fieldName || raw === '') return { ok: false, value: '', reason: '値が空です' }

  if (numericFields.includes(fieldName)) {
    const normalized = normalizeImportNumber(raw)
    if (!isImportableNumberForField(fieldName, normalized)) return { ok: false, value: normalized, reason: `${getCoverageFieldLabel(fieldName)}の数値が許容範囲外です` }
    return { ok: true, value: normalized, reason: '' }
  }

  if (fieldName === 'dividendCut') {
    const normalized = normalizeBoolean(raw)
    if (!['true', 'false'].includes(normalized)) return { ok: false, value: normalized, reason: '減配有無は true / false / あり / なし のみ有効です' }
    return { ok: true, value: normalized, reason: '' }
  }

  if (fieldName === 'ruleProfile') {
    const normalized = raw.toUpperCase()
    if (!allowedRuleProfiles.includes(normalized)) return { ok: false, value: normalized, reason: '判定プロファイルが許可値外です' }
    return { ok: true, value: normalized, reason: '' }
  }

  if (dateFields.includes(fieldName)) {
    const error = validateDateValue(getCoverageFieldLabel(fieldName), raw)
    if (error) return { ok: false, value: raw, reason: error }
    return { ok: true, value: raw, reason: '' }
  }

  if (evidenceFields.includes(fieldName)) return { ok: true, value: raw, reason: '' }

  return { ok: false, value: raw, reason: '取込対象外の項目です' }
}


const hasAnyEvidenceTargetData = (holding) => {
  const targetFields = [
    'currentPrice',
    'annualDividend',
    'payoutRatio',
    'operatingCashFlowYoY',
    'revenueYoY',
    'epsYoY',
    'equityRatio',
    'debtToEquity',
    'dividendCut',
  ]
  return targetFields.some((field) => holding?.[field] !== '' && holding?.[field] !== undefined && holding?.[field] !== null)
}

const validateVerificationInput = (holding) => {
  const errors = []
  const fieldErrors = {}

  if (!hasAnyEvidenceTargetData(holding)) return { errors, fieldErrors }

  const sourceName = String(holding?.sourceName || '').trim()
  const sourceUrl = String(holding?.sourceUrl || '').trim()
  const fiscalPeriod = String(holding?.fiscalPeriod || '').trim()
  const dataType = String(holding?.dataType || '').trim()
  const confirmedAt = String(holding?.confirmedAt || '').trim()

  if (!sourceName) {
    const error = 'データ取得元が未入力'
    fieldErrors.sourceName = error
    errors.push(error)
  }

  if (!sourceUrl) {
    const error = '根拠URLが未入力'
    fieldErrors.sourceUrl = error
    errors.push(error)
  } else if (!/^https?:\/\//.test(sourceUrl)) {
    const error = '根拠URLがhttp/httpsで始まっていません'
    fieldErrors.sourceUrl = error
    errors.push(error)
  }

  if (!fiscalPeriod) {
    const error = '対象決算期が未入力'
    fieldErrors.fiscalPeriod = error
    errors.push(error)
  } else if (!/\d{4}|FY\d{2,4}|\d{2,4}Q[1-4]|Q[1-4]/i.test(fiscalPeriod)) {
    const error = '対象決算期の形式が不明'
    fieldErrors.fiscalPeriod = error
    errors.push(error)
  }

  if (!dataType) {
    const error = 'データ種別が未選択'
    fieldErrors.dataType = error
    errors.push(error)
  } else if (!allowedDataTypes.includes(dataType)) {
    const error = 'データ種別が actual / company_forecast / analyst_forecast ではありません'
    fieldErrors.dataType = error
    errors.push(error)
  }

  if (!confirmedAt) {
    const error = '根拠確認日が未入力'
    fieldErrors.confirmedAt = error
    errors.push(error)
  } else {
    const dateError = validateDateValue('根拠確認日', confirmedAt)
    if (dateError) {
      fieldErrors.confirmedAt = dateError
      errors.push(dateError)
    }
  }

  return { errors: [...new Set(errors)], fieldErrors }
}


const validateEvidenceStrengthInput = (holding) => {
  const errors = []
  const fieldErrors = {}

  if (!hasAnyEvidenceTargetData(holding)) return { errors, fieldErrors }

  const sourcePage = String(holding?.sourcePage || '').trim()
  const sourceQuote = String(holding?.sourceQuote || '').trim()
  const sourceMetricName = String(holding?.sourceMetricName || '').trim()
  const sourceUnit = String(holding?.sourceUnit || '').trim()

  if (!sourcePage) {
    const error = '根拠ページが未入力'
    fieldErrors.sourcePage = error
    errors.push(error)
  } else if (!/^\d+$/.test(sourcePage) || Number(sourcePage) < 1) {
    const error = '根拠ページが1以上の整数ではありません'
    fieldErrors.sourcePage = error
    errors.push(error)
  }

  if (!sourceQuote) {
    const error = '引用文・該当数値が未入力'
    fieldErrors.sourceQuote = error
    errors.push(error)
  } else {
    if (sourceQuote.length < 5) {
      const error = '引用文・該当数値が短すぎます'
      fieldErrors.sourceQuote = error
      errors.push(error)
    }
    if (!/[0-9０-９]/.test(sourceQuote)) {
      const error = '引用文・該当数値に数値が含まれていません'
      fieldErrors.sourceQuote = error
      errors.push(error)
    }
  }

  if (!sourceMetricName) {
    const error = '参照指標名が未入力'
    fieldErrors.sourceMetricName = error
    errors.push(error)
  }

  if (!sourceUnit) {
    const error = '単位が未入力'
    fieldErrors.sourceUnit = error
    errors.push(error)
  }


  return { errors: [...new Set(errors)], fieldErrors }
}

const evidenceMetricDefinitions = [
  { field: 'payoutRatio', labels: ['配当性向', 'payout'], tolerance: 0.2, label: '配当性向' },
  { field: 'operatingCashFlowYoY', labels: ['営業CF前年比', '営業キャッシュフロー前年比', '営業cf', 'operating cash flow'], tolerance: 0.2, label: '営業CF前年比' },
  { field: 'revenueYoY', labels: ['売上前年比', '売上高前年比', 'revenue', 'sales'], tolerance: 0.2, label: '売上前年比' },
  { field: 'epsYoY', labels: ['EPS前年比', 'eps'], tolerance: 0.2, label: 'EPS前年比' },
  { field: 'equityRatio', labels: ['自己資本比率', 'equity ratio'], tolerance: 0.2, label: '自己資本比率' },
  { field: 'debtToEquity', labels: ['有利子負債倍率', 'debt to equity', 'de ratio', 'd/e'], tolerance: 0.05, label: '有利子負債倍率' },
  { field: 'annualDividend', labels: ['年間配当', '1株配当', '配当金', 'dividend'], tolerance: 0.01, label: '年間配当' },
  { field: 'currentPrice', labels: ['現在価格', '株価', 'current price', 'price'], tolerance: 0.01, label: '現在価格' },
]

const normalizeEvidenceText = (value) => String(value || '')
  .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
  .replace(/[＋－−]/g, (char) => (char === '＋' ? '+' : '-'))
  .replace(/，/g, ',')
  .replace(/．/g, '.')

const extractNumbersFromQuote = (quote) => {
  const normalized = normalizeEvidenceText(quote)
  const matches = normalized.match(/[+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[+-]?\d+(?:\.\d+)?/g) || []
  return matches
    .map((item) => Number(item.replace(/,/g, '')))
    .filter((number) => Number.isFinite(number))
}

const findEvidenceMetricDefinition = (metricName) => {
  const normalized = normalizeEvidenceText(metricName).toLowerCase().replace(/\s+/g, '')
  return evidenceMetricDefinitions.find((definition) =>
    definition.labels.some((label) => normalized.includes(label.toLowerCase().replace(/\s+/g, '')))
  ) || null
}

const parseSelectedEvidenceValue = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(number) ? number : null
}

const checkEvidenceMatch = (stock) => {
  const emptyResult = { status: 'NOT_APPLICABLE', errors: [], multipleEvidenceValueErrors: [], quotedValue: null, selectedEvidenceValue: null, inputValue: null, difference: null, matchedField: '', matchedMetricLabel: '', multipleNumbers: false, extractedNumbers: [] }

  if (!hasAnyEvidenceTargetData(stock.holding)) {
    return emptyResult
  }

  const definition = findEvidenceMetricDefinition(stock.sourceMetricName)
  if (!definition) {
    return emptyResult
  }

  const inputValue = stock[definition.field]
  if (inputValue === null || inputValue === undefined || !Number.isFinite(inputValue)) {
    return { ...emptyResult, matchedField: definition.field, matchedMetricLabel: definition.label }
  }

  const extractedNumbers = extractNumbersFromQuote(stock.sourceQuote)
  if (extractedNumbers.length === 0) {
    return { ...emptyResult, inputValue, matchedField: definition.field, matchedMetricLabel: definition.label, extractedNumbers }
  }

  const multipleNumbers = extractedNumbers.length >= 2
  const selectedEvidenceValue = parseSelectedEvidenceValue(stock.selectedEvidenceValue)
  const multipleEvidenceValueErrors = []

  if (multipleNumbers && selectedEvidenceValue === null) {
    multipleEvidenceValueErrors.push('引用文に複数の数値があります。採用証跡値を指定してください。')
    return {
      status: 'MULTIPLE_VALUES',
      errors: [],
      multipleEvidenceValueErrors,
      quotedValue: null,
      selectedEvidenceValue: null,
      inputValue,
      difference: null,
      matchedField: definition.field,
      matchedMetricLabel: definition.label,
      multipleNumbers,
      extractedNumbers,
    }
  }

  let quotedValue = extractedNumbers[0]
  if (multipleNumbers) {
    const selectedMatched = extractedNumbers.some((value) => Math.abs(value - selectedEvidenceValue) <= definition.tolerance)
    if (!selectedMatched) {
      multipleEvidenceValueErrors.push(`採用証跡値${selectedEvidenceValue}が引用文内の数値と一致しません（許容差±${definition.tolerance}）`)
      return {
        status: 'MULTIPLE_VALUES',
        errors: [],
        multipleEvidenceValueErrors,
        quotedValue: null,
        selectedEvidenceValue,
        inputValue,
        difference: null,
        matchedField: definition.field,
        matchedMetricLabel: definition.label,
        multipleNumbers,
        extractedNumbers,
      }
    }
    quotedValue = selectedEvidenceValue
  }

  const difference = Math.abs(quotedValue - inputValue)
  const matched = difference <= definition.tolerance

  return {
    status: matched ? 'MATCH' : 'MISMATCH',
    errors: matched ? [] : [`証跡不一致: ${definition.label}の入力値${inputValue}と採用証跡値${quotedValue}の差分が${difference.toFixed(2)}（許容差±${definition.tolerance}）`],
    multipleEvidenceValueErrors,
    quotedValue,
    selectedEvidenceValue: multipleNumbers ? selectedEvidenceValue : quotedValue,
    inputValue,
    difference,
    matchedField: definition.field,
    matchedMetricLabel: definition.label,
    multipleNumbers,
    extractedNumbers,
  }
}


const auditImpactFields = new Set([
  'shares', 'averagePrice', 'currentPrice', 'annualDividend', 'payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'dividendCut', 'ruleProfile',
  'bankCapitalRatio', 'bankNplRatio', 'bankCreditCostRatio', 'bankNetInterestMargin', 'reitLtv', 'reitOccupancyRate', 'reitNavRatio', 'reitFfoYoY', 'utilityCapexToSales', 'utilityFuelCostYoY', 'cyclicalMarketIndexYoY', 'inventoryYoY', 'capacityUtilization', 'growthFcfYoY', 'operatingMargin', 'rdToSales', 'pipelineProgress', 'financialAumYoY', 'financialCreditCostRatio',
  'priceUpdatedAt', 'financialUpdatedAt', 'fxUpdatedAt', 'sourceUrl', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit', 'outcomePrice', 'outcomeDividend', 'actionPrice', 'actionShares', 'actionDate', 'ruleVersion', 'riskRegime'
])

const getAuditImpactLevel = (fieldName, previousValue, newValue, decisionBefore = '', decisionAfter = '') => {
  if (String(decisionBefore || '') && String(decisionAfter || '') && String(decisionBefore) !== String(decisionAfter)) return 'HIGH'
  if (auditImpactFields.has(fieldName)) return 'HIGH'
  if (String(previousValue ?? '') !== String(newValue ?? '')) return 'MEDIUM'
  return 'LOW'
}

const sanitizeAuditLog = (items) => {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => item && typeof item === 'object' && item.changedAt && item.fieldName)
    .map((item) => ({
      id: String(item.id || `${item.changedAt}-${item.code || 'SYSTEM'}-${item.fieldName}`),
      changedAt: String(item.changedAt || ''),
      code: String(item.code || 'SYSTEM'),
      name: String(item.name || ''),
      fieldName: String(item.fieldName || ''),
      previousValue: item.previousValue === undefined || item.previousValue === null ? '' : String(item.previousValue),
      newValue: item.newValue === undefined || item.newValue === null ? '' : String(item.newValue),
      changeSource: String(item.changeSource || 'manual'),
      decisionBefore: String(item.decisionBefore || ''),
      decisionAfter: String(item.decisionAfter || ''),
      ruleVersion: String(item.ruleVersion || DECISION_HISTORY_VERSION),
      impactLevel: String(item.impactLevel || getAuditImpactLevel(String(item.fieldName || ''), item.previousValue, item.newValue, item.decisionBefore, item.decisionAfter)),
    }))
}

const buildAuditStats = (auditLog) => {
  const now = Date.now()
  const stats = {
    total: auditLog.length,
    last24h: 0,
    high: 0,
    medium: 0,
    low: 0,
    csvImport: 0,
    jsonRestore: 0,
    manual: 0,
    ruleConfig: 0,
    decisionChanged: 0,
  }

  for (const item of auditLog) {
    const changedAt = new Date(item.changedAt).getTime()
    if (Number.isFinite(changedAt) && now - changedAt <= 86400000) stats.last24h += 1
    if (item.impactLevel === 'HIGH') stats.high += 1
    else if (item.impactLevel === 'MEDIUM') stats.medium += 1
    else stats.low += 1
    if (item.changeSource === 'csv_import') stats.csvImport += 1
    else if (item.changeSource === 'json_restore') stats.jsonRestore += 1
    else if (item.changeSource === 'rule_config') stats.ruleConfig += 1
    else if (item.changeSource === 'manual') stats.manual += 1
    if (item.decisionBefore && item.decisionAfter && item.decisionBefore !== item.decisionAfter) stats.decisionChanged += 1
  }
  return stats
}

const buildAuditEntry = ({ code = 'SYSTEM', name = '', fieldName, previousValue = '', newValue = '', changeSource = 'manual', decisionBefore = '', decisionAfter = '', ruleVersion = DECISION_HISTORY_VERSION }) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  changedAt: new Date().toISOString(),
  code,
  name,
  fieldName,
  previousValue: previousValue === undefined || previousValue === null ? '' : String(previousValue),
  newValue: newValue === undefined || newValue === null ? '' : String(newValue),
  changeSource,
  decisionBefore,
  decisionAfter,
  ruleVersion,
  impactLevel: getAuditImpactLevel(fieldName, previousValue, newValue, decisionBefore, decisionAfter),
})


const blockingDecisionSet = new Set([
  'INVALID_DATA',
  'UNVERIFIED_DATA',
  'WEAK_EVIDENCE',
  'MULTIPLE_EVIDENCE_VALUES',
  'MISMATCHED_EVIDENCE',
  'PROFILE_DATA_REQUIRED',
  'RULE_CONFIG_REQUIRED',
  'STALE_DATA',
  'NO_DATA',
])

const getRiskPriorityLevel = (score, riskWeightConfig = DEFAULT_RISK_WEIGHT_CONFIG) => {
  if (score >= getRiskLevelThreshold(riskWeightConfig, 'critical')) return 'CRITICAL'
  if (score >= getRiskLevelThreshold(riskWeightConfig, 'high')) return 'HIGH'
  if (score >= getRiskLevelThreshold(riskWeightConfig, 'medium')) return 'MEDIUM'
  return 'LOW'
}

const riskPriorityTone = {
  CRITICAL: 'bg-red-50 border-red-300 text-red-800',
  HIGH: 'bg-amber-50 border-amber-300 text-amber-800',
  MEDIUM: 'bg-sky-50 border-sky-300 text-sky-800',
  LOW: 'bg-emerald-50 border-emerald-300 text-emerald-800',
}

const addRiskDriver = (drivers, points, label, level = 'MEDIUM', key = '') => {
  if (!points || points <= 0) return
  drivers.push({ points, label, level, key })
}

const calculateRiskPriority = (stock, history = [], riskWeightConfig = DEFAULT_RISK_WEIGHT_CONFIG) => {
  const drivers = []
  const decision = stock.decisionResult?.decision || 'UNKNOWN'
  const severity = stock.decisionResult?.severity || 'MEDIUM'

  if (decision === 'SELL') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'decisionSell'), 'SELL判定', 'CRITICAL', 'decisionSell')
  else if (decision === 'REDUCE') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'decisionReduce'), 'REDUCE判定', 'HIGH', 'decisionReduce')
  else if (blockingDecisionSet.has(decision)) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'blockingDecision'), `${decision}で通常判定停止`, 'HIGH', 'blockingDecision')
  else if (decision === 'BUY') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'decisionBuy'), 'BUY判定。未実行なら機会損失候補', 'MEDIUM', 'decisionBuy')

  if (severity === 'CRITICAL') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'severityCritical'), '重大度CRITICAL', 'CRITICAL', 'severityCritical')
  else if (severity === 'HIGH') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'severityHigh'), '重大度HIGH', 'HIGH', 'severityHigh')

  if ((stock.positionWeight || 0) >= 8) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'positionOver8'), `個別銘柄比率 ${formatPercent(stock.positionWeight)}`, 'HIGH', 'positionOver8')
  else if ((stock.positionWeight || 0) >= 5) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'positionOver5'), `個別銘柄比率 ${formatPercent(stock.positionWeight)}`, 'MEDIUM', 'positionOver5')

  if ((stock.sectorWeight || 0) >= 25) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'sectorOver25'), `セクター比率 ${formatPercent(stock.sectorWeight)}`, 'HIGH', 'sectorOver25')
  else if ((stock.sectorWeight || 0) >= 20) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'sectorOver20'), `セクター比率 ${formatPercent(stock.sectorWeight)}`, 'MEDIUM', 'sectorOver20')

  if (stock.unrealizedGainRate !== null && stock.unrealizedGainRate <= -20) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'lossOver20'), `含み損 ${formatPercent(stock.unrealizedGainRate)}`, 'HIGH', 'lossOver20')
  else if (stock.unrealizedGainRate !== null && stock.unrealizedGainRate <= -10) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'lossOver10'), `含み損 ${formatPercent(stock.unrealizedGainRate)}`, 'MEDIUM', 'lossOver10')

  if ((stock.validationErrors || []).length > 0) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'validationError'), `異常値 ${stock.validationErrors.length}件`, 'HIGH', 'validationError')
  if ((stock.verificationErrors || []).length > 0) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'verificationError'), `根拠未確認 ${stock.verificationErrors.length}件`, 'HIGH', 'verificationError')
  if ((stock.evidenceErrors || []).length > 0) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'evidenceError'), `証跡不足 ${stock.evidenceErrors.length}件`, 'HIGH', 'evidenceError')
  if ((stock.multipleEvidenceValueErrors || []).length > 0) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'multipleEvidenceError'), '複数数値の採用値未指定', 'HIGH', 'multipleEvidenceError')
  if ((stock.evidenceMatchErrors || []).length > 0) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'mismatchedEvidenceError'), '証跡値と入力値の不一致', 'HIGH', 'mismatchedEvidenceError')

  const reasons = stock.decisionResult?.reasons || []
  if (reasons.some((reason) => String(reason).includes('期限切れ') || String(reason).includes('更新日'))) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'staleData'), 'データ期限切れ・更新日問題', 'HIGH', 'staleData')
  if (reasons.some((reason) => String(reason).includes('未入力'))) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'missingData'), '必須データ未入力', 'MEDIUM', 'missingData')

  const latest = [...history].sort((a, b) => String(b.decisionDate || b.createdAt).localeCompare(String(a.decisionDate || a.createdAt)))[0]
  if (latest) {
    const compliance = latest.complianceStatus || calculateActionCompliance(latest).complianceStatus
    if (['SELL', 'REDUCE'].includes(latest.decision) && compliance === 'NOT_EXECUTED') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'sellReduceNotExecuted'), `直近${latest.decision}判定が未実行`, 'CRITICAL', 'sellReduceNotExecuted')
    else if (compliance === 'CONTRADICTED') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'contradictedAction'), '直近判定に逆行実行', 'CRITICAL', 'contradictedAction')
    else if (compliance === 'NON_COMPLIANT') addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'nonCompliantAction'), '直近判定に非遵守', 'HIGH', 'nonCompliantAction')
    if (!latest.outcomeDate && ['BUY', 'SELL', 'REDUCE', 'HOLD', 'WATCH'].includes(latest.decision)) addRiskDriver(drivers, getRiskWeight(riskWeightConfig, 'outcomeMissing'), '直近判定の結果未評価', 'LOW', 'outcomeMissing')
  }

  const score = Math.round(drivers.reduce((sum, item) => sum + item.points, 0))
  return {
    ...stock,
    riskPriorityScore: score,
    riskPriorityLevel: getRiskPriorityLevel(score, riskWeightConfig),
    riskDrivers: drivers.sort((a, b) => b.points - a.points),
  }
}

const buildRiskPriorityStats = (items) => ({
  total: items.length,
  critical: items.filter((item) => item.riskPriorityLevel === 'CRITICAL').length,
  high: items.filter((item) => item.riskPriorityLevel === 'HIGH').length,
  medium: items.filter((item) => item.riskPriorityLevel === 'MEDIUM').length,
  low: items.filter((item) => item.riskPriorityLevel === 'LOW').length,
  topScore: items[0]?.riskPriorityScore || 0,
})


const getLatestEvaluatedHistoryMap = (decisionHistory) => {
  const map = new Map()
  const items = [...sanitizeDecisionHistory(decisionHistory)].sort((a, b) => String(b.outcomeDate || b.decisionDate || b.createdAt).localeCompare(String(a.outcomeDate || a.decisionDate || a.createdAt)))
  for (const item of items) {
    const calculated = calculateHistoryOutcome(item)
    const accuracy = item.decisionAccuracy || calculated.decisionAccuracy
    if (!accuracy || accuracy === 'NOT_APPLICABLE') continue
    if (!map.has(item.code)) map.set(item.code, { ...item, decisionAccuracy: accuracy, outcomeTotalReturn: item.outcomeTotalReturn ?? calculated.outcomeTotalReturn })
  }
  return map
}

const riskRecommendationTone = {
  INCREASE: 'bg-red-50 border-red-200 text-red-800',
  DECREASE: 'bg-sky-50 border-sky-200 text-sky-800',
  KEEP: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  NEED_DATA: 'bg-slate-50 border-slate-200 text-slate-600',
}

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))

const getRiskWeightDefinition = (key) => riskWeightDefinitions.find((definition) => definition.key === key)

const buildRiskWeightDiagnostics = (riskPriorityList, decisionHistory, riskWeightConfig = DEFAULT_RISK_WEIGHT_CONFIG) => {
  const latestEvaluated = getLatestEvaluatedHistoryMap(decisionHistory)
  const rowsByKey = new Map()

  for (const stock of riskPriorityList) {
    const history = latestEvaluated.get(stock.code)
    for (const driver of stock.riskDrivers || []) {
      const key = driver.key || driver.label
      const definition = getRiskWeightDefinition(key)
      const row = rowsByKey.get(key) || {
        key,
        label: definition?.label || driver.label,
        currentWeight: getRiskWeight(riskWeightConfig, key),
        currentLevel: driver.level || 'MEDIUM',
        activeCount: 0,
        evaluatedCount: 0,
        success: 0,
        failure: 0,
        missedOpportunity: 0,
        neutral: 0,
        totalReturn: 0,
        returnCount: 0,
        affectedCodes: [],
      }
      row.activeCount += 1
      if (row.affectedCodes.length < 8) row.affectedCodes.push(`${stock.code}:${stock.name}`)
      if (history) {
        row.evaluatedCount += 1
        const accuracy = history.decisionAccuracy
        if (accuracy === 'SUCCESS') row.success += 1
        else if (accuracy === 'FAILURE') row.failure += 1
        else if (accuracy === 'MISSED_OPPORTUNITY') row.missedOpportunity += 1
        else if (accuracy === 'NEUTRAL') row.neutral += 1
        if (Number.isFinite(Number(history.outcomeTotalReturn))) {
          row.totalReturn += Number(history.outcomeTotalReturn)
          row.returnCount += 1
        }
      }
      rowsByKey.set(key, row)
    }
  }

  const diagnostics = Array.from(rowsByKey.values()).map((row) => {
    const successRate = row.evaluatedCount > 0 ? (row.success / row.evaluatedCount) * 100 : 0
    const failureRate = row.evaluatedCount > 0 ? ((row.failure + row.missedOpportunity) / row.evaluatedCount) * 100 : 0
    const avgReturn = row.returnCount > 0 ? row.totalReturn / row.returnCount : null
    const definition = getRiskWeightDefinition(row.key)
    let recommendation = 'NEED_DATA'
    let reason = '評価済み履歴が3件未満。重み変更不可。'
    let suggestedWeight = row.currentWeight

    if (row.evaluatedCount >= 3) {
      if (failureRate >= 60) {
        recommendation = 'INCREASE'
        suggestedWeight = clampNumber(Math.round(row.currentWeight * 1.2 + 5), definition?.min ?? 0, definition?.max ?? 300)
        reason = '失敗・機会損失率が60%以上。リスク加点を強める候補。'
      } else if (successRate >= 70 && row.currentWeight >= 10) {
        recommendation = 'DECREASE'
        suggestedWeight = clampNumber(Math.round(row.currentWeight * 0.85), definition?.min ?? 0, definition?.max ?? 300)
        reason = 'SUCCESS率が70%以上。過剰警戒を弱める候補。'
      } else {
        recommendation = 'KEEP'
        reason = '評価済み履歴上、重み変更の根拠が弱い。'
      }
    }

    return {
      ...row,
      successRate,
      failureRate,
      avgReturn,
      recommendation,
      suggestedWeight,
      reason,
    }
  }).sort((a, b) => {
    const order = { INCREASE: 0, DECREASE: 1, KEEP: 2, NEED_DATA: 3 }
    return order[a.recommendation] - order[b.recommendation] || b.evaluatedCount - a.evaluatedCount || b.activeCount - a.activeCount
  })

  const stats = {
    totalDrivers: diagnostics.length,
    evaluatedDrivers: diagnostics.filter((item) => item.evaluatedCount >= 3).length,
    increase: diagnostics.filter((item) => item.recommendation === 'INCREASE').length,
    decrease: diagnostics.filter((item) => item.recommendation === 'DECREASE').length,
    keep: diagnostics.filter((item) => item.recommendation === 'KEEP').length,
    needData: diagnostics.filter((item) => item.recommendation === 'NEED_DATA').length,
  }

  return { diagnostics, stats }
}

const downloadTextFile = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const toCsvText = (rows) => rows.map((row) => row.map((cell) => `\"${String(cell ?? '').replaceAll('\"', '\"\"')}\"`).join(',')).join('\n')


const stableStringify = (value) => {
  const seen = new WeakSet()
  const normalize = (item) => {
    if (item === null || typeof item !== 'object') return item
    if (seen.has(item)) return null
    seen.add(item)
    if (Array.isArray(item)) return item.map(normalize)
    return Object.keys(item).sort().reduce((acc, key) => {
      if (item[key] !== undefined) acc[key] = normalize(item[key])
      return acc
    }, {})
  }
  return JSON.stringify(normalize(value))
}

const hashString = (input) => {
  let hash = 2166136261
  const text = String(input || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildIntegrityHash = (payload) => hashString(stableStringify(payload))

const sanitizeIntegrityMeta = (value) => {
  if (!value || typeof value !== 'object') {
    return {
      backupIntegrityHash: '',
      lastBackupAt: '',
      lastRestoreAt: '',
      restoreSourceHash: '',
      restoreStatus: '',
      integrityWarnings: [],
    }
  }
  return {
    backupIntegrityHash: String(value.backupIntegrityHash || ''),
    lastBackupAt: String(value.lastBackupAt || ''),
    lastRestoreAt: String(value.lastRestoreAt || ''),
    restoreSourceHash: String(value.restoreSourceHash || ''),
    restoreStatus: String(value.restoreStatus || ''),
    integrityWarnings: safeArray(value.integrityWarnings).map(String).slice(0, 20),
  }
}

const createBackupPayloadForHash = ({ usdJpy, fxUpdatedAt, holdings, decisionHistory, auditLog, operationalChecklist, riskWeightConfig }) => ({
  app: 'portfolio-dashboard',
  schemaVersion: APP_SCHEMA_VERSION,
  usdJpy,
  fxUpdatedAt,
  holdings,
  decisionHistory,
  auditLog,
  operationalChecklist,
  riskWeightConfig,
})

const buildBackupMeta = ({ payload, stocks, decisionHistory, auditLog, operationalChecklist }) => {
  const exportedAt = new Date().toISOString()
  return {
    appSchemaVersion: APP_SCHEMA_VERSION,
    backupIntegrityHash: buildIntegrityHash(payload),
    lastBackupAt: exportedAt,
    stockCount: stocks.length,
    holdingRecordCount: Object.keys(payload.holdings || {}).length,
    decisionHistoryCount: decisionHistory.length,
    auditLogCount: auditLog.length,
    checklistDoneCount: Object.values(operationalChecklist || {}).filter((item) => item?.completedAt).length,
  }
}

const isFilled = (value) => value !== undefined && value !== null && String(value).trim() !== ''

const calculateDataCompleteness = ({ stocks, holdings, decisionHistory, auditLog, settings }) => {
  const scoreParts = {
    position: { points: 20, total: 0, filled: 0 },
    financial: { points: 20, total: 0, filled: 0 },
    evidence: { points: 20, total: 0, filled: 0 },
    freshness: { points: 15, total: 0, filled: 0 },
    profile: { points: 10, total: 0, filled: 0 },
    history: { points: 5, total: 1, filled: decisionHistory.length > 0 ? 1 : 0 },
    actionOutcome: { points: 5, total: 1, filled: decisionHistory.some((item) => item.actionTaken || item.outcomeDate) ? 1 : 0 },
    audit: { points: 5, total: 1, filled: auditLog.length > 0 ? 1 : 0 },
  }

  const requiredBySection = {
    position: ['shares', 'averagePrice', 'currentPrice', 'annualDividend'],
    financial: ['payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'dividendCut'],
    evidence: ['sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'sourceMetricName', 'sourceUnit'],
    freshness: ['priceUpdatedAt', 'financialUpdatedAt'],
    profile: ['ruleProfile'],
  }

  const missingCriticalFields = []
  for (const stock of stocks) {
    const holding = holdings[stock.code] || {}
    for (const [section, fields] of Object.entries(requiredBySection)) {
      for (const field of fields) {
        scoreParts[section].total += 1
        if (isFilled(holding[field])) scoreParts[section].filled += 1
        else missingCriticalFields.push(`${stock.code}:${field}`)
      }
    }
  }

  scoreParts.freshness.total += 1
  if (isFilled(settings.fxUpdatedAt)) scoreParts.freshness.filled += 1
  else missingCriticalFields.push('SYSTEM:fxUpdatedAt')

  let score = 0
  for (const part of Object.values(scoreParts)) {
    score += part.total > 0 ? (part.filled / part.total) * part.points : 0
  }

  const decisionHistoryCount = decisionHistory.length
  const auditLogCount = auditLog.length
  const integrityWarnings = []
  if (decisionHistoryCount === 0) integrityWarnings.push('判定履歴が未保存')
  if (auditLogCount === 0) integrityWarnings.push('監査ログが未作成')
  if (!isFilled(settings.fxUpdatedAt)) integrityWarnings.push('USD/JPY更新日が未入力')
  if (missingCriticalFields.length > 0) integrityWarnings.push(`重要項目欠損 ${missingCriticalFields.length}件`)

  return {
    dataCompletenessScore: Math.round(score),
    missingCriticalFieldCount: missingCriticalFields.length,
    missingCriticalFields: missingCriticalFields.slice(0, 20),
    integrityWarnings,
    decisionHistoryCount,
    auditLogCount,
    stockCount: stocks.length,
    holdingRecordCount: Object.keys(holdings || {}).length,
  }
}


const buildCoverageDiagnostics = ({ stocks, decisionHistory, auditLog, checklistEntries, integritySummary }) => {
  const baseSections = [
    { key: 'position', label: '保有・価格', fields: ['shares', 'averagePrice', 'currentPrice', 'annualDividend', 'priceUpdatedAt'] },
    { key: 'financial', label: '財務', fields: ['payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'dividendCut', 'financialUpdatedAt'] },
    { key: 'evidence', label: '根拠・証跡', fields: ['sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'sourceMetricName', 'sourceUnit'] },
    { key: 'rule', label: '判定プロファイル', fields: ['ruleProfile'] },
  ]
  const sectionTotals = Object.fromEntries(baseSections.map((section) => [section.key, { ...section, total: 0, filled: 0, missing: 0, rate: 0 }]))
  sectionTotals.profileMetric = { key: 'profileMetric', label: '業種別専用指標', total: 0, filled: 0, missing: 0, rate: 0 }
  sectionTotals.historyOutcome = { key: 'historyOutcome', label: '履歴・実行・結果', total: 0, filled: 0, missing: 0, rate: 0 }

  const blockers = []
  const stockRows = stocks.map((stock) => {
    let total = 0
    let filled = 0
    const missingFields = []
    const addFields = (sectionKey, fields) => {
      for (const field of fields) {
        total += 1
        sectionTotals[sectionKey].total += 1
        const value = field === 'fxUpdatedAt' ? stock.fxUpdatedAt : stock[field]
        if (isFilled(value)) {
          filled += 1
          sectionTotals[sectionKey].filled += 1
        } else {
          missingFields.push(field)
          sectionTotals[sectionKey].missing += 1
        }
      }
    }
    for (const section of baseSections) addFields(section.key, section.fields)
    addFields('profileMetric', getProfileMetrics(stock.ruleProfile).map((metric) => metric.field))

    const histories = decisionHistory.filter((item) => item.code === stock.code)
    const latest = histories[0]
    sectionTotals.historyOutcome.total += 3
    total += 3
    if (histories.length > 0) { filled += 1; sectionTotals.historyOutcome.filled += 1 } else { missingFields.push('decisionHistory'); sectionTotals.historyOutcome.missing += 1 }
    if (latest?.actionTaken || latest?.actionType) { filled += 1; sectionTotals.historyOutcome.filled += 1 } else { missingFields.push('actionTracking'); sectionTotals.historyOutcome.missing += 1 }
    if (latest?.outcomeDate) { filled += 1; sectionTotals.historyOutcome.filled += 1 } else { missingFields.push('outcomeEvaluation'); sectionTotals.historyOutcome.missing += 1 }

    const coverageScore = total > 0 ? Math.round((filled / total) * 100) : 0
    const blockingDecision = ['INVALID_DATA', 'UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE', 'PROFILE_DATA_REQUIRED', 'RULE_CONFIG_REQUIRED', 'STALE_DATA', 'NO_DATA'].includes(stock.decisionResult?.decision)
    const impact = blockingDecision || coverageScore < 60 ? 'HIGH' : coverageScore < 80 ? 'MEDIUM' : 'LOW'
    const priority = (blockingDecision ? 100 : 0) + (100 - coverageScore) + (stock.riskPriorityScore || 0) / 10
    for (const field of missingFields.slice(0, 10)) {
      blockers.push({ code: stock.code, name: stock.name, fieldName: field, fieldLabel: getCoverageFieldLabel(field), decision: stock.decisionResult?.decision || '', coverageScore, impact, priority })
    }
    return { code: stock.code, name: stock.name, market: stock.market, group: stock.group, ruleProfile: stock.ruleProfile, decision: stock.decisionResult?.decision || '', riskPriorityScore: stock.riskPriorityScore || 0, coverageScore, filled, total, missingCount: missingFields.length, missingFields, impact, priority }
  }).sort((a, b) => a.coverageScore - b.coverageScore || b.riskPriorityScore - a.riskPriorityScore)

  for (const section of Object.values(sectionTotals)) section.rate = section.total > 0 ? (section.filled / section.total) * 100 : 100
  const totalFields = Object.values(sectionTotals).reduce((sum, section) => sum + section.total, 0)
  const filledFields = Object.values(sectionTotals).reduce((sum, section) => sum + section.filled, 0)
  const coverageScore = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0
  const evaluatedHistory = decisionHistory.filter((item) => item.outcomeDate).length
  return {
    coverageScore,
    totalFields,
    filledFields,
    missingFields: totalFields - filledFields,
    sectionTotals: Object.values(sectionTotals),
    stockRows,
    blockers: blockers.sort((a, b) => b.priority - a.priority).slice(0, 100),
    highImpactBlockers: blockers.filter((item) => item.impact === 'HIGH').length,
    outcomeCoverageRate: decisionHistory.length > 0 ? (evaluatedHistory / decisionHistory.length) * 100 : 0,
    actionCoverageRate: decisionHistory.length > 0 ? (decisionHistory.filter((item) => item.actionTaken || item.actionType).length / decisionHistory.length) * 100 : 0,
    checklistCoverageRate: checklistEntries.length > 0 ? (checklistEntries.filter((item) => item.status === 'DONE').length / checklistEntries.length) * 100 : 0,
    auditCoverageRate: auditLog.length > 0 ? 100 : 0,
    integrityCompletenessScore: integritySummary?.dataCompletenessScore ?? 0,
  }
}

const safeArray = (value) => Array.isArray(value) ? value : []

const sanitizeDecisionHistory = (items) => {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => item && typeof item === 'object' && item.code && item.decisionDate)
    .map((item) => ({
      runId: String(item.runId || item.decisionDate || `run-${Date.now()}`),
      decisionDate: String(item.decisionDate || ''),
      createdAt: String(item.createdAt || item.decisionDate || ''),
      code: String(item.code || ''),
      name: String(item.name || ''),
      market: String(item.market || ''),
      group: String(item.group || ''),
      currency: String(item.currency || ''),
      decision: String(item.decision || ''),
      severity: String(item.severity || ''),
      reasons: safeArray(item.reasons).map(String),
      ruleVersion: String(item.ruleVersion || DECISION_HISTORY_VERSION),
      ruleProfile: String(item.ruleProfile || ''),
      riskRegime: String(item.riskRegime || 'STATIC'),
      inputSnapshot: item.inputSnapshot && typeof item.inputSnapshot === 'object' ? item.inputSnapshot : {},
      portfolioSnapshot: item.portfolioSnapshot && typeof item.portfolioSnapshot === 'object' ? item.portfolioSnapshot : {},
      evidenceSnapshot: item.evidenceSnapshot && typeof item.evidenceSnapshot === 'object' ? item.evidenceSnapshot : {},
      outcomeDate: String(item.outcomeDate || ''),
      outcomePrice: item.outcomePrice === '' || item.outcomePrice === undefined || item.outcomePrice === null ? '' : String(item.outcomePrice),
      outcomeDividend: item.outcomeDividend === '' || item.outcomeDividend === undefined || item.outcomeDividend === null ? '' : String(item.outcomeDividend),
      outcomeReturn: Number.isFinite(Number(item.outcomeReturn)) ? Number(item.outcomeReturn) : null,
      outcomeTotalReturn: Number.isFinite(Number(item.outcomeTotalReturn)) ? Number(item.outcomeTotalReturn) : null,
      decisionAccuracy: String(item.decisionAccuracy || ''),
      actionTaken: item.actionTaken === true || item.actionTaken === 'true',
      actionType: String(item.actionType || ''),
      actionDate: String(item.actionDate || ''),
      actionPrice: item.actionPrice === '' || item.actionPrice === undefined || item.actionPrice === null ? '' : String(item.actionPrice),
      actionShares: item.actionShares === '' || item.actionShares === undefined || item.actionShares === null ? '' : String(item.actionShares),
      actionAmount: Number.isFinite(Number(item.actionAmount)) ? Number(item.actionAmount) : null,
      actionReason: String(item.actionReason || ''),
      executionGapDays: Number.isFinite(Number(item.executionGapDays)) ? Number(item.executionGapDays) : null,
      executionPriceGap: Number.isFinite(Number(item.executionPriceGap)) ? Number(item.executionPriceGap) : null,
      complianceStatus: String(item.complianceStatus || ''),
    }))
}

const calculateHistoryOutcome = (item) => {
  const basePrice = toNumber(item?.inputSnapshot?.currentPrice)
  const outcomePrice = toNumber(item?.outcomePrice)
  const outcomeDividend = toNumber(item?.outcomeDividend) ?? 0
  const outcomeDate = String(item?.outcomeDate || '')

  if (!basePrice || basePrice <= 0 || !outcomePrice || outcomePrice <= 0 || !outcomeDate) {
    return {
      outcomeReturn: null,
      outcomeTotalReturn: null,
      decisionAccuracy: '',
    }
  }

  const outcomeReturn = ((outcomePrice - basePrice) / basePrice) * 100
  const outcomeTotalReturn = ((outcomePrice + outcomeDividend - basePrice) / basePrice) * 100
  const decision = String(item?.decision || '')
  let decisionAccuracy = 'NOT_APPLICABLE'

  if (decision === 'BUY') decisionAccuracy = outcomeTotalReturn > 0 ? 'SUCCESS' : 'FAILURE'
  else if (decision === 'SELL') decisionAccuracy = outcomeTotalReturn < 0 ? 'SUCCESS' : 'FAILURE'
  else if (decision === 'REDUCE') decisionAccuracy = outcomeTotalReturn < 0 ? 'SUCCESS' : 'NEUTRAL'
  else if (decision === 'HOLD') decisionAccuracy = outcomeTotalReturn >= 0 ? 'SUCCESS' : 'FAILURE'
  else if (decision === 'WATCH') decisionAccuracy = outcomeTotalReturn <= 0 ? 'SUCCESS' : 'MISSED_OPPORTUNITY'

  return {
    outcomeReturn,
    outcomeTotalReturn,
    decisionAccuracy,
  }
}


const normalizeActionType = (value) => String(value || '').trim().toUpperCase()

const calculateHistoryAction = (item) => {
  const decision = String(item?.decision || '')
  const actionType = normalizeActionType(item?.actionType)
  const actionTaken = item?.actionTaken === true || item?.actionTaken === 'true'
  const basePrice = toNumber(item?.inputSnapshot?.currentPrice)
  const actionPrice = toNumber(item?.actionPrice)
  const actionShares = toNumber(item?.actionShares)
  const decisionDate = item?.decisionDate ? new Date(item.decisionDate) : null
  const actionDate = item?.actionDate ? new Date(item.actionDate) : null

  let complianceStatus = 'NOT_APPLICABLE'

  if (!actionTaken || !actionType || actionType === 'NONE') {
    if (decision === 'BUY' || decision === 'SELL' || decision === 'REDUCE') complianceStatus = 'NOT_EXECUTED'
    else if (decision === 'HOLD' || decision === 'WATCH') complianceStatus = 'COMPLIANT'
  } else if (decision === 'BUY' && actionType === 'BUY') complianceStatus = 'COMPLIANT'
  else if (decision === 'SELL' && actionType === 'SELL') complianceStatus = 'COMPLIANT'
  else if (decision === 'REDUCE' && (actionType === 'SELL' || actionType === 'REDUCE')) complianceStatus = 'COMPLIANT'
  else if (decision === 'HOLD' && (actionType === 'HOLD' || actionType === 'NONE')) complianceStatus = 'COMPLIANT'
  else if (decision === 'WATCH' && (actionType === 'NONE' || actionType === 'HOLD')) complianceStatus = 'COMPLIANT'
  else if ((decision === 'BUY' && actionType === 'SELL') || (decision === 'SELL' && actionType === 'BUY')) complianceStatus = 'CONTRADICTED'
  else complianceStatus = 'NON_COMPLIANT'

  const actionAmount = actionPrice && actionShares ? actionPrice * actionShares : null
  const executionPriceGap = basePrice && actionPrice ? ((actionPrice - basePrice) / basePrice) * 100 : null
  let executionGapDays = null
  if (decisionDate instanceof Date && !Number.isNaN(decisionDate.getTime()) && actionDate instanceof Date && !Number.isNaN(actionDate.getTime())) {
    executionGapDays = Math.round((actionDate.getTime() - decisionDate.getTime()) / 86400000)
  }

  return {
    actionAmount,
    executionGapDays,
    executionPriceGap,
    complianceStatus,
  }
}

const buildActionStats = (decisionHistory) => {
  const stats = {
    total: decisionHistory.length,
    compliant: 0,
    notExecuted: 0,
    contradicted: 0,
    nonCompliant: 0,
    notApplicable: 0,
    buyNotExecuted: 0,
    sellNotExecuted: 0,
    reduceNotExecuted: 0,
    executed: 0,
    gapTotal: 0,
    gapCount: 0,
    priceGapTotal: 0,
    priceGapCount: 0,
  }

  for (const item of decisionHistory) {
    const calculated = calculateHistoryAction(item)
    const status = item.complianceStatus || calculated.complianceStatus
    if (item.actionTaken === true || item.actionTaken === 'true') stats.executed += 1
    if (status === 'COMPLIANT') stats.compliant += 1
    else if (status === 'NOT_EXECUTED') stats.notExecuted += 1
    else if (status === 'CONTRADICTED') stats.contradicted += 1
    else if (status === 'NON_COMPLIANT') stats.nonCompliant += 1
    else stats.notApplicable += 1

    if (status === 'NOT_EXECUTED' && item.decision === 'BUY') stats.buyNotExecuted += 1
    if (status === 'NOT_EXECUTED' && item.decision === 'SELL') stats.sellNotExecuted += 1
    if (status === 'NOT_EXECUTED' && item.decision === 'REDUCE') stats.reduceNotExecuted += 1

    const gapDays = Number.isFinite(Number(item.executionGapDays)) ? Number(item.executionGapDays) : calculated.executionGapDays
    if (Number.isFinite(gapDays)) {
      stats.gapTotal += gapDays
      stats.gapCount += 1
    }
    const priceGap = Number.isFinite(Number(item.executionPriceGap)) ? Number(item.executionPriceGap) : calculated.executionPriceGap
    if (Number.isFinite(priceGap)) {
      stats.priceGapTotal += priceGap
      stats.priceGapCount += 1
    }
  }

  stats.complianceRate = stats.total > 0 ? (stats.compliant / stats.total) * 100 : 0
  stats.executionRate = stats.total > 0 ? (stats.executed / stats.total) * 100 : 0
  stats.averageExecutionGapDays = stats.gapCount > 0 ? stats.gapTotal / stats.gapCount : 0
  stats.averageExecutionPriceGap = stats.priceGapCount > 0 ? stats.priceGapTotal / stats.priceGapCount : 0
  return stats
}

const buildOutcomeStats = (decisionHistory) => {
  const stats = {
    evaluated: 0,
    pending: 0,
    success: 0,
    failure: 0,
    missedOpportunity: 0,
    neutral: 0,
    byDecision: {},
    byRuleVersion: {},
  }

  for (const item of decisionHistory) {
    const calculated = calculateHistoryOutcome(item)
    const accuracy = item.decisionAccuracy || calculated.decisionAccuracy
    const evaluated = Boolean(accuracy)
    if (!evaluated) {
      stats.pending += 1
      continue
    }

    stats.evaluated += 1
    if (accuracy === 'SUCCESS') stats.success += 1
    if (accuracy === 'FAILURE') stats.failure += 1
    if (accuracy === 'MISSED_OPPORTUNITY') stats.missedOpportunity += 1
    if (accuracy === 'NEUTRAL') stats.neutral += 1

    const decisionKey = item.decision || 'UNKNOWN'
    const ruleKey = item.ruleVersion || 'UNKNOWN'
    stats.byDecision[decisionKey] = stats.byDecision[decisionKey] || { total: 0, success: 0, failure: 0, missedOpportunity: 0, neutral: 0 }
    stats.byDecision[decisionKey].total += 1
    if (accuracy === 'SUCCESS') stats.byDecision[decisionKey].success += 1
    if (accuracy === 'FAILURE') stats.byDecision[decisionKey].failure += 1
    if (accuracy === 'MISSED_OPPORTUNITY') stats.byDecision[decisionKey].missedOpportunity += 1
    if (accuracy === 'NEUTRAL') stats.byDecision[decisionKey].neutral += 1

    stats.byRuleVersion[ruleKey] = stats.byRuleVersion[ruleKey] || { total: 0, success: 0, failure: 0, missedOpportunity: 0, neutral: 0 }
    stats.byRuleVersion[ruleKey].total += 1
    if (accuracy === 'SUCCESS') stats.byRuleVersion[ruleKey].success += 1
    if (accuracy === 'FAILURE') stats.byRuleVersion[ruleKey].failure += 1
    if (accuracy === 'MISSED_OPPORTUNITY') stats.byRuleVersion[ruleKey].missedOpportunity += 1
    if (accuracy === 'NEUTRAL') stats.byRuleVersion[ruleKey].neutral += 1
  }

  stats.successRate = stats.evaluated > 0 ? (stats.success / stats.evaluated) * 100 : 0
  stats.failureRate = stats.evaluated > 0 ? (stats.failure / stats.evaluated) * 100 : 0
  return stats
}

const buildHistoryRuns = (decisionHistory) => {
  const map = new Map()
  for (const item of decisionHistory) {
    const runId = item.runId || item.decisionDate
    const current = map.get(runId) || {
      runId,
      decisionDate: item.decisionDate,
      ruleVersion: item.ruleVersion,
      total: 0,
      counts: {},
    }
    current.total += 1
    current.counts[item.decision] = (current.counts[item.decision] || 0) + 1
    map.set(runId, current)
  }
  return [...map.values()].sort((a, b) => String(b.decisionDate).localeCompare(String(a.decisionDate)))
}

const getMissingRequiredData = (stock) => {
  const missing = []
  if (stock.shares === null) missing.push('保有数')
  if (stock.currentPrice === null) missing.push('現在価格')
  if (stock.annualDividend === null) missing.push('年間配当')
  if (stock.payoutRatio === null) missing.push('配当性向')
  if (stock.operatingCashFlowYoY === null) missing.push('営業CF前年比')
  if (stock.epsYoY === null) missing.push('EPS前年比')
  if (stock.equityRatio === null) missing.push('自己資本比率')
  if (stock.debtToEquity === null) missing.push('有利子負債倍率')
  if (stock.dividendCut === null) missing.push('減配有無')
  if (stock.hasPosition && stock.averagePrice === null) missing.push('取得単価')
  return missing
}

const getStaleDataReasons = (stock) => {
  const reasons = []

  if (stock.currentPrice !== null) {
    const age = daysSince(stock.priceUpdatedAt)
    if (age === null) reasons.push('価格更新日が未入力')
    else if (age > staleRules.price.maxAgeDays) reasons.push(`現在価格が${age}日前のデータ（期限${staleRules.price.maxAgeDays}日）`)
  }

  const hasFinancialData = [stock.payoutRatio, stock.operatingCashFlowYoY, stock.revenueYoY, stock.epsYoY, stock.equityRatio, stock.debtToEquity, stock.dividendCut].some((value) => value !== null)
  if (hasFinancialData) {
    const age = daysSince(stock.financialUpdatedAt)
    if (age === null) reasons.push('財務更新日が未入力')
    else if (age > staleRules.financial.maxAgeDays) reasons.push(`財務データが${age}日前のデータ（期限${staleRules.financial.maxAgeDays}日）`)
  }

  if (stock.currency === 'USD' && (stock.currentPrice !== null || stock.hasPosition)) {
    const age = daysSince(stock.fxUpdatedAt)
    if (age === null) reasons.push('USD/JPY更新日が未入力')
    else if (age > staleRules.fx.maxAgeDays) reasons.push(`USD/JPYが${age}日前のデータ（期限${staleRules.fx.maxAgeDays}日）`)
  }

  return [...new Set(reasons)]
}


const getSellReasonsByProfile = (stock) => {
  const profile = stock.ruleProfile || 'GENERAL'
  const reasons = []
  if (stock.dividendCut === true) reasons.push('減配あり')

  switch (profile) {
    case 'BANK':
      if (stock.bankCapitalRatio < 8) reasons.push('BANK: 銀行自己資本比率8%未満')
      if (stock.bankNplRatio >= 5) reasons.push('BANK: 不良債権比率5%以上')
      if (stock.bankCreditCostRatio >= 3) reasons.push('BANK: 与信費用率3%以上')
      if (stock.bankNetInterestMargin < 0) reasons.push('BANK: 純金利マージン0%未満')
      if (stock.payoutRatio >= 100) reasons.push('BANK: 配当性向100%以上')
      if (stock.epsYoY <= -40) reasons.push('BANK: EPS前年比-40%以下')
      break
    case 'REIT':
      if (stock.reitLtv >= 60) reasons.push('REIT: LTV60%以上')
      if (stock.reitOccupancyRate < 90) reasons.push('REIT: 稼働率90%未満')
      if (stock.reitFfoYoY <= -30) reasons.push('REIT: FFO前年比-30%以下')
      break
    case 'UTILITY':
      if (stock.operatingCashFlowYoY <= -40) reasons.push('UTILITY: 営業CF前年比-40%以下')
      if (stock.utilityFuelCostYoY >= 100 && stock.operatingCashFlowYoY <= -20) reasons.push('UTILITY: 燃料費前年比100%以上かつ営業CF悪化')
      break
    case 'CYCLICAL':
      if (stock.operatingCashFlowYoY <= -30) reasons.push('CYCLICAL: 営業CF前年比-30%以下')
      if (stock.cyclicalMarketIndexYoY <= -30 && stock.inventoryYoY >= 30) reasons.push('CYCLICAL: 市況指数-30%以下かつ在庫+30%以上')
      if (stock.capacityUtilization < 60) reasons.push('CYCLICAL: 設備稼働率60%未満')
      break
    case 'GROWTH_TECH':
      if (stock.growthFcfYoY <= -50) reasons.push('GROWTH_TECH: FCF前年比-50%以下')
      if (stock.operatingMargin <= -20) reasons.push('GROWTH_TECH: 営業利益率-20%以下')
      if (stock.operatingCashFlowYoY <= -40) reasons.push('GROWTH_TECH: 営業CF前年比-40%以下')
      if (stock.revenueYoY <= -20) reasons.push('GROWTH_TECH: 売上前年比-20%以下')
      break
    case 'HEALTHCARE':
      if (stock.operatingCashFlowYoY <= -30) reasons.push('HEALTHCARE: 営業CF前年比-30%以下')
      break
    case 'FINANCIAL':
      if (stock.financialAumYoY <= -25) reasons.push('FINANCIAL: 運用資産前年比-25%以下')
      if (stock.financialCreditCostRatio >= 3) reasons.push('FINANCIAL: 金融与信費用率3%以上')
      if (stock.payoutRatio >= 100) reasons.push('FINANCIAL: 配当性向100%以上')
      if (stock.epsYoY <= -40) reasons.push('FINANCIAL: EPS前年比-40%以下')
      break
    default:
      if (stock.payoutRatio >= 100) reasons.push('GENERAL: 配当性向100%以上')
      if (stock.operatingCashFlowYoY <= -30) reasons.push('GENERAL: 営業CF前年比-30%以下')
      if (stock.epsYoY <= -30) reasons.push('GENERAL: EPS前年比-30%以下')
      if (stock.equityRatio < 20) reasons.push('GENERAL: 自己資本比率20%未満')
      if (stock.debtToEquity >= 5) reasons.push('GENERAL: 有利子負債倍率5倍以上')
  }
  return reasons
}

const getReduceReasonsByProfile = (stock) => {
  const profile = stock.ruleProfile || 'GENERAL'
  const reasons = []
  if (stock.positionWeight >= 8) reasons.push('個別銘柄比率8%以上')
  if (stock.sectorWeight >= 25) reasons.push('同一セクター比率25%以上')
  if (stock.hasPosition && stock.unrealizedGainRate !== null && stock.unrealizedGainRate <= -20) reasons.push('含み損-20%以下')

  switch (profile) {
    case 'BANK':
      if (stock.bankCapitalRatio < 9) reasons.push('BANK: 銀行自己資本比率9%未満')
      if (stock.bankNplRatio >= 3) reasons.push('BANK: 不良債権比率3%以上')
      if (stock.payoutRatio >= 85) reasons.push('BANK: 配当性向85%以上')
      if (stock.epsYoY <= -25) reasons.push('BANK: EPS前年比-25%以下')
      break
    case 'REIT':
      if (stock.reitLtv >= 55) reasons.push('REIT: LTV55%以上')
      if (stock.reitOccupancyRate < 95) reasons.push('REIT: 稼働率95%未満')
      if (stock.reitNavRatio >= 1.3) reasons.push('REIT: NAV倍率1.3倍以上')
      if (stock.payoutRatio >= 120) reasons.push('REIT: 分配金余力確認が必要（配当性向120%以上）')
      break
    case 'UTILITY':
      if (stock.operatingCashFlowYoY <= -25) reasons.push('UTILITY: 営業CF前年比-25%以下')
      break
    case 'CYCLICAL':
      if (stock.operatingCashFlowYoY <= -15) reasons.push('CYCLICAL: 営業CF前年比-15%以下')
      if (stock.cyclicalMarketIndexYoY <= -15) reasons.push('CYCLICAL: 市況指数前年比-15%以下')
      if (stock.inventoryYoY >= 20) reasons.push('CYCLICAL: 在庫前年比20%以上')
      break
    case 'GROWTH_TECH':
      if (stock.revenueYoY < 5) reasons.push('GROWTH_TECH: 売上前年比5%未満')
      if (stock.growthFcfYoY < 0) reasons.push('GROWTH_TECH: FCF前年比0%未満')
      if (stock.operatingMargin < 10) reasons.push('GROWTH_TECH: 営業利益率10%未満')
      if (stock.operatingCashFlowYoY < 0) reasons.push('GROWTH_TECH: 営業CF前年比0%未満')
      break
    case 'HEALTHCARE':
      if (stock.revenueYoY <= -10) reasons.push('HEALTHCARE: 売上前年比-10%以下')
      if (stock.operatingCashFlowYoY <= -20) reasons.push('HEALTHCARE: 営業CF前年比-20%以下')
      if (stock.pipelineProgress < 30) reasons.push('HEALTHCARE: パイプライン進捗率30%未満')
      break
    case 'FINANCIAL':
      if (stock.payoutRatio >= 85) reasons.push('FINANCIAL: 配当性向85%以上')
      if (stock.epsYoY <= -25) reasons.push('FINANCIAL: EPS前年比-25%以下')
      break
    default:
      if (stock.payoutRatio >= 80) reasons.push('GENERAL: 配当性向80%以上')
      if (stock.operatingCashFlowYoY <= -15) reasons.push('GENERAL: 営業CF前年比-15%以下')
  }
  return reasons
}

const getBuyChecksByProfile = (stock) => {
  const profile = stock.ruleProfile || 'GENERAL'
  const common = [
    { passed: stock.positionWeight < 5, reason: '個別銘柄比率5%未満' },
    { passed: stock.sectorWeight < 20, reason: '同一セクター比率20%未満' },
    { passed: stock.dividendCut === false, reason: '減配なし' },
  ]

  switch (profile) {
    case 'BANK':
      return [
        { passed: stock.bankCapitalRatio >= 9, reason: 'BANK: 銀行自己資本比率9%以上' },
        { passed: stock.bankNplRatio < 3, reason: 'BANK: 不良債権比率3%未満' },
        { passed: stock.bankCreditCostRatio < 1, reason: 'BANK: 与信費用率1%未満' },
        { passed: stock.payoutRatio < 75, reason: 'BANK: 配当性向75%未満' },
        { passed: stock.epsYoY >= 0, reason: 'BANK: EPS前年比0%以上' },
        { passed: stock.dividendYield >= 3, reason: 'BANK: 配当利回り3%以上' },
        ...common,
      ]
    case 'REIT':
      return [
        { passed: stock.reitLtv < 50, reason: 'REIT: LTV50%未満' },
        { passed: stock.reitOccupancyRate >= 95, reason: 'REIT: 稼働率95%以上' },
        { passed: stock.reitFfoYoY >= 0, reason: 'REIT: FFO前年比0%以上' },
        { passed: stock.dividendYield >= 4, reason: 'REIT: 分配金利回り4%以上' },
        { passed: stock.positionWeight < 5, reason: '個別銘柄比率5%未満' },
        { passed: stock.sectorWeight < 20, reason: '同一セクター比率20%未満' },
        { passed: stock.dividendCut === false, reason: '分配金減額なし' },
      ]
    case 'UTILITY':
      return [
        { passed: stock.utilityFuelCostYoY <= 30, reason: 'UTILITY: 燃料費前年比30%以下' },
        { passed: stock.utilityCapexToSales <= 80, reason: 'UTILITY: 設備投資/売上80%以下' },
        { passed: stock.operatingCashFlowYoY >= -10, reason: 'UTILITY: 営業CF前年比-10%以上' },
        { passed: stock.dividendYield >= 3, reason: 'UTILITY: 配当利回り3%以上' },
        ...common,
      ]
    case 'CYCLICAL':
      return [
        { passed: stock.cyclicalMarketIndexYoY >= 0, reason: 'CYCLICAL: 市況指数前年比0%以上' },
        { passed: stock.inventoryYoY <= 10, reason: 'CYCLICAL: 在庫前年比10%以下' },
        { passed: stock.capacityUtilization >= 70, reason: 'CYCLICAL: 設備稼働率70%以上' },
        { passed: stock.operatingCashFlowYoY >= 0, reason: 'CYCLICAL: 営業CF前年比0%以上' },
        { passed: stock.payoutRatio < 70, reason: 'CYCLICAL: 配当性向70%未満' },
        ...common,
      ]
    case 'GROWTH_TECH':
      return [
        { passed: stock.revenueYoY >= 5, reason: 'GROWTH_TECH: 売上前年比5%以上' },
        { passed: stock.growthFcfYoY >= 0, reason: 'GROWTH_TECH: FCF前年比0%以上' },
        { passed: stock.operatingMargin >= 10, reason: 'GROWTH_TECH: 営業利益率10%以上' },
        { passed: stock.epsYoY >= 0, reason: 'GROWTH_TECH: EPS前年比0%以上' },
        { passed: stock.operatingCashFlowYoY >= 0, reason: 'GROWTH_TECH: 営業CF前年比0%以上' },
        { passed: stock.positionWeight < 5, reason: '個別銘柄比率5%未満' },
        { passed: stock.sectorWeight < 20, reason: '同一セクター比率20%未満' },
      ]
    case 'HEALTHCARE':
      return [
        { passed: stock.rdToSales >= 8, reason: 'HEALTHCARE: R&D/売上8%以上' },
        { passed: stock.pipelineProgress >= 40, reason: 'HEALTHCARE: パイプライン進捗率40%以上' },
        { passed: stock.operatingCashFlowYoY >= 0, reason: 'HEALTHCARE: 営業CF前年比0%以上' },
        { passed: stock.revenueYoY >= -5, reason: 'HEALTHCARE: 売上前年比-5%以上' },
        { passed: stock.payoutRatio < 80, reason: 'HEALTHCARE: 配当性向80%未満' },
        ...common,
      ]
    case 'FINANCIAL':
      return [
        { passed: stock.financialAumYoY >= 0, reason: 'FINANCIAL: 運用資産前年比0%以上' },
        { passed: stock.financialCreditCostRatio < 1, reason: 'FINANCIAL: 金融与信費用率1%未満' },
        { passed: stock.payoutRatio < 75, reason: 'FINANCIAL: 配当性向75%未満' },
        { passed: stock.epsYoY >= 0, reason: 'FINANCIAL: EPS前年比0%以上' },
        { passed: stock.dividendYield >= 3, reason: 'FINANCIAL: 配当利回り3%以上' },
        ...common,
      ]
    default:
      return [
        { passed: stock.payoutRatio < 70, reason: 'GENERAL: 配当性向70%未満' },
        { passed: stock.operatingCashFlowYoY >= 0, reason: 'GENERAL: 営業CF前年比0%以上' },
        { passed: stock.epsYoY >= 0, reason: 'GENERAL: EPS前年比0%以上' },
        { passed: stock.equityRatio >= 30, reason: 'GENERAL: 自己資本比率30%以上' },
        { passed: stock.debtToEquity < 3, reason: 'GENERAL: 有利子負債倍率3倍未満' },
        { passed: stock.dividendYield >= 3, reason: 'GENERAL: 配当利回り3%以上' },
        ...common,
      ]
  }
}

const judgeStock = (stock) => {
  if (stock.validationErrors?.length > 0) {
    return {
      decision: 'INVALID_DATA',
      severity: 'CRITICAL',
      reasons: stock.validationErrors,
    }
  }

  if (stock.verificationErrors?.length > 0) {
    return {
      decision: 'UNVERIFIED_DATA',
      severity: 'HIGH',
      reasons: stock.verificationErrors,
    }
  }

  if (stock.evidenceErrors?.length > 0) {
    return {
      decision: 'WEAK_EVIDENCE',
      severity: 'HIGH',
      reasons: stock.evidenceErrors,
    }
  }

  if (stock.multipleEvidenceValueErrors?.length > 0) {
    return {
      decision: 'MULTIPLE_EVIDENCE_VALUES',
      severity: 'HIGH',
      reasons: stock.multipleEvidenceValueErrors,
    }
  }

  if (stock.evidenceMatchErrors?.length > 0) {
    return {
      decision: 'MISMATCHED_EVIDENCE',
      severity: 'HIGH',
      reasons: stock.evidenceMatchErrors,
    }
  }

  const staleReasons = getStaleDataReasons(stock)
  if (staleReasons.length > 0) {
    return {
      decision: 'STALE_DATA',
      severity: 'HIGH',
      reasons: staleReasons,
    }
  }

  const missing = getMissingRequiredData(stock)
  if (missing.length > 0) {
    return {
      decision: 'NO_DATA',
      severity: 'HIGH',
      reasons: missing.map((item) => `${item}が未入力`),
    }
  }

  const profile = stock.ruleProfile || 'GENERAL'
  const profileDataReasons = getProfileDataRequiredReasons(stock)
  if (profileDataReasons.length > 0) {
    return { decision: 'PROFILE_DATA_REQUIRED', severity: 'HIGH', reasons: [`判定プロファイル: ${profile}`, ...profileDataReasons] }
  }

  const sellReasons = getSellReasonsByProfile(stock)

  if (sellReasons.length > 0) {
    return { decision: 'SELL', severity: 'CRITICAL', reasons: [`判定プロファイル: ${profile}`, ...sellReasons] }
  }

  const reduceReasons = getReduceReasonsByProfile(stock)

  if (reduceReasons.length > 0) {
    return { decision: 'REDUCE', severity: 'HIGH', reasons: [`判定プロファイル: ${profile}`, ...reduceReasons] }
  }

  const buyChecks = getBuyChecksByProfile(stock)

  if (buyChecks.every((check) => check.passed)) {
    return {
      decision: 'BUY',
      severity: 'LOW',
      reasons: [`判定プロファイル: ${profile}`, ...buyChecks.map((check) => check.reason)],
    }
  }

  const failedBuyChecks = buyChecks.filter((check) => !check.passed).map((check) => check.reason)
  return {
    decision: stock.hasPosition ? 'HOLD' : 'WATCH',
    severity: 'MEDIUM',
    reasons: [`判定プロファイル: ${profile}`, '売却・削減条件には該当しないが、買い条件をすべて満たしていない', ...failedBuyChecks.slice(0, 3)],
  }
}

function FilterButton({ label, active, onClick, activeClass = 'bg-slate-900 text-white border-slate-900' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-2xl text-sm font-semibold transition border ${
        active ? activeClass : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

function MetricCard({ label, value, subLabel, tone = 'slate' }) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
  }[tone]

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="text-xs font-semibold opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {subLabel && <div className="mt-1 text-xs opacity-70">{subLabel}</div>}
    </div>
  )
}

function InputCell({ label, value, onChange, placeholder, signed = false, error = '' }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${error ? 'text-red-700' : 'text-slate-500'}`}>{label}</span>
      <input
        inputMode="decimal"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:ring-4 ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      />
      {error ? <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span> : null}
      {signed && !error && <span className="mt-1 block text-[10px] text-slate-400">マイナス入力可</span>}
    </label>
  )
}

function SelectCell({ label, value, onChange, error = '' }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${error ? 'text-red-700' : 'text-slate-500'}`}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:ring-4 ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      >
        <option value="">未入力</option>
        <option value="false">なし</option>
        <option value="true">あり</option>
      </select>
      {error ? <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span> : null}
    </label>
  )
}

function DateInputCell({ label, value, onChange, error = '' }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${error ? 'text-red-700' : 'text-slate-500'}`}>{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:ring-4 ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      />
      {error ? <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span> : null}
    </label>
  )
}


function TextCell({ label, value, onChange, placeholder, error = '', type = 'text' }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${error ? 'text-red-700' : 'text-slate-500'}`}>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:ring-4 ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      />
      {error ? <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span> : null}
    </label>
  )
}

function DataTypeSelectCell({ label, value, onChange, error = '' }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${error ? 'text-red-700' : 'text-slate-500'}`}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:ring-4 ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      >
        <option value="">未選択</option>
        {dataTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error ? <span className="mt-1 block text-[10px] font-semibold text-red-600">{error}</span> : null}
    </label>
  )
}


function RuleProfileSelectCell({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      >
        {ruleProfileOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function DecisionBadge({ result }) {
  return (
    <span className={`px-3 py-1 rounded-full border text-[11px] font-bold ${decisionTone[result.decision]}`}>
      {decisionLabels[result.decision]}
    </span>
  )
}


function ProfileMetricInputs({ profile, holding, fieldErrors, updateField }) {
  const metrics = getProfileMetrics(profile)
  if (metrics.length === 0) return null
  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
      <div className="mb-2 text-xs font-bold text-indigo-800">プロファイル専用指標: {profile}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {metrics.map((metric) => (
          <InputCell
            key={metric.field}
            label={metric.label}
            value={holding[metric.field]}
            onChange={(value) => updateField(metric.field, value)}
            placeholder={metric.placeholder}
            signed={metric.signed}
            error={fieldErrors[metric.field]}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] font-semibold text-indigo-700">専用指標が未入力の場合、PROFILE_DATA_REQUIREDで通常判定を停止します。</div>
    </div>
  )
}

function StockCard({ stock, holding, onHoldingChange, decisionHistory = [] }) {
  const result = stock.decisionResult || { decision: 'NO_DATA', severity: 'HIGH', reasons: ['判定不可'] }
  const fieldErrors = { ...(stock.validationFieldErrors || {}), ...(stock.verificationFieldErrors || {}), ...(stock.evidenceFieldErrors || {}) }

  const updateField = (field, value) => {
    const previousValue = holding[field] ?? ''
    onHoldingChange(stock.code, {
      ...holding,
      [field]: value,
    }, { fieldName: field, previousValue, newValue: value, changeSource: 'manual' })
  }

  return (
    <div className="px-5 py-4 hover:bg-slate-50 transition-colors duration-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-bold text-slate-900">{stock.code}</div>
          <div className="text-sm text-slate-500">{stock.name}</div>
          <div className="text-xs text-slate-400 mt-1">{stock.business}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
            {stock.currency}
          </span>
          <DecisionBadge result={result} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {stock.tags.length === 0 ? (
          <span className="text-[11px] text-red-500">タグ未分類</span>
        ) : (
          stock.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] text-slate-600">
              {conditionLabels[tag] || tag}
            </span>
          ))
        )}
      </div>

      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">判定プロファイル: {stock.ruleProfile}（未指定時は業務内容・分類から自動付与）</div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <InputCell label="保有数" value={holding.shares} onChange={(value) => updateField('shares', value)} placeholder="例: 100" error={fieldErrors.shares} />
        <InputCell label={`取得単価(${stock.currency})`} value={holding.averagePrice} onChange={(value) => updateField('averagePrice', value)} placeholder="例: 3200" error={fieldErrors.averagePrice} />
        <InputCell label={`現在価格(${stock.currency})`} value={holding.currentPrice} onChange={(value) => updateField('currentPrice', value)} placeholder="例: 4100" error={fieldErrors.currentPrice} />
        <InputCell label={`年間配当(${stock.currency})`} value={holding.annualDividend} onChange={(value) => updateField('annualDividend', value)} placeholder="例: 194" error={fieldErrors.annualDividend} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <InputCell label="配当性向(%)" value={holding.payoutRatio} onChange={(value) => updateField('payoutRatio', value)} placeholder="例: 65" error={fieldErrors.payoutRatio} />
        <InputCell label="営業CF前年比(%)" value={holding.operatingCashFlowYoY} onChange={(value) => updateField('operatingCashFlowYoY', value)} placeholder="例: -12" signed error={fieldErrors.operatingCashFlowYoY} />
        <InputCell label="EPS前年比(%)" value={holding.epsYoY} onChange={(value) => updateField('epsYoY', value)} placeholder="例: 8" signed error={fieldErrors.epsYoY} />
        <SelectCell label="減配" value={holding.dividendCut} onChange={(value) => updateField('dividendCut', value)} error={fieldErrors.dividendCut} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <InputCell label="売上前年比(%)" value={holding.revenueYoY} onChange={(value) => updateField('revenueYoY', value)} placeholder="例: 3" signed error={fieldErrors.revenueYoY} />
        <InputCell label="自己資本比率(%)" value={holding.equityRatio} onChange={(value) => updateField('equityRatio', value)} placeholder="例: 45" error={fieldErrors.equityRatio} />
        <InputCell label="有利子負債倍率(倍)" value={holding.debtToEquity} onChange={(value) => updateField('debtToEquity', value)} placeholder="例: 1.8" error={fieldErrors.debtToEquity} />
        <RuleProfileSelectCell label="判定プロファイル" value={holding.ruleProfile || stock.ruleProfile} onChange={(value) => updateField('ruleProfile', value)} />
      </div>

      <ProfileMetricInputs profile={stock.ruleProfile} holding={holding} fieldErrors={fieldErrors} updateField={updateField} />

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-2">
        <DateInputCell label="価格更新日" value={holding.priceUpdatedAt} onChange={(value) => updateField('priceUpdatedAt', value)} error={fieldErrors.priceUpdatedAt} />
        <DateInputCell label="財務更新日" value={holding.financialUpdatedAt} onChange={(value) => updateField('financialUpdatedAt', value)} error={fieldErrors.financialUpdatedAt} />
      </div>

      <div className="mt-3 rounded-2xl border border-purple-100 bg-purple-50/60 p-3">
        <div className="mb-2 text-xs font-bold text-purple-800">データ根拠</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextCell label="取得元名" value={holding.sourceName} onChange={(value) => updateField('sourceName', value)} placeholder="例: 決算短信 / 10-K / IR資料" error={fieldErrors.sourceName} />
          <TextCell label="根拠URL" value={holding.sourceUrl} onChange={(value) => updateField('sourceUrl', value)} placeholder="https://..." error={fieldErrors.sourceUrl} type="url" />
          <TextCell label="対象決算期" value={holding.fiscalPeriod} onChange={(value) => updateField('fiscalPeriod', value)} placeholder="例: FY2025 Q2" error={fieldErrors.fiscalPeriod} />
          <DataTypeSelectCell label="データ種別" value={holding.dataType} onChange={(value) => updateField('dataType', value)} error={fieldErrors.dataType} />
          <DateInputCell label="根拠確認日" value={holding.confirmedAt} onChange={(value) => updateField('confirmedAt', value)} error={fieldErrors.confirmedAt} />
        </div>
        <div className="mt-3 border-t border-purple-100 pt-3">
          <div className="mb-2 text-xs font-bold text-fuchsia-800">証跡レベル</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <TextCell label="根拠ページ" value={holding.sourcePage} onChange={(value) => updateField('sourcePage', value)} placeholder="例: 12" error={fieldErrors.sourcePage} inputMode="numeric" />
            <TextCell label="採用証跡値" value={holding.selectedEvidenceValue} onChange={(value) => updateField('selectedEvidenceValue', value)} placeholder="複数数値時のみ必須。例: 62.4" error={fieldErrors.selectedEvidenceValue} inputMode="decimal" />
            <TextCell label="参照指標名" value={holding.sourceMetricName} onChange={(value) => updateField('sourceMetricName', value)} placeholder="例: 配当性向" error={fieldErrors.sourceMetricName} />
            <TextCell label="単位" value={holding.sourceUnit} onChange={(value) => updateField('sourceUnit', value)} placeholder="例: % / 円 / USD" error={fieldErrors.sourceUnit} />
            <TextCell label="補足メモ" value={holding.evidenceMemo} onChange={(value) => updateField('evidenceMemo', value)} placeholder="任意" error={fieldErrors.evidenceMemo} />
            <div className="md:col-span-2">
              <TextCell label="引用文・該当数値" value={holding.sourceQuote} onChange={(value) => updateField('sourceQuote', value)} placeholder="例: 配当性向は62.4%" error={fieldErrors.sourceQuote} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">評価額</div>
          <div className="mt-1 font-bold text-slate-900">{formatJPY(stock.marketValueJPY)}</div>
        </div>
        <div className={`rounded-xl border p-3 ${stock.pnlJPY !== null && stock.pnlJPY < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="font-semibold text-slate-500">含み損益</div>
          <div className={`mt-1 font-bold ${stock.pnlJPY !== null && stock.pnlJPY < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatJPY(stock.pnlJPY)}</div>
          <div className="text-[11px] text-slate-500">{formatPercent(stock.unrealizedGainRate)}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">年間配当</div>
          <div className="mt-1 font-bold text-slate-900">{formatJPY(stock.annualDividendJPY)}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">利回り</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(stock.dividendYield)}</div>
        </div>
      </div>

      {stock.validationErrors?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-800">
          <div className="mb-1 text-sm font-bold">入力異常: 判定停止</div>
          <ul className="space-y-1">
            {stock.validationErrors.slice(0, 6).map((error) => <li key={error}>・{error}</li>)}
          </ul>
        </div>
      )}

      {stock.verificationErrors?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-purple-300 bg-purple-50 p-4 text-xs font-semibold text-purple-800">
          <div className="mb-1 text-sm font-bold">根拠未確認: 判定停止</div>
          <ul className="space-y-1">
            {stock.verificationErrors.slice(0, 6).map((error) => <li key={error}>・{error}</li>)}
          </ul>
        </div>
      )}

      {stock.evidenceErrors?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-fuchsia-300 bg-fuchsia-50 p-4 text-xs font-semibold text-fuchsia-800">
          <div className="mb-1 text-sm font-bold">証跡不足: 判定停止</div>
          <ul className="space-y-1">
            {stock.evidenceErrors.slice(0, 6).map((error) => <li key={error}>・{error}</li>)}
          </ul>
        </div>
      )}

      {stock.evidenceMatch?.status && stock.evidenceMatch.status !== 'NOT_APPLICABLE' && (
        <div className={`mt-4 rounded-2xl border p-4 text-xs font-semibold ${stock.evidenceMatch.status === 'MISMATCH' ? 'border-rose-300 bg-rose-50 text-rose-800' : stock.evidenceMatch.status === 'MULTIPLE_VALUES' ? 'border-pink-300 bg-pink-50 text-pink-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
          <div className="mb-2 text-sm font-bold">証跡照合: {stock.evidenceMatch.status === 'MISMATCH' ? '不一致' : stock.evidenceMatch.status === 'MULTIPLE_VALUES' ? '複数数値未指定' : '一致'}</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <div>指標: {stock.evidenceMatch.matchedMetricLabel || '-'}</div>
            <div>採用証跡値: {stock.evidenceMatch.selectedEvidenceValue ?? '-'}</div>
            <div>引用値: {stock.evidenceMatch.quotedValue ?? '-'}</div>
            <div>入力値: {stock.evidenceMatch.inputValue ?? '-'}</div>
            <div>差分: {stock.evidenceMatch.difference !== null ? stock.evidenceMatch.difference.toFixed(2) : '-'}</div>
          </div>
          {stock.evidenceMatch.multipleNumbers && <div className="mt-2">引用内数値: {stock.evidenceMatch.extractedNumbers.join(' / ')}</div>}
          {stock.multipleEvidenceValueErrors?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {stock.multipleEvidenceValueErrors.slice(0, 4).map((error) => <li key={error}>・{error}</li>)}
            </ul>
          )}
          {stock.evidenceMatchErrors?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {stock.evidenceMatchErrors.slice(0, 4).map((error) => <li key={error}>・{error}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className={`mt-4 rounded-2xl border p-4 ${decisionTone[result.decision]}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold">機械判定: {decisionLabels[result.decision]}</div>
          <div className={`text-xs font-semibold ${severityTone[result.severity] || 'text-slate-700'}`}>重大度: {result.severity}</div>
        </div>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed">
          {result.reasons.slice(0, 6).map((reason) => <li key={reason}>・{reason}</li>)}
        </ul>
        <div className="mt-2 text-[11px] font-semibold">人間による判定上書き: 不可</div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-bold text-slate-700">銘柄別過去判定</div>
        {decisionHistory.length === 0 ? (
          <div className="text-[11px] font-semibold text-slate-500">履歴なし。上部の「現在判定を履歴保存」で記録。</div>
        ) : (
          <div className="space-y-1">
            {decisionHistory.slice(0, 3).map((item) => (
              <div key={`${item.runId}-${item.code}`} className="flex items-center justify-between gap-2 rounded-xl border border-white bg-white px-3 py-2 text-[11px] font-semibold text-slate-700">
                <span>{String(item.decisionDate).slice(0, 10)}</span>
                <span className={`rounded-full border px-2 py-0.5 ${decisionTone[item.decision] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>{item.decision}</span>
                <span className="text-slate-400">{item.ruleVersion || '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">個別比率</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(stock.positionWeight)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">セクター比率</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(stock.sectorWeight)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">配当性向</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(stock.payoutRatio)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">営業CF前年比</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(stock.operatingCashFlowYoY)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs leading-relaxed">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="font-semibold text-slate-600 mb-1">購入根拠</div>
          <div className="text-slate-500">{stock.thesis}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <div className="font-semibold text-emerald-700 mb-1">買い条件</div>
          <div className="text-slate-600">{stock.buyCondition}</div>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-100 p-3">
          <div className="font-semibold text-red-700 mb-1">売り・警戒</div>
          <div className="text-slate-600">{stock.sellCondition}</div>
        </div>
      </div>
    </div>
  )
}

export default function PortfolioManagementDashboard() {
  const [selectedMarket, setSelectedMarket] = useState('ALL')
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [selectedConditions, setSelectedConditions] = useState([])
  const [keyword, setKeyword] = useState('')
  const [settings, setSettings] = useState(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY)
      return saved ? JSON.parse(saved) : { usdJpy: String(DEFAULT_USD_JPY), fxUpdatedAt: '' }
    } catch {
      return { usdJpy: String(DEFAULT_USD_JPY), fxUpdatedAt: '' }
    }
  })
  const usdJpyInput = settings.usdJpy ?? String(DEFAULT_USD_JPY)
  const fxUpdatedAtInput = settings.fxUpdatedAt ?? ''
  const setUsdJpyInput = (value) => {
    setSettings((current) => ({ ...current, usdJpy: value }))
  }
  const setFxUpdatedAtInput = (value) => {
    setSettings((current) => ({ ...current, fxUpdatedAt: value }))
  }
  const [holdings, setHoldings] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [importMessage, setImportMessage] = useState('')
  const [pendingMissingImport, setPendingMissingImport] = useState(null)
  const [bulkPasteText, setBulkPasteText] = useState('')
  const [importValidationReport, setImportValidationReport] = useState(() => {
    try {
      const saved = window.localStorage.getItem(IMPORT_VALIDATION_REPORT_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [decisionHistory, setDecisionHistory] = useState(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_KEY)
      return saved ? sanitizeDecisionHistory(JSON.parse(saved)) : []
    } catch {
      return []
    }
  })
  const [auditLog, setAuditLog] = useState(() => {
    try {
      const saved = window.localStorage.getItem(AUDIT_KEY)
      return saved ? sanitizeAuditLog(JSON.parse(saved)) : []
    } catch {
      return []
    }
  })
  const [integrityMeta, setIntegrityMeta] = useState(() => {
    try {
      const saved = window.localStorage.getItem(INTEGRITY_KEY)
      return saved ? sanitizeIntegrityMeta(JSON.parse(saved)) : sanitizeIntegrityMeta(null)
    } catch {
      return sanitizeIntegrityMeta(null)
    }
  })

  const [operationalChecklist, setOperationalChecklist] = useState(() => {
    try {
      const saved = window.localStorage.getItem(CHECKLIST_KEY)
      return saved ? sanitizeChecklist(JSON.parse(saved)) : {}
    } catch {
      return {}
    }
  })

  const [guidedWorkflow, setGuidedWorkflow] = useState(() => {
    try {
      const saved = window.localStorage.getItem(GUIDED_WORKFLOW_KEY)
      return saved ? sanitizeGuidedWorkflow(JSON.parse(saved)) : sanitizeGuidedWorkflow(null)
    } catch {
      return sanitizeGuidedWorkflow(null)
    }
  })

  const [riskWeightConfig, setRiskWeightConfig] = useState(() => {
    try {
      const saved = window.localStorage.getItem(RISK_WEIGHT_KEY)
      return saved ? sanitizeRiskWeightConfig(JSON.parse(saved)) : sanitizeRiskWeightConfig(DEFAULT_RISK_WEIGHT_CONFIG)
    } catch {
      return sanitizeRiskWeightConfig(DEFAULT_RISK_WEIGHT_CONFIG)
    }
  })

  const [safeMode, setSafeMode] = useState(() => sanitizeSafeModeSetting(readSafeModeSetting()))
  const isReadOnlyMode = safeMode.mode !== 'EDIT'

  useEffect(() => {
    window.localStorage.setItem(SAFE_MODE_KEY, JSON.stringify(safeMode))
  }, [safeMode])

  const enableEditMode = () => {
    const phrase = window.prompt('編集モードに切り替えるには EDIT と入力してください。')
    if (phrase !== 'EDIT') {
      setImportMessage('編集モード切替を中止しました。')
      return
    }
    const now = new Date().toISOString()
    setSafeMode({ mode: 'EDIT', changedAt: now, version: SAFE_MODE_VERSION })
    setImportMessage('編集モードに切り替えました。入力・取込・復元・削除が可能です。')
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: '安全モード', fieldName: 'safeMode', previousValue: 'READ_ONLY', newValue: 'EDIT', changeSource: 'manual', decisionBefore: 'LOCKED', decisionAfter: 'UNLOCKED' }))
  }

  const disableEditMode = () => {
    const now = new Date().toISOString()
    setSafeMode({ mode: 'READ_ONLY', changedAt: now, version: SAFE_MODE_VERSION })
    setImportMessage('閲覧モードに戻しました。変更操作をロックしています。')
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: '安全モード', fieldName: 'safeMode', previousValue: 'EDIT', newValue: 'READ_ONLY', changeSource: 'manual', decisionBefore: 'UNLOCKED', decisionAfter: 'LOCKED' }))
  }

  const confirmDangerousAction = (label, requiredText = 'DELETE') => {
    const phrase = window.prompt(`${label}を実行するには ${requiredText} と入力してください。`)
    return phrase === requiredText
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(decisionHistory))
  }, [decisionHistory])

  useEffect(() => {
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog))
  }, [auditLog])

  useEffect(() => {
    window.localStorage.setItem(INTEGRITY_KEY, JSON.stringify(integrityMeta))
  }, [integrityMeta])

  useEffect(() => {
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(operationalChecklist))
  }, [operationalChecklist])

  useEffect(() => {
    window.localStorage.setItem(GUIDED_WORKFLOW_KEY, JSON.stringify(guidedWorkflow))
  }, [guidedWorkflow])

  useEffect(() => {
    window.localStorage.setItem(RISK_WEIGHT_KEY, JSON.stringify(riskWeightConfig))
  }, [riskWeightConfig])

  useEffect(() => {
    if (importValidationReport) window.localStorage.setItem(IMPORT_VALIDATION_REPORT_KEY, JSON.stringify(importValidationReport))
    else window.localStorage.removeItem(IMPORT_VALIDATION_REPORT_KEY)
  }, [importValidationReport])

  const stocks = useMemo(() => normalizeStocks({ sections, businessMap, thesisMap, buyMap, sellMap }), [])
  const allGroups = useMemo(() => [...new Set(stocks.map((stock) => stock.group))], [stocks])
  const usdJpyValidationError = validateNumericValue('usdJpy', usdJpyInput, usdJpyRule)
  const fxUpdatedAtValidationError = validateDateValue('USD/JPY更新日', fxUpdatedAtInput)
  const usdJpy = usdJpyValidationError ? null : toNumber(usdJpyInput)

  const enrichedStocks = useMemo(() => {
    const baseStocks = stocks.map((stock) => {
      const holding = holdings[stock.code] || {}
      const validation = validateHoldingInput(holding, stock, usdJpyInput, fxUpdatedAtInput)
      const verification = validateVerificationInput(holding)
      const evidence = validateEvidenceStrengthInput(holding)
      const shares = toNumber(holding.shares)
      const averagePrice = toNumber(holding.averagePrice)
      const currentPrice = toNumber(holding.currentPrice)
      const annualDividend = toNumber(holding.annualDividend)
      const payoutRatio = toNumber(holding.payoutRatio)
      const operatingCashFlowYoY = toNumber(holding.operatingCashFlowYoY)
      const revenueYoY = toNumber(holding.revenueYoY)
      const epsYoY = toNumber(holding.epsYoY)
      const equityRatio = toNumber(holding.equityRatio)
      const debtToEquity = toNumber(holding.debtToEquity)
      const bankCapitalRatio = toNumber(holding.bankCapitalRatio)
      const bankNplRatio = toNumber(holding.bankNplRatio)
      const bankCreditCostRatio = toNumber(holding.bankCreditCostRatio)
      const bankNetInterestMargin = toNumber(holding.bankNetInterestMargin)
      const reitLtv = toNumber(holding.reitLtv)
      const reitOccupancyRate = toNumber(holding.reitOccupancyRate)
      const reitNavRatio = toNumber(holding.reitNavRatio)
      const reitFfoYoY = toNumber(holding.reitFfoYoY)
      const utilityCapexToSales = toNumber(holding.utilityCapexToSales)
      const utilityFuelCostYoY = toNumber(holding.utilityFuelCostYoY)
      const cyclicalMarketIndexYoY = toNumber(holding.cyclicalMarketIndexYoY)
      const inventoryYoY = toNumber(holding.inventoryYoY)
      const capacityUtilization = toNumber(holding.capacityUtilization)
      const growthFcfYoY = toNumber(holding.growthFcfYoY)
      const operatingMargin = toNumber(holding.operatingMargin)
      const rdToSales = toNumber(holding.rdToSales)
      const pipelineProgress = toNumber(holding.pipelineProgress)
      const financialAumYoY = toNumber(holding.financialAumYoY)
      const financialCreditCostRatio = toNumber(holding.financialCreditCostRatio)
      const dividendCut = toBooleanOrNull(holding.dividendCut)
      const fallbackRuleProfile = inferRuleProfile(stock)
      const ruleProfile = allowedRuleProfiles.includes(holding.ruleProfile) ? holding.ruleProfile : fallbackRuleProfile
      const priceUpdatedAt = holding.priceUpdatedAt || ''
      const financialUpdatedAt = holding.financialUpdatedAt || ''
      const fxUpdatedAt = fxUpdatedAtInput || ''
      const fxRate = stock.currency === 'USD' ? usdJpy : 1
      const canCalculateFx = Number.isFinite(fxRate)
      const marketValueJPY = shares !== null && currentPrice !== null && canCalculateFx ? shares * currentPrice * fxRate : null
      const costJPY = shares !== null && averagePrice !== null && canCalculateFx ? shares * averagePrice * fxRate : null
      const pnlJPY = marketValueJPY !== null && costJPY !== null ? marketValueJPY - costJPY : null
      const unrealizedGainRate = pnlJPY !== null && costJPY > 0 ? (pnlJPY / costJPY) * 100 : null
      const annualDividendJPY = shares !== null && annualDividend !== null && canCalculateFx ? shares * annualDividend * fxRate : null
      const dividendYield = annualDividend !== null && currentPrice > 0 ? (annualDividend / currentPrice) * 100 : null
      const hasPosition = shares !== null && shares > 0

      const baseStock = {
        ...stock,
        holding,
        validationErrors: validation.errors,
        validationFieldErrors: validation.fieldErrors,
        verificationErrors: verification.errors,
        verificationFieldErrors: verification.fieldErrors,
        evidenceErrors: evidence.errors,
        evidenceFieldErrors: evidence.fieldErrors,
        shares,
        averagePrice,
        currentPrice,
        annualDividend,
        payoutRatio,
        operatingCashFlowYoY,
        revenueYoY,
        epsYoY,
        equityRatio,
        debtToEquity,
        bankCapitalRatio,
        bankNplRatio,
        bankCreditCostRatio,
        bankNetInterestMargin,
        reitLtv,
        reitOccupancyRate,
        reitNavRatio,
        reitFfoYoY,
        utilityCapexToSales,
        utilityFuelCostYoY,
        cyclicalMarketIndexYoY,
        inventoryYoY,
        capacityUtilization,
        growthFcfYoY,
        operatingMargin,
        rdToSales,
        pipelineProgress,
        financialAumYoY,
        financialCreditCostRatio,
        dividendCut,
        ruleProfile,
        priceUpdatedAt,
        financialUpdatedAt,
        fxUpdatedAt,
        sourceName: holding.sourceName || '',
        sourceUrl: holding.sourceUrl || '',
        fiscalPeriod: holding.fiscalPeriod || '',
        dataType: holding.dataType || '',
        confirmedAt: holding.confirmedAt || '',
        sourcePage: holding.sourcePage || '',
        sourceQuote: holding.sourceQuote || '',
        selectedEvidenceValue: holding.selectedEvidenceValue || '',
        sourceMetricName: holding.sourceMetricName || '',
        sourceUnit: holding.sourceUnit || '',
        evidenceMemo: holding.evidenceMemo || '',
        marketValueJPY,
        costJPY,
        pnlJPY,
        unrealizedGainRate,
        annualDividendJPY,
        dividendYield,
        hasPosition,
        hasFullValuationData: shares !== null && averagePrice !== null && currentPrice !== null,
      }

      const evidenceMatch = checkEvidenceMatch(baseStock)
      return { ...baseStock, evidenceMatch, evidenceMatchErrors: evidenceMatch.errors, multipleEvidenceValueErrors: evidenceMatch.multipleEvidenceValueErrors }
    })

    const totalMarketValueJPY = baseStocks.reduce((sum, stock) => sum + (stock.marketValueJPY || 0), 0)
    const groupTotals = new Map()
    for (const stock of baseStocks) {
      if (!stock.marketValueJPY) continue
      groupTotals.set(stock.group, (groupTotals.get(stock.group) || 0) + stock.marketValueJPY)
    }

    return baseStocks.map((stock) => {
      const positionWeight = totalMarketValueJPY > 0 && stock.marketValueJPY ? (stock.marketValueJPY / totalMarketValueJPY) * 100 : 0
      const sectorWeight = totalMarketValueJPY > 0 ? ((groupTotals.get(stock.group) || 0) / totalMarketValueJPY) * 100 : 0
      const withWeights = { ...stock, positionWeight, sectorWeight }
      return { ...withWeights, decisionResult: judgeStock(withWeights) }
    })
  }, [stocks, holdings, usdJpy, usdJpyInput, fxUpdatedAtInput])

  const filteredStocks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return enrichedStocks.filter((stock) => {
      if (selectedMarket !== 'ALL' && stock.market !== selectedMarket) return false
      if (selectedGroup !== 'ALL' && stock.group !== selectedGroup) return false

      if (selectedConditions.length > 0) {
        const matched = selectedConditions.every((condition) => stock.tags.includes(condition))
        if (!matched) return false
      }

      if (normalizedKeyword) {
        const searchTarget = [
          stock.code,
          stock.name,
          stock.market,
          stock.group,
          stock.business,
          stock.thesis,
          stock.buyCondition,
          stock.sellCondition,
          stock.currency,
          stock.decisionResult?.decision,
          stock.sourceName,
          stock.sourceUrl,
          stock.fiscalPeriod,
          stock.dataType,
          stock.confirmedAt,
          ...stock.tags.map((tag) => conditionLabels[tag] || tag),
        ]
          .join(' ')
          .toLowerCase()

        if (!searchTarget.includes(normalizedKeyword)) return false
      }

      return true
    })
  }, [enrichedStocks, selectedMarket, selectedGroup, selectedConditions, keyword])

  const groupedSections = useMemo(() => {
    return marketOrder
      .map((market) => {
        const marketStocks = filteredStocks.filter((stock) => stock.market === market)
        const groups = [...new Set(marketStocks.map((stock) => stock.group))].map((group) => ({
          category: group,
          items: marketStocks.filter((stock) => stock.group === group),
        }))
        return { title: market, groups }
      })
      .filter((section) => section.groups.length > 0)
  }, [filteredStocks])

  const portfolioSummary = useMemo(() => {
    const positionedStocks = enrichedStocks.filter((stock) => stock.hasPosition)
    const valuedStocks = enrichedStocks.filter((stock) => stock.hasFullValuationData)
    const totalMarketValueJPY = enrichedStocks.reduce((sum, stock) => sum + (stock.marketValueJPY || 0), 0)
    const totalCostJPY = enrichedStocks.reduce((sum, stock) => sum + (stock.costJPY || 0), 0)
    const totalPnlJPY = totalMarketValueJPY - totalCostJPY
    const totalAnnualDividendJPY = enrichedStocks.reduce((sum, stock) => sum + (stock.annualDividendJPY || 0), 0)
    const portfolioDividendYield = totalMarketValueJPY > 0 ? (totalAnnualDividendJPY / totalMarketValueJPY) * 100 : null
    const unrealizedPnlRate = totalCostJPY > 0 ? (totalPnlJPY / totalCostJPY) * 100 : null

    const byGroupMap = new Map()
    for (const stock of enrichedStocks) {
      if (!stock.marketValueJPY) continue
      byGroupMap.set(stock.group, (byGroupMap.get(stock.group) || 0) + stock.marketValueJPY)
    }
    const byGroup = [...byGroupMap.entries()]
      .map(([group, value]) => ({ group, value, ratio: totalMarketValueJPY > 0 ? (value / totalMarketValueJPY) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)

    const buildDistribution = (key) => {
      const map = new Map()
      for (const stock of enrichedStocks) {
        if (!stock.marketValueJPY) continue
        const label = stock[key]
        map.set(label, (map.get(label) || 0) + stock.marketValueJPY)
      }
      return [...map.entries()]
        .map(([label, value]) => ({ label, value, ratio: totalMarketValueJPY > 0 ? (value / totalMarketValueJPY) * 100 : 0 }))
        .sort((a, b) => b.value - a.value)
    }

    const decisionCounts = Object.keys(decisionLabels).reduce((record, key) => {
      record[key] = enrichedStocks.filter((stock) => stock.decisionResult?.decision === key).length
      return record
    }, {})

    const byMarket = buildDistribution('market')
    const byCurrency = buildDistribution('currency')
    const byRuleProfile = [...new Set(enrichedStocks.map((stock) => stock.ruleProfile || 'GENERAL'))]
      .map((label) => ({ label, count: enrichedStocks.filter((stock) => (stock.ruleProfile || 'GENERAL') === label).length }))
      .sort((a, b) => b.count - a.count)
    const topPositions = enrichedStocks
      .filter((stock) => stock.marketValueJPY)
      .map((stock) => ({ ...stock, ratio: totalMarketValueJPY > 0 ? (stock.marketValueJPY / totalMarketValueJPY) * 100 : 0 }))
      .sort((a, b) => b.marketValueJPY - a.marketValueJPY)
      .slice(0, 10)

    const largestGroup = byGroup[0]
    const negativePositions = enrichedStocks.filter((stock) => stock.pnlJPY !== null && stock.pnlJPY < 0)
    const missingValuationData = positionedStocks.filter((stock) => !stock.hasFullValuationData)
    const invalidStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'INVALID_DATA')
    const unverifiedStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'UNVERIFIED_DATA')
    const sourceUrlInvalidStocks = enrichedStocks.filter((stock) => stock.verificationFieldErrors?.sourceUrl)
    const fiscalPeriodMissingStocks = enrichedStocks.filter((stock) => stock.verificationFieldErrors?.fiscalPeriod)
    const dataTypeMissingStocks = enrichedStocks.filter((stock) => stock.verificationFieldErrors?.dataType)
    const staleStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'STALE_DATA')
    const priceStaleStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'STALE_DATA' && stock.decisionResult?.reasons.some((reason) => reason.includes('現在価格') || reason.includes('価格更新日')))
    const financialStaleStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'STALE_DATA' && stock.decisionResult?.reasons.some((reason) => reason.includes('財務')))
    const fxStaleStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'STALE_DATA' && stock.decisionResult?.reasons.some((reason) => reason.includes('USD/JPY')))
    const weakEvidenceStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'WEAK_EVIDENCE')
    const mismatchedEvidenceStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'MISMATCHED_EVIDENCE')
    const multipleEvidenceValueStocks = enrichedStocks.filter((stock) => stock.decisionResult?.decision === 'MULTIPLE_EVIDENCE_VALUES')
    const evidenceMatchedStocks = enrichedStocks.filter((stock) => stock.evidenceMatch?.status === 'MATCH')
    const evidenceNotApplicableStocks = enrichedStocks.filter((stock) => stock.evidenceMatch?.status === 'NOT_APPLICABLE')
    const multipleNumberEvidenceStocks = enrichedStocks.filter((stock) => stock.evidenceMatch?.multipleNumbers)
    const quoteMissingStocks = enrichedStocks.filter((stock) => stock.evidenceFieldErrors?.sourceQuote)
    const pageMissingStocks = enrichedStocks.filter((stock) => stock.evidenceFieldErrors?.sourcePage)
    const metricMissingStocks = enrichedStocks.filter((stock) => stock.evidenceFieldErrors?.sourceMetricName)
    const criticalStocks = enrichedStocks.filter((stock) => ['INVALID_DATA', 'UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE', 'PROFILE_DATA_REQUIRED', 'STALE_DATA', 'SELL', 'REDUCE', 'NO_DATA'].includes(stock.decisionResult?.decision))

    return {
      positionedCount: positionedStocks.length,
      valuedCount: valuedStocks.length,
      totalMarketValueJPY,
      totalCostJPY,
      totalPnlJPY,
      totalAnnualDividendJPY,
      portfolioDividendYield,
      unrealizedPnlRate,
      byGroup,
      byMarket,
      byCurrency,
      byRuleProfile,
      topPositions,
      largestGroup,
      negativePositions,
      missingValuationData,
      decisionCounts,
      invalidStocks,
      unverifiedStocks,
      sourceUrlInvalidStocks,
      fiscalPeriodMissingStocks,
      dataTypeMissingStocks,
      weakEvidenceStocks,
      mismatchedEvidenceStocks,
      multipleEvidenceValueStocks,
      evidenceMatchedStocks,
      evidenceNotApplicableStocks,
      multipleNumberEvidenceStocks,
      quoteMissingStocks,
      pageMissingStocks,
      metricMissingStocks,
      staleStocks,
      priceStaleStocks,
      financialStaleStocks,
      fxStaleStocks,
      criticalStocks,
    }
  }, [enrichedStocks])

  const historyRuns = useMemo(() => buildHistoryRuns(decisionHistory), [decisionHistory])
  const latestHistoryRun = historyRuns[0] || null
  const outcomeStats = useMemo(() => buildOutcomeStats(decisionHistory), [decisionHistory])
  const actionStats = useMemo(() => buildActionStats(decisionHistory), [decisionHistory])
  const latestHistoryEntries = useMemo(() => {
    if (!latestHistoryRun) return []
    return decisionHistory.filter((item) => item.runId === latestHistoryRun.runId).slice(0, 12)
  }, [decisionHistory, latestHistoryRun])
  const stockDecisionHistoryMap = useMemo(() => {
    const map = new Map()
    for (const item of decisionHistory) {
      if (!map.has(item.code)) map.set(item.code, [])
      map.get(item.code).push(item)
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(b.decisionDate).localeCompare(String(a.decisionDate)))
    }
    return map
  }, [decisionHistory])
  const stockByCode = useMemo(() => new Map(enrichedStocks.map((stock) => [stock.code, stock])), [enrichedStocks])
  const auditStats = useMemo(() => buildAuditStats(auditLog), [auditLog])
  const integritySummary = useMemo(() => calculateDataCompleteness({ stocks: enrichedStocks, holdings, decisionHistory, auditLog, settings }), [enrichedStocks, holdings, decisionHistory, auditLog, settings])

  const checklistEntries = useMemo(() => operationalChecklistDefinitions.map((definition) => {
    const entry = operationalChecklist[definition.id] || {}
    const status = getChecklistStatus(definition, entry)
    return {
      ...definition,
      ...entry,
      ...status,
    }
  }), [operationalChecklist])

  const checklistStats = useMemo(() => {
    const overdue = checklistEntries.filter((item) => item.status === 'OVERDUE')
    const highOverdue = overdue.filter((item) => item.impact === 'HIGH')
    const done = checklistEntries.filter((item) => item.status === 'DONE')
    const byCadence = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].map((cadence) => ({
      cadence,
      label: cadenceLabels[cadence],
      total: checklistEntries.filter((item) => item.cadence === cadence).length,
      overdue: checklistEntries.filter((item) => item.cadence === cadence && item.status === 'OVERDUE').length,
      done: checklistEntries.filter((item) => item.cadence === cadence && item.status === 'DONE').length,
    }))
    return {
      total: checklistEntries.length,
      done: done.length,
      overdue: overdue.length,
      highOverdue: highOverdue.length,
      completionRate: checklistEntries.length > 0 ? (done.length / checklistEntries.length) * 100 : 0,
      byCadence,
    }
  }, [checklistEntries])

  const guidedWorkflowStats = useMemo(() => guidedWorkflowDefinitions.map((workflow) => {
    const doneCount = workflow.steps.filter((step) => guidedWorkflow.completedSteps?.[getGuidedStepKey(workflow.id, step.id)]).length
    const checklistDoneCount = workflow.steps.filter((step) => {
      const linked = checklistEntries.find((item) => item.id === step.checklistId)
      return linked?.status === 'DONE'
    }).length
    return {
      ...workflow,
      doneCount,
      checklistDoneCount,
      totalSteps: workflow.steps.length,
      completionRate: workflow.steps.length > 0 ? (doneCount / workflow.steps.length) * 100 : 0,
    }
  }), [guidedWorkflow, checklistEntries])

  const activeGuidedWorkflow = useMemo(() => {
    return guidedWorkflowDefinitions.find((workflow) => workflow.id === guidedWorkflow.activeWorkflowId) || guidedWorkflowDefinitions[0]
  }, [guidedWorkflow.activeWorkflowId])

  const activeGuidedWorkflowSteps = useMemo(() => {
    return activeGuidedWorkflow.steps.map((step, index) => {
      const key = getGuidedStepKey(activeGuidedWorkflow.id, step.id)
      const linkedChecklist = checklistEntries.find((item) => item.id === step.checklistId)
      return {
        ...step,
        index: index + 1,
        completedAt: guidedWorkflow.completedSteps?.[key] || '',
        key,
        checklistStatus: linkedChecklist?.status || 'OVERDUE',
        checklistStatusLabel: linkedChecklist?.label || '未実施',
        checklistAgeDays: linkedChecklist?.ageDays ?? null,
      }
    })
  }, [activeGuidedWorkflow, guidedWorkflow.completedSteps, checklistEntries])

  const coverageDiagnostics = useMemo(() => buildCoverageDiagnostics({ stocks: enrichedStocks, decisionHistory, auditLog, checklistEntries, integritySummary }), [enrichedStocks, decisionHistory, auditLog, checklistEntries, integritySummary])


  const riskWeightConfigErrors = useMemo(() => validateRiskWeightConfig(riskWeightConfig), [riskWeightConfig])

  const updateRiskWeight = (key, value) => {
    setRiskWeightConfig((current) => sanitizeRiskWeightConfig({
      ...current,
      weights: { ...current.weights, [key]: value },
    }))
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: 'リスク重み設定', fieldName: `riskWeight.${key}`, previousValue: riskWeightConfig.weights?.[key] || '', newValue: value, changeSource: 'rule_config', ruleVersion: riskWeightConfig.riskScoreVersion }))
  }

  const updateRiskLevel = (key, value) => {
    setRiskWeightConfig((current) => sanitizeRiskWeightConfig({
      ...current,
      levels: { ...current.levels, [key]: value },
    }))
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: 'リスクレベル設定', fieldName: `riskLevel.${key}`, previousValue: riskWeightConfig.levels?.[key] || '', newValue: value, changeSource: 'rule_config', ruleVersion: riskWeightConfig.riskScoreVersion }))
  }

  const updateRiskWeightMeta = (fieldName, value) => {
    setRiskWeightConfig((current) => sanitizeRiskWeightConfig({ ...current, [fieldName]: value }))
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: 'リスク重み設定', fieldName, previousValue: riskWeightConfig[fieldName] || '', newValue: value, changeSource: 'rule_config', ruleVersion: riskWeightConfig.riskScoreVersion }))
  }

  const resetRiskWeightConfig = () => {
    if (!confirmDangerousAction('リスク重み設定の初期化', 'RESET')) return
    setRiskWeightConfig(sanitizeRiskWeightConfig(DEFAULT_RISK_WEIGHT_CONFIG))
    appendAuditEntries(buildAuditEntry({ code: 'SYSTEM', name: 'リスク重み設定', fieldName: 'riskWeightConfig', previousValue: 'custom', newValue: 'default', changeSource: 'rule_config', ruleVersion: RISK_SCORE_VERSION }))
  }

  const riskPriorityList = useMemo(() => {
    return enrichedStocks
      .map((stock) => calculateRiskPriority(stock, stockDecisionHistoryMap.get(stock.code) || [], riskWeightConfig))
      .sort((a, b) => b.riskPriorityScore - a.riskPriorityScore || (b.marketValueJPY || 0) - (a.marketValueJPY || 0))
      .map((stock, index) => ({ ...stock, riskPriorityRank: index + 1 }))
  }, [enrichedStocks, stockDecisionHistoryMap, riskWeightConfig])

  const riskPriorityStats = useMemo(() => buildRiskPriorityStats(riskPriorityList), [riskPriorityList])

  const riskWeightDiagnosticsResult = useMemo(() => buildRiskWeightDiagnostics(riskPriorityList, decisionHistory, riskWeightConfig), [riskPriorityList, decisionHistory, riskWeightConfig])
  const riskWeightDiagnostics = riskWeightDiagnosticsResult.diagnostics
  const riskWeightDiagnosticStats = riskWeightDiagnosticsResult.stats


  const appendAuditEntries = (entries) => {
    const normalized = sanitizeAuditLog(Array.isArray(entries) ? entries : [entries])
    if (normalized.length === 0) return
    setAuditLog((current) => [...normalized, ...current].slice(0, 20000))
  }

  const totalCount = filteredStocks.length
  const jpCount = filteredStocks.filter((stock) => stock.market === '日本株').length
  const usCount = filteredStocks.filter((stock) => stock.market === '米国株').length
  const missingCount = Math.max(ACTUAL_HOLDING_COUNT - stocks.length, 0)

  const onHoldingChange = (code, holding, meta = {}) => {
    const stock = stockByCode.get(code)
    const previous = holdings[code] || {}
    setHoldings((current) => ({ ...current, [code]: holding }))
    if (meta.fieldName && String(meta.previousValue ?? previous[meta.fieldName] ?? '') !== String(meta.newValue ?? holding[meta.fieldName] ?? '')) {
      appendAuditEntries(buildAuditEntry({
        code,
        name: stock?.name || '',
        fieldName: meta.fieldName,
        previousValue: meta.previousValue ?? previous[meta.fieldName] ?? '',
        newValue: meta.newValue ?? holding[meta.fieldName] ?? '',
        changeSource: meta.changeSource || 'manual',
        decisionBefore: stock?.decisionResult?.decision || '',
        decisionAfter: 'RECALCULATED_AFTER_CHANGE',
        ruleVersion: DECISION_HISTORY_VERSION,
      }))
    }
  }

  const toggleCondition = (condition) => {
    setSelectedConditions((current) =>
      current.includes(condition) ? current.filter((item) => item !== condition) : [...current, condition]
    )
  }

  const resetFilters = () => {
    setSelectedMarket('ALL')
    setSelectedGroup('ALL')
    setSelectedConditions([])
    setKeyword('')
  }

  const importCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const text = await file.text()
      const { headers, rows } = parseCsvText(text)
      const stockCodeSet = new Set(stocks.map((stock) => stock.code))

      if (!headers.includes('code')) {
        setImportMessage('CSV取込失敗: code列がありません。CSV出力したファイル形式を使用してください。')
        return
      }

      let importedCount = 0
      let unknownCount = 0
      let invalidCount = 0
      const nextHoldings = { ...holdings }

      for (const row of rows) {
        const code = String(getCsvValue(row, ['code', '銘柄コード'])).trim()
        if (!code) continue

        if (!stockCodeSet.has(code)) {
          unknownCount += 1
          continue
        }

        const importedHolding = normalizeImportedHolding({
          shares: getCsvValue(row, ['shares', '保有数']),
          averagePrice: getCsvValue(row, ['averagePrice', '取得単価']),
          currentPrice: getCsvValue(row, ['currentPrice', '現在価格']),
          annualDividend: getCsvValue(row, ['annualDividend', '年間配当']),
          payoutRatio: getCsvValue(row, ['payoutRatio', '配当性向']),
          operatingCashFlowYoY: getCsvValue(row, ['operatingCashFlowYoY', '営業CF前年比']),
          revenueYoY: getCsvValue(row, ['revenueYoY', '売上前年比']),
          epsYoY: getCsvValue(row, ['epsYoY', 'EPS前年比']),
          equityRatio: getCsvValue(row, ['equityRatio', '自己資本比率']),
          debtToEquity: getCsvValue(row, ['debtToEquity', '有利子負債倍率']),
          dividendCut: getCsvValue(row, ['dividendCut', '減配']),
          ruleProfile: getCsvValue(row, ['ruleProfile', '判定プロファイル']),
          priceUpdatedAt: getCsvValue(row, ['priceUpdatedAt', '価格更新日']),
          financialUpdatedAt: getCsvValue(row, ['financialUpdatedAt', '財務更新日']),
          sourceName: getCsvValue(row, ['sourceName', 'データ取得元', '取得元名']),
          sourceUrl: getCsvValue(row, ['sourceUrl', '根拠URL']),
          fiscalPeriod: getCsvValue(row, ['fiscalPeriod', '対象決算期']),
          dataType: getCsvValue(row, ['dataType', 'データ種別']),
          confirmedAt: getCsvValue(row, ['confirmedAt', '根拠確認日']),
          sourcePage: getCsvValue(row, ['sourcePage', '根拠ページ']),
          sourceQuote: getCsvValue(row, ['sourceQuote', '引用文・該当数値', '引用']),
          selectedEvidenceValue: getCsvValue(row, ['selectedEvidenceValue', '採用証跡値']),
          sourceMetricName: getCsvValue(row, ['sourceMetricName', '参照指標名', '指標名']),
          sourceUnit: getCsvValue(row, ['sourceUnit', '単位']),
          evidenceMemo: getCsvValue(row, ['evidenceMemo', '補足メモ']),
        })

        const values = Object.values(importedHolding)
        const isEmpty = values.every((value) => value === '')
        const isValid = isValidImportedHolding(importedHolding)

        if (!isValid) {
          invalidCount += 1
          continue
        }

        if (isEmpty) {
          delete nextHoldings[code]
        } else {
          nextHoldings[code] = importedHolding
        }
        importedCount += 1
      }

      const auditEntries = []
      for (const [code, nextHolding] of Object.entries(nextHoldings)) {
        const previousHolding = holdings[code] || {}
        const stock = stockByCode.get(code)
        for (const fieldName of holdingFields) {
          const previousValue = previousHolding[fieldName] ?? ''
          const newValue = nextHolding[fieldName] ?? ''
          if (String(previousValue) !== String(newValue)) {
            auditEntries.push(buildAuditEntry({ code, name: stock?.name || '', fieldName, previousValue, newValue, changeSource: 'csv_import', decisionBefore: stock?.decisionResult?.decision || '', decisionAfter: 'RECALCULATED_AFTER_CHANGE' }))
          }
        }
      }
      setHoldings(nextHoldings)
      appendAuditEntries(auditEntries)
      setImportMessage(`CSV取込完了: ${importedCount}件反映 / 未登録コード ${unknownCount}件 / 数値不正 ${invalidCount}件`)
    } catch (error) {
      setImportMessage(`CSV取込失敗: ${error instanceof Error ? error.message : 'ファイルを読み込めませんでした'}`)
    }
  }

  const buildMissingDataImportPreview = ({ headers, rows }) => {
    const stockCodeSet = new Set(stocks.map((stock) => stock.code))

    if (!headers.includes('code') || !headers.includes('missingField')) {
      throw new Error('code列とmissingField列が必要です。portfolio-missing-data-template.csvを使用してください。')
    }

    let importableCount = 0
    let unknownCount = 0
    let invalidCount = 0
    let skippedCount = 0
    let highImpactCount = 0
    let fxUpdated = false
    const nextHoldings = { ...holdings }
    const auditEntries = []
    const previewRows = []
    let nextFxUpdatedAt = fxUpdatedAtInput

    for (const row of rows) {
      const code = String(getCsvValue(row, ['code', '銘柄コード'])).trim()
      const fieldName = String(getCsvValue(row, ['missingField', 'fieldName', '項目'])).trim()
      const importedValue = getCsvValue(row, ['importedValue', 'value', 'newValue', 'inputValue', '入力値', '反映値'])
      const fieldLabel = getCoverageFieldLabel(fieldName)
      const basePreview = { code, name: '', fieldName, fieldLabel, previousValue: '', newValue: importedValue, status: 'SKIPPED', reason: '', impactLevel: 'LOW', decisionBefore: '', decisionAfter: 'RECALCULATED_AFTER_APPLY' }

      if (!code || !fieldName) {
        skippedCount += 1
        previewRows.push({ ...basePreview, reason: 'codeまたはmissingFieldが空' })
        continue
      }

      if (fieldName === 'fxUpdatedAt') {
        const normalized = normalizeMissingDataImportValue(fieldName, importedValue)
        if (!normalized.ok) {
          invalidCount += 1
          previewRows.push({ ...basePreview, status: 'INVALID', reason: normalized.reason || '値が不正' })
          continue
        }
        if (String(nextFxUpdatedAt || '') === String(normalized.value || '')) {
          skippedCount += 1
          previewRows.push({ ...basePreview, previousValue: nextFxUpdatedAt || '', newValue: normalized.value, reason: '変更なし' })
          continue
        }
        const impactLevel = 'HIGH'
        highImpactCount += 1
        auditEntries.push(buildAuditEntry({ code: 'SYSTEM', name: 'USD/JPY更新日', fieldName, previousValue: nextFxUpdatedAt || '', newValue: normalized.value, changeSource: 'missing_data_import_preview_apply', ruleVersion: DECISION_HISTORY_VERSION }))
        previewRows.push({ ...basePreview, name: 'USD/JPY更新日', previousValue: nextFxUpdatedAt || '', newValue: normalized.value, status: 'IMPORTABLE', reason: '適用待ち', impactLevel, decisionBefore: 'SYSTEM', decisionAfter: 'RECALCULATED_AFTER_APPLY' })
        nextFxUpdatedAt = normalized.value
        fxUpdated = true
        importableCount += 1
        continue
      }

      if (!stockCodeSet.has(code)) {
        unknownCount += 1
        previewRows.push({ ...basePreview, status: 'UNKNOWN_CODE', reason: '登録銘柄に存在しないcode' })
        continue
      }

      if (!holdingFields.includes(fieldName)) {
        invalidCount += 1
        previewRows.push({ ...basePreview, status: 'INVALID', reason: '取込対象外の項目' })
        continue
      }

      const normalized = normalizeMissingDataImportValue(fieldName, importedValue)
      if (!normalized.ok) {
        invalidCount += 1
        previewRows.push({ ...basePreview, status: 'INVALID', reason: normalized.reason || '値が不正' })
        continue
      }

      const stock = stockByCode.get(code)
      const previousHolding = nextHoldings[code] || {}
      const previousValue = previousHolding[fieldName] ?? ''
      const newValue = normalized.value
      const decisionBefore = stock?.decisionResult?.decision || ''
      const impactLevel = ['currentPrice', 'annualDividend', 'payoutRatio', 'operatingCashFlowYoY', 'epsYoY', 'dividendCut', 'sourceQuote', 'selectedEvidenceValue', 'financialUpdatedAt', 'priceUpdatedAt'].includes(fieldName) ? 'HIGH' : 'MEDIUM'

      if (String(previousValue) === String(newValue)) {
        skippedCount += 1
        previewRows.push({ ...basePreview, name: stock?.name || '', previousValue, newValue, decisionBefore, reason: '変更なし' })
        continue
      }

      if (impactLevel === 'HIGH') highImpactCount += 1
      nextHoldings[code] = { ...previousHolding, [fieldName]: newValue }
      auditEntries.push(buildAuditEntry({
        code,
        name: stock?.name || '',
        fieldName,
        previousValue,
        newValue,
        changeSource: 'missing_data_import_preview_apply',
        decisionBefore,
        decisionAfter: 'RECALCULATED_AFTER_APPLY',
        ruleVersion: DECISION_HISTORY_VERSION,
      }))
      previewRows.push({ ...basePreview, name: stock?.name || '', previousValue, newValue, status: 'IMPORTABLE', reason: '適用待ち', impactLevel, decisionBefore, decisionAfter: 'RECALCULATED_AFTER_APPLY' })
      importableCount += 1
    }

    return { importableCount, unknownCount, invalidCount, skippedCount, highImpactCount, fxUpdated, nextHoldings, auditEntries, nextFxUpdatedAt, rows: previewRows, createdAt: new Date().toISOString() }
  }

  const importMissingDataTemplateCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const text = await file.text()
      const { headers, rows } = parseCsvText(text)
      const preview = buildMissingDataImportPreview({ headers, rows })
      setPendingMissingImport(preview)
      setImportMessage(`不足入力CSVプレビュー作成: 反映予定 ${preview.importableCount}件 / HIGH影響 ${preview.highImpactCount}件 / 未登録 ${preview.unknownCount}件 / 不正 ${preview.invalidCount}件 / スキップ ${preview.skippedCount}件。内容確認後に「プレビューを適用」を押してください。`)
    } catch (error) {
      setPendingMissingImport(null)
      setImportMessage(`不足入力CSVプレビュー失敗: ${error instanceof Error ? error.message : 'ファイルを読み込めませんでした'}`)
    }
  }


  const previewBulkPasteImport = () => {
    const text = bulkPasteText.trim()
    if (!text) {
      setImportMessage('一括貼り付け入力が空です。Excel / Google Sheets からヘッダー付きで貼り付けてください。')
      return
    }

    try {
      const { headers, rows } = parseCsvText(text)
      if (!headers.length || rows.length === 0) {
        setPendingMissingImport(null)
        setImportMessage('一括貼り付けプレビュー失敗: ヘッダー行またはデータ行がありません。')
        return
      }
      const preview = buildMissingDataImportPreview({ headers, rows })
      setPendingMissingImport({ ...preview, sourceType: 'bulk_paste' })
      setImportMessage(`一括貼り付けプレビュー作成: 反映予定 ${preview.importableCount}件 / HIGH影響 ${preview.highImpactCount}件 / 未登録 ${preview.unknownCount}件 / 不正 ${preview.invalidCount}件 / スキップ ${preview.skippedCount}件。内容確認後に「プレビューを適用」を押してください。`)
    } catch (error) {
      setPendingMissingImport(null)
      setImportMessage(`一括貼り付けプレビュー失敗: ${error instanceof Error ? error.message : '貼り付け内容を解析できませんでした'}`)
    }
  }

  const clearBulkPasteInput = () => {
    setBulkPasteText('')
    setImportMessage('一括貼り付け入力をクリアしました。')
  }

  const buildImportValidationReport = (preview) => {
    const createdAt = new Date().toISOString()
    const importableRows = preview.rows.filter((row) => row.status === 'IMPORTABLE')
    const rejectedRows = preview.rows.filter((row) => ['INVALID', 'UNKNOWN_CODE'].includes(row.status))
    const skippedRows = preview.rows.filter((row) => row.status === 'SKIPPED')
    const highImpactRows = importableRows.filter((row) => row.impactLevel === 'HIGH')
    const changedFields = importableRows.reduce((acc, row) => {
      acc[row.fieldName] = (acc[row.fieldName] || 0) + 1
      return acc
    }, {})
    const affectedStocks = [...new Set(importableRows.filter((row) => row.code && row.code !== 'SYSTEM').map((row) => row.code))]
    const coverageBefore = coverageDiagnostics.coverageScore
    const totalFields = coverageDiagnostics.totalFields || 0
    const filledFieldsBefore = coverageDiagnostics.filledFields || 0
    const netFilledDelta = importableRows.reduce((sum, row) => {
      const wasFilled = isFilled(row.previousValue)
      const isNowFilled = isFilled(row.newValue)
      if (!wasFilled && isNowFilled) return sum + 1
      if (wasFilled && !isNowFilled) return sum - 1
      return sum
    }, 0)
    const filledFieldsAfterEstimate = Math.max(0, Math.min(totalFields, filledFieldsBefore + netFilledDelta))
    const coverageAfterEstimate = totalFields > 0 ? Math.round((filledFieldsAfterEstimate / totalFields) * 100) : coverageBefore
    const beforeTopRiskScore = riskPriorityRows[0]?.riskPriorityScore || 0
    const changedRiskRows = importableRows.filter((row) => row.impactLevel === 'HIGH' || ['currentPrice', 'payoutRatio', 'operatingCashFlowYoY', 'epsYoY', 'financialUpdatedAt', 'priceUpdatedAt', 'sourceQuote', 'selectedEvidenceValue'].includes(row.fieldName)).length

    return {
      reportId: `import-${Date.now()}`,
      createdAt,
      appliedRows: importableRows.length,
      rejectedRows: rejectedRows.length,
      skippedRows: skippedRows.length,
      highImpactRows: highImpactRows.length,
      affectedStockCount: affectedStocks.length,
      decisionChangedRows: highImpactRows.length,
      coverageBefore,
      coverageAfterEstimate,
      coverageDeltaEstimate: coverageAfterEstimate - coverageBefore,
      riskScoreBeforeTop: beforeTopRiskScore,
      riskScoreAfter: 'RECALCULATED_AFTER_APPLY',
      changedRiskRows,
      changedFields,
      rejectedReasons: rejectedRows.reduce((acc, row) => { acc[row.reason] = (acc[row.reason] || 0) + 1; return acc }, {}),
      rows: preview.rows.map((row) => ({
        status: row.status,
        code: row.code,
        name: row.name,
        fieldName: row.fieldName,
        fieldLabel: row.fieldLabel,
        previousValue: row.previousValue,
        newValue: row.newValue,
        decisionBefore: row.decisionBefore,
        decisionAfter: row.decisionAfter,
        impactLevel: row.impactLevel,
        reason: row.reason,
      })),
    }
  }

  const exportImportValidationReportJson = () => {
    if (!importValidationReport) {
      setImportMessage('出力できるインポート後検証レポートがありません。')
      return
    }
    downloadTextFile(JSON.stringify(importValidationReport, null, 2), `portfolio-import-validation-report-${importValidationReport.createdAt.slice(0, 10)}.json`, 'application/json;charset=utf-8;')
  }

  const exportImportValidationReportCsv = () => {
    if (!importValidationReport) {
      setImportMessage('出力できるインポート後検証レポートがありません。')
      return
    }
    const header = ['createdAt', 'status', 'code', 'name', 'fieldName', 'fieldLabel', 'previousValue', 'newValue', 'decisionBefore', 'decisionAfter', 'impactLevel', 'reason']
    const rows = importValidationReport.rows.map((row) => [importValidationReport.createdAt, row.status, row.code, row.name, row.fieldName, row.fieldLabel, row.previousValue, row.newValue, row.decisionBefore, row.decisionAfter, row.impactLevel, row.reason])
    downloadTextFile(`﻿${toCsvText([header, ...rows])}`, `portfolio-import-validation-report-${importValidationReport.createdAt.slice(0, 10)}.csv`, 'text/csv;charset=utf-8;')
  }

  const applyPendingMissingDataImport = () => {
    if (!pendingMissingImport) return
    const report = buildImportValidationReport(pendingMissingImport)
    setHoldings(pendingMissingImport.nextHoldings)
    if (pendingMissingImport.fxUpdated) setFxUpdatedAtInput(pendingMissingImport.nextFxUpdatedAt)
    appendAuditEntries(pendingMissingImport.auditEntries)
    setImportValidationReport(report)
    setImportMessage(`不足入力CSV反映完了: ${pendingMissingImport.importableCount}件反映 / HIGH影響 ${pendingMissingImport.highImpactCount}件 / 未登録 ${pendingMissingImport.unknownCount}件 / 不正 ${pendingMissingImport.invalidCount}件 / スキップ ${pendingMissingImport.skippedCount}件。インポート後検証レポートを作成しました。`)
    setPendingMissingImport(null)
  }

  const cancelPendingMissingDataImport = () => {
    setPendingMissingImport(null)
    setImportMessage('不足入力CSVプレビューを破棄しました。データは変更していません。')
  }

  const exportCsv = () => {
    const header = [
      'code', 'name', 'market', 'group', 'currency',
      'shares', 'averagePrice', 'currentPrice', 'annualDividend',
      'payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'dividendCut', 'ruleProfile',
      'bankCapitalRatio', 'bankNplRatio', 'bankCreditCostRatio', 'bankNetInterestMargin', 'reitLtv', 'reitOccupancyRate', 'reitNavRatio', 'reitFfoYoY', 'utilityCapexToSales', 'utilityFuelCostYoY', 'cyclicalMarketIndexYoY', 'inventoryYoY', 'capacityUtilization', 'growthFcfYoY', 'operatingMargin', 'rdToSales', 'pipelineProgress', 'financialAumYoY', 'financialCreditCostRatio',
      'priceUpdatedAt', 'financialUpdatedAt', 'fxUpdatedAt',
      'sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt',
      'sourcePage', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit', 'evidenceMemo',
      'decision', 'severity', 'decisionReasons', 'validationErrors', 'verificationErrors', 'evidenceErrors', 'multipleEvidenceValueErrors', 'evidenceMatchErrors',
      'evidenceMatchStatus', 'evidenceQuotedValue', 'evidenceSelectedValue', 'evidenceInputValue', 'evidenceDifference', 'evidenceMatchedMetric', 'evidenceExtractedNumbers',
      'marketValueJPY', 'costJPY', 'pnlJPY', 'annualDividendJPY', 'dividendYield', 'positionWeight', 'sectorWeight'
    ]
    const rows = enrichedStocks.map((stock) => [
      stock.code,
      stock.name,
      stock.market,
      stock.group,
      stock.currency,
      stock.holding.shares || '',
      stock.holding.averagePrice || '',
      stock.holding.currentPrice || '',
      stock.holding.annualDividend || '',
      stock.holding.payoutRatio || '',
      stock.holding.operatingCashFlowYoY || '',
      stock.holding.revenueYoY || '',
      stock.holding.epsYoY || '',
      stock.holding.equityRatio || '',
      stock.holding.debtToEquity || '',
      stock.holding.dividendCut || '',
      stock.ruleProfile || '',
      stock.holding.bankCapitalRatio || '',
      stock.holding.bankNplRatio || '',
      stock.holding.bankCreditCostRatio || '',
      stock.holding.bankNetInterestMargin || '',
      stock.holding.reitLtv || '',
      stock.holding.reitOccupancyRate || '',
      stock.holding.reitNavRatio || '',
      stock.holding.reitFfoYoY || '',
      stock.holding.utilityCapexToSales || '',
      stock.holding.utilityFuelCostYoY || '',
      stock.holding.cyclicalMarketIndexYoY || '',
      stock.holding.inventoryYoY || '',
      stock.holding.capacityUtilization || '',
      stock.holding.growthFcfYoY || '',
      stock.holding.operatingMargin || '',
      stock.holding.rdToSales || '',
      stock.holding.pipelineProgress || '',
      stock.holding.financialAumYoY || '',
      stock.holding.financialCreditCostRatio || '',
      stock.holding.priceUpdatedAt || '',
      stock.holding.financialUpdatedAt || '',
      stock.fxUpdatedAt || '',
      stock.holding.sourceName || '',
      stock.holding.sourceUrl || '',
      stock.holding.fiscalPeriod || '',
      stock.holding.dataType || '',
      stock.holding.confirmedAt || '',
      stock.holding.sourcePage || '',
      stock.holding.sourceQuote || '',
      stock.holding.selectedEvidenceValue || '',
      stock.holding.sourceMetricName || '',
      stock.holding.sourceUnit || '',
      stock.holding.evidenceMemo || '',
      stock.decisionResult?.decision || '',
      stock.decisionResult?.severity || '',
      (stock.decisionResult?.reasons || []).join(' / '),
      (stock.validationErrors || []).join(' / '),
      (stock.verificationErrors || []).join(' / '),
      (stock.evidenceErrors || []).join(' / '),
      (stock.multipleEvidenceValueErrors || []).join(' / '),
      (stock.evidenceMatchErrors || []).join(' / '),
      stock.evidenceMatch?.status || '',
      stock.evidenceMatch?.quotedValue ?? '',
      stock.evidenceMatch?.selectedEvidenceValue ?? '',
      stock.evidenceMatch?.inputValue ?? '',
      stock.evidenceMatch?.difference ?? '',
      stock.evidenceMatch?.matchedMetricLabel || '',
      (stock.evidenceMatch?.extractedNumbers || []).join(' / '),
      stock.marketValueJPY || '',
      stock.costJPY || '',
      stock.pnlJPY || '',
      stock.annualDividendJPY || '',
      stock.dividendYield || '',
      stock.positionWeight || '',
      stock.sectorWeight || '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    downloadTextFile(`\uFEFF${csv}`, 'portfolio-dashboard.csv', 'text/csv;charset=utf-8;')
  }

  const exportJson = () => {
    const payloadForHash = createBackupPayloadForHash({
      usdJpy: usdJpyInput,
      fxUpdatedAt: fxUpdatedAtInput,
      holdings,
      decisionHistory,
      auditLog,
      operationalChecklist,
      riskWeightConfig,
    })
    const backupMeta = buildBackupMeta({ payload: payloadForHash, stocks, decisionHistory, auditLog, operationalChecklist })
    const backup = {
      app: 'portfolio-dashboard',
      version: 11,
      schemaVersion: APP_SCHEMA_VERSION,
      exportedAt: backupMeta.lastBackupAt,
      usdJpy: usdJpyInput,
      fxUpdatedAt: fxUpdatedAtInput,
      holdings,
      decisionHistory,
      auditLog,
      operationalChecklist,
      riskWeightConfig,
      riskScoreVersion: riskWeightConfig.riskScoreVersion,
      checklistSchemaVersion: CHECKLIST_SCHEMA_VERSION,
      auditLogVersion: AUDIT_LOG_VERSION,
      backupMeta,
      integritySummary,
      rules: {
        sell: ['減配あり', '配当性向100%以上', '営業CF前年比-30%以下', 'EPS前年比-30%以下', '自己資本比率20%未満', '有利子負債倍率5倍以上'],
        reduce: ['個別銘柄比率8%以上', '同一セクター比率25%以上', '配当性向80%以上', '営業CF前年比-15%以下', '含み損-20%以下'],
        buy: ['配当性向70%未満', '営業CF前年比0%以上', 'EPS前年比0%以上', '自己資本比率30%以上', '有利子負債倍率3倍未満', '配当利回り3%以上', '個別銘柄比率5%未満', '同一セクター比率20%未満'],
        invalidData: ['数値以外', '許容範囲外', 'USD/JPY 50未満または300超'],
        staleData: ['現在価格7日超', 'USD/JPY7日超', '財務データ100日超'],
        unverifiedData: ['取得元名未入力', '根拠URL未入力または不正', '対象決算期未入力または形式不明', 'データ種別未選択', '根拠確認日未入力または未来日'],
        weakEvidence: ['根拠ページ未入力', '引用文・該当数値なし', '引用に数値なし', '参照指標名なし', '単位なし'],
        multipleEvidenceValues: ['引用文に複数数値がある場合は採用証跡値が必須', '採用証跡値が引用文内数値と一致しない場合は判定停止'],
        mismatchedEvidence: ['採用証跡値と入力値の不一致', '許容差超過'],
        ruleProfiles: ruleProfileOptions.map((option) => option.value),
        decisionHistoryVersion: DECISION_HISTORY_VERSION,
        decisionHistory: ['判定日時', '入力値スナップショット', 'ポートフォリオ比率', '証跡スナップショットを保存'],
        auditLog: ['変更日時', '銘柄', '項目', '変更前', '変更後', '変更元', '判定変化', '影響度'],
        integrity: ['バックアップハッシュ', '完全性スコア', '履歴件数', '監査ログ件数', '重要項目欠損件数'],
        operationalChecklist: ['日次', '週次', '月次', '四半期の運用タスク', '期限切れチェック', 'チェックリストCSV出力'],
      },
    }
    setIntegrityMeta((current) => sanitizeIntegrityMeta({
      ...current,
      backupIntegrityHash: backupMeta.backupIntegrityHash,
      lastBackupAt: backupMeta.lastBackupAt,
      integrityWarnings: integritySummary.integrityWarnings,
    }))
    downloadTextFile(JSON.stringify(backup, null, 2), 'portfolio-dashboard-backup.json', 'application/json;charset=utf-8;')
  }

  const importJson = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const restoreHashPayload = createBackupPayloadForHash({
        usdJpy: parsed?.usdJpy ?? '',
        fxUpdatedAt: parsed?.fxUpdatedAt ?? '',
        holdings: parsed?.holdings || {},
        decisionHistory: Array.isArray(parsed?.decisionHistory) ? parsed.decisionHistory : [],
        auditLog: Array.isArray(parsed?.auditLog) ? parsed.auditLog : [],
        operationalChecklist: sanitizeChecklist(parsed?.operationalChecklist),
        riskWeightConfig: sanitizeRiskWeightConfig(parsed?.riskWeightConfig),
      })
      const calculatedRestoreHash = buildIntegrityHash(restoreHashPayload)
      const declaredRestoreHash = parsed?.backupMeta?.backupIntegrityHash ? String(parsed.backupMeta.backupIntegrityHash) : ''
      const restoreWarnings = []
      if (declaredRestoreHash && declaredRestoreHash !== calculatedRestoreHash) {
        restoreWarnings.push(`バックアップハッシュ不一致: declared=${declaredRestoreHash} calculated=${calculatedRestoreHash}`)
      }
      if (!declaredRestoreHash) restoreWarnings.push('バックアップハッシュなし')
      const importedHoldings = parsed?.holdings

      if (!importedHoldings || typeof importedHoldings !== 'object' || Array.isArray(importedHoldings)) {
        setImportMessage('JSON取込失敗: holdingsがありません。JSON出力したバックアップを使用してください。')
        return
      }

      const stockCodeSet = new Set(stocks.map((stock) => stock.code))
      const nextHoldings = {}
      let importedCount = 0
      let unknownCount = 0
      let invalidCount = 0

      for (const [code, holding] of Object.entries(importedHoldings)) {
        if (!stockCodeSet.has(code)) {
          unknownCount += 1
          continue
        }

        const normalized = normalizeImportedHolding({
          shares: holding?.shares,
          averagePrice: holding?.averagePrice,
          currentPrice: holding?.currentPrice,
          annualDividend: holding?.annualDividend,
          payoutRatio: holding?.payoutRatio,
          operatingCashFlowYoY: holding?.operatingCashFlowYoY,
          revenueYoY: holding?.revenueYoY,
          epsYoY: holding?.epsYoY,
          equityRatio: holding?.equityRatio,
          debtToEquity: holding?.debtToEquity,
          dividendCut: holding?.dividendCut,
          ruleProfile: holding?.ruleProfile,
          priceUpdatedAt: holding?.priceUpdatedAt,
          financialUpdatedAt: holding?.financialUpdatedAt,
          sourceName: holding?.sourceName,
          sourceUrl: holding?.sourceUrl,
          fiscalPeriod: holding?.fiscalPeriod,
          dataType: holding?.dataType,
          confirmedAt: holding?.confirmedAt,
          sourcePage: holding?.sourcePage,
          sourceQuote: holding?.sourceQuote,
          selectedEvidenceValue: holding?.selectedEvidenceValue,
          sourceMetricName: holding?.sourceMetricName,
          sourceUnit: holding?.sourceUnit,
          evidenceMemo: holding?.evidenceMemo,
        })
        const values = Object.values(normalized)

        if (!isValidImportedHolding(normalized)) {
          invalidCount += 1
          continue
        }

        if (!values.every((value) => value === '')) {
          nextHoldings[code] = normalized
          importedCount += 1
        }
      }

      const auditEntries = []
      for (const [code, nextHolding] of Object.entries(nextHoldings)) {
        const previousHolding = holdings[code] || {}
        const stock = stockByCode.get(code)
        for (const fieldName of holdingFields) {
          const previousValue = previousHolding[fieldName] ?? ''
          const newValue = nextHolding[fieldName] ?? ''
          if (String(previousValue) !== String(newValue)) {
            auditEntries.push(buildAuditEntry({ code, name: stock?.name || '', fieldName, previousValue, newValue, changeSource: 'json_restore', decisionBefore: stock?.decisionResult?.decision || '', decisionAfter: 'RECALCULATED_AFTER_CHANGE' }))
          }
        }
      }
      const restoreAt = new Date().toISOString()
      auditEntries.unshift(buildAuditEntry({
        code: 'SYSTEM',
        name: 'バックアップ復元',
        fieldName: 'restoreSourceHash',
        previousValue: integrityMeta.restoreSourceHash || '',
        newValue: calculatedRestoreHash,
        changeSource: 'json_restore',
        decisionBefore: integrityMeta.restoreStatus || '',
        decisionAfter: restoreWarnings.length > 0 ? 'RESTORED_WITH_WARNINGS' : 'RESTORED',
      }))
      setIntegrityMeta((current) => sanitizeIntegrityMeta({
        ...current,
        lastRestoreAt: restoreAt,
        restoreSourceHash: calculatedRestoreHash,
        restoreStatus: restoreWarnings.length > 0 ? 'RESTORED_WITH_WARNINGS' : 'RESTORED',
        integrityWarnings: restoreWarnings,
      }))
      setHoldings(nextHoldings)
      appendAuditEntries(auditEntries)
      if (Array.isArray(parsed.auditLog)) {
        setAuditLog((current) => [...auditEntries, ...sanitizeAuditLog(parsed.auditLog), ...current].slice(0, 20000))
      }
      if (parsed.usdJpy !== undefined && validateNumericValue('usdJpy', parsed.usdJpy, usdJpyRule) === null) {
        setUsdJpyInput(String(parsed.usdJpy))
      }
      if (parsed.fxUpdatedAt !== undefined && validateDateValue('USD/JPY更新日', parsed.fxUpdatedAt) === null) {
        setFxUpdatedAtInput(String(parsed.fxUpdatedAt))
      }
      if (Array.isArray(parsed.decisionHistory)) {
        setDecisionHistory(sanitizeDecisionHistory(parsed.decisionHistory))
      }
      if (parsed.operationalChecklist && typeof parsed.operationalChecklist === 'object') {
        setOperationalChecklist(sanitizeChecklist(parsed.operationalChecklist))
      }
      if (parsed.riskWeightConfig && typeof parsed.riskWeightConfig === 'object') {
        const restoredRiskConfig = sanitizeRiskWeightConfig(parsed.riskWeightConfig)
        setRiskWeightConfig(restoredRiskConfig)
        auditEntries.push(buildAuditEntry({ code: 'SYSTEM', name: 'リスク重み復元', fieldName: 'riskWeightConfig', previousValue: riskWeightConfig.riskScoreVersion || '', newValue: restoredRiskConfig.riskScoreVersion || '', changeSource: 'json_restore', decisionBefore: '', decisionAfter: '' }))
      }
      setImportMessage(`JSON取込完了: ${importedCount}件反映 / 未登録コード ${unknownCount}件 / 数値不正 ${invalidCount}件 / 履歴 ${Array.isArray(parsed.decisionHistory) ? parsed.decisionHistory.length : 0}件 / 復元ハッシュ ${calculatedRestoreHash}${restoreWarnings.length > 0 ? ` / 警告 ${restoreWarnings.length}件` : ''}`)
    } catch (error) {
      setImportMessage(`JSON取込失敗: ${error instanceof Error ? error.message : 'ファイルを読み込めませんでした'}`)
    }
  }

  const saveDecisionHistorySnapshot = () => {
    const decisionDate = new Date().toISOString()
    const runId = `run-${Date.now()}`
    const entries = enrichedStocks.map((stock) => ({
      runId,
      decisionDate,
      createdAt: decisionDate,
      code: stock.code,
      name: stock.name,
      market: stock.market,
      group: stock.group,
      currency: stock.currency,
      decision: stock.decisionResult?.decision || 'NO_DATA',
      severity: stock.decisionResult?.severity || 'HIGH',
      reasons: stock.decisionResult?.reasons || [],
      ruleVersion: DECISION_HISTORY_VERSION,
      ruleProfile: stock.ruleProfile || 'GENERAL',
      riskRegime: 'STATIC',
      inputSnapshot: { ...(holdings[stock.code] || {}) },
      portfolioSnapshot: {
        marketValueJPY: stock.marketValueJPY,
        costJPY: stock.costJPY,
        pnlJPY: stock.pnlJPY,
        annualDividendJPY: stock.annualDividendJPY,
        dividendYield: stock.dividendYield,
        currentPrice: stock.currentPrice,
        positionWeight: stock.positionWeight,
        sectorWeight: stock.sectorWeight,
        totalMarketValueJPY: portfolioSummary.totalMarketValueJPY,
        totalCostJPY: portfolioSummary.totalCostJPY,
      },
      evidenceSnapshot: {
        sourceName: stock.holding?.sourceName || '',
        sourceUrl: stock.holding?.sourceUrl || '',
        fiscalPeriod: stock.holding?.fiscalPeriod || '',
        dataType: stock.holding?.dataType || '',
        confirmedAt: stock.holding?.confirmedAt || '',
        sourcePage: stock.holding?.sourcePage || '',
        sourceQuote: stock.holding?.sourceQuote || '',
        selectedEvidenceValue: stock.holding?.selectedEvidenceValue || '',
        sourceMetricName: stock.holding?.sourceMetricName || '',
        sourceUnit: stock.holding?.sourceUnit || '',
      },
    }))
    setDecisionHistory((current) => [...entries, ...current].slice(0, 10000))
    setImportMessage(`判定履歴保存完了: ${entries.length}件 / ${decisionDate.slice(0, 19).replace('T', ' ')}`)
  }

  const exportDecisionHistoryCsv = () => {
    const header = ['runId', 'decisionDate', 'code', 'name', 'market', 'group', 'decision', 'severity', 'ruleVersion', 'ruleProfile', 'riskRegime', 'reasons', 'basePrice', 'actionTaken', 'actionType', 'actionDate', 'actionPrice', 'actionShares', 'actionAmount', 'actionReason', 'executionGapDays', 'executionPriceGap', 'complianceStatus', 'outcomeDate', 'outcomePrice', 'outcomeDividend', 'outcomeReturn', 'outcomeTotalReturn', 'decisionAccuracy', 'marketValueJPY', 'positionWeight', 'sectorWeight']
    const rows = decisionHistory.map((item) => [
      item.runId,
      item.decisionDate,
      item.code,
      item.name,
      item.market,
      item.group,
      item.decision,
      item.severity,
      item.ruleVersion,
      item.ruleProfile,
      item.riskRegime,
      safeArray(item.reasons).join(' / '),
      item.inputSnapshot?.currentPrice ?? item.portfolioSnapshot?.currentPrice ?? '',
      item.actionTaken ? 'true' : 'false',
      item.actionType ?? '',
      item.actionDate ?? '',
      item.actionPrice ?? '',
      item.actionShares ?? '',
      item.actionAmount ?? '',
      item.actionReason ?? '',
      item.executionGapDays ?? '',
      item.executionPriceGap ?? '',
      item.complianceStatus ?? '',
      item.outcomeDate ?? '',
      item.outcomePrice ?? '',
      item.outcomeDividend ?? '',
      item.outcomeReturn ?? '',
      item.outcomeTotalReturn ?? '',
      item.decisionAccuracy ?? '',
      item.portfolioSnapshot?.marketValueJPY ?? '',
      item.portfolioSnapshot?.positionWeight ?? '',
      item.portfolioSnapshot?.sectorWeight ?? '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('\"', '\"\"')}"`).join(','))
      .join('\n')
    downloadTextFile(`\uFEFF${csv}`, 'portfolio-decision-history.csv', 'text/csv;charset=utf-8;')
  }

  const updateDecisionHistoryOutcome = (runId, code, field, value) => {
    let auditEntry = null
    setDecisionHistory((current) => current.map((item) => {
      if (item.runId !== runId || item.code !== code) return item
      const previousValue = item[field] ?? ''
      const next = { ...item, [field]: value }
      const calculated = calculateHistoryOutcome(next)
      if (String(previousValue) !== String(value ?? '')) {
        auditEntry = buildAuditEntry({ code: item.code, name: item.name, fieldName: field, previousValue, newValue: value, changeSource: 'manual', decisionBefore: item.decision, decisionAfter: item.decision, ruleVersion: item.ruleVersion })
      }
      return {
        ...next,
        outcomeReturn: calculated.outcomeReturn,
        outcomeTotalReturn: calculated.outcomeTotalReturn,
        decisionAccuracy: calculated.decisionAccuracy,
      }
    }))
    if (auditEntry) appendAuditEntries(auditEntry)
  }

  const updateDecisionHistoryAction = (runId, code, field, value) => {
    let auditEntry = null
    setDecisionHistory((current) => current.map((item) => {
      if (item.runId !== runId || item.code !== code) return item
      const previousValue = item[field] ?? ''
      const normalizedValue = field === 'actionTaken' ? value === true || value === 'true' : value
      const next = { ...item, [field]: normalizedValue }
      const calculated = calculateHistoryAction(next)
      if (String(previousValue) !== String(normalizedValue ?? '')) {
        auditEntry = buildAuditEntry({ code: item.code, name: item.name, fieldName: field, previousValue, newValue: normalizedValue, changeSource: 'manual', decisionBefore: item.decision, decisionAfter: item.decision, ruleVersion: item.ruleVersion })
      }
      return {
        ...next,
        actionAmount: calculated.actionAmount,
        executionGapDays: calculated.executionGapDays,
        executionPriceGap: calculated.executionPriceGap,
        complianceStatus: calculated.complianceStatus,
      }
    }))
    if (auditEntry) appendAuditEntries(auditEntry)
  }

  const exportAuditLogCsv = () => {
    const header = ['changedAt', 'code', 'name', 'fieldName', 'previousValue', 'newValue', 'changeSource', 'decisionBefore', 'decisionAfter', 'impactLevel', 'ruleVersion']
    const rows = auditLog.map((item) => [item.changedAt, item.code, item.name, item.fieldName, item.previousValue, item.newValue, item.changeSource, item.decisionBefore, item.decisionAfter, item.impactLevel, item.ruleVersion])
    const csv = [header, ...rows].map((row) => row.map((cell) => `\"${String(cell ?? '').replaceAll('\"', '\"\"')}\"`).join(',')).join('\n')
    downloadTextFile(`\uFEFF${csv}`, 'portfolio-audit-log.csv', 'text/csv;charset=utf-8;')
  }


  const buildOperationalReportData = () => {
    const generatedAt = new Date().toISOString()
    const blockingDecisionKeys = ['INVALID_DATA', 'UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE', 'PROFILE_DATA_REQUIRED', 'RULE_CONFIG_REQUIRED', 'STALE_DATA', 'NO_DATA']
    const blockingTotal = blockingDecisionKeys.reduce((sum, key) => sum + (portfolioSummary.decisionCounts[key] || 0), 0)
    const actionRequiredKeys = ['SELL', 'REDUCE', ...blockingDecisionKeys]
    const actionRequiredStocks = enrichedStocks
      .filter((stock) => actionRequiredKeys.includes(stock.decisionResult?.decision))
      .map((stock) => ({
        code: stock.code,
        name: stock.name,
        market: stock.market,
        group: stock.group,
        ruleProfile: stock.ruleProfile,
        decision: stock.decisionResult?.decision || 'NO_DATA',
        severity: stock.decisionResult?.severity || 'HIGH',
        reasons: safeArray(stock.decisionResult?.reasons).slice(0, 5),
        marketValueJPY: stock.marketValueJPY,
        positionWeight: stock.positionWeight,
        sectorWeight: stock.sectorWeight,
      }))
      .slice(0, 50)

    return {
      generatedAt,
      appSchemaVersion: APP_SCHEMA_VERSION,
      ruleVersion: DECISION_HISTORY_VERSION,
      summary: {
        displayedStocks: totalCount,
        registeredStocks: stocks.length,
        actualHoldingCount: ACTUAL_HOLDING_COUNT,
        implementationGap: missingCount,
        positionedCount: portfolioSummary.positionedCount,
        valuedCount: portfolioSummary.valuedCount,
        totalMarketValueJPY: portfolioSummary.totalMarketValueJPY,
        totalCostJPY: portfolioSummary.totalCostJPY,
        totalPnlJPY: portfolioSummary.totalPnlJPY,
        unrealizedPnlRate: portfolioSummary.unrealizedPnlRate,
        totalAnnualDividendJPY: portfolioSummary.totalAnnualDividendJPY,
        portfolioDividendYield: portfolioSummary.portfolioDividendYield,
      },
      decisions: {
        counts: portfolioSummary.decisionCounts,
        blockingTotal,
        actionRequiredTotal: actionRequiredStocks.length,
      },
      compliance: {
        complianceRate: actionStats.complianceRate,
        notExecuted: actionStats.notExecuted,
        contradicted: actionStats.contradicted,
        nonCompliant: actionStats.nonCompliant,
        averageExecutionGapDays: actionStats.averageExecutionGapDays,
        averageExecutionPriceGap: actionStats.averageExecutionPriceGap,
      },
      outcomes: {
        evaluated: outcomeStats.evaluated,
        pending: outcomeStats.pending,
        success: outcomeStats.success,
        failure: outcomeStats.failure,
        missedOpportunity: outcomeStats.missedOpportunity,
        successRate: outcomeStats.successRate,
        failureRate: outcomeStats.failureRate,
      },
      riskWeightConfig: {
        riskScoreVersion: riskWeightConfig.riskScoreVersion,
        riskWeightRegime: riskWeightConfig.riskWeightRegime,
        riskWeightReviewedAt: riskWeightConfig.riskWeightReviewedAt,
        riskWeightChangeReason: riskWeightConfig.riskWeightChangeReason,
        riskWeightConfigErrors,
      },
      integrity: {
        dataCompletenessScore: integritySummary.dataCompletenessScore,
        missingCriticalFieldCount: integritySummary.missingCriticalFieldCount,
        integrityWarnings: [...(integrityMeta.integrityWarnings || []), ...integritySummary.integrityWarnings],
        backupIntegrityHash: integrityMeta.backupIntegrityHash || '',
        lastBackupAt: integrityMeta.lastBackupAt || '',
        restoreSourceHash: integrityMeta.restoreSourceHash || '',
        lastRestoreAt: integrityMeta.lastRestoreAt || '',
        decisionHistoryCount: integritySummary.decisionHistoryCount,
        auditLogCount: integritySummary.auditLogCount,
      },
      audit: {
        total: auditStats.total,
        last24h: auditStats.last24h,
        highImpact: auditStats.high,
        decisionChanged: auditStats.decisionChanged,
        csvImport: auditStats.csvImport,
        jsonRestore: auditStats.jsonRestore,
      },
      operationalChecklist: {
        schemaVersion: CHECKLIST_SCHEMA_VERSION,
        stats: checklistStats,
        overdueItems: checklistEntries.filter((item) => item.status === 'OVERDUE').map((item) => ({ id: item.id, cadence: item.cadence, label: item.label, impact: item.impact, statusLabel: item.label, ageDays: item.ageDays })),
        entries: checklistEntries,
      },
      allocation: {
        byMarket: portfolioSummary.byMarket,
        byCurrency: portfolioSummary.byCurrency,
        byGroup: portfolioSummary.byGroup?.slice(0, 10),
        byRuleProfile: portfolioSummary.byRuleProfile,
        topPositions: portfolioSummary.topPositions?.slice(0, 10).map((stock) => ({
          code: stock.code,
          name: stock.name,
          group: stock.group,
          marketValueJPY: stock.marketValueJPY,
          positionWeight: stock.positionWeight,
          pnlJPY: stock.pnlJPY,
        })),
      },
      actionRequiredStocks,
      latestHistoryRun: latestHistoryRun ? {
        decisionDate: latestHistoryRun.decisionDate,
        total: latestHistoryRun.total,
        ruleVersion: latestHistoryRun.ruleVersion,
        counts: latestHistoryRun.counts,
      } : null,
    }
  }

  const buildOperationalReportMarkdown = () => {
    const report = buildOperationalReportData()
    const yen = (value) => Number.isFinite(Number(value)) ? `${formatNumber(Number(value), 0)}円` : '未算出'
    const pct = (value) => Number.isFinite(Number(value)) ? formatPercent(Number(value)) : '未算出'
    const decisionLines = Object.entries(report.decisions.counts || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([key, count]) => `- ${key}: ${count}`)
      .join('\n') || '- 該当なし'
    const topPositionLines = (report.allocation.topPositions || [])
      .map((item, index) => `${index + 1}. ${item.code} ${item.name}: ${yen(item.marketValueJPY)} / 比率 ${pct(item.positionWeight)} / 損益 ${yen(item.pnlJPY)}`)
      .join('\n') || '該当なし'
    const actionRequiredLines = (report.actionRequiredStocks || [])
      .slice(0, 20)
      .map((item) => `- ${item.code} ${item.name}: ${item.decision} / ${item.severity} / ${item.reasons.join('、') || '理由なし'}`)
      .join('\n') || '- 該当なし'
    const warnings = (report.integrity.integrityWarnings || [])
      .slice(0, 20)
      .map((item) => `- ${item}`)
      .join('\n') || '- なし'

    return `# Portfolio Dashboard 運用レポート\n\n` +
      `- 生成日時: ${report.generatedAt}\n` +
      `- Schema: ${report.appSchemaVersion}\n` +
      `- Rule Version: ${report.ruleVersion}\n\n` +
      `## 1. 資産サマリー\n\n` +
      `- 評価額: ${yen(report.summary.totalMarketValueJPY)}\n` +
      `- 取得額: ${yen(report.summary.totalCostJPY)}\n` +
      `- 含み損益: ${yen(report.summary.totalPnlJPY)} / ${pct(report.summary.unrealizedPnlRate)}\n` +
      `- 年間配当見込: ${yen(report.summary.totalAnnualDividendJPY)}\n` +
      `- ポートフォリオ配当利回り: ${pct(report.summary.portfolioDividendYield)}\n` +
      `- 保有入力済み銘柄: ${report.summary.positionedCount}\n` +
      `- 評価可能銘柄: ${report.summary.valuedCount}\n\n` +
      `## 2. 判定サマリー\n\n` +
      `${decisionLines}\n\n` +
      `- 判定停止系合計: ${report.decisions.blockingTotal}\n` +
      `- 要対応銘柄数: ${report.decisions.actionRequiredTotal}\n\n` +
      `## 3. 実行遵守・成績\n\n` +
      `- 判定遵守率: ${pct(report.compliance.complianceRate)}\n` +
      `- 未実行: ${report.compliance.notExecuted}\n` +
      `- 逆行実行: ${report.compliance.contradicted}\n` +
      `- 非遵守: ${report.compliance.nonCompliant}\n` +
      `- 平均実行遅延: ${formatNumber(report.compliance.averageExecutionGapDays, 1)}日\n` +
      `- 平均実行価格乖離: ${pct(report.compliance.averageExecutionPriceGap)}\n` +
      `- 評価済み履歴: ${report.outcomes.evaluated}\n` +
      `- 未評価履歴: ${report.outcomes.pending}\n` +
      `- SUCCESS率: ${pct(report.outcomes.successRate)}\n` +
      `- FAILURE率: ${pct(report.outcomes.failureRate)}\n` +
      `- 機会損失: ${report.outcomes.missedOpportunity}\n\n` +
      `## 4. データ完全性・監査\n\n` +
      `- 完全性スコア: ${report.integrity.dataCompletenessScore}/100\n` +
      `- 欠損クリティカル: ${report.integrity.missingCriticalFieldCount}\n` +
      `- 判定履歴件数: ${report.integrity.decisionHistoryCount}\n` +
      `- 監査ログ件数: ${report.integrity.auditLogCount}\n` +
      `- 直近24時間変更: ${report.audit.last24h}\n` +
      `- HIGH影響変更: ${report.audit.highImpact}\n` +
      `- 判定変化変更: ${report.audit.decisionChanged}\n` +
      `- 最終JSON保存: ${report.integrity.lastBackupAt || '未保存'}\n` +
      `- 保存Hash: ${report.integrity.backupIntegrityHash || 'なし'}\n` +
      `- 最終JSON復元: ${report.integrity.lastRestoreAt || '未復元'}\n` +
      `- 復元Hash: ${report.integrity.restoreSourceHash || 'なし'}\n\n` +
      `## 5. 整合警告\n\n${warnings}\n\n` +
      `## 6. 上位保有銘柄\n\n${topPositionLines}\n\n` +
      `## 7. 要対応銘柄 上位20件\n\n${actionRequiredLines}\n\n` +
      `## 8. 運用チェックリスト\n\n` +
      `- 完了率: ${pct(report.operationalChecklist.stats.completionRate)}\n` +
      `- 期限切れ: ${report.operationalChecklist.stats.overdue}\n` +
      `- HIGH期限切れ: ${report.operationalChecklist.stats.highOverdue}\n` +
      `${(report.operationalChecklist.overdueItems || []).slice(0, 20).map((item) => `- ${cadenceLabels[item.cadence] || item.cadence}: ${item.label} / ${item.impact}`).join('\n') || '- 期限切れなし'}\n\n` +
      `## 9. 運用上の制約\n\n` +
      `- 株価・配当・財務・実行・結果データは手動入力。\n` +
      `- 静的GitHub Pages構成のため、ユーザー認証とサーバー保存は未対応。\n` +
      `- 根拠URL本文と引用文の自動照合は未対応。\n` +
      `- レポートは出力時点のlocalStorageデータに依存。\n`
  }

  const exportOperationalReportMarkdown = () => {
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(buildOperationalReportMarkdown(), `portfolio-operation-report-${date}.md`, 'text/markdown;charset=utf-8;')
  }

  const exportOperationalReportJson = () => {
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(JSON.stringify(buildOperationalReportData(), null, 2), `portfolio-operation-report-${date}.json`, 'application/json;charset=utf-8;')
  }

  const completeChecklistItem = (id) => {
    const definition = operationalChecklistDefinitions.find((item) => item.id === id)
    const now = new Date().toISOString()
    setOperationalChecklist((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        completedAt: now,
      },
    }))
    appendAuditEntries(buildAuditEntry({
      code: 'SYSTEM',
      name: '運用チェックリスト',
      fieldName: `checklist.${id}`,
      previousValue: operationalChecklist[id]?.completedAt || '',
      newValue: now,
      changeSource: 'manual',
      decisionBefore: definition?.label || '',
      decisionAfter: 'DONE',
    }))
  }

  const resetChecklistItem = (id) => {
    const definition = operationalChecklistDefinitions.find((item) => item.id === id)
    setOperationalChecklist((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        completedAt: '',
      },
    }))
    appendAuditEntries(buildAuditEntry({
      code: 'SYSTEM',
      name: '運用チェックリスト',
      fieldName: `checklist.${id}`,
      previousValue: operationalChecklist[id]?.completedAt || '',
      newValue: '',
      changeSource: 'manual',
      decisionBefore: definition?.label || '',
      decisionAfter: 'RESET',
    }))
  }

  const exportChecklistCsv = () => {
    const header = ['id', 'cadence', 'label', 'impact', 'status', 'lastCompletedAt', 'ageDays', 'description']
    const rows = checklistEntries.map((item) => [item.id, item.cadence, item.label, item.impact, item.status, item.completedAt || '', item.ageDays ?? '', item.description])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`\uFEFF${csv}`, 'portfolio-operational-checklist.csv', 'text/csv;charset=utf-8;')
  }



  const startGuidedWorkflow = (workflowId) => {
    const definition = guidedWorkflowDefinitions.find((item) => item.id === workflowId)
    if (!definition) return
    const now = new Date().toISOString()
    setGuidedWorkflow((current) => ({
      ...current,
      version: GUIDED_WORKFLOW_VERSION,
      activeWorkflowId: workflowId,
      startedAt: now,
    }))
    appendAuditEntries(buildAuditEntry({
      code: 'SYSTEM',
      name: 'ガイドワークフロー',
      fieldName: 'guidedWorkflow.activeWorkflowId',
      previousValue: guidedWorkflow.activeWorkflowId || '',
      newValue: workflowId,
      changeSource: 'manual',
      decisionBefore: 'WORKFLOW_SELECT',
      decisionAfter: definition.label,
    }))
    setImportMessage(`${definition.label}を開始しました。上から順に処理してください。`)
  }

  const completeGuidedStep = (workflowId, stepId) => {
    const workflow = guidedWorkflowDefinitions.find((item) => item.id === workflowId)
    const step = workflow?.steps.find((item) => item.id === stepId)
    if (!workflow || !step) return
    const now = new Date().toISOString()
    const key = getGuidedStepKey(workflowId, stepId)
    setGuidedWorkflow((current) => ({
      ...current,
      version: GUIDED_WORKFLOW_VERSION,
      activeWorkflowId: workflowId,
      completedSteps: {
        ...(current.completedSteps || {}),
        [key]: now,
      },
      lastCompletedAt: now,
    }))
    if (step.checklistId) {
      setOperationalChecklist((current) => ({
        ...current,
        [step.checklistId]: {
          ...(current[step.checklistId] || {}),
          completedAt: now,
        },
      }))
    }
    appendAuditEntries(buildAuditEntry({
      code: 'SYSTEM',
      name: 'ガイドワークフロー',
      fieldName: `guidedWorkflow.${workflowId}.${stepId}`,
      previousValue: guidedWorkflow.completedSteps?.[key] || '',
      newValue: now,
      changeSource: 'manual',
      decisionBefore: workflow.label,
      decisionAfter: `DONE: ${step.label}`,
    }))
    setImportMessage(`${workflow.label}: ${step.label}を完了にしました。`)
  }

  const resetGuidedWorkflowProgress = () => {
    if (!confirmDangerousAction('ガイドワークフロー進捗リセット', 'RESET')) return
    const previous = JSON.stringify(guidedWorkflow.completedSteps || {})
    setGuidedWorkflow((current) => ({ ...current, completedSteps: {}, lastCompletedAt: '' }))
    appendAuditEntries(buildAuditEntry({
      code: 'SYSTEM',
      name: 'ガイドワークフロー',
      fieldName: 'guidedWorkflow.completedSteps',
      previousValue: previous,
      newValue: '',
      changeSource: 'manual',
      decisionBefore: 'RESET_REQUESTED',
      decisionAfter: 'RESET_DONE',
    }))
    setImportMessage('ガイドワークフロー進捗をリセットしました。')
  }

  const exportGuidedWorkflowCsv = () => {
    const header = ['workflowId', 'workflowLabel', 'cadence', 'stepId', 'stepOrder', 'stepLabel', 'description', 'output', 'checklistId', 'completedAt', 'checklistStatus']
    const rows = guidedWorkflowDefinitions.flatMap((workflow) => workflow.steps.map((step, index) => {
      const key = getGuidedStepKey(workflow.id, step.id)
      const checklist = checklistEntries.find((item) => item.id === step.checklistId)
      return [workflow.id, workflow.label, workflow.cadence, step.id, index + 1, step.label, step.description, step.output, step.checklistId, guidedWorkflow.completedSteps?.[key] || '', checklist?.status || '']
    }))
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-guided-workflows.csv', 'text/csv;charset=utf-8;')
  }



  const exportRiskWeightConfigCsv = () => {
    const header = ['type', 'key', 'label', 'value', 'min', 'max', 'riskScoreVersion', 'riskWeightRegime', 'riskWeightReviewedAt', 'riskWeightChangeReason']
    const rows = [
      ...riskWeightDefinitions.map((definition) => ['weight', definition.key, definition.label, riskWeightConfig.weights?.[definition.key] ?? '', definition.min, definition.max, riskWeightConfig.riskScoreVersion, riskWeightConfig.riskWeightRegime, riskWeightConfig.riskWeightReviewedAt, riskWeightConfig.riskWeightChangeReason]),
      ...riskLevelDefinitions.map((definition) => ['level', definition.key, definition.label, riskWeightConfig.levels?.[definition.key] ?? '', definition.min, definition.max, riskWeightConfig.riskScoreVersion, riskWeightConfig.riskWeightRegime, riskWeightConfig.riskWeightReviewedAt, riskWeightConfig.riskWeightChangeReason]),
    ]
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-risk-weight-config.csv', 'text/csv;charset=utf-8;')
  }

  const exportRiskPriorityCsv = () => {
    const header = ['rank', 'code', 'name', 'market', 'group', 'decision', 'severity', 'riskPriorityLevel', 'riskPriorityScore', 'positionWeight', 'sectorWeight', 'unrealizedGainRate', 'topRiskDrivers']
    const rows = riskPriorityList.map((stock) => [
      stock.riskPriorityRank,
      stock.code,
      stock.name,
      stock.market,
      stock.group,
      stock.decisionResult?.decision || '',
      stock.decisionResult?.severity || '',
      stock.riskPriorityLevel,
      stock.riskPriorityScore,
      stock.positionWeight || 0,
      stock.sectorWeight || 0,
      stock.unrealizedGainRate ?? '',
      (stock.riskDrivers || []).slice(0, 5).map((driver) => `${driver.label}(${driver.points})`).join(' / '),
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-risk-priority.csv', 'text/csv;charset=utf-8;')
  }

  const exportRiskWeightDiagnosticsCsv = () => {
    const header = ['key', 'label', 'currentWeight', 'suggestedWeight', 'recommendation', 'activeCount', 'evaluatedCount', 'success', 'failure', 'missedOpportunity', 'neutral', 'successRate', 'failureRate', 'avgTotalReturn', 'reason', 'affectedCodes']
    const rows = riskWeightDiagnostics.map((item) => [
      item.key,
      item.label,
      item.currentWeight,
      item.suggestedWeight,
      item.recommendation,
      item.activeCount,
      item.evaluatedCount,
      item.success,
      item.failure,
      item.missedOpportunity,
      item.neutral,
      item.successRate.toFixed(2),
      item.failureRate.toFixed(2),
      item.avgReturn === null ? '' : item.avgReturn.toFixed(2),
      item.reason,
      item.affectedCodes.join(' / '),
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-risk-weight-diagnostics.csv', 'text/csv;charset=utf-8;')
  }

  const exportCoverageDiagnosticsCsv = () => {
    const header = ['type', 'code', 'name', 'market', 'group', 'ruleProfile', 'decision', 'coverageScore', 'missingCount', 'fieldName', 'fieldLabel', 'impact']
    const stockRows = coverageDiagnostics.stockRows.map((item) => ['stock', item.code, item.name, item.market, item.group, item.ruleProfile, item.decision, item.coverageScore, item.missingCount, item.missingFields.map(getCoverageFieldLabel).join(' / '), '', item.impact])
    const blockerRows = coverageDiagnostics.blockers.map((item) => ['blocker', item.code, item.name, '', '', '', item.decision, item.coverageScore, '', item.fieldName, item.fieldLabel, item.impact])
    const sectionRows = coverageDiagnostics.sectionTotals.map((item) => ['section', '', item.label, '', '', '', '', item.rate.toFixed(2), item.missing, item.key, `${item.filled}/${item.total}`, item.rate < 80 ? 'HIGH' : 'LOW'])
    const csv = [header, ...sectionRows, ...stockRows, ...blockerRows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-coverage-diagnostics.csv', 'text/csv;charset=utf-8;')
  }


  const exportMissingDataTemplateCsv = () => {
    const header = ['code', 'name', 'market', 'group', 'ruleProfile', 'missingField', 'missingFieldLabel', 'requiredReason', 'inputHint', 'sourceRequired', 'currentDecision', 'riskPriorityScore', 'coverageScore', 'impact', 'priority']
    const rows = [...coverageDiagnostics.blockers]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map((item) => {
        const stock = enrichedStocks.find((target) => target.code === item.code)
        const hint = getMissingDataTemplateHint(item.fieldName)
        return [item.code, item.name, stock?.market || '', stock?.group || '', stock?.ruleProfile || '', item.fieldName, item.fieldLabel, hint.reason, hint.hint, hint.sourceRequired, item.decision, stock?.riskPriorityScore || 0, item.coverageScore, item.impact, Math.round(item.priority || 0)]
      })
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-missing-data-template.csv', 'text/csv;charset=utf-8;')
  }


  const bulkInputSuggestions = useMemo(() => {
    return [...coverageDiagnostics.blockers]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map((item) => {
        const stock = enrichedStocks.find((target) => target.code === item.code)
        const hint = getMissingDataTemplateHint(item.fieldName)
        const requiresEvidence = ['payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'annualDividend', 'dividendCut', 'sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit'].includes(item.fieldName)
        const priority = Math.round(item.priority || 0)
        const placeholder = item.fieldName.endsWith('UpdatedAt') || item.fieldName === 'confirmedAt'
          ? 'YYYY-MM-DD'
          : item.fieldName === 'dividendCut'
            ? 'true/false'
            : item.fieldName === 'dataType'
              ? 'actual'
              : item.fieldName === 'ruleProfile'
                ? (stock?.ruleProfile || 'GENERAL')
                : '入力値'
        return {
          code: item.code,
          name: item.name,
          market: stock?.market || '',
          group: stock?.group || '',
          ruleProfile: stock?.ruleProfile || '',
          missingField: item.fieldName,
          missingFieldLabel: item.fieldLabel,
          suggestedField: item.fieldName,
          suggestedReason: hint.reason,
          requiredEvidence: requiresEvidence ? hint.sourceRequired : '任意または内部データ',
          inputHint: hint.hint,
          pasteTemplate: `${item.code}	${item.fieldName}	${placeholder}`,
          currentDecision: item.decision,
          riskPriorityScore: stock?.riskPriorityScore || 0,
          coverageScore: item.coverageScore,
          impact: item.impact,
          priority,
        }
      })

  }, [coverageDiagnostics.blockers, enrichedStocks])

  const unresolvedRiskPlan = useMemo(() => {
    const blockingDecisions = ['INVALID_DATA', 'UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE', 'PROFILE_DATA_REQUIRED', 'RULE_CONFIG_REQUIRED', 'STALE_DATA', 'NO_DATA']
    const daysSince = (dateText) => {
      if (!dateText) return null
      const parsed = new Date(dateText)
      if (Number.isNaN(parsed.getTime())) return null
      return Math.floor((Date.now() - parsed.getTime()) / 86400000)
    }
    const latestBackupAge = daysSince(integrityMeta.lastBackupAt)
    const stopDecisionCount = blockingDecisions.reduce((sum, key) => sum + (portfolioSummary.decisionCounts?.[key] || 0), 0)
    const evidenceIssueCount = (portfolioSummary.decisionCounts?.UNVERIFIED_DATA || 0) + (portfolioSummary.decisionCounts?.WEAK_EVIDENCE || 0) + (portfolioSummary.decisionCounts?.MULTIPLE_EVIDENCE_VALUES || 0) + (portfolioSummary.decisionCounts?.MISMATCHED_EVIDENCE || 0)
    const staleIssueCount = (portfolioSummary.decisionCounts?.STALE_DATA || 0) + (portfolioSummary.priceStaleStocks?.length || 0) + (portfolioSummary.financialStaleStocks?.length || 0) + (portfolioSummary.fxStaleStocks?.length || 0)
    const notExecutedCount = decisionHistory.filter((item) => ['SELL', 'REDUCE', 'BUY'].includes(item.decision) && (!item.actionTaken || item.complianceStatus === 'NOT_EXECUTED')).length
    const contradictedCount = decisionHistory.filter((item) => ['CONTRADICTED', 'NON_COMPLIANT'].includes(item.complianceStatus)).length
    const outcomeMissingCount = decisionHistory.filter((item) => ['BUY', 'SELL', 'REDUCE', 'HOLD', 'WATCH'].includes(item.decision) && !item.decisionAccuracy).length
    const needDataCount = riskWeightDiagnostics.filter((item) => item.recommendation === 'NEED_DATA').length

    const metrics = {
      AUTO_DATA_FETCH: {
        score: Math.min(150, staleIssueCount * 8 + (coverageDiagnostics.missingFields || 0) * 0.4 + (coverageDiagnostics.coverageScore < 80 ? 30 : 0)),
        count: staleIssueCount,
        evidence: `期限切れ/未更新 ${staleIssueCount}件、カバレッジ ${Math.round(coverageDiagnostics.coverageScore || 0)}%`,
        action: bulkInputSuggestions.length > 0 ? '入力候補CSV/貼付用TSVを出力し、期限切れ・不足データから更新。' : '期限切れ件数を確認し、日次/四半期ワークフローで更新。',
      },
      SOURCE_BODY_VERIFICATION: {
        score: Math.min(150, evidenceIssueCount * 10 + (portfolioSummary.evidenceNotApplicableStocks?.length || 0) * 2),
        count: evidenceIssueCount,
        evidence: `証跡系停止 ${evidenceIssueCount}件、照合対象外 ${portfolioSummary.evidenceNotApplicableStocks?.length || 0}件`,
        action: 'UNVERIFIED/WEAK/MULTIPLE/MISMATCHを優先してURL・ページ・引用・採用値を修正。',
      },
      LOCAL_STORAGE_DEPENDENCY: {
        score: Math.min(150, (latestBackupAge === null ? 60 : latestBackupAge > 7 ? 50 : latestBackupAge > 3 ? 25 : 5) + (integritySummary.dataCompletenessScore < 80 ? 35 : 0) + (integritySummary.missingCriticalFieldCount || 0) * 1.5),
        count: integritySummary.missingCriticalFieldCount || 0,
        evidence: `完全性 ${integritySummary.dataCompletenessScore}/100、最終バックアップ ${latestBackupAge === null ? 'なし' : `${latestBackupAge}日前`}`,
        action: 'JSON保存を実行し、backupIntegrityHashとlastBackupAtを更新。復元後は完全性スコア確認。',
      },
      AUTHORIZATION: {
        score: Math.min(120, (isReadOnlyMode ? 15 : 45) + (auditLog.filter((item) => item.impactLevel === 'HIGH').length > 0 ? 15 : 0)),
        count: auditLog.filter((item) => item.impactLevel === 'HIGH').length,
        evidence: `現在 ${isReadOnlyMode ? '閲覧モード' : '編集モード'}、HIGH監査ログ ${auditLog.filter((item) => item.impactLevel === 'HIGH').length}件`,
        action: '作業後は閲覧モードへ戻す。HIGH影響変更は監査ログCSVで確認。',
      },
      BROKER_ACCOUNT_INTEGRATION: {
        score: Math.min(150, notExecutedCount * 8 + contradictedCount * 20),
        count: notExecutedCount + contradictedCount,
        evidence: `未実行 ${notExecutedCount}件、逆行/非遵守 ${contradictedCount}件`,
        action: 'SELL/REDUCE/BUYの未実行理由、実行日、実行価格、株数をactionTrackingへ入力。',
      },
      OUTCOME_DATA_COVERAGE: {
        score: Math.min(150, outcomeMissingCount * 4 + needDataCount * 12 + (coverageDiagnostics.outcomeCoverageRate < 70 ? 30 : 0)),
        count: outcomeMissingCount + needDataCount,
        evidence: `outcome未評価 ${outcomeMissingCount}件、重み診断NEED_DATA ${needDataCount}件、評価率 ${Math.round(coverageDiagnostics.outcomeCoverageRate || 0)}%`,
        action: '判定履歴の結果価格・配当・結果確認日を入力し、重み診断のNEED_DATAを減らす。',
      },
    }

    const rows = unresolvedRiskDefinitions.map((definition) => {
      const metric = metrics[definition.key] || { score: 0, count: 0, evidence: '', action: definition.nextAction }
      const score = Math.round(metric.score || 0)
      const priorityLevel = score >= 100 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW'
      return { ...definition, ...metric, score, priorityLevel }
    }).sort((a, b) => b.score - a.score || b.count - a.count)

    const stats = {
      total: rows.length,
      critical: rows.filter((item) => item.priorityLevel === 'CRITICAL').length,
      high: rows.filter((item) => item.priorityLevel === 'HIGH').length,
      unresolvedScore: rows.reduce((sum, item) => sum + item.score, 0),
      top: rows[0],
      staticBlocked: rows.filter((item) => item.staticLimit.includes('不可') || item.staticLimit.includes('困難')).length,
    }
    return { rows, stats }
  }, [portfolioSummary, coverageDiagnostics, integrityMeta, integritySummary, decisionHistory, riskWeightDiagnostics, auditLog, isReadOnlyMode, bulkInputSuggestions])

  const exportUnresolvedRiskPlanCsv = () => {
    const header = ['rank', 'key', 'label', 'category', 'priorityLevel', 'score', 'count', 'evidence', 'staticLimit', 'mitigation', 'nextAction']
    const rows = unresolvedRiskPlan.rows.map((item, index) => [index + 1, item.key, item.label, item.category, item.priorityLevel, item.score, item.count, item.evidence, item.staticLimit, item.mitigation, item.action || item.nextAction])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-unresolved-risk-priority.csv', 'text/csv;charset=utf-8;')
  }

  const exportBulkInputSuggestionsCsv = () => {
    const header = ['code', 'name', 'market', 'group', 'ruleProfile', 'suggestedField', 'suggestedFieldLabel', 'suggestedReason', 'requiredEvidence', 'inputHint', 'pasteTemplate', 'currentDecision', 'riskPriorityScore', 'coverageScore', 'impact', 'priority']
    const rows = bulkInputSuggestions.map((item) => [item.code, item.name, item.market, item.group, item.ruleProfile, item.suggestedField, item.missingFieldLabel, item.suggestedReason, item.requiredEvidence, item.inputHint, item.pasteTemplate, item.currentDecision, item.riskPriorityScore, item.coverageScore, item.impact, item.priority])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, 'portfolio-bulk-input-suggestions.csv', 'text/csv;charset=utf-8;')
  }

  const exportBulkPasteTemplateTsv = () => {
    const header = ['code', 'missingField', 'importedValue']
    const rows = bulkInputSuggestions.map((item) => [item.code, item.suggestedField, ''])
    const tsv = [header, ...rows].map((row) => row.map((cell) => String(cell ?? '').replaceAll('	', ' ').replaceAll('\n', ' ')).join('	')).join('\n')
    downloadTextFile(tsv, 'portfolio-bulk-paste-template.tsv', 'text/tab-separated-values;charset=utf-8;')
  }



  const buildDataUpdatePackRows = (packType) => {
    const today = new Date().toISOString().slice(0, 10)
    const blockingDecisions = ['INVALID_DATA', 'UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE', 'PROFILE_DATA_REQUIRED', 'RULE_CONFIG_REQUIRED', 'STALE_DATA', 'NO_DATA']
    const makeRow = ({ pack, cadence, code, name, market, group, ruleProfile, fieldName, currentValue = '', decision = '', riskPriorityScore = 0, riskPriorityRank = '', riskPriorityLevel = '', coverageScore = '', dueReason = '', requiredReason = '', inputHint = '', sourceRequired = '', workflowStep = '', importedValue = '' }) => {
      const hint = getMissingDataTemplateHint(fieldName)
      return {
        pack,
        cadence,
        code,
        name,
        market,
        group,
        ruleProfile,
        missingField: fieldName,
        missingFieldLabel: getCoverageFieldLabel(fieldName),
        currentValue,
        importedValue,
        requiredReason: requiredReason || hint.reason,
        inputHint: inputHint || hint.hint,
        sourceRequired: sourceRequired || hint.sourceRequired,
        currentDecision: decision,
        riskPriorityScore,
        riskPriorityRank,
        riskPriorityLevel,
        coverageScore,
        dueReason,
        workflowStep,
        generatedAt: today,
      }
    }
    const rows = []
    const addStockField = (stock, fieldName, pack, cadence, dueReason, workflowStep, extra = {}) => rows.push(makeRow({
      pack,
      cadence,
      code: stock.code,
      name: stock.name,
      market: stock.market,
      group: stock.group,
      ruleProfile: stock.ruleProfile,
      fieldName,
      currentValue: holdings[stock.code]?.[fieldName] ?? '',
      decision: stock.decisionResult?.decision || '',
      riskPriorityScore: stock.riskPriorityScore || 0,
      riskPriorityRank: stock.riskPriorityRank || '',
      riskPriorityLevel: stock.riskPriorityLevel || '',
      coverageScore: stock.coverageScore ?? '',
      dueReason,
      workflowStep,
      ...extra,
    }))

    const riskyStocks = [...riskPriorityList]
      .filter((stock) => stock.riskPriorityLevel !== 'LOW' || blockingDecisions.includes(stock.decisionResult?.decision))
      .slice(0, 80)

    if (packType === 'daily' || packType === 'all') {
      for (const stock of riskyStocks) {
        const decision = stock.decisionResult?.decision || ''
        const reasons = []
        if (stock.isPriceStale || decision === 'STALE_DATA') reasons.push('価格期限切れ')
        if (['SELL', 'REDUCE'].includes(decision)) reasons.push(`${decision}判定`)
        if (blockingDecisions.includes(decision)) reasons.push(`停止判定:${decision}`)
        if ((stock.riskPriorityScore || 0) >= getRiskLevelThreshold(riskWeightConfig, 'high')) reasons.push('リスク優先度HIGH以上')
        const reason = reasons.join(' / ') || '日次価格確認対象'
        addStockField(stock, 'currentPrice', 'daily-update-pack', 'daily', reason, '価格・為替更新')
        addStockField(stock, 'priceUpdatedAt', 'daily-update-pack', 'daily', reason, '価格・為替更新', { importedValue: today })
      }
      const usdStocks = enrichedStocks.filter((stock) => stock.currency === 'USD')
      if (usdStocks.length > 0) {
        rows.push(makeRow({
          pack: 'daily-update-pack',
          cadence: 'daily',
          code: 'FX',
          name: 'USD/JPY',
          market: 'GLOBAL',
          group: 'FX',
          ruleProfile: 'GLOBAL',
          fieldName: 'fxUpdatedAt',
          currentValue: fxUpdatedAtInput,
          importedValue: today,
          decision: portfolioSummary.decisionCounts?.STALE_DATA ? 'STALE_DATA' : '',
          dueReason: '米国株の円換算・評価額・比率計算に必要',
          workflowStep: '価格・為替更新',
          requiredReason: '米国株円換算の鮮度判定に必要',
          inputHint: 'YYYY-MM-DD。USD/JPYを更新した日付。',
          sourceRequired: '為替確認日',
        }))
      }
    }

    if (packType === 'weekly' || packType === 'all') {
      const evidenceFields = ['sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit']
      const evidenceStocks = enrichedStocks.filter((stock) => ['UNVERIFIED_DATA', 'WEAK_EVIDENCE', 'MULTIPLE_EVIDENCE_VALUES', 'MISMATCHED_EVIDENCE'].includes(stock.decisionResult?.decision) || (stock.evidenceResult?.status && stock.evidenceResult.status !== 'MATCH'))
      for (const stock of evidenceStocks.slice(0, 100)) {
        for (const field of evidenceFields) {
          if (!holdings[stock.code]?.[field] || ['sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit'].includes(field)) {
            addStockField(stock, field, 'weekly-evidence-pack', 'weekly', `証跡系停止または照合未完了: ${stock.decisionResult?.decision || ''}`, '証跡・監査ログ確認')
          }
        }
      }
      const actionTargets = decisionHistory.filter((item) => ['SELL', 'REDUCE', 'BUY'].includes(item.decision) && (!item.actionTaken || item.complianceStatus === 'NOT_EXECUTED')).slice(0, 100)
      for (const item of actionTargets) {
        const stock = enrichedStocks.find((target) => target.code === item.code) || item
        ;['actionTaken', 'actionType', 'actionDate', 'actionPrice', 'actionShares', 'actionReason'].forEach((field) => rows.push(makeRow({
          pack: 'weekly-evidence-pack',
          cadence: 'weekly',
          code: item.code,
          name: item.name,
          market: stock.market || '',
          group: stock.group || '',
          ruleProfile: stock.ruleProfile || item.ruleProfile || '',
          fieldName: field,
          currentValue: item[field] ?? '',
          decision: item.decision,
          riskPriorityScore: stock.riskPriorityScore || 0,
          riskPriorityRank: stock.riskPriorityRank || '',
          riskPriorityLevel: stock.riskPriorityLevel || '',
          dueReason: 'SELL/REDUCE/BUY判定の未実行・未記録を解消',
          workflowStep: '実行/結果未入力確認',
          requiredReason: '判定遵守率・未実行検出に必要',
          inputHint: '売買履歴に基づき入力。未実行なら理由をactionReasonへ記録。',
          sourceRequired: '売買履歴 / 証券口座',
        })))
      }
      const outcomeTargets = decisionHistory.filter((item) => ['BUY', 'SELL', 'REDUCE', 'HOLD', 'WATCH'].includes(item.decision) && !item.decisionAccuracy).slice(0, 100)
      for (const item of outcomeTargets) {
        const stock = enrichedStocks.find((target) => target.code === item.code) || item
        ;['outcomeDate', 'outcomePrice', 'outcomeDividend'].forEach((field) => rows.push(makeRow({
          pack: 'weekly-evidence-pack',
          cadence: 'weekly',
          code: item.code,
          name: item.name,
          market: stock.market || '',
          group: stock.group || '',
          ruleProfile: stock.ruleProfile || item.ruleProfile || '',
          fieldName: field,
          currentValue: item[field] ?? '',
          decision: item.decision,
          riskPriorityScore: stock.riskPriorityScore || 0,
          riskPriorityRank: stock.riskPriorityRank || '',
          riskPriorityLevel: stock.riskPriorityLevel || '',
          dueReason: '判定成績評価に必要な結果データが未入力',
          workflowStep: '実行/結果未入力確認',
          requiredReason: '判定成績・重み診断に必要',
          inputHint: '結果確認時点の価格・受取配当・確認日を入力。',
          sourceRequired: '市場価格 / 配当履歴',
        })))
      }
    }

    if (packType === 'monthly' || packType === 'all') {
      const monthlyTasks = [
        ['decisionHistory', '現在判定を履歴保存し、ルール成績評価の母集団を増やす', '判定履歴保存'],
        ['operationReport', '月次運用レポートMD/JSONを出力する', '運用レポート出力'],
        ['ruleVersion', 'ルールバージョン・確認日・変更理由を確認する', 'ルール設定確認'],
        ['riskScoreVersion', 'リスク重み診断を確認し、必要なら推奨重みを適用する', 'リスク重み診断'],
        ['lastBackupAt', 'JSONバックアップを保存し、完全性ハッシュを更新する', 'JSONバックアップ保存'],
      ]
      for (const [field, reason, step] of monthlyTasks) {
        rows.push(makeRow({
          pack: 'monthly-operation-pack',
          cadence: 'monthly',
          code: 'SYSTEM',
          name: '月次運用',
          market: 'SYSTEM',
          group: 'OPERATIONS',
          ruleProfile: 'SYSTEM',
          fieldName: field,
          currentValue: field === 'lastBackupAt' ? integrityMeta.lastBackupAt || '' : field === 'riskScoreVersion' ? riskWeightConfig.riskScoreVersion || '' : '',
          decision: '',
          dueReason: reason,
          workflowStep: step,
          requiredReason: reason,
          inputHint: '画面上の該当ボタンまたは設定欄で処理する。',
          sourceRequired: 'アプリ操作 / 運用記録',
        }))
      }
    }

    if (packType === 'quarterly' || packType === 'all') {
      const coreFinancialFields = ['annualDividend', 'payoutRatio', 'operatingCashFlowYoY', 'revenueYoY', 'epsYoY', 'equityRatio', 'debtToEquity', 'dividendCut', 'financialUpdatedAt', 'sourceName', 'sourceUrl', 'fiscalPeriod', 'dataType', 'confirmedAt', 'sourcePage', 'sourceQuote', 'selectedEvidenceValue', 'sourceMetricName', 'sourceUnit']
      const quarterlyTargets = enrichedStocks
        .filter((stock) => stock.shares > 0 || blockingDecisions.includes(stock.decisionResult?.decision) || (stock.riskPriorityScore || 0) > 0)
        .sort((a, b) => (b.riskPriorityScore || 0) - (a.riskPriorityScore || 0))
        .slice(0, 120)
      for (const stock of quarterlyTargets) {
        for (const field of coreFinancialFields) {
          addStockField(stock, field, 'quarterly-financial-pack', 'quarterly', '四半期財務・証跡棚卸し対象', '財務データ更新')
        }
        const profileFields = (profileMetricDefinitions[stock.ruleProfile] || []).map((item) => item.field)
        for (const field of profileFields) {
          addStockField(stock, field, 'quarterly-financial-pack', 'quarterly', `${stock.ruleProfile}専用指標の四半期更新`, '業種別専用指標更新')
        }
      }
    }

    const seen = new Set()
    return rows.filter((row) => {
      const key = `${row.pack}|${row.code}|${row.missingField}|${row.workflowStep}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => {
      const levelOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      return (levelOrder[b.riskPriorityLevel] || 0) - (levelOrder[a.riskPriorityLevel] || 0) || Number(b.riskPriorityScore || 0) - Number(a.riskPriorityScore || 0)
    })
  }

  const exportDataUpdatePackCsv = (packType, filename) => {
    const header = ['pack', 'cadence', 'code', 'name', 'market', 'group', 'ruleProfile', 'missingField', 'missingFieldLabel', 'currentValue', 'importedValue', 'requiredReason', 'inputHint', 'sourceRequired', 'currentDecision', 'riskPriorityScore', 'riskPriorityRank', 'riskPriorityLevel', 'coverageScore', 'dueReason', 'workflowStep', 'generatedAt']
    const rows = buildDataUpdatePackRows(packType).map((item) => header.map((key) => item[key] ?? ''))
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadTextFile(`﻿${csv}`, filename, 'text/csv;charset=utf-8;')
  }

  const exportDailyUpdatePackCsv = () => exportDataUpdatePackCsv('daily', 'portfolio-daily-update-pack.csv')
  const exportWeeklyEvidencePackCsv = () => exportDataUpdatePackCsv('weekly', 'portfolio-weekly-evidence-pack.csv')
  const exportMonthlyOperationPackCsv = () => exportDataUpdatePackCsv('monthly', 'portfolio-monthly-operation-pack.csv')
  const exportQuarterlyFinancialPackCsv = () => exportDataUpdatePackCsv('quarterly', 'portfolio-quarterly-financial-pack.csv')
  const exportAllDataUpdatePackCsv = () => exportDataUpdatePackCsv('all', 'portfolio-all-data-update-pack.csv')

  const updatePackSummary = useMemo(() => {
    const packs = [
      { key: 'daily', label: '日次更新パック', rows: buildDataUpdatePackRows('daily') },
      { key: 'weekly', label: '週次証跡パック', rows: buildDataUpdatePackRows('weekly') },
      { key: 'monthly', label: '月次運用パック', rows: buildDataUpdatePackRows('monthly') },
      { key: 'quarterly', label: '四半期財務パック', rows: buildDataUpdatePackRows('quarterly') },
    ]
    return packs.map((pack) => ({
      ...pack,
      rowCount: pack.rows.length,
      highCount: pack.rows.filter((row) => ['CRITICAL', 'HIGH'].includes(row.riskPriorityLevel)).length,
      stockCount: new Set(pack.rows.filter((row) => !['SYSTEM', 'FX'].includes(row.code)).map((row) => row.code)).size,
      topReason: pack.rows[0]?.dueReason || '対象なし',
    }))
  }, [enrichedStocks, riskPriorityList, coverageDiagnostics, decisionHistory, holdings, settings, riskWeightConfig, integrityMeta])

  const applyRiskWeightRecommendations = () => {
    const actionable = riskWeightDiagnostics.filter((item) => ['INCREASE', 'DECREASE'].includes(item.recommendation) && item.evaluatedCount >= 3 && item.suggestedWeight !== item.currentWeight)
    if (actionable.length === 0) {
      setImportMessage('適用可能なリスク重み改善候補はありません。評価済み履歴を増やしてください。')
      return
    }
    const nextWeights = { ...riskWeightConfig.weights }
    for (const item of actionable) nextWeights[item.key] = String(item.suggestedWeight)
    const nextConfig = sanitizeRiskWeightConfig({
      ...riskWeightConfig,
      weights: nextWeights,
      riskScoreVersion: `${riskWeightConfig.riskScoreVersion || RISK_SCORE_VERSION}-tuned-${new Date().toISOString().slice(0, 10)}`,
      riskWeightReviewedAt: new Date().toISOString().slice(0, 10),
      riskWeightChangeReason: `判定成績診断に基づく重み自動補正 ${actionable.length}件`,
    })
    setRiskWeightConfig(nextConfig)
    appendAuditEntries(actionable.map((item) => buildAuditEntry({
      code: 'SYSTEM',
      name: 'リスク重み自動補正',
      fieldName: `riskWeight.${item.key}`,
      previousValue: item.currentWeight,
      newValue: item.suggestedWeight,
      changeSource: 'rule_config',
      decisionBefore: item.recommendation,
      decisionAfter: item.reason,
      ruleVersion: nextConfig.riskScoreVersion,
    })))
    setImportMessage(`リスク重み改善候補 ${actionable.length}件を適用しました。npm run build後にGitHubへ反映してください。`)
  }


  const clearAuditLog = () => {
    if (confirmDangerousAction('監査ログ全削除')) {
      setAuditLog([])
      setImportMessage('監査ログを削除しました。')
    }
  }

  const clearDecisionHistory = () => {
    if (confirmDangerousAction('判定履歴全削除')) {
      setDecisionHistory([])
      setImportMessage('判定履歴を削除しました。')
    }
  }

  const clearHoldings = () => {
    if (confirmDangerousAction('入力データ全削除')) {
      const entries = Object.entries(holdings).flatMap(([code, holding]) => {
        const stock = stockByCode.get(code)
        return Object.entries(holding || {}).filter(([, value]) => String(value ?? '') !== '').map(([fieldName, value]) => buildAuditEntry({ code, name: stock?.name || '', fieldName, previousValue: value, newValue: '', changeSource: 'manual', decisionBefore: stock?.decisionResult?.decision || '', decisionAfter: 'CLEARED' }))
      })
      setHoldings({})
      appendAuditEntries(entries)
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-sky-100 via-white to-slate-100 text-slate-900 overflow-hidden relative ${isReadOnlyMode ? 'safe-readonly' : 'safe-editing'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(191,219,254,0.4),transparent_70%)]" />
      <div className="safe-allow sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-slate-900">安全操作モード: {isReadOnlyMode ? '閲覧モード' : '編集モード'}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {isReadOnlyMode ? '入力・取込・復元・削除・ルール変更をロック中。編集する場合は明示解除が必要。' : '編集可能状態。作業後は閲覧モードへ戻す。危険操作は追加確認あり。'}
              {safeMode.changedAt ? ` / 切替: ${safeMode.changedAt.slice(0, 19).replace('T', ' ')}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isReadOnlyMode ? (
              <button type="button" onClick={enableEditMode} className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100">編集モード解除</button>
            ) : (
              <button type="button" onClick={disableEditMode} className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">閲覧モードへ戻す</button>
            )}
          </div>
        </div>
      </div>
      <div className="relative z-10 px-6 pt-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">ガイドワークフロー</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">日次・週次・月次・四半期の作業を順番固定。人間が作業順を選ばない構造にする。</p>
              <p className="mt-1 text-xs font-bold text-red-600">閲覧モードでは進捗更新不可。実施記録を残す場合は編集モードに切替。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportGuidedWorkflowCsv} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">ワークフローCSV</button>
              <button type="button" onClick={resetGuidedWorkflowProgress} className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100">進捗リセット</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {guidedWorkflowStats.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => startGuidedWorkflow(workflow.id)}
                className={`rounded-2xl border p-4 text-left transition ${guidedWorkflow.activeWorkflowId === workflow.id ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
              >
                <div className="text-sm font-black text-slate-900">{workflow.label}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{cadenceLabels[workflow.cadence] || workflow.cadence}</div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, workflow.completionRate))}%` }} />
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-600">進捗 {workflow.doneCount}/{workflow.totalSteps} / checklist {workflow.checklistDoneCount}/{workflow.totalSteps}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">{activeGuidedWorkflow.label}</h3>
                <p className="text-xs font-semibold text-slate-500">{activeGuidedWorkflow.objective}</p>
              </div>
              <div className="text-xs font-bold text-slate-500">開始: {guidedWorkflow.startedAt ? guidedWorkflow.startedAt.slice(0, 19).replace('T', ' ') : '未開始'} / 最終完了: {guidedWorkflow.lastCompletedAt ? guidedWorkflow.lastCompletedAt.slice(0, 19).replace('T', ' ') : 'なし'}</div>
            </div>
            <div className="grid gap-3 xl:grid-cols-4">
              {activeGuidedWorkflowSteps.map((step) => (
                <div key={step.id} className={`rounded-2xl border p-4 ${step.completedAt ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black text-slate-400">STEP {step.index}</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{step.label}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${step.completedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{step.completedAt ? 'DONE' : 'OPEN'}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">{step.description}</p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-2 text-[11px] font-semibold text-slate-600">
                    <div>出力: {step.output}</div>
                    <div>連動タスク: {step.checklistId}</div>
                    <div>チェック状態: {step.checklistStatus} {step.checklistAgeDays !== null ? `/ ${step.checklistAgeDays}日` : ''}</div>
                    {step.completedAt && <div>完了: {step.completedAt.slice(0, 19).replace('T', ' ')}</div>}
                  </div>
                  <button type="button" onClick={() => completeGuidedStep(activeGuidedWorkflow.id, step.id)} className="mt-3 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">このステップを完了</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 px-6 pt-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-red-100 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">未解決リスク優先改修キュー</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">未解決項目を、現在のデータ状態から機械的に優先順位化。静的GitHub Pagesで直接解決できない項目は、代替策と次アクションを固定。</p>
            </div>
            <button type="button" onClick={exportUnresolvedRiskPlanCsv} className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100">未解決リスクCSV</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="未解決スコア合計" value={unresolvedRiskPlan.stats.unresolvedScore} subLabel="残課題の加重点数" tone={unresolvedRiskPlan.stats.unresolvedScore > 300 ? 'red' : unresolvedRiskPlan.stats.unresolvedScore > 180 ? 'amber' : 'emerald'} />
            <MetricCard label="CRITICAL" value={unresolvedRiskPlan.stats.critical} subLabel="即時優先" tone={unresolvedRiskPlan.stats.critical > 0 ? 'red' : 'emerald'} />
            <MetricCard label="HIGH" value={unresolvedRiskPlan.stats.high} subLabel="高優先" tone={unresolvedRiskPlan.stats.high > 0 ? 'amber' : 'emerald'} />
            <MetricCard label="静的構成の限界" value={unresolvedRiskPlan.stats.staticBlocked} subLabel="完全解決に外部基盤が必要" tone="slate" />
            <MetricCard label="最優先" value={unresolvedRiskPlan.stats.top?.priorityLevel || 'なし'} subLabel={unresolvedRiskPlan.stats.top?.label || '対象なし'} tone={unresolvedRiskPlan.stats.top?.priorityLevel === 'CRITICAL' ? 'red' : unresolvedRiskPlan.stats.top?.priorityLevel === 'HIGH' ? 'amber' : 'sky'} />
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[52px_1fr_90px_90px_1.2fr_1.2fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold text-slate-500">
              <div>順位</div>
              <div>未解決項目</div>
              <div>優先</div>
              <div className="text-right">点数</div>
              <div>根拠</div>
              <div>次アクション</div>
            </div>
            {unresolvedRiskPlan.rows.map((item, index) => (
              <div key={item.key} className="grid grid-cols-[52px_1fr_90px_90px_1.2fr_1.2fr] gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0">
                <div className="font-black text-slate-900">#{index + 1}</div>
                <div>
                  <div className="font-black text-slate-900">{item.label}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.category}</div>
                  <div className="mt-1 text-[11px] text-slate-500">制約: {item.staticLimit}</div>
                </div>
                <div><span className={`rounded-full border px-2 py-1 text-[11px] font-black ${unresolvedLevelTone[item.priorityLevel] || unresolvedLevelTone.LOW}`}>{item.priorityLevel}</span></div>
                <div className="text-right text-lg font-black text-slate-900">{item.score}</div>
                <div className="font-semibold leading-relaxed text-slate-600">{item.evidence}</div>
                <div>
                  <div className="font-semibold leading-relaxed text-slate-700">{item.action || item.nextAction}</div>
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-500">代替策: {item.mitigation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative z-10 px-6 pt-6">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-orange-100 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">データ更新パック</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">未解決の「自動取得できないデータ」を、日次・週次・月次・四半期の作業CSVに分解して出力します。</p>
              <p className="mt-1 text-xs font-bold text-orange-700">出力CSVは作業指示用です。値を埋めた後は一括貼り付けまたは不足入力CSV取込で反映してください。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportDailyUpdatePackCsv} className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-black text-orange-700 hover:bg-orange-100">日次更新Pack</button>
              <button type="button" onClick={exportWeeklyEvidencePackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-700 hover:bg-orange-50">週次証跡Pack</button>
              <button type="button" onClick={exportMonthlyOperationPackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-700 hover:bg-orange-50">月次運用Pack</button>
              <button type="button" onClick={exportQuarterlyFinancialPackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-700 hover:bg-orange-50">四半期財務Pack</button>
              <button type="button" onClick={exportAllDataUpdatePackCsv} className="rounded-2xl border border-orange-300 bg-orange-600 px-4 py-2 text-xs font-black text-white hover:bg-orange-700">全更新Pack</button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {updatePackSummary.map((pack) => (
              <div key={pack.key} className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                <div className="text-sm font-black text-slate-900">{pack.label}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white p-2"><div className="text-lg font-black text-slate-900">{pack.rowCount}</div><div className="font-bold text-slate-500">行数</div></div>
                  <div className="rounded-xl bg-white p-2"><div className="text-lg font-black text-slate-900">{pack.stockCount}</div><div className="font-bold text-slate-500">銘柄</div></div>
                  <div className="rounded-xl bg-white p-2"><div className="text-lg font-black text-red-700">{pack.highCount}</div><div className="font-bold text-slate-500">HIGH</div></div>
                </div>
                <div className="mt-3 rounded-xl border border-orange-100 bg-white p-3 text-xs font-semibold leading-relaxed text-slate-600">最上位理由: {pack.topReason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
            <div className="space-y-5 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">キーワード検索</label>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="銘柄コード、企業名、業務内容、タグ、判定で検索"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <FilterButton
                  label="全リセット"
                  active={selectedMarket === 'ALL' && selectedGroup === 'ALL' && selectedConditions.length === 0 && keyword === ''}
                  onClick={resetFilters}
                />
                <FilterButton label="日本株" active={selectedMarket === '日本株'} onClick={() => setSelectedMarket(selectedMarket === '日本株' ? 'ALL' : '日本株')} />
                <FilterButton label="米国株" active={selectedMarket === '米国株'} onClick={() => setSelectedMarket(selectedMarket === '米国株' ? 'ALL' : '米国株')} />
                {conditionDefinitions.map((condition) => (
                  <FilterButton key={condition.key} label={condition.label} active={selectedConditions.includes(condition.key)} onClick={() => toggleCondition(condition.key)} activeClass={condition.activeClass} />
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_repeat(5,140px)] md:items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">ジャンル</label>
                  <select
                    value={selectedGroup}
                    onChange={(event) => setSelectedGroup(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="ALL">すべてのジャンル</option>
                    {allGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">USD/JPY</label>
                  <input
                    inputMode="decimal"
                    value={usdJpyInput}
                    onChange={(event) => setUsdJpyInput(event.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${usdJpyValidationError ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-slate-50 focus:border-sky-400 focus:ring-sky-100'}`}
                  />
                  {usdJpyValidationError && <div className="text-xs font-semibold text-red-600">{usdJpyValidationError}</div>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">USD/JPY更新日</label>
                  <input
                    type="date"
                    value={fxUpdatedAtInput}
                    onChange={(event) => setFxUpdatedAtInput(event.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${fxUpdatedAtValidationError ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-slate-50 focus:border-sky-400 focus:ring-sky-100'}`}
                  />
                  {fxUpdatedAtValidationError && <div className="text-xs font-semibold text-red-600">{fxUpdatedAtValidationError}</div>}
                </div>
                <button type="button" onClick={exportCsv} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">CSV出力</button>
                <label className="cursor-pointer rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-700 hover:bg-sky-100">
                  CSV取込
                  <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
                </label>
                <button type="button" onClick={exportJson} className="rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">JSON保存</button>
                <label className="cursor-pointer rounded-2xl border border-violet-300 bg-violet-50 px-4 py-3 text-center text-sm font-semibold text-violet-700 hover:bg-violet-100">
                  JSON復元
                  <input type="file" accept=".json,application/json" onChange={importJson} className="hidden" />
                </label>
                <button type="button" onClick={saveDecisionHistorySnapshot} className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">現在判定を履歴保存</button>
                <button type="button" onClick={exportDecisionHistoryCsv} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">履歴CSV出力</button>
                <button type="button" onClick={exportAuditLogCsv} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">監査ログCSV出力</button>
                <button type="button" onClick={exportOperationalReportMarkdown} className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">運用レポートMD</button>
                <button type="button" onClick={exportOperationalReportJson} className="rounded-2xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">運用レポートJSON</button>
                <button type="button" onClick={exportCoverageDiagnosticsCsv} className="rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-100">不足診断CSV</button>
                <button type="button" onClick={exportMissingDataTemplateCsv} className="rounded-2xl border border-teal-300 bg-white px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50">不足入力テンプレートCSV</button>
                <button type="button" onClick={exportBulkInputSuggestionsCsv} className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-100">入力候補CSV</button>
                <button type="button" onClick={exportBulkPasteTemplateTsv} className="rounded-2xl border border-cyan-300 bg-white px-4 py-3 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">貼付用TSV</button>
                <button type="button" onClick={exportDailyUpdatePackCsv} className="rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100">日次更新Pack</button>
                <button type="button" onClick={exportWeeklyEvidencePackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50">週次証跡Pack</button>
                <button type="button" onClick={exportMonthlyOperationPackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50">月次運用Pack</button>
                <button type="button" onClick={exportQuarterlyFinancialPackCsv} className="rounded-2xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50">四半期財務Pack</button>
                <button type="button" onClick={exportAllDataUpdatePackCsv} className="rounded-2xl border border-orange-300 bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700">全更新Pack</button>
                <label className="cursor-pointer rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-center text-sm font-semibold text-teal-700 hover:bg-teal-100">
                  不足入力CSV取込
                  <input type="file" accept=".csv,text/csv" onChange={importMissingDataTemplateCsv} className="hidden" />
                </label>
                <button type="button" onClick={exportImportValidationReportCsv} className="rounded-2xl border border-purple-300 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100">取込検証CSV</button>
                <button type="button" onClick={exportImportValidationReportJson} className="rounded-2xl border border-purple-300 bg-white px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-50">取込検証JSON</button>
                <button type="button" onClick={clearAuditLog} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">監査ログ削除</button>
                <button type="button" onClick={clearDecisionHistory} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">履歴削除</button>
                <button type="button" onClick={clearHoldings} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100">入力削除</button>
              </div>

              {importMessage && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-800">{importMessage}</div>}

              <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-cyan-900">入力候補の自動生成</h3>
                    <p className="mt-1 text-sm text-cyan-800">カバレッジ診断・リスク優先度・停止判定から、次に入力すべき項目を機械的に並べます。</p>
                    <p className="mt-1 text-xs text-cyan-700">CSVは作業指示用、TSVは一括貼り付け欄へそのまま貼るための空テンプレートです。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={exportBulkInputSuggestionsCsv} className="rounded-2xl border border-cyan-300 bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">入力候補CSV</button>
                    <button type="button" onClick={exportBulkPasteTemplateTsv} className="rounded-2xl border border-cyan-300 bg-white px-4 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100">貼付用TSV</button>
                  </div>
                </div>
                <div className="mt-4 max-h-72 overflow-auto rounded-2xl border border-cyan-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-cyan-100 text-cyan-900">
                      <tr>
                        <th className="px-3 py-2">優先</th>
                        <th className="px-3 py-2">銘柄</th>
                        <th className="px-3 py-2">入力項目</th>
                        <th className="px-3 py-2">理由</th>
                        <th className="px-3 py-2">必要根拠</th>
                        <th className="px-3 py-2">貼付形式</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkInputSuggestions.slice(0, 15).map((item, index) => (
                        <tr key={`${item.code}-${item.suggestedField}-${index}`}>
                          <td className="px-3 py-2 font-bold text-cyan-800">{index + 1}</td>
                          <td className="px-3 py-2">{item.code} {item.name}</td>
                          <td className="px-3 py-2 font-semibold">{item.missingFieldLabel}</td>
                          <td className="px-3 py-2">{item.suggestedReason}</td>
                          <td className="px-3 py-2">{item.requiredEvidence}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{item.pasteTemplate}</td>
                        </tr>
                      ))}
                      {bulkInputSuggestions.length === 0 && (
                        <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>入力候補なし</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-teal-900">一括貼り付け入力</h3>
                    <p className="mt-1 text-sm text-teal-800">Excel / Google Sheets からヘッダー付きで貼り付け。CSVファイルを作らずに、不足入力CSVと同じ形式でプレビューできます。</p>
                    <p className="mt-1 text-xs text-teal-700">必須列: code, missingField, importedValue。区切りはタブ・カンマの両方に対応。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={previewBulkPasteImport} className="rounded-2xl border border-teal-300 bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">貼り付け内容をプレビュー</button>
                    <button type="button" onClick={clearBulkPasteInput} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">クリア</button>
                  </div>
                </div>
                <textarea
                  value={bulkPasteText}
                  onChange={(event) => setBulkPasteText(event.target.value)}
                  placeholder={'code\tname\tmissingField\tmissingFieldLabel\timportedValue\n2914\t日本たばこ産業\tpayoutRatio\t配当性向\t62.4\nMSFT\tMicrosoft\tepsYoY\tEPS前年比\t12.5'}
                  className="mt-4 h-40 w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 font-mono text-xs text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </div>

              {importValidationReport && (
                <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-purple-900">インポート後検証レポート</h3>
                      <p className="mt-1 text-sm text-purple-800">作成日時: {new Date(importValidationReport.createdAt).toLocaleString('ja-JP')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={exportImportValidationReportCsv} className="rounded-2xl border border-purple-300 bg-white px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">CSV出力</button>
                      <button type="button" onClick={exportImportValidationReportJson} className="rounded-2xl border border-purple-300 bg-white px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">JSON出力</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <MetricCard label="反映行" value={importValidationReport.appliedRows} subLabel={`却下 ${importValidationReport.rejectedRows} / スキップ ${importValidationReport.skippedRows}`} tone={importValidationReport.rejectedRows > 0 ? 'amber' : 'emerald'} />
                    <MetricCard label="HIGH影響" value={importValidationReport.highImpactRows} subLabel={`対象銘柄 ${importValidationReport.affectedStockCount}`} tone={importValidationReport.highImpactRows > 0 ? 'red' : 'emerald'} />
                    <MetricCard label="カバレッジ推定" value={`${importValidationReport.coverageBefore}% → ${importValidationReport.coverageAfterEstimate}%`} subLabel={`差分 ${importValidationReport.coverageDeltaEstimate >= 0 ? '+' : ''}${importValidationReport.coverageDeltaEstimate}pt`} tone={importValidationReport.coverageDeltaEstimate >= 0 ? 'emerald' : 'red'} />
                    <MetricCard label="リスク再計算対象" value={importValidationReport.changedRiskRows} subLabel="適用後に再判定" tone={importValidationReport.changedRiskRows > 0 ? 'amber' : 'emerald'} />
                  </div>
                  <div className="mt-4 text-xs text-purple-800">変更項目: {Object.entries(importValidationReport.changedFields || {}).map(([key, value]) => `${getCoverageFieldLabel(key)} ${value}件`).join(' / ') || 'なし'}</div>
                </div>
              )}

              {pendingMissingImport && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-amber-900">{pendingMissingImport.sourceType === 'bulk_paste' ? '一括貼り付け 反映前プレビュー' : '不足入力CSV 反映前プレビュー'}</h3>
                      <p className="mt-1 text-sm text-amber-800">反映予定 {pendingMissingImport.importableCount}件 / HIGH影響 {pendingMissingImport.highImpactCount}件 / 未登録 {pendingMissingImport.unknownCount}件 / 不正 {pendingMissingImport.invalidCount}件 / スキップ {pendingMissingImport.skippedCount}件</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={applyPendingMissingDataImport} className="rounded-2xl border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">プレビューを適用</button>
                      <button type="button" onClick={cancelPendingMissingDataImport} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">キャンセル</button>
                    </div>
                  </div>
                  <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-amber-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-amber-100 text-amber-900">
                        <tr>
                          <th className="px-3 py-2">状態</th>
                          <th className="px-3 py-2">銘柄</th>
                          <th className="px-3 py-2">項目</th>
                          <th className="px-3 py-2">変更前</th>
                          <th className="px-3 py-2">変更後</th>
                          <th className="px-3 py-2">判定変化</th>
                          <th className="px-3 py-2">影響</th>
                          <th className="px-3 py-2">理由</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingMissingImport.rows.slice(0, 100).map((row, index) => (
                          <tr key={`${row.code}-${row.fieldName}-${index}`} className={row.status === 'IMPORTABLE' ? 'bg-white' : 'bg-slate-50 text-slate-500'}>
                            <td className="px-3 py-2 font-semibold">{row.status}</td>
                            <td className="px-3 py-2">{row.code} {row.name}</td>
                            <td className="px-3 py-2">{row.fieldLabel || row.fieldName}</td>
                            <td className="px-3 py-2">{String(row.previousValue ?? '')}</td>
                            <td className="px-3 py-2">{String(row.newValue ?? '')}</td>
                            <td className="px-3 py-2">{row.decisionBefore || '-'} → {row.decisionAfter || '-'}</td>
                            <td className="px-3 py-2 font-semibold">{row.impactLevel}</td>
                            <td className="px-3 py-2">{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pendingMissingImport.rows.length > 100 && <div className="mt-2 text-xs text-amber-800">表示は先頭100件のみです。適用対象件数は上部の反映予定件数を確認してください。</div>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">市場: {selectedMarket === 'ALL' ? '全市場' : selectedMarket}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">条件: {selectedConditions.length === 0 ? '指定なし' : selectedConditions.map((key) => conditionLabels[key]).join(' / ')}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">ジャンル: {selectedGroup === 'ALL' ? '全ジャンル' : selectedGroup}</span>
                {keyword && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">検索: {keyword}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Portfolio Intelligence</h1>
                <p className="text-slate-500 mt-3 text-lg font-medium">Rule-Based Portfolio Decision Dashboard</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <MetricCard label="表示中銘柄数" value={totalCount} />
                <MetricCard label="日本株" value={jpCount} />
                <MetricCard label="米国株" value={usCount} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <MetricCard label="INVALID" value={portfolioSummary.decisionCounts.INVALID_DATA || 0} subLabel="入力異常" tone="red" />
            <MetricCard label="UNVERIFIED" value={portfolioSummary.decisionCounts.UNVERIFIED_DATA || 0} subLabel="根拠未確認" tone="amber" />
            <MetricCard label="WEAK" value={portfolioSummary.decisionCounts.WEAK_EVIDENCE || 0} subLabel="証跡不足" tone="amber" />
            <MetricCard label="MULTIPLE" value={portfolioSummary.decisionCounts.MULTIPLE_EVIDENCE_VALUES || 0} subLabel="採用値未指定" tone="amber" />
            <MetricCard label="MISMATCH" value={portfolioSummary.decisionCounts.MISMATCHED_EVIDENCE || 0} subLabel="証跡不一致" tone="red" />
            <MetricCard label="PROFILE" value={portfolioSummary.decisionCounts.PROFILE_DATA_REQUIRED || 0} subLabel="専用指標不足" tone="amber" />
            <MetricCard label="STALE" value={portfolioSummary.decisionCounts.STALE_DATA || 0} subLabel="期限切れ" tone="amber" />
            <MetricCard label="SELL" value={portfolioSummary.decisionCounts.SELL || 0} subLabel="強制売却条件" tone="red" />
            <MetricCard label="REDUCE" value={portfolioSummary.decisionCounts.REDUCE || 0} subLabel="削減条件" tone="amber" />
            <MetricCard label="BUY" value={portfolioSummary.decisionCounts.BUY || 0} subLabel="買い条件通過" tone="emerald" />
            <MetricCard label="HOLD" value={portfolioSummary.decisionCounts.HOLD || 0} subLabel="保有継続" tone="sky" />
            <MetricCard label="WATCH" value={portfolioSummary.decisionCounts.WATCH || 0} subLabel="監視" />
            <MetricCard label="NO_DATA" value={portfolioSummary.decisionCounts.NO_DATA || 0} subLabel="データ不足" tone="amber" />
            {portfolioSummary.byRuleProfile?.slice(0, 8).map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.count} subLabel="ルールプロファイル" />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="履歴保存回数" value={historyRuns.length} subLabel={latestHistoryRun ? String(latestHistoryRun.decisionDate).slice(0, 10) : '未保存'} tone="sky" />
            <MetricCard label="履歴件数" value={decisionHistory.length} subLabel="銘柄別スナップショット" />
            <MetricCard label="直近SELL" value={latestHistoryRun?.counts?.SELL || 0} subLabel="最新保存回" tone="red" />
            <MetricCard label="直近REDUCE" value={latestHistoryRun?.counts?.REDUCE || 0} subLabel="最新保存回" tone="amber" />
            <MetricCard label="評価済み履歴" value={outcomeStats.evaluated} subLabel={`SUCCESS率 ${formatPercent(outcomeStats.successRate)}`} tone="emerald" />
            <MetricCard label="未評価履歴" value={outcomeStats.pending} subLabel="outcome未入力" tone="amber" />
            <MetricCard label="FAILURE" value={outcomeStats.failure} subLabel={`失敗率 ${formatPercent(outcomeStats.failureRate)}`} tone="red" />
            <MetricCard label="機会損失" value={outcomeStats.missedOpportunity} subLabel="WATCH後上昇" tone="amber" />
            <MetricCard label="判定遵守率" value={formatPercent(actionStats.complianceRate)} subLabel={`COMPLIANT ${actionStats.compliant}件`} tone="emerald" />
            <MetricCard label="未実行" value={actionStats.notExecuted} subLabel={`BUY ${actionStats.buyNotExecuted} / SELL ${actionStats.sellNotExecuted} / REDUCE ${actionStats.reduceNotExecuted}`} tone="amber" />
            <MetricCard label="逆行実行" value={actionStats.contradicted} subLabel={`非遵守 ${actionStats.nonCompliant}件`} tone="red" />
            <MetricCard label="平均実行遅延" value={`${formatNumber(actionStats.averageExecutionGapDays, 1)}日`} subLabel={`平均価格乖離 ${formatPercent(actionStats.averageExecutionPriceGap)}`} tone="sky" />
            <MetricCard label="監査ログ" value={auditStats.total} subLabel={`24時間 ${auditStats.last24h}件`} tone="sky" />
            <MetricCard label="HIGH影響変更" value={auditStats.high} subLabel={`判定変化 ${auditStats.decisionChanged}件`} tone="red" />
            <MetricCard label="CSV/JSON変更" value={auditStats.csvImport + auditStats.jsonRestore} subLabel={`CSV ${auditStats.csvImport} / JSON ${auditStats.jsonRestore}`} tone="amber" />
            <MetricCard label="完全性スコア" value={`${integritySummary.dataCompletenessScore}/100`} subLabel={`欠損 ${integritySummary.missingCriticalFieldCount}件`} tone={integritySummary.dataCompletenessScore >= 80 ? 'emerald' : integritySummary.dataCompletenessScore >= 50 ? 'amber' : 'red'} />
            <MetricCard label="最終JSON保存" value={integrityMeta.lastBackupAt ? integrityMeta.lastBackupAt.slice(0, 10) : '未保存'} subLabel={integrityMeta.backupIntegrityHash || 'hashなし'} tone="sky" />
            <MetricCard label="最終JSON復元" value={integrityMeta.lastRestoreAt ? integrityMeta.lastRestoreAt.slice(0, 10) : '未復元'} subLabel={integrityMeta.restoreSourceHash || 'hashなし'} tone={integrityMeta.restoreStatus === 'RESTORED_WITH_WARNINGS' ? 'amber' : 'slate'} />
          </div>

          <div className="bg-white/80 backdrop-blur-3xl border border-teal-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">データ入力・評価カバレッジ診断</h2>
                <p className="text-xs font-semibold text-slate-500">判定・診断・バックテストに必要な入力不足を機械的に抽出。次に埋めるべき項目を固定。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportCoverageDiagnosticsCsv} className="rounded-2xl border border-teal-300 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100">不足診断CSV</button>
                <button type="button" onClick={exportMissingDataTemplateCsv} className="rounded-2xl border border-teal-300 bg-white px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50">不足入力テンプレートCSV</button>
                <button type="button" onClick={exportBulkInputSuggestionsCsv} className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100">入力候補CSV</button>
                <button type="button" onClick={exportBulkPasteTemplateTsv} className="rounded-2xl border border-cyan-300 bg-white px-4 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-50">貼付用TSV</button>
                <label className="cursor-pointer rounded-2xl border border-teal-300 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100">
                  不足入力CSV取込
                  <input type="file" accept=".csv,text/csv" onChange={importMissingDataTemplateCsv} className="hidden" />
                </label>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="総合カバレッジ" value={formatPercent(coverageDiagnostics.coverageScore)} subLabel={`${coverageDiagnostics.filledFields}/${coverageDiagnostics.totalFields}項目`} tone={coverageDiagnostics.coverageScore >= 90 ? 'emerald' : coverageDiagnostics.coverageScore >= 75 ? 'amber' : 'red'} />
              <MetricCard label="不足項目" value={coverageDiagnostics.missingFields} subLabel={`HIGH ${coverageDiagnostics.highImpactBlockers}件`} tone={coverageDiagnostics.highImpactBlockers > 0 ? 'red' : 'emerald'} />
              <MetricCard label="入力テンプレート行" value={coverageDiagnostics.blockers.length} subLabel="CSV出力対象" tone={coverageDiagnostics.blockers.length > 0 ? 'amber' : 'emerald'} />
              <MetricCard label="結果評価率" value={formatPercent(coverageDiagnostics.outcomeCoverageRate)} subLabel="decisionHistory中" tone={coverageDiagnostics.outcomeCoverageRate >= 70 ? 'emerald' : 'amber'} />
              <MetricCard label="実行記録率" value={formatPercent(coverageDiagnostics.actionCoverageRate)} subLabel="actionTracking" tone={coverageDiagnostics.actionCoverageRate >= 70 ? 'emerald' : 'amber'} />
              <MetricCard label="チェック完了率" value={formatPercent(coverageDiagnostics.checklistCoverageRate)} subLabel="運用タスク" tone={coverageDiagnostics.checklistCoverageRate >= 80 ? 'emerald' : 'amber'} />
              <MetricCard label="完全性スコア" value={coverageDiagnostics.integrityCompletenessScore} subLabel="既存integrity" tone={coverageDiagnostics.integrityCompletenessScore >= 90 ? 'emerald' : 'amber'} />
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-black text-slate-900">区分別カバレッジ</div>
                <div className="space-y-2">
                  {coverageDiagnostics.sectionTotals.map((section) => (
                    <div key={section.key} className="grid grid-cols-[120px_1fr_72px] items-center gap-3 text-xs">
                      <div className="font-bold text-slate-700">{section.label}</div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, Math.max(0, section.rate))}%` }} /></div>
                      <div className="text-right font-black text-slate-900">{formatPercent(section.rate)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-black text-slate-900">次に埋めるべき項目</div>
                <div className="space-y-2">
                  {coverageDiagnostics.blockers.slice(0, 10).map((item) => (
                    <div key={`${item.code}-${item.fieldName}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{item.code} {item.name}</div>
                        <div className="font-semibold text-slate-500">{item.fieldLabel} / 判定 {item.decision}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${item.impact === 'HIGH' ? 'border-red-200 bg-red-50 text-red-700' : item.impact === 'MEDIUM' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'}`}>{item.impact}</span>
                    </div>
                  ))}
                  {coverageDiagnostics.blockers.length === 0 && <div className="text-xs font-semibold text-emerald-700">主要不足項目なし</div>}
                </div>
              </div>
            </div>
          </div>


          <div className="bg-white/80 backdrop-blur-3xl border border-blue-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">運用レポート</h2>
                <p className="text-xs font-semibold text-slate-500">資産サマリー、判定、遵守率、成績、完全性、要対応銘柄を1ファイルで出力。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportOperationalReportMarkdown} className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Markdown出力</button>
                <button type="button" onClick={exportOperationalReportJson} className="rounded-2xl border border-blue-300 bg-white px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">JSON出力</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="要対応銘柄" value={portfolioSummary.criticalStocks.length} subLabel="停止判定・SELL・REDUCE" tone={portfolioSummary.criticalStocks.length > 0 ? 'red' : 'emerald'} />
              <MetricCard label="判定停止系" value={['INVALID_DATA','UNVERIFIED_DATA','WEAK_EVIDENCE','MULTIPLE_EVIDENCE_VALUES','MISMATCHED_EVIDENCE','PROFILE_DATA_REQUIRED','RULE_CONFIG_REQUIRED','STALE_DATA','NO_DATA'].reduce((sum, key) => sum + (portfolioSummary.decisionCounts[key] || 0), 0)} subLabel="通常判定前に停止" tone="amber" />
              <MetricCard label="成績評価" value={`${outcomeStats.evaluated}/${decisionHistory.length}`} subLabel={`SUCCESS率 ${formatPercent(outcomeStats.successRate)}`} tone="emerald" />
              <MetricCard label="遵守状況" value={formatPercent(actionStats.complianceRate)} subLabel={`未実行 ${actionStats.notExecuted} / 逆行 ${actionStats.contradicted}`} tone={actionStats.notExecuted + actionStats.contradicted > 0 ? 'amber' : 'emerald'} />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              出力ファイルは運用会議・月次棚卸し・バックテスト前の固定資料として使用。数値は出力時点のlocalStorage、JSON復元状態、判定履歴、監査ログに依存。
            </div>
          </div>



          <div className="bg-white/80 backdrop-blur-3xl border border-emerald-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">運用チェックリスト</h2>
                <p className="text-xs font-semibold text-slate-500">日次・週次・月次・四半期の確認作業を固定。期限切れタスクは運用リスクとして扱う。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportChecklistCsv} className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">チェックリストCSV</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="完了率" value={formatPercent(checklistStats.completionRate)} subLabel={`${checklistStats.done}/${checklistStats.total}件完了`} tone={checklistStats.overdue === 0 ? 'emerald' : 'amber'} />
              <MetricCard label="期限切れ" value={checklistStats.overdue} subLabel={`HIGH ${checklistStats.highOverdue}件`} tone={checklistStats.overdue > 0 ? 'red' : 'emerald'} />
              {checklistStats.byCadence.map((item) => (
                <MetricCard key={item.cadence} label={item.label} value={`${item.done}/${item.total}`} subLabel={`期限切れ ${item.overdue}件`} tone={item.overdue > 0 ? 'amber' : 'emerald'} />
              ))}
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {checklistEntries.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${checklistTone[item.status] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/70 bg-white/60 px-2 py-1 text-[11px] font-bold">{cadenceLabels[item.cadence] || item.cadence}</span>
                        <span className="rounded-full border border-white/70 bg-white/60 px-2 py-1 text-[11px] font-bold">{item.impact}</span>
                        <span className="rounded-full border border-white/70 bg-white/60 px-2 py-1 text-[11px] font-bold">{item.status === 'DONE' ? '完了' : '期限切れ'}</span>
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-900">{item.label}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-600">{item.description}</div>
                      <div className="mt-2 text-[11px] font-semibold text-slate-500">最終実施: {item.completedAt ? item.completedAt.slice(0, 10) : '未実施'} / {item.status === 'DONE' ? item.label : item.statusLabel}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => completeChecklistItem(item.id)} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50">完了</button>
                      <button type="button" onClick={() => resetChecklistItem(item.id)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">リセット</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>


          <div className="bg-white/80 backdrop-blur-3xl border border-purple-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">リスク重み設定</h2>
                <p className="text-xs font-semibold text-slate-500">リスク優先度スコアの重み・閾値・バージョンを固定値から設定管理へ移行。変更は監査ログに記録。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportRiskWeightConfigCsv} className="rounded-2xl border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100">重み設定CSV</button>
                <button type="button" onClick={resetRiskWeightConfig} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">初期値へ戻す</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                リスクスコア版
                <input value={riskWeightConfig.riskScoreVersion} onChange={(event) => updateRiskWeightMeta('riskScoreVersion', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
              </label>
              <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                市況局面
                <select value={riskWeightConfig.riskWeightRegime} onChange={(event) => updateRiskWeightMeta('riskWeightRegime', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900">
                  {riskRegimeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                重み確認日
                <input type="date" value={riskWeightConfig.riskWeightReviewedAt} onChange={(event) => updateRiskWeightMeta('riskWeightReviewedAt', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
              </label>
              <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                変更理由
                <input value={riskWeightConfig.riskWeightChangeReason} onChange={(event) => updateRiskWeightMeta('riskWeightChangeReason', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {riskLevelDefinitions.map((definition) => (
                <label key={definition.key} className="block rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
                  {definition.label}
                  <input type="number" value={riskWeightConfig.levels?.[definition.key] ?? ''} onChange={(event) => updateRiskLevel(definition.key, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900" />
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {riskWeightDefinitions.map((definition) => (
                <label key={definition.key} className="block rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
                  {definition.label}
                  <input type="number" value={riskWeightConfig.weights?.[definition.key] ?? ''} onChange={(event) => updateRiskWeight(definition.key, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900" />
                </label>
              ))}
            </div>

            {riskWeightConfigErrors.length > 0 && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800">
                <div className="mb-2 text-sm">RISK_WEIGHT_CONFIG_REQUIRED</div>
                {riskWeightConfigErrors.map((item) => <div key={item}>・{item}</div>)}
              </div>
            )}
          </div>

          <div className="bg-white/80 backdrop-blur-3xl border border-red-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">リスク優先度ランキング</h2>
                <p className="text-xs font-semibold text-slate-500">SELL / REDUCE、停止判定、集中度、含み損、未実行、証跡不備を点数化し、確認順を機械的に固定。</p>
              </div>
              <button type="button" onClick={exportRiskPriorityCsv} className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">リスク優先度CSV</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="最高リスク点" value={riskPriorityStats.topScore} subLabel={riskPriorityList[0] ? `${riskPriorityList[0].code} ${riskPriorityList[0].name}` : '対象なし'} tone={riskPriorityStats.topScore >= getRiskLevelThreshold(riskWeightConfig, 'critical') ? 'red' : riskPriorityStats.topScore >= getRiskLevelThreshold(riskWeightConfig, 'high') ? 'amber' : 'emerald'} />
              <MetricCard label="CRITICAL" value={riskPriorityStats.critical} subLabel="即確認対象" tone={riskPriorityStats.critical > 0 ? 'red' : 'emerald'} />
              <MetricCard label="HIGH" value={riskPriorityStats.high} subLabel="優先確認対象" tone={riskPriorityStats.high > 0 ? 'amber' : 'emerald'} />
              <MetricCard label="MEDIUM" value={riskPriorityStats.medium} subLabel="通常確認対象" tone="sky" />
              <MetricCard label="LOW" value={riskPriorityStats.low} subLabel="低優先" tone="slate" />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[64px_110px_1fr_110px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold text-slate-500">
                <div>順位</div>
                <div>銘柄</div>
                <div>主要リスク要因</div>
                <div>判定</div>
                <div className="text-right">点数</div>
              </div>
              {riskPriorityList.slice(0, 15).map((stock) => (
                <div key={stock.code} className="grid grid-cols-[64px_110px_1fr_110px_90px] gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0">
                  <div className="font-black text-slate-900">#{stock.riskPriorityRank}</div>
                  <div>
                    <div className="font-bold text-slate-900">{stock.code}</div>
                    <div className="truncate text-[11px] font-semibold text-slate-500">{stock.name}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(stock.riskDrivers || []).slice(0, 4).map((driver) => (
                      <span key={`${stock.code}-${driver.label}`} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${riskPriorityTone[driver.level] || riskPriorityTone.MEDIUM}`}>
                        {driver.label} +{driver.points}
                      </span>
                    ))}
                    {(stock.riskDrivers || []).length === 0 && <span className="text-[11px] font-semibold text-slate-400">主要リスクなし</span>}
                  </div>
                  <div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${decisionTone[stock.decisionResult?.decision] || decisionTone.WATCH}`}>
                      {stock.decisionResult?.decision || 'UNKNOWN'}
                    </span>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">{stock.riskPriorityLevel}</div>
                  </div>
                  <div className="text-right text-lg font-black text-slate-900">{stock.riskPriorityScore}</div>
                </div>
              ))}
            </div>
          </div>


          <div className="bg-white/80 backdrop-blur-3xl border border-violet-100 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">リスク重み成績診断</h2>
                <p className="text-xs font-semibold text-slate-500">判定履歴のoutcomeを使い、リスク加点が過剰・不足している候補を機械的に抽出。評価済み履歴3件未満の要因は変更不可。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportRiskWeightDiagnosticsCsv} className="rounded-2xl border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">診断CSV</button>
                <button type="button" onClick={applyRiskWeightRecommendations} className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700">改善候補を適用</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="診断対象要因" value={riskWeightDiagnosticStats.totalDrivers} subLabel="現在発生中のriskDrivers" tone="sky" />
              <MetricCard label="評価可能" value={riskWeightDiagnosticStats.evaluatedDrivers} subLabel="評価済み履歴3件以上" tone={riskWeightDiagnosticStats.evaluatedDrivers > 0 ? 'emerald' : 'amber'} />
              <MetricCard label="重み増加候補" value={riskWeightDiagnosticStats.increase} subLabel="失敗・機会損失率高" tone={riskWeightDiagnosticStats.increase > 0 ? 'red' : 'emerald'} />
              <MetricCard label="重み低下候補" value={riskWeightDiagnosticStats.decrease} subLabel="過剰警戒候補" tone={riskWeightDiagnosticStats.decrease > 0 ? 'sky' : 'emerald'} />
              <MetricCard label="検証不足" value={riskWeightDiagnosticStats.needData} subLabel="outcome履歴不足" tone={riskWeightDiagnosticStats.needData > 0 ? 'amber' : 'emerald'} />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.2fr_90px_90px_90px_90px_1fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold text-slate-500">
                <div>リスク要因</div>
                <div>現在</div>
                <div>推奨</div>
                <div>評価数</div>
                <div>成功率</div>
                <div>理由</div>
              </div>
              {riskWeightDiagnostics.slice(0, 12).map((item) => (
                <div key={item.key} className="grid grid-cols-[1.2fr_90px_90px_90px_90px_1fr] gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0">
                  <div>
                    <div className="font-bold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">発生 {item.activeCount}件 / {item.affectedCodes.slice(0, 2).join(' / ')}</div>
                  </div>
                  <div className="font-black text-slate-900">{item.currentWeight}</div>
                  <div className="font-black text-slate-900">{item.suggestedWeight}</div>
                  <div className="font-bold text-slate-700">{item.evaluatedCount}</div>
                  <div className="font-bold text-slate-700">{formatPercent(item.successRate)}</div>
                  <div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${riskRecommendationTone[item.recommendation] || riskRecommendationTone.NEED_DATA}`}>{item.recommendation}</span>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">失敗率 {formatPercent(item.failureRate)} / 平均TR {item.avgReturn === null ? '未評価' : formatPercent(item.avgReturn)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>


          <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">データ完全性チェック</h2>
                <p className="text-xs font-semibold text-slate-500">JSON保存時ハッシュ、復元元ハッシュ、重要項目欠損、履歴・監査ログ件数を監視。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600">Schema: {APP_SCHEMA_VERSION}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="完全性スコア" value={`${integritySummary.dataCompletenessScore}/100`} subLabel="重要項目入力率" tone={integritySummary.dataCompletenessScore >= 80 ? 'emerald' : integritySummary.dataCompletenessScore >= 50 ? 'amber' : 'red'} />
              <MetricCard label="欠損クリティカル" value={integritySummary.missingCriticalFieldCount} subLabel={integritySummary.missingCriticalFields.slice(0, 2).join(' / ') || 'なし'} tone={integritySummary.missingCriticalFieldCount > 0 ? 'red' : 'emerald'} />
              <MetricCard label="判定履歴件数" value={integritySummary.decisionHistoryCount} subLabel="backup meta対象" tone="sky" />
              <MetricCard label="監査ログ件数" value={integritySummary.auditLogCount} subLabel="backup meta対象" tone="sky" />
              <MetricCard label="保持銘柄件数" value={integritySummary.holdingRecordCount} subLabel={`登録銘柄 ${integritySummary.stockCount}`} />
              <MetricCard label="JSON保存Hash" value={integrityMeta.backupIntegrityHash || 'なし'} subLabel={integrityMeta.lastBackupAt || '未保存'} tone="sky" />
              <MetricCard label="JSON復元Hash" value={integrityMeta.restoreSourceHash || 'なし'} subLabel={integrityMeta.lastRestoreAt || '未復元'} tone={integrityMeta.restoreStatus === 'RESTORED_WITH_WARNINGS' ? 'amber' : 'slate'} />
              <MetricCard label="整合警告" value={(integrityMeta.integrityWarnings || []).length + integritySummary.integrityWarnings.length} subLabel={[...(integrityMeta.integrityWarnings || []), ...integritySummary.integrityWarnings].slice(0, 1).join('') || 'なし'} tone={(integrityMeta.integrityWarnings || []).length + integritySummary.integrityWarnings.length > 0 ? 'amber' : 'emerald'} />
            </div>
            {(integritySummary.missingCriticalFields.length > 0 || integritySummary.integrityWarnings.length > 0 || (integrityMeta.integrityWarnings || []).length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
                  <div className="mb-2 text-sm font-bold">整合警告</div>
                  {[...(integrityMeta.integrityWarnings || []), ...integritySummary.integrityWarnings].slice(0, 8).map((item) => <div key={item}>・{item}</div>)}
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
                  <div className="mb-2 text-sm font-bold">欠損項目サンプル</div>
                  {integritySummary.missingCriticalFields.slice(0, 8).map((item) => <div key={item}>・{item}</div>)}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">判定履歴ログ</h2>
                <p className="text-xs font-semibold text-slate-500">判定日時・入力値・ポートフォリオ比率・証跡をスナップショット保存。バックテスト用の土台。</p>
              </div>
              <div className="text-xs font-bold text-slate-500">履歴上限: 10,000件</div>
            </div>
            {historyRuns.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">履歴なし。上部の「現在判定を履歴保存」を押すと、全銘柄の現在判定を記録します。</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {historyRuns.slice(0, 6).map((run) => (
                  <div key={run.runId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                    <div className="font-bold text-slate-900">{String(run.decisionDate).slice(0, 19).replace('T', ' ')}</div>
                    <div className="mt-1">件数: {run.total} / ルール: {run.ruleVersion}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1 font-semibold">
                      <span>SELL {run.counts.SELL || 0}</span>
                      <span>REDUCE {run.counts.REDUCE || 0}</span>
                      <span>BUY {run.counts.BUY || 0}</span>
                      <span>INVALID {run.counts.INVALID_DATA || 0}</span>
                      <span>STALE {run.counts.STALE_DATA || 0}</span>
                      <span>NO_DATA {run.counts.NO_DATA || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {latestHistoryEntries.length > 0 && (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-bold text-slate-900">判定結果の成績評価</h3>
                  <p className="text-xs font-semibold text-slate-500">直近保存回の最大12件を表示。実行記録と結果を分離管理。実行有無・約定価格・株数で遵守状況を計算し、結果価格・配当で判定成績を計算します。</p>
                </div>
                <div className="grid gap-3">
                  {latestHistoryEntries.map((item) => (
                    <div key={`${item.runId}-${item.code}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
                        <div className="lg:col-span-3">
                          <div className="font-bold text-slate-900">{item.code} {item.name}</div>
                          <div className="text-xs font-semibold text-slate-500">判定: {item.decision} / 基準価格: {formatNumber(toNumber(item.inputSnapshot?.currentPrice), 2)}</div>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">実行有無</label>
                          <select value={item.actionTaken ? 'true' : 'false'} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionTaken', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400">
                            <option value="false">未実行</option>
                            <option value="true">実行済み</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">実行種別</label>
                          <select value={item.actionType || ''} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionType', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400">
                            <option value="">未選択</option>
                            <option value="NONE">NONE</option>
                            <option value="BUY">BUY</option>
                            <option value="SELL">SELL</option>
                            <option value="REDUCE">REDUCE</option>
                            <option value="HOLD">HOLD</option>
                          </select>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">実行日</label>
                          <input type="date" value={item.actionDate || ''} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionDate', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">実行価格</label>
                          <input type="number" value={item.actionPrice || ''} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionPrice', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">実行株数</label>
                          <input type="number" value={item.actionShares || ''} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionShares', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2 text-xs font-semibold text-slate-700">
                          <div>遵守: <span className={item.complianceStatus === 'COMPLIANT' ? 'text-emerald-700' : item.complianceStatus === 'CONTRADICTED' ? 'text-red-700' : item.complianceStatus === 'NOT_EXECUTED' ? 'text-amber-700' : 'text-slate-500'}>{item.complianceStatus || '未計算'}</span></div>
                          <div>遅延: {item.executionGapDays ?? '-'}日</div>
                          <div>価格乖離: {formatPercent(item.executionPriceGap)}</div>
                        </div>
                        <div className="lg:col-span-4">
                          <label className="text-[11px] font-bold text-slate-500">実行理由・未実行理由</label>
                          <input value={item.actionReason || ''} onChange={(event) => updateDecisionHistoryAction(item.runId, item.code, 'actionReason', event.target.value)} placeholder="資金不足、約定待ち、判定に従い実行など" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">結果確認日</label>
                          <input type="date" value={item.outcomeDate || ''} onChange={(event) => updateDecisionHistoryOutcome(item.runId, item.code, 'outcomeDate', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">結果価格</label>
                          <input type="number" value={item.outcomePrice || ''} onChange={(event) => updateDecisionHistoryOutcome(item.runId, item.code, 'outcomePrice', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500">受取配当</label>
                          <input type="number" value={item.outcomeDividend || ''} onChange={(event) => updateDecisionHistoryOutcome(item.runId, item.code, 'outcomeDividend', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-400" />
                        </div>
                        <div className="lg:col-span-4 text-xs font-semibold text-slate-700">
                          <div>価格リターン: {formatPercent(item.outcomeReturn)}</div>
                          <div>配当込み: {formatPercent(item.outcomeTotalReturn)}</div>
                          <div>実行金額: {formatNumber(item.actionAmount, 0)}</div>
                          <div className={item.decisionAccuracy === 'SUCCESS' ? 'text-emerald-700' : item.decisionAccuracy === 'FAILURE' ? 'text-red-700' : item.decisionAccuracy === 'MISSED_OPPORTUNITY' ? 'text-amber-700' : 'text-slate-500'}>成績: {item.decisionAccuracy || '未評価'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="評価額合計" value={formatJPY(portfolioSummary.totalMarketValueJPY)} subLabel={`保有 ${portfolioSummary.positionedCount}社 / 評価可能 ${portfolioSummary.valuedCount}社`} />
            <MetricCard label="含み損益" value={formatJPY(portfolioSummary.totalPnlJPY)} subLabel={formatPercent(portfolioSummary.unrealizedPnlRate)} tone={portfolioSummary.totalPnlJPY < 0 ? 'red' : 'emerald'} />
            <MetricCard label="年間配当" value={formatJPY(portfolioSummary.totalAnnualDividendJPY)} subLabel={`総合利回り ${formatPercent(portfolioSummary.portfolioDividendYield)}`} tone="sky" />
            <MetricCard label="未実装銘柄" value={missingCount} subLabel={`実保有想定 ${ACTUAL_HOLDING_COUNT}社 / 登録 ${stocks.length}社`} tone={missingCount > 0 ? 'red' : 'emerald'} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="根拠未確認合計" value={portfolioSummary.unverifiedStocks.length} subLabel="UNVERIFIED_DATA" tone="amber" />
            <MetricCard label="証跡不足合計" value={portfolioSummary.weakEvidenceStocks.length} subLabel="WEAK_EVIDENCE" tone="amber" />
            <MetricCard label="採用値未指定" value={portfolioSummary.multipleEvidenceValueStocks.length} subLabel="MULTIPLE_EVIDENCE_VALUES" tone="amber" />
            <MetricCard label="証跡不一致" value={portfolioSummary.mismatchedEvidenceStocks.length} subLabel="MISMATCHED_EVIDENCE" tone="red" />
            <MetricCard label="照合一致" value={portfolioSummary.evidenceMatchedStocks.length} subLabel="引用値=入力値" tone="emerald" />
            <MetricCard label="照合対象外" value={portfolioSummary.evidenceNotApplicableStocks.length} subLabel="指標未対応/値なし" tone="amber" />
            <MetricCard label="複数数値引用" value={portfolioSummary.multipleNumberEvidenceStocks.length} subLabel="要確認" tone="amber" />
            <MetricCard label="URL不正/未入力" value={portfolioSummary.sourceUrlInvalidStocks.length} subLabel="根拠URL" tone="amber" />
            <MetricCard label="決算期不明" value={portfolioSummary.fiscalPeriodMissingStocks.length} subLabel="対象決算期" tone="amber" />
            <MetricCard label="種別未選択" value={portfolioSummary.dataTypeMissingStocks.length} subLabel="実績/予想" tone="amber" />
            <MetricCard label="期限切れ合計" value={portfolioSummary.staleStocks.length} subLabel="STALE_DATA" tone="amber" />
            <MetricCard label="価格期限切れ" value={portfolioSummary.priceStaleStocks.length} subLabel="7日超または未入力" tone="amber" />
            <MetricCard label="財務期限切れ" value={portfolioSummary.financialStaleStocks.length} subLabel="100日超または未入力" tone="amber" />
            <MetricCard label="為替期限切れ" value={portfolioSummary.fxStaleStocks.length} subLabel="7日超または未入力" tone="amber" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 xl:col-span-2">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">機械判定ルール</h2>
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="font-bold text-red-700 mb-2">SELL</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・減配あり</li><li>・配当性向100%以上</li><li>・営業CF前年比-30%以下</li><li>・EPS前年比-30%以下</li><li>・自己資本比率20%未満</li><li>・有利子負債倍率5倍以上</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-bold text-amber-700 mb-2">REDUCE</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・個別銘柄比率8%以上</li><li>・同一セクター比率25%以上</li><li>・配当性向80%以上</li><li>・営業CF前年比-15%以下</li><li>・含み損-20%以下</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="font-bold text-emerald-700 mb-2">BUY</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・配当性向70%未満</li><li>・営業CF前年比0%以上</li><li>・EPS前年比0%以上</li><li>・自己資本比率30%以上</li><li>・有利子負債倍率3倍未満</li><li>・配当利回り3%以上</li><li>・集中度基準内</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <div className="font-bold text-orange-700 mb-2">STALE_DATA</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・現在価格7日超</li><li>・USD/JPY7日超</li><li>・財務データ100日超</li><li>・更新日未入力</li><li>・期限切れ時は判定停止</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4">
                  <div className="font-bold text-fuchsia-700 mb-2">WEAK_EVIDENCE</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・根拠ページ未入力</li><li>・引用文・該当数値なし</li><li>・引用に数値なし</li><li>・参照指標名なし</li><li>・単位なし</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-pink-200 bg-pink-50 p-4">
                  <div className="font-bold text-pink-700 mb-2">MULTIPLE_EVIDENCE_VALUES</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・引用文に複数数値</li><li>・採用証跡値が未入力</li><li>・採用証跡値が引用内数値と不一致</li><li>・判定停止</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="font-bold text-rose-700 mb-2">MISMATCHED_EVIDENCE</div>
                  <ul className="space-y-1 text-slate-700">
                    <li>・採用証跡値と入力値が不一致</li><li>・許容差を超過</li><li>・不一致時は判定停止</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                入力できるのは数値・事実のみ。判定優先順位は INVALID_DATA → UNVERIFIED_DATA → WEAK_EVIDENCE → MULTIPLE_EVIDENCE_VALUES → MISMATCHED_EVIDENCE → PROFILE_DATA_REQUIRED → STALE_DATA → NO_DATA → SELL → REDUCE → BUY → HOLD → WATCH。SELL/REDUCE/BUYは判定プロファイル別に分岐し、人間による上書きは不可。
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">要対応リスト</h2>
              {portfolioSummary.criticalStocks.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">INVALID_DATA / UNVERIFIED_DATA / WEAK_EVIDENCE / MULTIPLE_EVIDENCE_VALUES / MISMATCHED_EVIDENCE / STALE_DATA / SELL / REDUCE / NO_DATA はありません。</div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                  {portfolioSummary.criticalStocks.slice(0, 20).map((stock) => (
                    <div key={stock.code} className={`rounded-2xl border p-3 ${decisionTone[stock.decisionResult.decision]}`}>
                      <div className="flex justify-between gap-2 text-sm font-bold"><span>{stock.code} {stock.name}</span><span>{stock.decisionResult.decision}</span></div>
                      <div className="mt-1 text-xs">{stock.decisionResult.reasons.slice(0, 2).join(' / ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">セクター別評価額</h2>
              {portfolioSummary.byGroup.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">保有数と現在価格を入力すると集計されます。</div>
              ) : (
                <div className="space-y-3">
                  {portfolioSummary.byGroup.slice(0, 8).map((item) => (
                    <div key={item.group}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{item.group}</span>
                        <span className="text-slate-500">{formatJPY(item.value)} / {formatPercent(item.ratio)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div className="h-3 rounded-full bg-slate-800" style={{ width: `${Math.min(item.ratio, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">市場・通貨比率</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-700">市場別</div>
                  {portfolioSummary.byMarket.length === 0 ? (
                    <div className="text-sm text-slate-500">評価額未入力</div>
                  ) : portfolioSummary.byMarket.map((item) => (
                    <div key={item.label} className="mb-2">
                      <div className="flex justify-between text-xs text-slate-600"><span>{item.label}</span><span>{formatPercent(item.ratio)}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-sky-700" style={{ width: `${Math.min(item.ratio, 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-700">通貨別</div>
                  {portfolioSummary.byCurrency.length === 0 ? (
                    <div className="text-sm text-slate-500">評価額未入力</div>
                  ) : portfolioSummary.byCurrency.map((item) => (
                    <div key={item.label} className="mb-2">
                      <div className="flex justify-between text-xs text-slate-600"><span>{item.label}</span><span>{formatPercent(item.ratio)}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-700" style={{ width: `${Math.min(item.ratio, 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 xl:col-span-2">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">上位保有銘柄</h2>
              {portfolioSummary.topPositions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">保有数と現在価格を入力すると表示されます。</div>
              ) : (
                <div className="space-y-3">
                  {portfolioSummary.topPositions.map((stock) => (
                    <div key={stock.code}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{stock.code} {stock.name}</span>
                        <span className="shrink-0 text-slate-500">{formatJPY(stock.marketValueJPY)} / {formatPercent(stock.ratio)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div className="h-3 rounded-full bg-slate-800" style={{ width: `${Math.min(stock.ratio, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">リスク警告</h2>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="rounded-2xl border border-red-200 bg-red-50 p-3">未実装銘柄: {missingCount}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">UNVERIFIED_DATA: {portfolioSummary.decisionCounts.UNVERIFIED_DATA || 0}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">STALE_DATA: {portfolioSummary.decisionCounts.STALE_DATA || 0}社</li>
                <li className="rounded-2xl border border-red-200 bg-red-50 p-3">SELL: {portfolioSummary.decisionCounts.SELL || 0}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">REDUCE: {portfolioSummary.decisionCounts.REDUCE || 0}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">NO_DATA: {portfolioSummary.decisionCounts.NO_DATA || 0}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">保有中だが評価不能: {portfolioSummary.missingValuationData.length}社</li>
                <li className="rounded-2xl border border-amber-200 bg-amber-50 p-3">含み損銘柄: {portfolioSummary.negativePositions.length}社</li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  最大セクター: {portfolioSummary.largestGroup ? `${portfolioSummary.largestGroup.group} ${formatPercent(portfolioSummary.largestGroup.ratio)}` : '-'}
                </li>
              </ul>
            </div>
          </div>

          {groupedSections.length === 0 && <div className="bg-white border border-slate-200 rounded-3xl p-8 text-slate-500">該当銘柄なし</div>}

          <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">入力イベント監査ログ</h2>
                <p className="text-xs font-semibold text-slate-500">誰がではなく、いつ・どの値を・何から何へ・どの経路で変更したかを保存。localStorageとJSONに保持。</p>
              </div>
              <div className="text-xs font-bold text-slate-500">上限: 20,000件</div>
            </div>
            {auditLog.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">監査ログなし。手入力、CSV取込、JSON復元、履歴のaction/outcome入力で自動記録します。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-3 py-2">変更日時</th>
                      <th className="px-3 py-2">銘柄</th>
                      <th className="px-3 py-2">項目</th>
                      <th className="px-3 py-2">変更前</th>
                      <th className="px-3 py-2">変更後</th>
                      <th className="px-3 py-2">変更元</th>
                      <th className="px-3 py-2">判定変化</th>
                      <th className="px-3 py-2">影響</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLog.slice(0, 20).map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-700">{String(item.changedAt).slice(0, 19).replace('T', ' ')}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">{item.code === 'SYSTEM' ? 'SYSTEM' : `${item.code} ${item.name}`}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-bold text-slate-800">{item.fieldName}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-slate-500">{item.previousValue}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-slate-800">{item.newValue}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{item.changeSource}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{item.decisionBefore || '-'} → {item.decisionAfter || '-'}</td>
                        <td className={`px-3 py-2 whitespace-nowrap font-bold ${item.impactLevel === 'HIGH' ? 'text-red-700' : item.impactLevel === 'MEDIUM' ? 'text-amber-700' : 'text-slate-500'}`}>{item.impactLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {groupedSections.map((section) => (
            <div key={section.title} className="mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">{section.title}</h2>
              <div className="space-y-4">
                {section.groups.map((group) => (
                  <div key={group.category} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-slate-200/70 bg-white/50 backdrop-blur-2xl">
                      <h3 className="text-xl font-semibold text-slate-900">{group.category}</h3>
                    </div>
                    <div className="divide-y divide-slate-100 grid lg:grid-cols-2">
                      {group.items.map((stock) => (
                        <StockCard
                          key={stock.code}
                          stock={stock}
                          holding={holdings[stock.code] || {}}
                          onHoldingChange={onHoldingChange}
                          decisionHistory={stockDecisionHistoryMap.get(stock.code) || []}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[36px] shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">管理上の重大警告</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-red-50 border border-red-200 rounded-[28px] p-6">
                <h3 className="font-semibold text-red-700 mb-3">まだ自動化されていないこと</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>・株価自動取得</li>
                  <li>・配当性向の自動取得</li>
                  <li>・営業CFの自動取得</li>
                  <li>・減配履歴の自動検出</li>
                  <li>・実保有105社との完全照合</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-6">
                <h3 className="font-semibold text-amber-700 mb-3">今回追加したこと</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>・INVALID_DATA / UNVERIFIED_DATA / WEAK_EVIDENCE / MULTIPLE_EVIDENCE_VALUES / MISMATCHED_EVIDENCE / STALE_DATA / BUY / HOLD / WATCH / REDUCE / SELL / NO_DATAの機械判定</li>
                  <li>・入力異常値チェックと異常時の判定停止</li>
                  <li>・UNVERIFIED_DATA判定と根拠未確認時の判定停止</li>
                  <li>・WEAK_EVIDENCE判定と証跡不足時の判定停止</li>
                  <li>・MISMATCHED_EVIDENCE判定と証跡不一致時の判定停止</li>
                  <li>・STALE_DATA判定と期限切れ時の判定停止</li>
                  <li>・価格更新日、財務更新日、USD/JPY更新日の管理</li>
                  <li>・取得元名、根拠URL、対象決算期、データ種別、根拠確認日の管理</li>
                  <li>・根拠ページ、引用文、参照指標名、単位、補足メモの管理</li>
                  <li>・引用文内数値と入力値の一致チェック</li>
                  <li>・人間による判定上書きの排除</li>
                  <li>・配当性向、営業CF前年比、EPS前年比、財務安全性入力</li>
                  <li>・判定理由と重大度表示</li>
                  <li>・INVALID_DATA / STALE_DATA / SELL / REDUCE / NO_DATA件数集計</li>
                  <li>・CSV / JSONへの判定用データ拡張</li>
                  <li>・prebuilt dist配信対応</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
