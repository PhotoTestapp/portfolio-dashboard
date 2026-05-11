# Portfolio Management Dashboard

GitHub Pages で公開するポートフォリオ管理ダッシュボードです。

## 現在の実装範囲

- 保有数、取得単価、現在価格、年間配当の入力
- 配当性向、営業CF前年比、売上前年比、EPS前年比、自己資本比率、有利子負債倍率、減配有無の入力
- 評価額、含み損益、年間配当、配当利回りの自動計算
- INVALID_DATA / BUY / HOLD / WATCH / REDUCE / SELL / NO_DATA の機械判定
- 判定理由と重大度の表示
- 人間による判定上書きの排除
- INVALID_DATA / SELL / REDUCE / BUY / HOLD / WATCH / NO_DATA 件数集計
- 要対応銘柄リスト
- CSV出力・CSV取込
- JSONバックアップ保存・JSON復元
- 市場別・通貨別比率
- 上位保有銘柄の集中度表示
- localStorage保存

## 機械判定ルール

### INVALID_DATA

以下の異常値がある場合は、売買判定を停止して `INVALID_DATA` にします。`INVALID_DATA` は `NO_DATA` より優先されます。

- 保有数: 0以上、10,000,000以下
- 取得単価: 0超、10,000,000以下
- 現在価格: 0超、10,000,000以下
- 年間配当: 0以上、1,000,000以下
- 配当性向: 0以上、300以下
- 営業CF前年比: -500以上、500以下
- 売上前年比: -500以上、500以下
- EPS前年比: -500以上、500以下
- 自己資本比率: 0以上、100以下
- 有利子負債倍率: 0以上、100以下
- USD/JPY: 50以上、300以下
- 減配有無: true / false / あり / なし のみ

判定優先順位は以下です。

```txt
INVALID_DATA → NO_DATA → SELL → REDUCE → BUY → HOLD → WATCH
```

### NO_DATA

以下の必須データが不足する場合は判断停止します。

- 保有数
- 現在価格
- 年間配当
- 配当性向
- 営業CF前年比
- EPS前年比
- 自己資本比率
- 有利子負債倍率
- 減配有無
- 保有中の場合は取得単価

### SELL

以下のいずれかに該当すれば `SELL` です。

- 減配あり
- 配当性向100%以上
- 営業CF前年比 -30%以下
- EPS前年比 -30%以下
- 自己資本比率20%未満
- 有利子負債倍率5倍以上

### REDUCE

以下のいずれかに該当すれば `REDUCE` です。

- 個別銘柄比率8%以上
- 同一セクター比率25%以上
- 配当性向80%以上
- 営業CF前年比 -15%以下
- 含み損 -20%以下

### BUY

以下をすべて満たす場合のみ `BUY` です。

- 配当性向70%未満
- 営業CF前年比0%以上
- EPS前年比0%以上
- 自己資本比率30%以上
- 有利子負債倍率3倍未満
- 配当利回り3%以上
- 個別銘柄比率5%未満
- 同一セクター比率20%未満
- 減配なし

### HOLD / WATCH

- 保有中で、SELL / REDUCE / BUY / NO_DATA に該当しない場合は `HOLD`
- 非保有で、SELL / REDUCE / BUY / NO_DATA に該当しない場合は `WATCH`

## CSV形式

```csv
code,name,market,group,currency,shares,averagePrice,currentPrice,annualDividend,payoutRatio,operatingCashFlowYoY,revenueYoY,epsYoY,equityRatio,debtToEquity,dividendCut
2914,日本たばこ産業,日本株,食品・生活,JPY,100,3200,4100,194,65,5,2,8,45,1.8,false
MSFT,Microsoft,米国株,IT・AI,USD,10,300,430,3.32,35,12,10,15,50,0.6,false
```

`dividendCut` は `true` または `false` で入力します。

## JSONバックアップ

画面上の「JSON保存」で、localStorageに保存された保有データ、USD/JPY、判定ルールをバックアップできます。
「JSON復元」で別ブラウザ・別PCへ移行できます。

## GitHub Pages更新手順

このリポジトリは prebuilt dist 配信方式です。変更後は必ずローカルでビルドしてからpushします。

```bash
npm run build
git add .
git commit -m "Update app"
git push
```

## 注意

株価、配当、為替、財務指標は手動入力です。今回の異常値チェックで許容範囲外データは判定停止しますが、許容範囲内の誤入力までは検出できません。
このアプリは証券売買を自動実行しません。表示された判定はルールベースの管理信号です。
