# Portfolio Management Dashboard

Vite + React + Tailwind CSS で構成したポートフォリオ管理ダッシュボードです。

## ローカル実行

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run preview
```

## GitHubへアップロード

```bash
git init
git add .
git commit -m "Initial portfolio dashboard"
git branch -M main
git remote add origin https://github.com/<USER>/<REPOSITORY>.git
git push -u origin main
```

## GitHub Pagesで公開する場合

Viteのbase設定が必要になる場合があります。
リポジトリ名が `portfolio-dashboard` の場合、`vite.config.js` を以下のように変更してください。

```js
export default defineConfig({
  base: '/portfolio-dashboard/',
  plugins: [react(), tailwindcss()],
})
```

## 現在の制約

- 株価自動取得なし
- 保有株数・取得単価・現在価格・年間配当は未入力
- 評価額、含み損益、年間配当収入は未計算
- 実保有105社の完全照合には、全保有銘柄データの追加が必要
