export const conditionLabels = {
  HIGH_DIVIDEND: '高配当',
  AI: 'AI',
  DEFENSIVE: 'ディフェンシブ',
  CYCLICAL: '景気敏感',
  RATE_SENSITIVE: '金利敏感',
  FX_SENSITIVE: '為替影響',
  RESOURCE: '資源・素材',
  HEALTHCARE: '医療・ヘルスケア',
  REAL_ESTATE: '不動産・住宅',
  INFRA: 'インフラ',
}

export const conditionDefinitions = [
  { key: 'HIGH_DIVIDEND', label: '高配当', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'AI', label: 'AI', activeClass: 'bg-violet-600 text-white border-violet-600' },
  { key: 'DEFENSIVE', label: 'ディフェンシブ', activeClass: 'bg-sky-600 text-white border-sky-600' },
  { key: 'CYCLICAL', label: '景気敏感', activeClass: 'bg-amber-600 text-white border-amber-600' },
  { key: 'RATE_SENSITIVE', label: '金利敏感', activeClass: 'bg-indigo-600 text-white border-indigo-600' },
  { key: 'FX_SENSITIVE', label: '為替影響', activeClass: 'bg-cyan-600 text-white border-cyan-600' },
  { key: 'RESOURCE', label: '資源・素材', activeClass: 'bg-orange-600 text-white border-orange-600' },
  { key: 'HEALTHCARE', label: '医療・ヘルスケア', activeClass: 'bg-rose-600 text-white border-rose-600' },
  { key: 'REAL_ESTATE', label: '不動産・住宅', activeClass: 'bg-lime-700 text-white border-lime-700' },
  { key: 'INFRA', label: 'インフラ', activeClass: 'bg-blue-700 text-white border-blue-700' },
]

const includesAny = (text, words) => words.some((word) => text.includes(word))

export const getCurrency = (market) => (market === '米国株' ? 'USD' : 'JPY')

export const buildTags = ({ thesis, buyCondition, sellCondition, business }) => {
  const text = `${thesis} ${buyCondition} ${sellCondition} ${business}`
  const tags = []

  if (includesAny(text, ['高配当', '増配', '株主還元', 'DOE'])) tags.push('HIGH_DIVIDEND')
  if (includesAny(text, ['AI', 'クラウド', '半導体', 'データセンター'])) tags.push('AI')
  if (includesAny(text, ['通信', '公益', '医薬', '日用品', '生活必需品', '食品', '電力', 'ガス'])) tags.push('DEFENSIVE')
  if (includesAny(text, ['鉄鋼', '海運', '建設機械', '自動車', '航空', '素材', '景気敏感'])) tags.push('CYCLICAL')
  if (includesAny(text, ['金利', '銀行', 'REIT', 'リース', '不動産'])) tags.push('RATE_SENSITIVE')
  if (includesAny(text, ['円安', '円高', '為替', '海外', '外航', '輸出'])) tags.push('FX_SENSITIVE')
  if (includesAny(text, ['石油', '天然ガス', '非鉄', '銅', '鉄鋼', 'アルミ', '資源'])) tags.push('RESOURCE')
  if (includesAny(text, ['医薬', '医療', 'ワクチン', 'ヘルスケア', 'がん', '免疫'])) tags.push('HEALTHCARE')
  if (includesAny(text, ['不動産', '住宅', 'マンション', 'REIT', '賃貸'])) tags.push('REAL_ESTATE')
  if (includesAny(text, ['通信', '電力', '公益', 'インフラ', '倉庫', '物流'])) tags.push('INFRA')

  return [...new Set(tags)]
}

export const normalizeStocks = ({ sections, businessMap, thesisMap, buyMap, sellMap }) => {
  return sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.map(([code, name]) => {
        const thesis = thesisMap[code] || '高配当・割安性・キャッシュフロー重視'
        const buyCondition = buyMap[code] || '金利低下・暴落局面・高配当株売られ過ぎ'
        const sellCondition = sellMap[code] || '減配・業績悪化・景気敏感株逆風'
        const business = businessMap[code] || '主要業務内容の確認が必要'

        return {
          code,
          name,
          market: section.title,
          group: group.category,
          currency: getCurrency(section.title),
          business,
          thesis,
          buyCondition,
          sellCondition,
          tags: buildTags({ thesis, buyCondition, sellCondition, business }),
          shares: null,
          averagePrice: null,
          currentPrice: null,
          annualDividend: null,
        }
      })
    )
  )
}
