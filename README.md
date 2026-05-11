# Portfolio Management Dashboard

React + Vite で作成したポートフォリオ管理ダッシュボードです。

## 主な機能

- 銘柄検索
- 市場別・ジャンル別・条件タグ別フィルター
- 保有数、取得単価、現在価格、年間配当の入力
- USD/JPY の手動換算
- 評価額、取得額、含み損益、年間配当、配当利回りの自動計算
- セクター別評価額集計
- リスク警告表示
- CSV出力
- CSV取込
- localStorage 保存

## CSV取込仕様

CSV出力したファイルをそのまま取り込めます。

必須列:

```csv
code
```

反映対象列:

```csv
shares,averagePrice,currentPrice,annualDividend
```

例:

```csv
code,name,market,group,currency,shares,averagePrice,currentPrice,annualDividend
2914,日本たばこ産業,日本株,食品・生活,JPY,100,3200,4100,194
MSFT,Microsoft,米国株,IT・AI,USD,10,300,430,3.32
```

`code` が既存銘柄と一致する行だけ反映します。未登録コードは無視します。

## ローカル起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## GitHub Pages

`main` ブランチへ push すると GitHub Actions で自動デプロイします。

公開URL例:

```txt
https://phototestapp.github.io/portfolio-dashboard/
```
