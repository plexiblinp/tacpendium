# CHANGE-001: DES-005 起き攻めBOOLEAN数の誤記

- 対象: DES-005 §5.6（コンボ詳細）、§5.7（コンボ登録・編集）
- 内容: 「7つのBOOLEAN」と記載されているが、DES-003 のスキーマでは oki_* カラムは6つ。knockdown_advantage は別途数値型。
- 正: 6つのBOOLEAN + knockdown_advantage（数値）
- 発見経緯: M0-01 プロトタイプ作成計画時に DES-003 と突合して発見
