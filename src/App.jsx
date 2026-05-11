import { useEffect, useMemo, useState } from 'react'
import { ACTUAL_HOLDING_COUNT, businessMap, buyMap, sections, sellMap, thesisMap } from './data/portfolioData'
import { conditionDefinitions, conditionLabels, normalizeStocks } from './utils/stockUtils'

const marketOrder = ['日本株', '米国株']
const STORAGE_KEY = 'portfolio-dashboard-holdings-v1'
const SETTINGS_KEY = 'portfolio-dashboard-settings-v1'
const HISTORY_KEY = 'portfolio-dashboard-decision-history-v1'
const DEFAULT_USD_JPY = 155
const DECISION_HISTORY_VERSION = '2026.05-decision-action-v1'

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

const downloadTextFile = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
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
    onHoldingChange(stock.code, {
      ...holding,
      [field]: value,
    })
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
  const setUsdJpyInput = (value) => setSettings((current) => ({ ...current, usdJpy: value }))
  const setFxUpdatedAtInput = (value) => setSettings((current) => ({ ...current, fxUpdatedAt: value }))
  const [holdings, setHoldings] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [importMessage, setImportMessage] = useState('')
  const [decisionHistory, setDecisionHistory] = useState(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_KEY)
      return saved ? sanitizeDecisionHistory(JSON.parse(saved)) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(decisionHistory))
  }, [decisionHistory])

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

  const totalCount = filteredStocks.length
  const jpCount = filteredStocks.filter((stock) => stock.market === '日本株').length
  const usCount = filteredStocks.filter((stock) => stock.market === '米国株').length
  const missingCount = Math.max(ACTUAL_HOLDING_COUNT - stocks.length, 0)

  const onHoldingChange = (code, holding) => {
    setHoldings((current) => ({ ...current, [code]: holding }))
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

      setHoldings(nextHoldings)
      setImportMessage(`CSV取込完了: ${importedCount}件反映 / 未登録コード ${unknownCount}件 / 数値不正 ${invalidCount}件`)
    } catch (error) {
      setImportMessage(`CSV取込失敗: ${error instanceof Error ? error.message : 'ファイルを読み込めませんでした'}`)
    }
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
    const backup = {
      app: 'portfolio-dashboard',
      version: 10,
      exportedAt: new Date().toISOString(),
      usdJpy: usdJpyInput,
      fxUpdatedAt: fxUpdatedAtInput,
      holdings,
      decisionHistory,
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
      },
    }
    downloadTextFile(JSON.stringify(backup, null, 2), 'portfolio-dashboard-backup.json', 'application/json;charset=utf-8;')
  }

  const importJson = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
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

      setHoldings(nextHoldings)
      if (parsed.usdJpy !== undefined && validateNumericValue('usdJpy', parsed.usdJpy, usdJpyRule) === null) {
        setUsdJpyInput(String(parsed.usdJpy))
      }
      if (parsed.fxUpdatedAt !== undefined && validateDateValue('USD/JPY更新日', parsed.fxUpdatedAt) === null) {
        setFxUpdatedAtInput(String(parsed.fxUpdatedAt))
      }
      if (Array.isArray(parsed.decisionHistory)) {
        setDecisionHistory(sanitizeDecisionHistory(parsed.decisionHistory))
      }
      setImportMessage(`JSON取込完了: ${importedCount}件反映 / 未登録コード ${unknownCount}件 / 数値不正 ${invalidCount}件 / 履歴 ${Array.isArray(parsed.decisionHistory) ? parsed.decisionHistory.length : 0}件`)
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
    setDecisionHistory((current) => current.map((item) => {
      if (item.runId !== runId || item.code !== code) return item
      const next = { ...item, [field]: value }
      const calculated = calculateHistoryOutcome(next)
      return {
        ...next,
        outcomeReturn: calculated.outcomeReturn,
        outcomeTotalReturn: calculated.outcomeTotalReturn,
        decisionAccuracy: calculated.decisionAccuracy,
      }
    }))
  }

  const updateDecisionHistoryAction = (runId, code, field, value) => {
    setDecisionHistory((current) => current.map((item) => {
      if (item.runId !== runId || item.code !== code) return item
      const next = { ...item, [field]: field === 'actionTaken' ? value === true || value === 'true' : value }
      const calculated = calculateHistoryAction(next)
      return {
        ...next,
        actionAmount: calculated.actionAmount,
        executionGapDays: calculated.executionGapDays,
        executionPriceGap: calculated.executionPriceGap,
        complianceStatus: calculated.complianceStatus,
      }
    }))
  }

  const clearDecisionHistory = () => {
    if (window.confirm('判定履歴をすべて削除します。実行しますか？')) {
      setDecisionHistory([])
      setImportMessage('判定履歴を削除しました。')
    }
  }

  const clearHoldings = () => {
    if (window.confirm('入力した保有データをすべて削除します。実行しますか？')) {
      setHoldings({})
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-slate-100 text-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(191,219,254,0.4),transparent_70%)]" />
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
                <button type="button" onClick={clearDecisionHistory} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">履歴削除</button>
                <button type="button" onClick={clearHoldings} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100">入力削除</button>
              </div>

              {importMessage && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-800">{importMessage}</div>}

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
