# Portfolio Management Dashboard

GitHub Pages で公開するポートフォリオ管理ダッシュボードです。

## 追加機能

- 保有数、取得単価、現在価格、年間配当の入力
- 評価額、含み損益、年間配当、配当利回りの自動計算
- CSV出力・CSV取込
- JSONバックアップ保存・JSON復元
- 市場別・通貨別比率
- 上位保有銘柄の集中度表示
- localStorage保存

## CSV形式

```csv
code,name,market,group,currency,shares,averagePrice,currentPrice,annualDividend
2914,日本たばこ産業,日本株,食品・生活,JPY,100,3200,4100,194
MSFT,Microsoft,米国株,IT・AI,USD,10,300,430,3.32
```

## JSONバックアップ

画面上の「JSON保存」で、localStorageに保存された保有データとUSD/JPYをバックアップできます。
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

株価、配当、為替は手動入力です。入力値が誤っていれば、評価額・損益・利回りも誤ります。
