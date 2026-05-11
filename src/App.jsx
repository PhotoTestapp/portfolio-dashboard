import { useMemo, useState } from 'react'
import { ACTUAL_HOLDING_COUNT, businessMap, buyMap, sections, sellMap, thesisMap } from './data/portfolioData'
import { conditionDefinitions, conditionLabels, normalizeStocks } from './utils/stockUtils'

const marketOrder = ['日本株', '米国株']

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

function StockCard({ stock }) {
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
          <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
            WATCH
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
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <div className="font-semibold text-amber-700 mb-1">未入力の管理項目</div>
          <div className="text-slate-600">保有数・取得単価・現在価格・年間配当は未入力。損益、評価額、配当収入は未計算。</div>
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

  const stocks = useMemo(() => normalizeStocks({ sections, businessMap, thesisMap, buyMap, sellMap }), [])
  const allGroups = useMemo(() => [...new Set(stocks.map((stock) => stock.group))], [stocks])

  const filteredStocks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return stocks.filter((stock) => {
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
  }, [stocks, selectedMarket, selectedGroup, selectedConditions, keyword])

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

  const totalCount = filteredStocks.length
  const jpCount = filteredStocks.filter((stock) => stock.market === '日本株').length
  const usCount = filteredStocks.filter((stock) => stock.market === '米国株').length
  const missingCount = Math.max(ACTUAL_HOLDING_COUNT - stocks.length, 0)

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
                <FilterButton
                  label="日本株"
                  active={selectedMarket === '日本株'}
                  onClick={() => setSelectedMarket(selectedMarket === '日本株' ? 'ALL' : '日本株')}
                />
                <FilterButton
                  label="米国株"
                  active={selectedMarket === '米国株'}
                  onClick={() => setSelectedMarket(selectedMarket === '米国株' ? 'ALL' : '米国株')}
                />
                {conditionDefinitions.map((condition) => (
                  <FilterButton
                    key={condition.key}
                    label={condition.label}
                    active={selectedConditions.includes(condition.key)}
                    onClick={() => toggleCondition(condition.key)}
                    activeClass={condition.activeClass}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="text-sm font-semibold text-slate-700 md:w-24">ジャンル</label>
                <select
                  value={selectedGroup}
                  onChange={(event) => setSelectedGroup(event.target.value)}
                  className="w-full md:max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                >
                  <option value="ALL">すべてのジャンル</option>
                  {allGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">市場: {selectedMarket === 'ALL' ? '全市場' : selectedMarket}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  条件: {selectedConditions.length === 0 ? '指定なし' : selectedConditions.map((key) => conditionLabels[key]).join(' / ')}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">ジャンル: {selectedGroup === 'ALL' ? '全ジャンル' : selectedGroup}</span>
                {keyword && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">検索: {keyword}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">Portfolio Intelligence</h1>
                <p className="text-slate-500 mt-3 text-lg font-medium">Portfolio Decision Dashboard</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
                  <div className="text-sm text-slate-500">表示中銘柄数</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="text-2xl font-bold text-slate-900">{jpCount}</div>
                  <div className="text-sm text-slate-500">日本株</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="text-2xl font-bold text-slate-900">{usCount}</div>
                  <div className="text-sm text-slate-500">米国株</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">登録済み銘柄</div>
                <div className="text-xl font-bold text-slate-900">{stocks.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">実保有想定</div>
                <div className="text-xl font-bold text-slate-900">{ACTUAL_HOLDING_COUNT}</div>
              </div>
              <div className={`rounded-2xl border p-4 ${missingCount > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className={`text-xs ${missingCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>未実装銘柄</div>
                <div className={`text-xl font-bold ${missingCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{missingCount}</div>
              </div>
            </div>
          </div>

          {groupedSections.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-slate-500">該当銘柄なし</div>
          )}

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
                      {group.items.map((stock) => <StockCard key={stock.code} stock={stock} />)}
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
                <h3 className="font-semibold text-red-700 mb-3">現在できないこと</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>・評価額の算出</li>
                  <li>・含み損益の算出</li>
                  <li>・年間配当額の算出</li>
                  <li>・円換算資産額の算出</li>
                  <li>・実保有105社との完全照合</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-[28px] p-6">
                <h3 className="font-semibold text-amber-700 mb-3">次に追加すべき項目</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>・保有株数</li>
                  <li>・取得単価</li>
                  <li>・現在価格</li>
                  <li>・年間配当</li>
                  <li>・USD/JPY</li>
                  <li>・配当性向</li>
                  <li>・営業CF</li>
                  <li>・減配履歴</li>
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
