# Portfolio Management Dashboard

GitHub Pages で公開するポートフォリオ管理ダッシュボードです。

## 現在の実装範囲

- 保有数、取得単価、現在価格、年間配当の入力
- 配当性向、営業CF前年比、売上前年比、EPS前年比、自己資本比率、有利子負債倍率、減配有無の入力
- 評価額、含み損益、年間配当、配当利回りの自動計算
- INVALID_DATA / UNVERIFIED_DATA / WEAK_EVIDENCE / MULTIPLE_EVIDENCE_VALUES / MISMATCHED_EVIDENCE / STALE_DATA / BUY / HOLD / WATCH / REDUCE / SELL / NO_DATA の機械判定
- 判定理由と重大度の表示
- 人間による判定上書きの排除
- INVALID_DATA / UNVERIFIED_DATA / WEAK_EVIDENCE / MULTIPLE_EVIDENCE_VALUES / MISMATCHED_EVIDENCE / STALE_DATA / SELL / REDUCE / BUY / HOLD / WATCH / NO_DATA 件数集計
- 要対応銘柄リスト
- CSV出力・CSV取込
- JSONバックアップ保存・JSON復元
- 市場別・通貨別比率
- 上位保有銘柄の集中度表示
- localStorage保存
- 価格更新日、財務更新日、USD/JPY更新日による期限切れ判定
- データ取得元、根拠URL、対象決算期、データ種別、根拠確認日の管理
- 根拠不明データを `UNVERIFIED_DATA` で判定停止
- 証跡不足を `WEAK_EVIDENCE` で判定停止
- 引用文に複数数値がある場合、採用証跡値未指定を `MULTIPLE_EVIDENCE_VALUES` で判定停止
- 採用証跡値と入力値の不一致を `MISMATCHED_EVIDENCE` で判定停止

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
INVALID_DATA → UNVERIFIED_DATA → WEAK_EVIDENCE → MULTIPLE_EVIDENCE_VALUES → MISMATCHED_EVIDENCE → STALE_DATA → NO_DATA → SELL → REDUCE → BUY → HOLD → WATCH
```


### UNVERIFIED_DATA

数値が正常範囲内でも、根拠情報が不足または不正な場合は、売買判定を停止して `UNVERIFIED_DATA` にします。`UNVERIFIED_DATA` は `STALE_DATA` より優先されます。

以下のいずれかに該当する場合に発生します。

- データ取得元が未入力
- 根拠URLが未入力
- 根拠URLが `http://` または `https://` で始まらない
- 対象決算期が未入力
- 対象決算期の形式が不明
- データ種別が未選択
- データ種別が `actual / company_forecast / analyst_forecast` 以外
- 根拠確認日が未入力
- 根拠確認日が未来日

データ種別は以下の固定値です。

| 値 | 意味 |
|---|---|
| `actual` | 実績 |
| `company_forecast` | 会社予想 |
| `analyst_forecast` | アナリスト予想 |

### WEAK_EVIDENCE

根拠URL等が入力されていても、資料内の該当箇所を再確認できない場合は `WEAK_EVIDENCE` にします。

以下のいずれかに該当する場合に発生します。

- 根拠ページが未入力
- 根拠ページが1以上の整数ではない
- 引用文・該当数値が未入力
- 引用文が短すぎる
- 引用文に数値が含まれない
- 参照指標名が未入力
- 単位が未入力

### MULTIPLE_EVIDENCE_VALUES

引用文に複数の数値が含まれる場合、どの数値を採用したかを明示するため `selectedEvidenceValue` を必須にします。

以下のいずれかに該当する場合に発生します。

- 引用文に複数数値があるが、採用証跡値が未入力
- 採用証跡値が引用文内の数値と一致しない

### MISMATCHED_EVIDENCE

採用証跡値と実際の入力値が許容差を超えて不一致の場合は、売買判定を停止して `MISMATCHED_EVIDENCE` にします。

