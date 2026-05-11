import { useEffect, useMemo, useState } from 'react'
import { ACTUAL_HOLDING_COUNT, businessMap, buyMap, sections, sellMap, thesisMap } from './data/portfolioData'
import { conditionDefinitions, conditionLabels, normalizeStocks } from './utils/stockUtils'

const marketOrder = ['日本株', '米国株']
const STORAGE_KEY = 'portfolio-dashboard-holdings-v1'
const DEFAULT_USD_JPY = 155

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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

const isImportableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return true
  return Number.isFinite(Number(value)) && Number(value) >= 0
}

const normalizeImportNumber = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  return String(value).replace(/,/g, '').trim()
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

function InputCell({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        inputMode="decimal"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
    </label>
  )
}

function StockCard({ stock, holding, onHoldingChange, usdJpy }) {
  const shares = toNumber(holding.shares)
  const averagePrice = toNumber(holding.averagePrice)
  const currentPrice = toNumber(holding.currentPrice)
  const annualDividend = toNumber(holding.annualDividend)
  const fxRate = stock.currency === 'USD' ? usdJpy : 1

  const marketValueJPY = shares !== null && currentPrice !== null ? shares * currentPrice * fxRate : null
  const costJPY = shares !== null && averagePrice !== null ? shares * averagePrice * fxRate : null
  const pnlJPY = marketValueJPY !== null && costJPY !== null ? marketValueJPY - costJPY : null
  const pnlRate = pnlJPY !== null && costJPY > 0 ? (pnlJPY / costJPY) * 100 : null
  const annualDividendJPY = shares !== null && annualDividend !== null ? shares * annualDividend * fxRate : null
  const dividendYield = annualDividend !== null && currentPrice > 0 ? (annualDividend / currentPrice) * 100 : null
  const hasPosition = shares !== null && shares > 0

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
          <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${hasPosition ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            {hasPosition ? 'HOLD' : 'WATCH'}
          </span>
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

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <InputCell label="保有数" value={holding.shares} onChange={(value) => updateField('shares', value)} placeholder="例: 100" />
        <InputCell label={`取得単価(${stock.currency})`} value={holding.averagePrice} onChange={(value) => updateField('averagePrice', value)} placeholder="例: 3200" />
        <InputCell label={`現在価格(${stock.currency})`} value={holding.currentPrice} onChange={(value) => updateField('currentPrice', value)} placeholder="例: 4100" />
        <InputCell label={`年間配当(${stock.currency})`} value={holding.annualDividend} onChange={(value) => updateField('annualDividend', value)} placeholder="例: 194" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">評価額</div>
          <div className="mt-1 font-bold text-slate-900">{formatJPY(marketValueJPY)}</div>
        </div>
        <div className={`rounded-xl border p-3 ${pnlJPY !== null && pnlJPY < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="font-semibold text-slate-500">含み損益</div>
          <div className={`mt-1 font-bold ${pnlJPY !== null && pnlJPY < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatJPY(pnlJPY)}</div>
          <div className="text-[11px] text-slate-500">{formatPercent(pnlRate)}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">年間配当</div>
          <div className="mt-1 font-bold text-slate-900">{formatJPY(annualDividendJPY)}</div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <div className="font-semibold text-slate-500">利回り</div>
          <div className="mt-1 font-bold text-slate-900">{formatPercent(dividendYield)}</div>
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
  const [usdJpyInput, setUsdJpyInput] = useState(String(DEFAULT_USD_JPY))
  const [holdings, setHoldings] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
  }, [holdings])

  const stocks = useMemo(() => normalizeStocks({ sections, businessMap, thesisMap, buyMap, sellMap }), [])
  const allGroups = useMemo(() => [...new Set(stocks.map((stock) => stock.group))], [stocks])
  const usdJpy = toNumber(usdJpyInput) || DEFAULT_USD_JPY

  const enrichedStocks = useMemo(() => {
    return stocks.map((stock) => {
      const holding = holdings[stock.code] || {}
      const shares = toNumber(holding.shares)
      const averagePrice = toNumber(holding.averagePrice)
      const currentPrice = toNumber(holding.currentPrice)
      const annualDividend = toNumber(holding.annualDividend)
      const fxRate = stock.currency === 'USD' ? usdJpy : 1
      const marketValueJPY = shares !== null && currentPrice !== null ? shares * currentPrice * fxRate : null
      const costJPY = shares !== null && averagePrice !== null ? shares * averagePrice * fxRate : null
      const pnlJPY = marketValueJPY !== null && costJPY !== null ? marketValueJPY - costJPY : null
      const annualDividendJPY = shares !== null && annualDividend !== null ? shares * annualDividend * fxRate : null
      const dividendYield = annualDividend !== null && currentPrice > 0 ? (annualDividend / currentPrice) * 100 : null

      return {
        ...stock,
        holding,
        shares,
        marketValueJPY,
        costJPY,
        pnlJPY,
        annualDividendJPY,
        dividendYield,
        hasPosition: shares !== null && shares > 0,
        hasFullValuationData: shares !== null && averagePrice !== null && currentPrice !== null,
      }
    })
  }, [stocks, holdings, usdJpy])

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

    const byMarket = buildDistribution('market')
    const byCurrency = buildDistribution('currency')
    const topPositions = enrichedStocks
      .filter((stock) => stock.marketValueJPY)
      .map((stock) => ({ ...stock, ratio: totalMarketValueJPY > 0 ? (stock.marketValueJPY / totalMarketValueJPY) * 100 : 0 }))
      .sort((a, b) => b.marketValueJPY - a.marketValueJPY)
      .slice(0, 10)

    const largestGroup = byGroup[0]
    const negativePositions = enrichedStocks.filter((stock) => stock.pnlJPY !== null && stock.pnlJPY < 0)
    const missingValuationData = positionedStocks.filter((stock) => !stock.hasFullValuationData)

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
      topPositions,
      largestGroup,
      negativePositions,
      missingValuationData,
    }
  }, [enrichedStocks])

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

        const importedHolding = {
          shares: normalizeImportNumber(getCsvValue(row, ['shares', '保有数'])),
          averagePrice: normalizeImportNumber(getCsvValue(row, ['averagePrice', '取得単価'])),
          currentPrice: normalizeImportNumber(getCsvValue(row, ['currentPrice', '現在価格'])),
          annualDividend: normalizeImportNumber(getCsvValue(row, ['annualDividend', '年間配当'])),
        }

        const values = Object.values(importedHolding)
        const isEmpty = values.every((value) => value === '')
        const isValid = values.every(isImportableNumber)

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
    const header = ['code', 'name', 'market', 'group', 'currency', 'shares', 'averagePrice', 'currentPrice', 'annualDividend', 'marketValueJPY', 'costJPY', 'pnlJPY', 'annualDividendJPY']
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
      stock.marketValueJPY || '',
      stock.costJPY || '',
      stock.pnlJPY || '',
      stock.annualDividendJPY || '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    downloadTextFile(`\uFEFF${csv}`, 'portfolio-dashboard.csv', 'text/csv;charset=utf-8;')
  }

  const exportJson = () => {
    const backup = {
      app: 'portfolio-dashboard',
      version: 2,
      exportedAt: new Date().toISOString(),
      usdJpy: usdJpyInput,
      holdings,
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

        const normalized = {
          shares: normalizeImportNumber(holding?.shares),
          averagePrice: normalizeImportNumber(holding?.averagePrice),
          currentPrice: normalizeImportNumber(holding?.currentPrice),
          annualDividend: normalizeImportNumber(holding?.annualDividend),
        }
        const values = Object.values(normalized)

        if (!values.every(isImportableNumber)) {
          invalidCount += 1
          continue
        }

        if (!values.every((value) => value === '')) {
          nextHoldings[code] = normalized
          importedCount += 1
        }
      }

      setHoldings(nextHoldings)
      if (parsed.usdJpy !== undefined && isImportableNumber(parsed.usdJpy)) {
        setUsdJpyInput(String(parsed.usdJpy))
      }
      setImportMessage(`JSON取込完了: ${importedCount}件反映 / 未登録コード ${unknownCount}件 / 数値不正 ${invalidCount}件`)
    } catch (error) {
      setImportMessage(`JSON取込失敗: ${error instanceof Error ? error.message : 'ファイルを読み込めませんでした'}`)
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
                  placeholder="銘柄コード、企業名、業務内容、タグ、買い条件、売り条件で検索"
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

              <div className="grid gap-3 md:grid-cols-[1fr_180px_repeat(5,140px)] md:items-end">
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <button type="button" onClick={exportCsv} className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                  CSV出力
                </button>
                <label className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
                  CSV取込
                  <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
                </label>
                <button type="button" onClick={exportJson} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  JSON保存
                </button>
                <label className="cursor-pointer rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
                  JSON復元
                  <input type="file" accept=".json,application/json" onChange={importJson} className="hidden" />
                </label>
                <button type="button" onClick={clearHoldings} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                  入力全削除
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">市場: {selectedMarket === 'ALL' ? '全市場' : selectedMarket}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">条件: {selectedConditions.length === 0 ? '指定なし' : selectedConditions.map((key) => conditionLabels[key]).join(' / ')}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">ジャンル: {selectedGroup === 'ALL' ? '全ジャンル' : selectedGroup}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">USD/JPY: {formatNumber(usdJpy, 2)}</span>
                {keyword && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">検索: {keyword}</span>}
              </div>

              {importMessage && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                  {importMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Portfolio Intelligence</h1>
                <p className="text-slate-500 mt-3 text-lg font-medium">Portfolio Decision Dashboard</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <MetricCard label="表示中銘柄数" value={totalCount} />
                <MetricCard label="日本株" value={jpCount} />
                <MetricCard label="米国株" value={usCount} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard label="評価額合計" value={formatJPY(portfolioSummary.totalMarketValueJPY)} tone="sky" />
              <MetricCard label="取得額合計" value={formatJPY(portfolioSummary.totalCostJPY)} />
              <MetricCard label="含み損益" value={formatJPY(portfolioSummary.totalPnlJPY)} subLabel={formatPercent(portfolioSummary.unrealizedPnlRate)} tone={portfolioSummary.totalPnlJPY < 0 ? 'red' : 'emerald'} />
              <MetricCard label="年間配当" value={formatJPY(portfolioSummary.totalAnnualDividendJPY)} subLabel={`利回り ${formatPercent(portfolioSummary.portfolioDividendYield)}`} tone="emerald" />
              <MetricCard label="保有入力済み" value={`${portfolioSummary.positionedCount}社`} subLabel={`評価可能 ${portfolioSummary.valuedCount}社`} />
              <MetricCard label="未実装銘柄" value={`${missingCount}社`} subLabel={`実保有想定 ${ACTUAL_HOLDING_COUNT}社`} tone={missingCount > 0 ? 'red' : 'emerald'} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="bg-white/80 backdrop-blur-3xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 xl:col-span-2">
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
                          usdJpy={usdJpy}
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
                  <li>・保有数、取得単価、現在価格、年間配当の入力</li>
                  <li>・評価額、含み損益、年間配当、利回りの計算</li>
                  <li>・USD/JPY手動換算</li>
                  <li>・セクター別評価額</li>
                  <li>・CSV出力</li>
                  <li>・CSV取込</li>
                  <li>・JSONバックアップ保存</li>
                  <li>・JSONバックアップ復元</li>
                  <li>・市場別・通貨別比率</li>
                  <li>・上位保有銘柄の集中度表示</li>
                  <li>・localStorage保存</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[36px] shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">売買判断マクロ条件</h2>
            <div className="grid xl:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="text-xl font-bold text-emerald-700 mb-4">買い条件</h3>
                <ul className="space-y-3 text-sm text-slate-800 leading-relaxed">
                  <li>・米国長期金利低下</li>
                  <li>・FRB / 日銀の利下げ転換</li>
                  <li>・CPI鈍化</li>
                  <li>・ISM製造業指数回復</li>
                  <li>・景気後退局面での高配当株売られ過ぎ</li>
                  <li>・VIX急騰後の恐怖局面</li>
                  <li>・PBR1倍割れ放置</li>
                  <li>・DOE導入・増配方針発表</li>
                  <li>・資源価格底打ち</li>
                  <li>・円高進行時の米国株買い増し</li>
                  <li>・半導体設備投資サイクル回復</li>
                  <li>・地政学リスク後の過剰下落</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <h3 className="text-xl font-bold text-red-700 mb-4">売り・警戒条件</h3>
                <ul className="space-y-3 text-sm text-slate-800 leading-relaxed">
                  <li>・配当性向急上昇</li>
                  <li>・営業CF悪化</li>
                  <li>・減配発表</li>
                  <li>・政策金利長期高止まり</li>
                  <li>・米国失業率急上昇</li>
                  <li>・景気敏感株の在庫調整局面</li>
                  <li>・海運指数急落</li>
                  <li>・中国不動産不況深刻化</li>
                  <li>・中東・台湾有事による物流混乱</li>
                  <li>・原油価格急騰によるコスト増</li>
                  <li>・円急騰による輸出株逆風</li>
                  <li>・半導体サイクルピークアウト</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