許容差は以下です。

- 比率・前年比: ±0.2
- 倍率: ±0.05
- 株価・配当: ±0.01

### STALE_DATA

以下の期限を超えたデータ、または更新日が未入力のデータがある場合は、売買判定を停止して `STALE_DATA` にします。

- 現在価格: 7日超で期限切れ
- USD/JPY: 7日超で期限切れ
- 財務データ: 100日超で期限切れ

財務データには、配当性向、営業CF前年比、売上前年比、EPS前年比、自己資本比率、有利子負債倍率、減配有無を含みます。

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
code,name,market,group,currency,shares,averagePrice,currentPrice,annualDividend,payoutRatio,operatingCashFlowYoY,revenueYoY,epsYoY,equityRatio,debtToEquity,dividendCut,priceUpdatedAt,financialUpdatedAt,fxUpdatedAt,sourceName,sourceUrl,fiscalPeriod,dataType,confirmedAt,sourcePage,sourceQuote,selectedEvidenceValue,sourceMetricName,sourceUnit,evidenceMemo
2914,日本たばこ産業,日本株,食品・生活,JPY,100,3200,4100,194,65,5,2,8,45,1.8,false,2026-05-11,2026-05-11,,決算短信,https://example.com/ir,FY2025 Q2,actual,2026-05-11,12,"配当性向は65.0%、前年度は62.1%",65.0,配当性向,%,決算短信の配当欄
MSFT,Microsoft,米国株,IT・AI,USD,10,300,430,3.32,35,12,10,15,50,0.6,false,2026-05-11,2026-05-11,2026-05-11,10-K,https://example.com/10k,FY2025 Q2,actual,2026-05-11,48,"EPS growth was 15.0%",,EPS前年比,%,10-KのMD&A
```

`dividendCut` は `true` または `false` で入力します。

## JSONバックアップ

画面上の「JSON保存」で、localStorageに保存された保有データ、USD/JPY、USD/JPY更新日、判定ルールをバックアップできます。
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

株価、配当、為替、財務指標は手動入力です。異常値チェックで許容範囲外データは判定停止し、根拠チェックで出所不明データを停止し、証跡チェックで引用・採用値不明を停止し、鮮度チェックで古いデータも判定停止します。ただし、根拠URLの中身までは自動検証していません。
このアプリは証券売買を自動実行しません。表示された判定はルールベースの管理信号です。

## 業種別ルールプロファイル

今回の版では、全銘柄共通ルールを廃止し、銘柄ごとに `ruleProfile` を持たせています。

| ruleProfile | 対象 | 主な違い |
|---|---|---|
| GENERAL | 一般事業会社 | 配当性向・営業CF・EPS・自己資本比率・負債倍率を標準判定 |
| BANK | 銀行 | 有利子負債倍率・自己資本比率を一般企業基準では判定しない |
| REIT | REIT | 配当性向100%以上・EPS悪化を即SELLにしない |
| UTILITY | 電力・通信・公益 | 負債倍率単独SELLを避け、営業CFを重視 |
| CYCLICAL | 鉄鋼・海運・自動車・航空など | EPS単独悪化を弱め、営業CF・集中度を重視 |
| GROWTH_TECH | IT・AI・成長株 | 配当利回り条件をBUY条件から外し、売上・EPS・営業CFを重視 |
| HEALTHCARE | 医薬・ヘルスケア | EPS単独悪化を弱め、売上・営業CFを重視 |
| FINANCIAL | 証券・リース・金融持株 | 有利子負債倍率を一般企業基準では扱わない |

`ruleProfile` は未入力の場合、業務内容・分類・銘柄コードから自動付与されます。CSV/JSONでは `ruleProfile` 列・項目として保存されます。


## 業種別専用指標

今回の版では `ruleProfile` ごとに専用指標を追加しています。一般財務指標だけでは銀行・REIT・公益・景気敏感・成長IT・ヘルスケア・金融を同じ基準で評価してしまうためです。

| プロファイル | 追加指標 |
|---|---|
| BANK | 銀行自己資本比率、不良債権比率、与信費用率、純金利マージン |
| REIT | LTV、稼働率、NAV倍率、FFO前年比 |
| UTILITY | 設備投資/売上、燃料費前年比 |
| CYCLICAL | 市況指数前年比、在庫前年比、設備稼働率 |
| GROWTH_TECH | FCF前年比、営業利益率、R&D/売上 |
| HEALTHCARE | R&D/売上、パイプライン進捗率 |
| FINANCIAL | 運用資産前年比、金融与信費用率 |

専用指標が不足している場合は `PROFILE_DATA_REQUIRED` で通常判定を停止します。

## 判定履歴ログ / バックテスト用スナップショット

この版では、現在表示されている全銘柄の機械判定を履歴として保存できます。

### 追加機能

- `現在判定を履歴保存` ボタン
- `portfolio-decision-history.csv` 出力
- JSONバックアップへの `decisionHistory` 同梱
- JSON復元時の履歴復元
- 銘柄カード内の過去判定表示
- 判定日時、判定結果、重大度、判定理由、入力値スナップショット、ポートフォリオ比率、証跡スナップショットを保存

### 運用上の注意

履歴保存は自動ではありません。データ更新後、判定結果を固定したいタイミングで `現在判定を履歴保存` を押してください。

### 更新手順

このプロジェクトは prebuilt `dist` 配信方式です。変更後は必ず以下を実行します。

```bash
npm run build
git add .
git commit -m "Add decision history snapshots"
git push
```

## 判定履歴の成績評価

この版では、保存済みの判定履歴に対して結果を入力し、判定成績を評価できます。

### 追加項目

- outcomeDate: 結果確認日
- outcomePrice: 結果確認時の価格
- outcomeDividend: 判定後に受け取った1株あたり配当
- outcomeReturn: 価格リターン
- outcomeTotalReturn: 配当込みリターン
- decisionAccuracy: SUCCESS / FAILURE / NEUTRAL / MISSED_OPPORTUNITY / NOT_APPLICABLE

### 評価ルール

- BUY: 配当込みリターンがプラスならSUCCESS、0以下ならFAILURE
- SELL: 配当込みリターンがマイナスならSUCCESS、0以上ならFAILURE
- REDUCE: 配当込みリターンがマイナスならSUCCESS、0以上ならNEUTRAL
- HOLD: 配当込みリターンが0以上ならSUCCESS、マイナスならFAILURE
- WATCH: 配当込みリターンが0以下ならSUCCESS、プラスならMISSED_OPPORTUNITY

### 運用手順

1. 現在判定を履歴保存する
2. 後日、結果確認日・結果価格・受取配当を入力する
3. SUCCESS率、FAILURE率、機会損失件数を確認する
4. 履歴CSVを出力してルール別成績を検証する


## 判定・実行・結果の三層管理

この版では、判定履歴に実際の売買行動を記録できます。

### 追加項目

- actionTaken: 実行有無
- actionType: BUY / SELL / REDUCE / HOLD / NONE
- actionDate: 実行日
- actionPrice: 実行価格
- actionShares: 実行株数
- actionAmount: 実行金額
- actionReason: 実行理由・未実行理由
- executionGapDays: 判定日から実行日までの日数
- executionPriceGap: 判定時価格と実行価格の乖離率
- complianceStatus: COMPLIANT / NOT_EXECUTED / CONTRADICTED / NON_COMPLIANT / NOT_APPLICABLE

### 目的

- decision: システムが出した判定
- action: 実際の売買行動
- outcome: その後の結果

この3層を分離することで、ルール自体が悪いのか、実行が遅いのか、未実行が原因なのかを切り分けます。

### 更新手順

```bash
cd /Users/haradaseiya/Downloads/portfolio-dashboard
npm run build
git add .
git commit -m "Add decision action tracking"
git push
```

## 追加機能: 入力イベント監査ログ

この版では `auditLog` を追加し、以下の変更を localStorage / JSON / CSV で追跡します。

- 手入力による銘柄データ変更
- CSV取込による一括変更
- JSON復元による上書き
- 判定履歴の action / outcome 入力変更
- 入力削除によるクリア変更

監査ログには以下を保存します。

| 項目 | 内容 |
|---|---|
| changedAt | 変更日時 |
| code / name | 対象銘柄 |
| fieldName | 変更項目 |
| previousValue | 変更前 |
| newValue | 変更後 |
| changeSource | manual / csv_import / json_restore / rule_config |
| decisionBefore | 変更前判定 |
| decisionAfter | 変更後判定または再計算予定 |
| impactLevel | HIGH / MEDIUM / LOW |
| ruleVersion | 変更時点のルール版 |

監査ログは最大20,000件まで保持します。

## データ完全性チェック

この版では、JSONバックアップと復元の信頼性を確認するため、以下を追加しています。

- JSON保存時に `backupIntegrityHash` を生成
- JSON復元時に復元元ハッシュを記録
- `lastBackupAt / lastRestoreAt / restoreSourceHash` を localStorage に保存
- データ完全性スコアを 0〜100 で表示
- 重要項目欠損数、判定履歴件数、監査ログ件数を表示
- JSON復元時の差分を監査ログへ記録
- ハッシュ不一致やハッシュなしのバックアップを警告

### 完全性スコア配点

| 区分 | 配点 |
|---|---:|
| 保有・価格データ | 20 |
| 財務データ | 20 |
| 証跡データ | 20 |
| 更新日データ | 15 |
| 業種別プロファイル | 10 |
| 判定履歴 | 5 |
| 実行・結果データ | 5 |
| 監査ログ | 5 |

### 運用上の注意

JSON保存後は、画面上の `JSON保存Hash` を控えてください。復元後の `JSON復元Hash` と照合することで、どのバックアップから復元したか追跡できます。


## 運用レポート出力

画面上の「運用レポートMD」「運用レポートJSON」から、出力時点の運用状態をファイル化できます。

### Markdownレポート

`portfolio-operation-report-YYYY-MM-DD.md` を出力します。

含まれる内容:

- 評価額、取得額、含み損益、年間配当、配当利回り
- 判定件数、判定停止系合計、要対応銘柄数
- 判定遵守率、未実行、逆行実行、平均実行遅延、平均価格乖離
- 成績評価件数、SUCCESS率、FAILURE率、機会損失件数
- データ完全性スコア、監査ログ件数、JSON保存/復元ハッシュ
- 整合警告、上位保有銘柄、要対応銘柄上位20件

### JSONレポート

`portfolio-operation-report-YYYY-MM-DD.json` を出力します。

機械処理・外部集計・将来のレポート比較用です。

### 注意

レポートは出力時点のlocalStorage、JSON復元状態、判定履歴、監査ログに依存します。株価・配当・財務・実行・結果データの入力が古い、または未入力の場合、レポート結果も不完全になります。

## 運用チェックリスト

この版では、日次・週次・月次・四半期の運用タスクをアプリ内で管理します。

### 追加された確認サイクル

- 日次: 価格・USD/JPY更新、停止判定確認、SELL/REDUCE確認
- 週次: 証跡・監査ログ確認、実行/結果未入力確認、JSONバックアップ保存
- 月次: 運用レポート出力、ルール設定確認、判定履歴保存
- 四半期: 財務データ更新、業種別専用指標棚卸し

### 追加された出力

- `portfolio-operational-checklist.csv`

### 注意

チェックリストの完了状態はlocalStorageに保存されます。別端末へ移す場合はJSONバックアップ/復元を使用してください。

## リスク優先度ランキング

全銘柄を機械的に点数化し、確認順を固定します。

### 主な加点要素

- SELL / REDUCE判定
- INVALID_DATA / UNVERIFIED_DATA / WEAK_EVIDENCE / MULTIPLE_EVIDENCE_VALUES / MISMATCHED_EVIDENCE / PROFILE_DATA_REQUIRED / RULE_CONFIG_REQUIRED / STALE_DATA / NO_DATA
- 個別銘柄比率の過大化
- セクター比率の過大化
- 含み損率の悪化
- 異常値、根拠未確認、証跡不足、証跡不一致
- 直近SELL / REDUCE判定の未実行
- 判定に逆行する実行
- 判定結果の未評価

### 出力

`portfolio-risk-priority.csv` を出力できます。

### 目的

日次確認時に、人間が確認順を選ばないようにするための機能です。最高点の銘柄から処理します。


## リスク重み設定・スコアバージョン管理

リスク優先度ランキングの点数を固定値ではなく、画面上の `riskWeightConfig` で管理します。

### 追加項目

- `riskScoreVersion`
- `riskWeightReviewedAt`
- `riskWeightChangeReason`
- `riskWeightRegime`
- `weights`
- `levels`

### 出力

- `portfolio-risk-weight-config.csv`
- JSONバックアップ内の `riskWeightConfig`

### 注意

重み変更は監査ログへ記録されます。ただし、重みの妥当性はバックテスト結果を使って定期的に見直す必要があります。

## リスク重み成績診断

追加機能:

- 判定履歴の outcome 評価を使い、リスク優先度スコアの重みが過剰・不足していないか診断します。
- `riskDrivers` ごとに発生件数、評価済み件数、SUCCESS率、FAILURE/MISSED_OPPORTUNITY率、平均配当込みリターンを集計します。
- 評価済み履歴が3件以上ある要因だけを重み変更候補にします。
- 失敗・機会損失率が高い要因は `INCREASE`、SUCCESS率が高い要因は `DECREASE`、根拠不足は `NEED_DATA` と表示します。
- 診断結果は `portfolio-risk-weight-diagnostics.csv` として出力できます。
- 「改善候補を適用」ボタンで、推奨重みを `riskWeightConfig` に反映し、auditLogへ変更履歴を記録します。

注意:

- この診断は、保存済みの判定履歴と outcome 入力に依存します。
- outcome未入力が多い場合、`NEED_DATA` が増え、重み変更は抑制されます。
- 重み改善は統計的な自動最適化ではなく、運用成績に基づくルールベースの補正候補です。

## データ入力・評価カバレッジ診断

追加機能:

- 総合カバレッジスコアを表示
- 保有・価格、財務、根拠・証跡、判定プロファイル、業種別専用指標、履歴・実行・結果の区分別カバレッジを表示
- 銘柄ごとの不足項目を抽出
- 次に埋めるべき項目を優先度順に表示
- 結果評価率、実行記録率、チェックリスト完了率を表示
- `portfolio-coverage-diagnostics.csv` を出力
- 運用レポートJSON/Markdownにカバレッジ概要を追加

目的:

判定精度、リスク重み診断、バックテストの前提となる入力不足を可視化し、次に入力すべきデータを人間が選ばずに済むようにする。

## 不足入力テンプレートCSV

カバレッジ診断で検出した不足項目から、入力作業用のCSVテンプレートを出力できます。

出力ファイル:

```txt
portfolio-missing-data-template.csv
```

主な列:

```txt
code,name,market,group,ruleProfile,missingField,missingFieldLabel,requiredReason,inputHint,sourceRequired,currentDecision,riskPriorityScore,coverageScore,impact,priority
```

このCSVは、次に入力すべき項目を銘柄別・優先度順に並べるための作業用テンプレートです。直接インポート用ではなく、根拠資料確認・データ収集・入力作業の指示書として使います。

