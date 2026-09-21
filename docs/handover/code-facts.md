# code-facts.md(自動生成 — **手編集禁止**)

生成: 2026-09-20 / commit `d981405` / `scripts/generate-code-facts.sh`

本資料は設計担当(Web 版 Claude)が指示書を書く際の **機械的事実の参照元** です。
retrospective-log.md §1 パターン A/C「実コード確認の省略」を防ぐため、Props・queryKey・
ルート・ハンドラ・config・ナビリンク・Response DTO・リクエスト/入力 DTO・model 構造体(db↔json)・
repository 構造体(scan/filter/input)・マイグレーション(DB スキーマの DDL)を実コードから
決定論的に抽出しています。

## 本資料の限界

- **静的 grep/awk 抽出** のため、以下は取りこぼし・不正確になりうる:
  - コメントアウトされた定義、`// TODO` 等で無効化されたコード
  - 動的生成(map/ループで組むルートや queryKey、スプレッド展開)
  - 型エイリアス・継承(`interface X extends Y`)経由の **間接的な** Props
  - queryKey の**呼び出し側**(どのフックが `queryKeys.combo.detail(id)` を呼ぶか)。§2-2 は
    正本の定義だけを写す。★呼び出し側の当たり判定は `query-keys.invalidation.test.ts` が表で固定している
  - 複数行にわたる複雑な型注釈(関数型の引数等は簡略化されることがある)
  - §2-2 は(ファイル, 用途, キー)が同一の行を重複排除する。同一ファイル内の複数 mutation が
    同じキーを invalidate していても 1 行に集約され、どの mutation かまでは区別しない
  - §7 は型継承を辿らない。Go の埋め込み(embedded struct)フィールドは展開されない
  - §7-2(リクエスト/入力 DTO)の抽出方式と取りこぼし:
    - 7-2-2 は **struct 名のパターン**(`request`/`input`/`params`/`payload` を含む、
      または `body` 終端。大小文字無視)で選別する。`c.Bind` 実引数の型は **追跡しない**
      (struct 定義ベース)。一方 7-2-1 は `var X Type` → `c.Bind(&X)` の宣言追跡で
      ハンドラ↔入力型を解決する(コードベースが一貫して `var req Type` 形のため成立)
    - バインド先型が `internal/api` 外で定義される場合(例 `model.CreateTagInput` /
      `model.UpdateTagInput`)は 7-2-1 マップには現れるが、**構造体定義は §8 を参照**
    - 名前パターンに合致しない入力サブ構造体(例 config の `*UpdateDTO`)は 7-2-2 に
      現れない。トップレベル(`UpdateConfigRequest`)経由で型名は判別可
    - 埋め込み(embedded struct)は展開せず `(embeds X)` 表示(§7 同様)。
      例: `PutRequest` = `version` + `(embeds CreateRequest)`
  - §8 / §9(model / repository 構造体)も同様に Go の埋め込み(embedded struct)は展開しない。
    §9 は **公開構造体のみ**で、lowercase `repository`(`*sql.DB` 保持)と interface は対象外
  - §10(マイグレーション)は `*.up.sql` のみを対象とし、**累積適用後の「現在のスキーマ」は再構成しない**
    (各連番の DDL を時系列で列挙するのみ)。ある列の最新定義は、その列を最後に触った連番を辿ること。
    `CREATE TABLE` の列定義は **`(` が文頭行の末尾にある前提**で抽出する(列が同一行に続く形は非対応)。
    INSERT/UPDATE/DELETE はテーブル単位で要約し、投入される **seed 行の中身は展開しない**。
    SQL 関数呼び出しや CHECK 制約等は行内に現れる範囲でそのまま列に含む(構文解析はしない)
- 本資料は **「コードに存在する事実」のみ** を列挙する。設計意図・あるべき姿・
  「実装すべきか」は判定しない。事実と設計判断は設計担当が突き合わせること。
- 最終的な正は常に実コード。疑わしい場合は本資料ではなくソースを確認すること。

---

## 1. コンポーネント Props(source: `web/src/**/*.tsx`)

| コンポーネント | ファイル | Props(interface 名)| フィールド |
|---|---|---|---|
| ConflictDialog | web/src/components/ConflictDialog.tsx | Props | open: boolean; kind: ConflictKind; resource: ConflictResource; viewTheirsHref: string \| null; onReload: (() => void) \| null; onSaveAsNew: (() => void) \| null; onGoToList: (() => void) \| null; onClose: () => void; |
| FieldRequirementBadge | web/src/components/FieldRequirementBadge.tsx | FieldRequirementBadgeProps | requirement: FieldRequirement; topic: string; className?: string; |
| Header | web/src/components/Header.tsx | HeaderProps | sticky?: boolean; |
| InfoMark | web/src/components/InfoMark.tsx | InfoMarkProps | topic: string; text: string; ariaLabel?: string; className?: string; |
| PreSaveDuplicateDialog | web/src/components/PreSaveDuplicateDialog.tsx | PreSaveDuplicateDialogProps | candidates: DuplicateCandidate[]; kind: "combo" \| "setup"; busy: boolean; restoreFailed?: boolean; onRestore: (id: number) => void; onCreateNew: () => void; onCancel: () => void; |
| AuthGate | web/src/features/auth/AuthGate.tsx | Props | children: ReactNode; |
| LoginScreen | web/src/features/auth/LoginScreen.tsx | Props | expired?: boolean; |
| PasswordChangeForm | web/src/features/auth/PasswordChangeForm.tsx | Props | onCancel: () => void; |
| PasswordField | web/src/features/auth/PasswordField.tsx | Props | label: string; value: string; onChange: (value: string) => void; testIdPrefix: string; autoFocus?: boolean; disabled?: boolean; masked: boolean; onMaskedChange: (masked: boolean) => void; |
| PasswordSetForm | web/src/features/auth/PasswordSetForm.tsx | Props | onDone: () => void; onSkip?: () => void; |
| ExportDialog | web/src/features/combo-io/components/ExportDialog.tsx | Props | open: boolean; onOpenChange: (open: boolean) => void; comboIds: number[]; isSelectionActive: boolean; comboTotalCount: number; |
| ImportCommitConfirmDialog | web/src/features/combo-io/components/ImportCommitConfirmDialog.tsx | Props | open: boolean; targetCount: number; excludedDraftCount: number; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| ComboExportDocument | web/src/features/combo-io/export-layout/ComboExportDocument.tsx | ComboExportDocumentProps | combos: ComboDetail[]; characters: Character[] \| undefined; selected: ReadonlySet<ExportItemKey>; page?: ExportPageRender; |
| AddComboToCompareModal | web/src/features/combo/components/AddComboToCompareModal.tsx | Props | open: boolean; currentIds: number[]; defaultCharacterId?: number; onAdd: (id: number) => void; onOpenChange: (open: boolean) => void; |
| CharacterChangeConfirmDialog | web/src/features/combo/components/CharacterChangeConfirmDialog.tsx | Props | open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; onCancel: () => void; |
| CollapsibleFieldset | web/src/features/combo/components/CollapsibleFieldset.tsx | Props | legend: string; defaultOpen?: boolean; summary?: ReactNode; children: ReactNode; contentClassName?: string; open?: boolean; onOpenChange?: (open: boolean) => void; openLabel?: string; closedLabel?: string; summaryPlacement?: "below" \| "inline"; summaryClassName?: string; className?: string; "data-testid"?: string; |
| ColumnVisibilityMenu | web/src/features/combo/components/ColumnVisibilityMenu.tsx | ColumnVisibilityMenuProps | visibility: ColumnVisibility; onChange: (next: ColumnVisibility) => void; onReset: () => void; |
| ComboDetailHeader | web/src/features/combo/components/ComboDetailHeader.tsx | ComboDetailHeaderProps | combo: ComboDetail; |
| ComboDetailMetadata | web/src/features/combo/components/ComboDetailMetadata.tsx | ComboDetailMetadataProps | combo: ComboDetail; inTrash?: boolean; |
| ComboDetailRecipe | web/src/features/combo/components/ComboDetailRecipe.tsx | ComboDetailRecipeProps | comboId: number; memo?: string; |
| ComboDraftToggleField | web/src/features/combo/components/ComboDraftToggleField.tsx | Props | checked: boolean; onChange: (checked: boolean) => void; inline?: boolean; |
| ComboEditor | web/src/features/combo/components/ComboEditor.tsx | Props | mode: "new" \| "edit" \| "copy"; initial?: ComboDetail; initialCharacterId?: number; |
| ComboEditorBasicFields | web/src/features/combo/components/ComboEditorBasicFields.tsx | Props | value: BasicFieldsValue; customStateDefs: CustomStateDef[]; onChange: (next: BasicFieldsValue) => void; onCreateTag?: (name: string) => Promise<number \| null>; tagCreating?: boolean; hitTypeLockedReason?: string; showDraftToggle?: boolean; onGoToRecipe?: () => void; |
| ComboEditorCharacterField | web/src/features/combo/components/ComboEditorCharacterField.tsx | Props | characterId: number; mode: "new" \| "edit" \| "copy"; onChange: (characterId: number) => void; lockedReason?: string; |
| ComboListFilters | web/src/features/combo/components/ComboListFilters.tsx | ComboListFiltersProps | filters: ComboListFiltersState; onFilterChange: (next: Partial<ComboListFiltersState>) => void; characterId: number; availableTags: Tag[]; visibility: ColumnVisibility; onVisibilityChange: (next: ColumnVisibility) => void; onVisibilityReset: () => void; hasActiveFilters: boolean; onClearFilters: () => void; |
| ComboSortControls | web/src/features/combo/components/ComboSortControls.tsx | ComboSortControlsProps | sort: SortField; order: SortOrder; onSortChange: (next: SortField) => void; onOrderChange: (next: SortOrder) => void; |
| ComboTable | web/src/features/combo/components/ComboTable.tsx | ComboTableProps | combos: ComboSummary[]; onDelete?: (id: number) => void; visibility: ColumnVisibility; onStatusChange?: (comboId: number, combo: ComboSummary, newStatus: string) => void; statusChangingId?: number \| null; hasActiveFilters?: boolean; onClearFilters?: () => void; emptyMessage?: string; newComboHref?: string; isSelectMode?: boolean; selectedIds?: number[]; onToggleSelect?: (id: number) => void; isSelectionAtMax?: boolean; showCopy?: boolean; showGameUpdateColumns?: boolean; onAcknowledge?: (comboId: number) => void; acknowledgingId?: number \| null; acknowledgeFailedId?: number \| null; |
| ComboTableRow | web/src/features/combo/components/ComboTableRow.tsx | ComboTableRowProps | combo: ComboSummary; expanded: boolean; canExpand?: boolean; onToggleExpand: (id: number) => void; onDelete?: (id: number) => void; visibility: ColumnVisibility; onStatusChange?: (comboId: number, combo: ComboSummary, newStatus: string) => void; statusChanging?: boolean; isSelectMode?: boolean; selected?: boolean; onToggleSelect?: (id: number) => void; selectionDisabled?: boolean; showCopy?: boolean; showGameUpdateColumns?: boolean; onAcknowledge?: (comboId: number) => void; acknowledging?: boolean; acknowledgeFailed?: boolean; |
| CompareTable | web/src/features/combo/components/CompareTable.tsx | CompareTableProps | combos: (ComboDetail \| undefined)[]; errors: (Error \| null)[]; loadings: boolean[]; ids: number[]; onRemove: (id: number) => void; |
| CompareTargetList | web/src/features/combo/components/CompareTargetList.tsx | CompareTargetListProps | combos: (ComboDetail \| undefined)[]; errors: (Error \| null)[]; loadings: boolean[]; ids: number[]; onRemove: (id: number) => void; |
| ControllerInputOmissionToggle | web/src/features/combo/components/ControllerInputOmissionToggle.tsx | Props | checked: boolean; onChange: (next: boolean) => void; omittedCount: number; testId?: string; |
| DeleteComboConfirm | web/src/features/combo/components/DeleteComboConfirm.tsx | Props | open: boolean; message: string; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| DisclosureToggleButton | web/src/features/combo/components/DisclosureToggleButton.tsx | Props | open: boolean; onToggle: () => void; label: string; controls?: string; "data-testid"?: string; |
| DuplicateRealtimeWarning | web/src/features/combo/components/DuplicateRealtimeWarning.tsx | Props | duplicates: DuplicateInfo[]; moves: Move[]; draft?: DuplicateDraftValues; |
| DuplicateWarning | web/src/features/combo/components/DuplicateWarning.tsx | Props | open: boolean; issue: ValidationIssue \| null; onOpenChange: (open: boolean) => void; |
| KnockdownAdvantageChangeModal | web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx | Props | open: boolean; linkedSetups: SetupSummary[]; onConfirm: (options: SetupCarryOptionsInput) => void; onOpenChange: (open: boolean) => void; |
| MassPercentInput | web/src/features/combo/components/MassPercentInput.tsx | MassPercentInputProps | mode: "mass" \| "percent"; testIdPrefix: string; value: string; onChange: (massText: string) => void; ariaLabel: string; disabled?: boolean; onBlur?: () => void; |
| ModifierOdVariantFields | web/src/features/combo/components/ModifierOdVariantFields.tsx | Props | flags: string[]; onToggle: (flag: string) => void; move: Move \| null \| undefined; layout: "dialog" \| "inline"; |
| ModifiersEditor | web/src/features/combo/components/ModifiersEditor.tsx | Props | open: boolean; step: Step \| undefined; stepIndex: number \| null; movesById: Map<number, Move>; onSave: (stepIndex: number, newModifiers: Modifiers \| undefined) => void; onOpenChange: (open: boolean) => void; |
| ModifiersSummary | web/src/features/combo/components/ModifiersSummary.tsx | Props | modifiers?: Modifiers \| null; |
| PermanentDeleteConfirm | web/src/features/combo/components/PermanentDeleteConfirm.tsx | Props | open: boolean; count: number; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| PresetSwitcher | web/src/features/combo/components/PresetSwitcher.tsx | PresetSwitcherProps | presets: Preset[]; selectedId: number \| undefined; onChange: (presetId: number) => void; disabled?: boolean; |
| PromoteToFinalButton | web/src/features/combo/components/PromoteToFinalButton.tsx | Props | combo: Combo; onPromoted?: (updatedCombo: Combo) => void; onValidationError?: (result: ValidationResult \| null) => void; |
| PutConfirmDialog | web/src/features/combo/components/PutConfirmDialog.tsx | Props | open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| RecipeBuilder | web/src/features/combo/components/RecipeBuilder.tsx | Props | characterId: number; steps: Step[]; moves: Move[]; movesLoading: boolean; onChange: (next: Step[]) => void; onSave?: () => void; canSave?: boolean; |
| RecipeText | web/src/features/combo/components/RecipeText.tsx | RecipeTextProps | recipe: string \| null \| undefined; fullView: boolean; compactClassName?: string; className?: string; |
| RecipeText | web/src/features/combo/components/RecipeText.tsx | MemoFirstLineProps | memo: string \| null \| undefined; className?: string; |
| RecipeViewToggle | web/src/features/combo/components/RecipeViewToggle.tsx | RecipeViewToggleProps | surfaceDefault: boolean; className?: string; |
| SetupInputRow | web/src/features/combo/components/SetupInputRow.tsx | Props | value: CreateSetupInput; onChange: (value: CreateSetupInput) => void; onRemove: () => void; characterId: number; index: number; moves?: Move[]; |
| SetupRegistrationSection | web/src/features/combo/components/SetupRegistrationSection.tsx | Props | value: CreateSetupInput[]; onChange: (setups: CreateSetupInput[]) => void; characterId: number; knockdownAdvantage: number \| null; linkedSetups: SetupSummary[]; onLinkedSetupsChange: (setups: SetupSummary[]) => void; moves?: Move[]; |
| SetupSelectorModal | web/src/features/combo/components/SetupSelectorModal.tsx | Props | open: boolean; characterId: number; knockdownAdvantage: number \| null; excludeSetupIds: number[]; onSelect: (setup: SetupSummary) => void; onOpenChange: (open: boolean) => void; |
| SetupTreeRow | web/src/features/combo/components/SetupTreeRow.tsx | SetupTreeRowProps | setups: SetupSummary[]; colSpan: number; onSetupClick?: (setupId: number) => void; |
| StepRow | web/src/features/combo/components/StepRow.tsx | Props | step: Step; index: number; total: number; movesById: Map<number, Move>; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void; onEdit: () => void; |
| TrashBulkActions | web/src/features/combo/components/TrashBulkActions.tsx | Props | selectedCombos: ComboSummary[]; selectedSetups: SetupResponse[]; onComplete: () => void; |
| TrashList | web/src/features/combo/components/TrashList.tsx | Props | combos: ComboSummary[]; selectedIds: number[]; onSelectionChange: (ids: number[]) => void; onComboChanged: () => void; |
| TrashListRow | web/src/features/combo/components/TrashListRow.tsx | Props | combo: ComboSummary; selected: boolean; onSelectionChange: (id: number, selected: boolean) => void; onComboChanged: () => void; |
| ValidationDisplay | web/src/features/combo/components/ValidationDisplay.tsx | Props | result?: ValidationResult \| null; fieldLabel?: (field: string) => string; |
| CommonMovePanel | web/src/features/combo/components/VirtualController/CommonMovePanel.tsx | Props | list: Move[]; moves: Move[]; onAdd: (moveId: number) => void; onRawRush: () => void; heldCodes?: ReadonlySet<string>; |
| ControllerButton | web/src/features/combo/components/VirtualController/ControllerButton.tsx | Props | label: string; aria: string; onClick: () => void; disabled?: boolean; active?: boolean; variant?: "default" \| "danger"; tone?: ButtonTone; subLabel?: string; size?: ButtonSize; testId?: string; held?: boolean; |
| DeleteRow | web/src/features/combo/components/VirtualController/DeleteRow.tsx | Props | onDelete: () => void; |
| DirectSpecPanel | web/src/features/combo/components/VirtualController/DirectSpecPanel.tsx | Props | moves: Move[]; list: Move[]; emptyLabel: string; onAdd: (moveId: number) => void; rushOn?: boolean; testIdPrefix?: string; heldCodes?: ReadonlySet<string>; footer?: ReactNode; |
| HitBoxLayout | web/src/features/combo/components/VirtualController/HitBoxLayout.tsx | Props | moves: Move[]; entries: CommandIndexEntries; direction: NumpadDirection; onDirectionChange: (direction: NumpadDirection) => void; rushOn: boolean; onRushToggle: () => void; onAdd: (moveId: number) => void; heldDirection?: NumpadDirection \| null; heldAttacks?: ReadonlySet<string>; |
| RushToggleRow | web/src/features/combo/components/VirtualController/RushToggleRow.tsx | Props | checked: boolean; onToggle: () => void; ariaLabel: string; label: string; hint: string; testId: string; |
| SpecialMovePanel | web/src/features/combo/components/VirtualController/SpecialMovePanel.tsx | Props | moves: Move[]; onAdd: (moveId: number, flags?: string[]) => void; |
| VirtualController | web/src/features/combo/components/VirtualController/VirtualController.tsx | Props | characterId: number; moves: Move[]; context: RecipeInputContext; onStepAdd: (step: StepInput) => void; onStepDelete: () => void; onSave?: () => void; canSave?: boolean; onOpenLastStepModifiers?: () => void; stepCount: number; |
| LanModeConfirmDialog | web/src/features/config/LanModeConfirmDialog.tsx | Props | open: boolean; passwordSet: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| QRCodeModal | web/src/features/config/QRCodeModal.tsx | QRCodeModalProps | url: string; onClose: () => void; |
| SettingsSectionBasic | web/src/features/config/SettingsSectionBasic.tsx | Props | config: ConfigResponse; |
| SettingsSectionData | web/src/features/config/SettingsSectionData.tsx | Props | config: ConfigResponse; |
| SettingsSectionDetails | web/src/features/config/SettingsSectionDetails.tsx | Props | config: ConfigResponse; |
| SettingsSectionNetwork | web/src/features/config/SettingsSectionNetwork.tsx | Props | config: ConfigResponse; openQr?: boolean; |
| GamepadCalibrationDialog | web/src/features/gamepad/components/GamepadCalibrationDialog.tsx | GamepadCalibrationDialogProps | open: boolean; onOpenChange: (open: boolean) => void; status: GamepadConnectionStatus; snapshot: GamepadSnapshot \| null; axesBaseline: readonly number[] \| null; padId: string \| null; browserKey: string; profile: GamepadProfile \| null; source: ProfileSource; onSave: (profile: GamepadProfile) => boolean; onRemove: () => boolean; |
| GamepadInputNotice | web/src/features/gamepad/components/GamepadInputNotice.tsx | Props | collapsedForm?: "label-row" \| "hidden"; |
| GamepadRecipeReadout | web/src/features/gamepad/components/GamepadRecipeReadout.tsx | Props | held: HeldInput; resolved: ReadoutEntry[]; unresolved: ReadoutEntry[]; moves: Move[]; active: boolean; shortcut: ShortcutState; lastAction: PhysicalInputActionResult \| null; commandMode: CommandModeState; commandModeAvailable: boolean; motionReadout: MotionReadoutEntry[]; |
| GamepadStatusBadge | web/src/features/gamepad/components/GamepadStatusBadge.tsx | GamepadStatusBadgeProps | status: GamepadConnectionStatus; padId: string \| null; source: ProfileSource; onOpenCalibration: () => void; |
| GamepadStatusControl | web/src/features/gamepad/components/GamepadStatusControl.tsx | Props | active?: boolean; connected?: boolean; |
| KeyboardBindingDialog | web/src/features/keyboard/components/KeyboardBindingDialog.tsx | KeyboardBindingDialogProps | open: boolean; onOpenChange: (open: boolean) => void; bindings: KeyboardBindings; onSave: (bindings: KeyboardBindings) => boolean; onClear: () => void; onCapturingChange: (capturing: boolean) => void; |
| MoveEditGrid | web/src/features/moves/MoveEditGrid.tsx | MoveEditRowProps | move: Move; characterId: number; rushVariantExists: boolean; |
| MoveEditGrid | web/src/features/moves/MoveEditGrid.tsx | MoveEditGridProps | characterId: number; moves: Move[]; |
| CharacterInfoBar | web/src/features/mycombo/components/CharacterInfoBar.tsx | CharacterInfoBarProps | characterId: number; statusCounts: MyComboStatusCounts; |
| CharacterSelector | web/src/features/mycombo/components/CharacterSelector.tsx | CharacterSelectorProps | selectedCharacterId: number \| null; onChange: (characterId: number) => void; placeholder?: string; ariaLabel?: string; triggerClassName?: string; "data-testid"?: string; |
| MyComboStatusSelect | web/src/features/mycombo/components/MyComboStatusSelect.tsx | MyComboStatusSelectProps | currentStatus: MyComboStatus \| ""; onChange: (newStatus: MyComboStatus \| "") => void; disabled?: boolean; isLoading?: boolean; |
| MyComboStatusTabs | web/src/features/mycombo/components/MyComboStatusTabs.tsx | MyComboStatusTabsProps | selected: MyComboStatus; onSelect: (status: MyComboStatus) => void; counts: MyComboStatusCounts; |
| PresetAliasEditor | web/src/features/preset/components/PresetAliasEditor.tsx | Props | details: PresetAliasDetail[]; edits: Record<number, string>; onChange: (moveId: number, value: string) => void; readOnly?: boolean; |
| PresetCopyDialog | web/src/features/preset/components/PresetCopyDialog.tsx | Props | open: boolean; base: Preset \| null; onOpenChange: (open: boolean) => void; onSubmit: (name: string) => void; isSubmitting?: boolean; errorMessage?: string; |
| PresetDeleteConfirmDialog | web/src/features/preset/components/PresetDeleteConfirmDialog.tsx | Props | open: boolean; preset: Preset \| null; isDefaultPreset?: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; isDeleting?: boolean; |
| PresetListTable | web/src/features/preset/components/PresetListTable.tsx | Props | builtins: Preset[]; customs: Preset[]; sampleCharacterId: number \| undefined; currentPresetId: number \| undefined; limitReached: boolean; onCopy: (base: Preset) => void; onDelete: (preset: Preset) => void; onUse: (preset: Preset) => void; isApplying?: boolean; currentUserId?: number; ownerName?: (userId: number) => string \| undefined; |
| PresetSamplePreview | web/src/features/preset/components/PresetSamplePreview.tsx | Props | presetId: number; characterId: number; |
| PunishAttributionBadge | web/src/features/punish/components/PunishAttributionBadge.tsx | PunishAttributionBadgeProps | side: "opponent" \| "own"; |
| SetplaySuggestionSection | web/src/features/setplay/components/SetplaySuggestionSection.tsx | Props | comboId: number; characterId: number; knockdownAdvantage: number \| null; onAdopted?: () => void; |
| SetplaySuggestionSection | web/src/features/setplay/components/SetplaySuggestionSection.tsx | RowProps | suggestion: SetplaySuggestion; comboId: number; characterId: number; displayName: (moveId: number, code: string) => string; onAdopted: () => void; onReject: () => void; |
| SetplayTargetPicker | web/src/features/setplay/components/SetplayTargetPicker.tsx | Props | characterId: number; value: number \| null; onChange: (moveId: number \| null) => void; |
| SetupAccordionItem | web/src/features/setup/components/SetupAccordionItem.tsx | Props | setup: SetupSummary; onUnlink: (setupId: number) => void; isDeleting?: boolean; onDelete?: (setup: SetupSummary, unlinkAlso: boolean) => void; isSoftDeleting?: boolean; onEdit?: () => void; comboId?: number; onResultsChanged?: () => void; |
| SetupBasicInfoForm | web/src/features/setup/components/SetupBasicInfoForm.tsx | Props | characterId: number; name: string \| null; description: string \| null; onChange: (changes: Partial<{ name: string \| null; description: string \| null }>) => void; |
| SetupCandidateList | web/src/features/setup/components/SetupCandidateList.tsx | Props | parentComboId: number; candidates: SetupSummary[]; |
| SetupRecipeEditor | web/src/features/setup/components/SetupRecipeEditor.tsx | Props | characterId: number; steps: SetupStepInput[]; onChange: (newSteps: SetupStepInput[]) => void; onSave?: () => void; canSave?: boolean; |
| SetupResultEditor | web/src/features/setup/components/SetupResultEditor.tsx | Props | comboId: number; setupId: number; results?: SetupResultCell[]; onChanged: () => void; |
| SetupResultGrid | web/src/features/setup/components/SetupResultGrid.tsx | StateIconProps | state: SetupResultState; |
| SetupResultGrid | web/src/features/setup/components/SetupResultGrid.tsx | Props | results?: SetupResultCell[]; |
| TrashSetupDeleteConfirm | web/src/features/setup/components/TrashSetupDeleteConfirm.tsx | Props | open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; |
| TrashSetupList | web/src/features/setup/components/TrashSetupList.tsx | Props | setups: SetupResponse[]; selectedIds: number[]; onSelectionChange: (ids: number[]) => void; onSetupChanged: () => void; |
| TrashSetupListRow | web/src/features/setup/components/TrashSetupListRow.tsx | Props | setup: SetupResponse; selected: boolean; onSelectionChange: (id: number, selected: boolean) => void; onSetupChanged: () => void; |
| VerifiedConditionsField | web/src/features/setup/components/VerifiedConditionsField.tsx | Props | value: SetupResultCondition[] \| undefined; onChange: (value: SetupResultCondition[]) => void; testIdPrefix: string; fieldsetTestId?: string; variant?: "inline" \| "section"; |
| TagBadgeList | web/src/features/tag/components/TagBadgeList.tsx | TagBadgeListProps | tags: Tag[]; excludeCategories?: string[]; maxVisible?: number; size?: "sm" \| "md"; |
| TagColorPalette | web/src/features/tag/components/TagColorPalette.tsx | Props | value: string; onChange: (hex: string) => void; |
| TagDeleteConfirmDialog | web/src/features/tag/components/TagDeleteConfirmDialog.tsx | Props | open: boolean; tag: Tag \| null; onOpenChange: (open: boolean) => void; onConfirm: () => void; isDeleting?: boolean; |
| TagFormDialog | web/src/features/tag/components/TagFormDialog.tsx | Props | open: boolean; tag?: Tag \| null; onOpenChange: (open: boolean) => void; onSubmit: (values: TagFormSubmitValues) => Promise<void>; |
| TagListTable | web/src/features/tag/components/TagListTable.tsx | Props | tags: Tag[]; onEdit: (tag: Tag) => void; onDelete: (tag: Tag) => void; searchQuery?: string; onClearSearch?: () => void; |
| TagSelector | web/src/features/tag/components/TagSelector.tsx | TagSelectorProps | selectedTagIds: number[]; onChange: (tagIds: number[]) => void; excludeCategories?: string[]; disabled?: boolean; onCreateTag?: (name: string) => Promise<number \| null>; creating?: boolean; |
| CurrentUserProvider | web/src/features/user/CurrentUserProvider.tsx | Props | children: ReactNode; |
| UserSelectScreen | web/src/features/user/UserSelectScreen.tsx | Props | users: User[]; onSelect: (id: number) => void; |
| Step01Welcome | web/src/features/wizard/Step01Welcome.tsx | Props | onNext: () => void; |
| Step02Language | web/src/features/wizard/Step02Language.tsx | Props | onNext: () => void; onPrev: () => void; |
| Step03Character | web/src/features/wizard/Step03Character.tsx | Props | characterId: number; onChange: (id: number) => void; onNext: () => void; onPrev: () => void; onSkip: () => void; |
| Step04Preset | web/src/features/wizard/Step04Preset.tsx | Props | presetId: number; onChange: (id: number) => void; onNext: () => void; onPrev: () => void; |
| Step05Network | web/src/features/wizard/Step05Network.tsx | Props | lanEnabled: boolean; onChange: (enabled: boolean) => void; onNext: () => void; onPrev: () => void; |
| Step06LanInfo | web/src/features/wizard/Step06LanInfo.tsx | Props | network: NetworkInfo; onNext: () => void; onPrev: () => void; |
| Step07Complete | web/src/features/wizard/Step07Complete.tsx | Props | onFinish: () => void; isPending: boolean; |
| Step07Password | web/src/features/wizard/Step07Password.tsx | Props | onNext: () => void; onPrev: () => void; |
| WizardProgress | web/src/features/wizard/WizardProgress.tsx | WizardProgressProps | currentStep: number; totalSteps: number; |

---

## 2. カスタムフック / queryKey(source: `web/src/**/*.ts(x)`)

### 2-1. カスタムフック一覧

| フック | ファイル |
|---|---|
| `useAckDataMigrationNotice` | web/src/features/data-migration/useDataMigrationNotice.ts |
| `useAcknowledgeComboVersion` | web/src/features/game-update/api.ts |
| `useAddCuration` | web/src/features/punish/api.ts |
| `useAddPruning` | web/src/features/punish/api.ts |
| `useAddPunish` | web/src/features/punish/api.ts |
| `useAnyModalOpen` | web/src/lib/modal-presence.ts |
| `useAuthStatus` | web/src/features/auth/useAuthStatus.ts |
| `useCharacterName` | web/src/features/character/hooks/useCharacters.ts |
| `useCharacterSetups` | web/src/features/setup/hooks/useCharacterSetups.ts |
| `useCharacters` | web/src/features/character/hooks/useCharacters.ts |
| `useCheckDuplicate` | web/src/features/combo/hooks/useCheckDuplicate.ts |
| `useClearHiddenSelection` | web/src/features/combo/hooks/useControllerInputOmission.ts |
| `useColumnVisibility` | web/src/features/combo/hooks/useColumnVisibility.ts |
| `useCombo` | web/src/features/combo/api.ts |
| `useComboListFilters` | web/src/features/combo/hooks/useComboListFilters.ts |
| `useComboRecipe` | web/src/features/combo/api.ts |
| `useCombos` | web/src/features/combo/api.ts |
| `useCommandIndex` | web/src/features/moves/api.ts |
| `useCompareCombos` | web/src/features/combo/hooks/useCompareCombos.ts |
| `useConfig` | web/src/features/config/useConfig.ts |
| `useControllerInput` | web/src/features/combo/components/VirtualController/useControllerInput.ts |
| `useControllerInputOmission` | web/src/features/combo/hooks/useControllerInputOmission.ts |
| `useCreateCombo` | web/src/features/combo/api.ts |
| `useCreatePreset` | web/src/features/preset/api.ts |
| `useCreateSetup` | web/src/features/setup/hooks/useCreateSetup.ts |
| `useCreateSetupLink` | web/src/features/setup/hooks/useSetupLinks.ts |
| `useCreateUser` | web/src/features/user/useUsers.ts |
| `useCurrentUser` | web/src/features/user/CurrentUserProvider.tsx |
| `useDataMigrationNotice` | web/src/features/data-migration/useDataMigrationNotice.ts |
| `useDeleteCombo` | web/src/features/combo/api.ts |
| `useDeletePreset` | web/src/features/preset/api.ts |
| `useDeleteSetup` | web/src/features/setup/hooks/useDeleteSetup.ts |
| `useDeleteSetupLink` | web/src/features/setup/hooks/useSetupLinks.ts |
| `useDeleteStarterVerdict` | web/src/features/punish/api.ts |
| `useDeletedCombo` | web/src/features/combo/hooks/useDeletedCombo.ts |
| `useExportCombo` | web/src/features/combo-io/api.ts |
| `useFieldSequence` | web/src/features/combo/useFieldSequence.ts |
| `useFilterPanelCollapsed` | web/src/features/combo/hooks/useFilterPanelCollapsed.ts |
| `useGameUpdateNotice` | web/src/features/game-update/api.ts |
| `useGamepadNoticeOpen` | web/src/features/gamepad/gamepad-notice-storage.ts |
| `useGamepadPolling` | web/src/features/gamepad/useGamepadPolling.ts |
| `useGamepadProfiles` | web/src/features/gamepad/useGamepadProfiles.ts |
| `useGenerateRushVariant` | web/src/features/moves/api.ts |
| `useImportComboCommit` | web/src/features/combo-io/api.ts |
| `useImportComboPreview` | web/src/features/combo-io/api.ts |
| `useIntakeBuildCsv` | web/src/features/intake/api.ts |
| `useIntakeResolve` | web/src/features/intake/api.ts |
| `useInvalidateRecipeCacheConsumers` | web/src/features/preset/api.ts |
| `useIsMobile` | web/src/hooks/useIsMobile.ts |
| `useKeyboardBindings` | web/src/features/keyboard/useKeyboardBindings.ts |
| `useKeyboardInput` | web/src/features/keyboard/useKeyboardInput.ts |
| `useLeaveWithoutConfirm` | web/src/features/navigation-guard/useUnsavedChangesGuard.ts |
| `useListboxKeyNav` | web/src/hooks/useListboxKeyNav.ts |
| `useLogin` | web/src/features/auth/useLogin.ts |
| `useLogout` | web/src/features/auth/useLogout.ts |
| `useMaterialize` | web/src/features/punish/api.ts |
| `useMotionCommands` | web/src/features/moves/api.ts |
| `useMoveDetail` | web/src/features/moves/api.ts |
| `useMovesByCharacter` | web/src/features/moves/api.ts |
| `useMyComboStatusCounts` | web/src/features/mycombo/hooks/useMyComboStatusCounts.ts |
| `useMyComboStatusTags` | web/src/features/mycombo/hooks/useMyComboStatusTags.ts |
| `useNavigationGuardContext` | web/src/features/navigation-guard/NavigationGuardProvider.tsx |
| `usePermanentDelete` | web/src/features/combo/hooks/usePermanentDelete.ts |
| `usePermanentDeleteSetup` | web/src/features/setup/hooks/usePermanentDeleteSetup.ts |
| `usePhysicalInputContext` | web/src/features/physical-input/PhysicalInputProvider.tsx |
| `usePhysicalInputSurfaceId` | web/src/features/physical-input/PhysicalInputProvider.tsx |
| `usePhysicalRecipeInput` | web/src/features/physical-input/usePhysicalRecipeInput.ts |
| `usePostponeGameUpdateNotice` | web/src/features/game-update/api.ts |
| `usePresetAliases` | web/src/features/preset/api.ts |
| `usePresets` | web/src/features/preset/api.ts |
| `usePreviewNames` | web/src/features/combo-io/usePreviewNames.ts |
| `usePunishList` | web/src/features/punish/api.ts |
| `usePunishTree` | web/src/features/punish/api.ts |
| `useRebuildRecipeCache` | web/src/features/preset/api.ts |
| `useRecentCombos` | web/src/hooks/useRecentCombos.ts |
| `useRecipeFullView` | web/src/features/combo/hooks/useRecipeFullView.ts |
| `useRemoveCuration` | web/src/features/punish/api.ts |
| `useRemovePruning` | web/src/features/punish/api.ts |
| `useRemovePunish` | web/src/features/punish/api.ts |
| `useRenameUser` | web/src/features/user/useUsers.ts |
| `useRequestLeave` | web/src/features/navigation-guard/useUnsavedChangesGuard.ts |
| `useResolvedCharacterId` | web/src/features/combo/hooks/useResolvedCharacterId.ts |
| `useRestoreCombo` | web/src/features/combo/hooks/useRestoreCombo.ts |
| `useRestoreSetup` | web/src/features/setup/hooks/useRestoreSetup.ts |
| `useSelectMode` | web/src/features/combo/hooks/useSelectMode.ts |
| `useSessionStorage` | web/src/hooks/useSessionStorage.ts |
| `useSetPassword` | web/src/features/auth/useSetPassword.ts |
| `useSetStarterVerdict` | web/src/features/punish/api.ts |
| `useSetplaySuggestions` | web/src/features/setplay/hooks/useSetplaySuggestions.ts |
| `useSetup` | web/src/features/setup/hooks/useSetup.ts |
| `useSetupAccordionActions` | web/src/features/setup/hooks/useSetupAccordionActions.ts |
| `useSetupCandidates` | web/src/features/setup/hooks/useSetupCandidates.ts |
| `useSetupCandidatesByKnockdown` | web/src/features/setup/hooks/useSetupCandidatesByKnockdown.ts |
| `useSetupResultMutations` | web/src/features/setup/hooks/useSetupResults.ts |
| `useStepDetection` | web/src/features/gamepad/useStepDetection.ts |
| `useTagFormDialog` | web/src/features/tag/hooks/useTagFormDialog.ts |
| `useTagManagement` | web/src/features/tag/hooks/useTagManagement.ts |
| `useTagSelectorForm` | web/src/features/tag/hooks/useTagSelectorForm.ts |
| `useTagsForSelector` | web/src/features/tag/hooks/useTagsForSelector.ts |
| `useTrashCombos` | web/src/features/combo/hooks/useTrashCombos.ts |
| `useTrashSetups` | web/src/features/setup/hooks/useTrashSetups.ts |
| `useUnsavedChangesGuard` | web/src/features/navigation-guard/useUnsavedChangesGuard.ts |
| `useUpdateComboMetadata` | web/src/features/combo/api.ts |
| `useUpdateComboWithKeyChange` | web/src/features/combo/api.ts |
| `useUpdateConfig` | web/src/features/config/useUpdateConfig.ts |
| `useUpdateMove` | web/src/features/moves/api.ts |
| `useUpdateMyComboStatus` | web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts |
| `useUpdatePreset` | web/src/features/preset/api.ts |
| `useUpdateSetup` | web/src/features/setup/hooks/useUpdateSetup.ts |
| `useUsers` | web/src/features/user/useUsers.ts |

### 2-2. queryKey(正本 = `web/src/lib/query-keys.ts` の `queryKeys` ファクトリ)

> **★正本はファクトリである**(`M24-08` / `CO-009` / `CHANGE-148`)。
> 画面・フックの側で配列リテラルを書かない。検査は `query-keys.convention.test.ts`。
> 下表の「返り値」は `as const` の配列そのもの。**前方一致で当たる範囲を読むこと**
> (TanStack の既定は前方一致であり、当たらなくなっても例外は出ず画面が更新されないだけ)。

| キー | 引数 | 返り値 |
|---|---|---|
| `queryKeys.combos.all` | `` | `["combos"]` |
| `queryKeys.combos.list` | `filter: T` | `["combos", filter]` |
| `queryKeys.combos.recent` | `` | `["combos", "recent"]` |
| `queryKeys.combos.trash` | `characterId: number` | `["combos", "trash", characterId]` |
| `queryKeys.combo.all` | `` | `["combo"]` |
| `queryKeys.combo.detail` | `id: number \| string \| null \| undefined` | `["combo", id]` |
| `queryKeys.combo.recipe` | `comboId: number \| string \| undefined, presetId: number \| undefined` | `["combo", comboId, "recipe", presetId]` |
| `queryKeys.combo.deleted` | `id: number \| null \| undefined` | `["combo", "deleted", id]` |
| `queryKeys.combo.duplicateCheck` | `input: T` | `["combo", "duplicate-check", input]` |
| `queryKeys.setups.all` | `` | `["setups"]` |
| `queryKeys.setups.byCharacter` | `characterId: number \| null \| undefined` | `["setups", { characterId }]` |
| `queryKeys.setups.trash` | `characterId: number` | `["setups", "trash", characterId]` |
| `queryKeys.setup.detail` | `id: number \| null \| undefined` | `["setup", { id }]` |
| `queryKeys.setupCandidates.all` | `` | `["setupCandidates"]` |
| `queryKeys.setupCandidates.byCombo` | `comboId: number \| null \| undefined` | `["setupCandidates", comboId]` |
| `queryKeys.setupCandidates.byKnockdown` | `characterId: number \| null \| undefined, knockdownAdvantage: number \| null \| undefined` | `["setupCandidates", { characterId, knockdownAdvantage }]` |
| `queryKeys.setplaySuggestions.all` | `` | `["setplaySuggestions"]` |
| `queryKeys.setplaySuggestions.list` | `comboId: number \| null \| undefined, applied: T` | `["setplaySuggestions", { comboId, applied }]` |
| `queryKeys.tags.all` | `` | `["tags"]` |
| `queryKeys.tags.list` | `includeUsage: boolean` | `["tags", { include_usage: includeUsage }]` |
| `queryKeys.tags.byCategory` | `includeUsage: boolean, category: string` | `["tags", { include_usage: includeUsage, category }]` |
| `queryKeys.tags.statusCounts` | `category: string, characterId: number \| undefined` | `[ "tags", { include_usage: true, category, character_id: characterId }, ]` |
| `queryKeys.presets.all` | `` | `["presets"]` |
| `queryKeys.presets.aliasesRoot` | `presetId: number` | `["presets", presetId, "aliases"]` |
| `queryKeys.presets.aliases` | `presetId: number \| undefined, characterId: number \| undefined, limit: number \| undefined` | `["presets", presetId, "aliases", { characterId, limit }]` |
| `queryKeys.moves.byCharacter` | `characterId: number \| null \| undefined` | `["moves", "by-character", characterId]` |
| `queryKeys.move.detail` | `id: number \| null \| undefined` | `["move", id]` |
| `queryKeys.commandIndex` | `characterId: number \| null \| undefined` | `["command-index", characterId]` |
| `queryKeys.motionCommands` | `characterId: number \| null \| undefined` | `["motion-commands", characterId]` |
| `queryKeys.punishFinder.all` | `` | `["punish-finder"]` |
| `queryKeys.punishFinder.byMatchup` | `selfCharacterId: number \| null, opponentCharacterId: number \| null, guardType: string` | `["punish-finder", selfCharacterId, opponentCharacterId, guardType]` |
| `queryKeys.punishList.all` | `` | `["punish-list"]` |
| `queryKeys.punishList.byMatchup` | `selfCharacterId: number \| null, opponentCharacterId: number \| null, guardType: string` | `["punish-list", selfCharacterId, opponentCharacterId, guardType]` |
| `queryKeys.characters.list` | `gameId: number` | `["characters", { gameId }]` |
| `queryKeys.auth.status` | `` | `["auth", "status"]` |
| `queryKeys.config` | `` | `["config"]` |
| `queryKeys.users` | `` | `["users"]` |
| `queryKeys.notices.dataMigration` | `` | `["notices", "data-migration"]` |
| `queryKeys.notices.gameUpdate` | `` | `["notices", "game-update"]` |

### 2-3. ★正本の外に残っている queryKey 配列リテラル(あってはならない)

> **0 件が正常。** 1 件でも出たら `web/CLAUDE.md` §1.5 の規約違反であり、
> `query-keys.convention.test.ts` が赤になっているはずである。
> 用途列: `query(定義)` = useQuery/useMutation のキー定義、`invalidate` = mutation 成功時に
> 無効化するキー、`invalidate(削除)` = removeQueries。
> ★`const(定義)`(共有キー定数)は `M24-08` の集約で消滅した。出たら残存である。

| ファイル | 用途 | queryKey |
|---|---|---|

---

## 3. ルート(source: `web/src/router.tsx`)

| path | element |
|---|---|
| `/` | HomePage |
| `/combos` | ComboListPage |
| `/combos/new` | ComboEditorPage |
| `/combos/:id/edit` | ComboEditorPage |
| `/combos/:comboId/setups/new` | SetupEditorPage |
| `/combos/:id` | ComboDetailPage |
| `/setups/:setupId` | SetupEditorPage |
| `/trash` | TrashPage |
| `/trash/combos/:id` | TrashComboDetailPage |
| `/tags/manage` | TagManagementPageRoute |
| `/mycombo` | MyComboPageRoute |
| `/compare` | ComparePage |
| `/health` | HealthCheckPage |
| `/wizard` | WizardPage |
| `/settings` | SettingsPage |
| `/moves/edit` | MovesEditGridPage |
| `/import/combo` | ComboImportPage |
| `/import/combo/helper` | IntakeHelperPage |
| `/punish/search` | PunishSearchPage |
| `/punish/list` | PunishListPage |
| `/presets` | PresetListPage |
| `/presets/:id/edit` | PresetEditPage |
| `/game-update/combos` | GameUpdateCombosPage |
| `*` | Navigate ※catch-all |

> 上表に無い path は **router.tsx に未定義**(例: `/presets` は Header にリンクがあるが未実装)。

---

## 4. Go ルート ↔ ハンドラ(source: `internal/api/*/routes.go`, `cmd/tacpendium/main.go`)

| METHOD `/api`+path | ハンドラ | ドメイン |
|---|---|---|
| GET /api/games/:gameId/characters | `character.Handler.List` | character |
| POST /api/combos | `combo.Handler.Create` | combo |
| POST /api/combos/check-duplicate | `combo.Handler.CheckDuplicate` | combo |
| GET /api/combos | `combo.Handler.List` | combo |
| GET /api/combos/:id | `combo.Handler.Get` | combo |
| GET /api/combos/:id/deleted | `combo.Handler.GetDeleted` | combo |
| PATCH /api/combos/:id | `combo.Handler.UpdateMetadata` | combo |
| PUT /api/combos/:id | `combo.Handler.UpdateWithKeyChange` | combo |
| DELETE /api/combos/:id | `combo.Handler.Delete` | combo |
| POST /api/combos/:id/restore | `combo.Handler.Restore` | combo |
| DELETE /api/combos/:id/permanent | `combo.Handler.PermanentDelete` | combo |
| GET /api/combos/:id/recipe | `combo.Handler.GetRecipe` | combo |
| POST /api/combos/:id/materialize | `combo.Handler.Materialize` | combo |
| POST /api/combos/:id/acknowledge-version | `combo.Handler.AcknowledgeGameVersion` | combo |
| GET /api/export/csv | `comboio.Handler.Export` | comboio |
| POST /api/import/csv/preview | `comboio.Handler.Preview` | comboio |
| POST /api/import/csv | `comboio.Handler.Commit` | comboio |
| GET /api/config | `config.Handler.Get` | config |
| PUT /api/config | `config.Handler.Update` | config |
| GET /api/debug/tables | `debug.Handler.ListTables` | debug |
| GET /api/debug/dump/:table | `debug.Handler.DumpTable` | debug |
| GET /api/debug/game-version | `debug.Handler.GetCurrentDataVersion` | debug |
| POST /api/debug/moves/:id/game-version | `debug.Handler.SetMoveGameVersion` | debug |
| POST /api/debug/combos/:id/baseline-version | `debug.Handler.SetComboBaselineVersion` | debug |
| DELETE /api/debug/notices/game-update | `debug.Handler.ClearGameUpdateNotice` | debug |
| GET /api/characters/:characterId/command-index | `inputresolve.Handler.CommandIndex` | inputresolve |
| GET /api/characters/:characterId/motion-commands | `inputresolve.Handler.MotionCommands` | inputresolve |
| POST /api/intake/resolve | `intake.Handler.Resolve` | intake |
| POST /api/intake/csv | `intake.Handler.BuildCSV` | intake |
| GET /api/moves | `move.Handler.List` | move |
| GET /api/moves/:id | `move.Handler.Get` | move |
| PATCH /api/moves/:id | `move.Handler.Update` | move |
| POST /api/moves/:id/rush-variant | `move.Handler.GenerateRushVariant` | move |
| GET /api/notices/data-migration | `notice.Handler.Get` | notice |
| POST /api/notices/data-migration/ack | `notice.Handler.Ack` | notice |
| GET /api/notices/game-update | `notice.Handler.Get` | notice |
| POST /api/notices/game-update/postpone | `notice.Handler.Postpone` | notice |
| GET /api/presets | `preset.Handler.List` | preset |
| GET /api/presets/:id | `preset.Handler.Get` | preset |
| GET /api/presets/:id/aliases | `preset.Handler.ListAliases` | preset |
| POST /api/presets | `preset.Handler.Create` | preset |
| PUT /api/presets/:id | `preset.Handler.Update` | preset |
| DELETE /api/presets/:id | `preset.Handler.Delete` | preset |
| POST /api/presets/:id/recipe-cache/rebuild | `preset.Handler.RebuildRecipeCache` | preset |
| GET /api/punish-finder | `punish.Handler.PunishFinder` | punish |
| GET /api/punish-list | `punish.Handler.PunishList` | punish |
| POST /api/combo-punish-starters | `punish.Handler.CreateStarter` | punish |
| DELETE /api/combo-punish-starters | `punish.Handler.DeleteStarter` | punish |
| POST /api/combo-punishes | `punish.Handler.CreatePunish` | punish |
| DELETE /api/combo-punishes | `punish.Handler.DeletePunish` | punish |
| POST /api/combo-punish-prunings | `punish.Handler.CreatePruning` | punish |
| DELETE /api/combo-punish-prunings | `punish.Handler.DeletePruning` | punish |
| POST /api/combo-punish-curations | `punish.Handler.CreateCuration` | punish |
| DELETE /api/combo-punish-curations | `punish.Handler.DeleteCuration` | punish |
| GET /api/combos/:comboId/setplay-suggestions | `setplay.Handler.GetSuggestions` | setplay |
| POST /api/combos/:comboId/setups | `setup.Handler.CreateSetup` | setup |
| POST /api/combos/:comboId/setups/check-duplicate | `setup.Handler.CheckDuplicate` | setup |
| POST /api/combos/:comboId/setup-links | `setup.Handler.CreateSetupLink` | setup |
| DELETE /api/combos/:comboId/setup-links/:setupId | `setup.Handler.DeleteSetupLink` | setup |
| GET /api/setups | `setup.Handler.ListSetups` | setup |
| GET /api/setups/candidates | `setup.Handler.GetSetupCandidatesByCharacter` | setup |
| GET /api/setups/:id | `setup.Handler.GetSetup` | setup |
| PATCH /api/setups/:id | `setup.Handler.UpdateSetup` | setup |
| DELETE /api/setups/:id | `setup.Handler.DeleteSetup` | setup |
| POST /api/setups/:id/restore | `setup.Handler.Restore` | setup |
| DELETE /api/setups/:id/permanent | `setup.Handler.PermanentDelete` | setup |
| GET /api/combos/:comboId/setup-candidates | `setup.Handler.GetSetupCandidates` | setup |
| PUT /api/combos/:comboId/setups/:setupId/results | `setup.Handler.UpsertSetupResult` | setup |
| DELETE /api/combos/:comboId/setups/:setupId/results | `setup.Handler.DeleteSetupResult` | setup |
| GET /api/tags | `tag.Handler.List` | tag |
| GET /api/tags/:id | `tag.Handler.Get` | tag |
| POST /api/tags | `tag.Handler.Create` | tag |
| PATCH /api/tags/:id | `tag.Handler.Update` | tag |
| DELETE /api/tags/:id | `tag.Handler.Delete` | tag |
| GET /api/users | `user.Handler.List` | user |
| POST /api/users | `user.Handler.Create` | user |
| PATCH /api/users/:id | `user.Handler.Update` | user |
| GET /api/health | `healthapi.Handler` | (main.go 直登録) |

### 4-1. ルート未登録の公開ハンドラ(レイヤ確認用)

> バグ修正時「症状のレイヤ ≠ 真因のレイヤ」(M7-16/18)。ハンドラの実在を確認すること。

- `auth.Handler.Login`(routes.go に未登録)
- `auth.Handler.Logout`(routes.go に未登録)
- `auth.Handler.SetPassword`(routes.go に未登録)
- `auth.Handler.Status`(routes.go に未登録)

---

## 5. config 構造体(source: `internal/config/config.go`)

> TOML セクション = ネスト構造体。設定画面の項目はここに無いフィールドを前提にしないこと(M6-4)。

- **[server]** (`ServerConfig`): Mode string `mode`; Port int `port`
- **[database]** (`DatabaseConfig`): Path string `path`
- **[logging]** (`LoggingConfig`): Level string `level`; File string `file`; MaxSizeMB int `max_size_mb`; MaxBackups int `max_backups`; MaxAgeDays int `max_age_days`
- **[security]** (`SecurityConfig`): PasswordEnabled bool `password_enabled`; PasswordHash string `password_hash`
- **[defaults]** (`DefaultsConfig`): CharacterID int64 `character_id`; PresetID int64 `preset_id`

---

## 6. 共通ナビリンク(source: `web/src/components/Header.tsx`, `Footer.tsx`)

> 画面追加時はナビへのリンク追加漏れに注意(M6-6)。`disabled` は未実装リンク。

| 配置 | to | label / 抜粋 | 状態 |
|---|---|---|---|
| Header | `/combos` | "コンボ一覧" | active |
| Header | `/mycombo` | "マイコンボ" | active |
| Header | `/compare` | "コンボ比較" | active |
| Header | `/punish/search` | "確定反撃サーチ" | active |
| Header | `/punish/list` | "確定反撃マイリスト" | active |
| Header | `/tags/manage` | "タグ管理" | active |
| Header | `/import/combo` | "取込" | active |
| Header | `/import/combo/helper` | "他から引っ越し" | active |
| Header | `/presets` | "プリセット管理" | active |
| Header | `/trash` | "ゴミ箱" | active |
| Header | `/settings` | "設定" | active |
| Footer | `/combos` | t("footer.combos") | active |
| Footer | `/mycombo` | t("footer.myCombos") | active |
| Footer | `/combos/new` | t("footer.newCombo") | active |
| Footer | `/settings` | t("footer.settings") | active |

### 6-1. その他の `<Link to="...">` リテラル(ブランドロゴ等)

- `to="/combos"`

---

## 7. バックエンド Response 構造体(source: `internal/api/**/*.go`)

> これは **API レスポンスの形(フロントが受け取る JSON)**。画面項目の有無ではなく
> DTO フィールドの有無を示す(M4-17)。各エントリは `JSONタグ名 \`Go型\`` 形式。
> `omitempty` 付きはタグ名に含めて表示(値が無いとキー自体が省略されうる)。

- **StatusResponse** (`internal/api/auth/dto.go`): passwordRequired `bool` / passwordSet `bool` / authenticated `bool`
- **CharacterListResponse** (`internal/api/character/handler.go`): items `[]model.Character`
- **ComboResponse** (`internal/api/combo/dto.go`): id `int64` / characterId `int64` / isDraft `bool` / damage,omitempty `*int` / starterMoveId,omitempty `*int64` / position,omitempty `*string` / opponentStance,omitempty `*string` / hitType,omitempty `*string` / opponentSize,omitempty `*string` / starterMeaty `bool` / driveAvailableAtStart,omitempty `*float64` / saAvailableAtStart,omitempty `*int` / driveDamage,omitempty `*float64` / saGaugeConsumed,omitempty `*int` / driveGaugeConsumed,omitempty `*float64` / knockdownAdvantage,omitempty `*int` / okiVerified `bool` / memo,omitempty `*string` / situation,omitempty `*string` / link,omitempty `*string` / videoPath,omitempty `*string` / imagePath,omitempty `*string` / okiOptions `[]OkiOptionDTO` / stepCount `int` / defaultRecipe `string` / starterMoveCode `string` / starterMoveNameJa,omitempty `*string` / version `int` / createdAt `time.Time` / updatedAt `time.Time` / deletedAt,omitempty `*time.Time` / materializedFromComboId,omitempty `*int64` / supersededByComboId,omitempty `*int64` / startPositionMass,omitempty `*int` / carryDistanceMass,omitempty `*int` / baselineVersion,omitempty `*string` / affectedByGameUpdate `bool` / affectedMoves `[]model.AffectedMove` / steps,omitempty `[]StepResponse` / tags `[]model.Tag` / validations,omitempty `*validation.ValidationResult` / setups `[]SetupSummary` / warnings,omitempty `[]validation.ValidationIssue`
- **StepResponse** (`internal/api/combo/dto.go`): id `int64` / stepOrder `int` / moveId,omitempty `*int64` / moveCode,omitempty `*string` / modifiers,omitempty `*model.Modifiers`
- **ListResponse** (`internal/api/combo/dto.go`): items `[]ComboResponse` / count `int` / total `int`
- **RecipeResponse** (`internal/api/combo/dto.go`): comboId `int64` / presetId `int64` / text `string`
- **CheckDuplicateResponse** (`internal/api/combo/dto.go`): duplicates `[]DuplicateInfoResponse` / deletedDuplicates `[]model.ComboRef`
- **DuplicateInfoResponse** (`internal/api/combo/dto.go`): id `int64` / characterId `int64` / starterMoveId `*int64` / position `*string` / opponentStance `*string` / hitType `*string` / opponentSize `*string` / starterMeaty `bool` / stepCount `int` / memo `*string`
- **MaterializeResponse** (`internal/api/combo/dto.go`): comboId `int64` / alreadyExisted `bool` / damageAdded `bool` / damageSkipReason,omitempty `string`
- **previewResponse** (`internal/api/comboio/dto.go`): combos `[]comboPreviewRowDTO` / setups `[]setupPreviewRowDTO` / comboFileError,omitempty `string` / setupFileError,omitempty `string` / summary `previewSummaryDTO`
- **commitResponse** (`internal/api/comboio/dto.go`): results `[]commitRowResultDTO` / summary `commitSummaryDTO`
- **ConfigResponse** (`internal/api/config/dto.go`): server `ServerDTO` / database `DatabaseDTO` / logging `LoggingDTO` / security `SecurityDTO` / network `NetworkDTO` / defaults `DefaultsDTO` / isInitialized `bool` / restartRequired `bool`
- **Response** (`internal/api/health/handler.go`): status `string` / version `string`
- **CommandIndexResponse** (`internal/api/inputresolve/handler.go`): characterId `int64` / entries `map[string]string`
- **MotionCommandsResponse** (`internal/api/inputresolve/handler.go`): characterId `int64` / commands `[]MotionCommandDTO`
- **resolveResponse** (`internal/api/intake/dto.go`): characterCode `string` / movesAvailable `bool` / combos `[]resolvedComboDTO` / summary `resolveSummaryDTO`
- **buildCSVResponse** (`internal/api/intake/dto.go`): csvText `string`
- **MoveResponse** (`internal/api/move/dto.go`): id `int64` / characterId `int64` / code `string` / category `string` / originalMoveId,omitempty `*int64` / startup,omitempty `*int` / active,omitempty `*int` / total,omitempty `*int` / onHit,omitempty `*int` / onBlock,omitempty `*int` / recovery,omitempty `*int` / isAerial `bool` / setupOnly `bool` / isDerived `bool` / nameJa,omitempty `*string` / warnings `[]movewarning.WarningCode`
- **ListResponse** (`internal/api/move/dto.go`): items `[]MoveResponse`
- **MoveDetailResponse** (`internal/api/move/dto.go`): id `int64` / characterId `int64` / code `string` / category `string` / originalMoveId,omitempty `*int64` / startup,omitempty `*int` / active,omitempty `*int` / total,omitempty `*int` / onHit,omitempty `*int` / onBlock,omitempty `*int` / damage,omitempty `*int` / recovery,omitempty `*int` / isAerial `bool` / setupOnly `bool` / rawData,omitempty `*string` / nameJa,omitempty `*string`
- **GameUpdateResponse** (`internal/api/notice/game_update.go`): currentDataVersion `string` / affectedCount `int` / postponedForVersion,omitempty `string`
- **Response** (`internal/api/notice/handler.go`): status `string` / reason,omitempty `string` / message `string` / from,omitempty `string` / to,omitempty `string` / retiredTo,omitempty `string` / retireFailed `bool` / at,omitempty `string` / acknowledged `bool`
- **PresetResponse** (`internal/api/preset/dto.go`): id `int64` / code `string` / name `string` / basePresetCode,omitempty `*string` / isBuiltin `bool` / userId,omitempty `*int64`
- **AliasResponse** (`internal/api/preset/dto.go`): moveId `int64` / moveCode `string` / moveCategory `string` / characterId `int64` / aliasText `string` / aliasTextEn,omitempty `*string` / officialAliasText,omitempty `*string`
- **RecipeCacheRebuildResponse** (`internal/api/preset/dto.go`): presetId `int64`
- **SuggestionsResponse** (`internal/api/setplay/dto.go`): items `[]SuggestionDTO` / truncated `bool` / totalFound `int` / reason,omitempty `string`
- **CheckSetupDuplicateResponse** (`internal/api/setup/dto.go`): duplicates `[]model.SetupRef` / deletedDuplicates `[]model.SetupRef`
- **SetupResponse** (`internal/api/setup/dto.go`): id `int64` / characterId `int64` / name,omitempty `*string` / description,omitempty `*string` / stepCount `int` / version `int` / createdAt `time.Time` / updatedAt `time.Time` / deletedAt,omitempty `*time.Time` / steps,omitempty `[]SetupStepResponse` / defaultRecipe `string` / parentComboIds `[]int64` / validations,omitempty `*validation.ValidationResult` / warnings,omitempty `[]validation.ValidationIssue`
- **SetupStepResponse** (`internal/api/setup/dto.go`): id `int64` / stepOrder `int` / moveId,omitempty `*int64` / moveCode,omitempty `*string` / modifiers,omitempty `*model.Modifiers`
- **SetupCandidatesResponse** (`internal/api/setup/dto.go`): items `[]SetupCandidateSummary`
- **ComboSetupLinkResponse** (`internal/api/setup/dto.go`): comboId `int64` / setupId `int64`
- **SetupListResponse** (`internal/api/setup/handler.go`): items `[]SetupResponse`
- **UserResponse** (`internal/api/user/dto.go`): id `int64` / name `string` / mainCharacterId,omitempty `*int64`

---

## 7-2. API リクエスト/入力 DTO(source: `internal/api/**/*.go`)

> **API が `c.Bind` で受け取る入力の形**(フロント→BE 契約)。§7(Response)の裏面。
> 各エントリは `JSONタグ名 \`Go型\`` 形式。`omitempty` はタグ名に含めて表示。
> 埋め込み(embedded struct)は展開せず `(embeds X)` と表示(フィールドは X 側を参照)。

### 7-2-1. `c.Bind` バインド先(ハンドラ ↔ 入力型)

> `var req Type` → `c.Bind(&req)` の宣言追跡で解決。型が `internal/api` 外
> (例 `model.CreateTagInput`)の場合、定義は §8 を参照。

| ハンドラ | バインド先型 |
|---|---|
| `auth.Handler.Login` | `LoginRequest` |
| `auth.Handler.SetPassword` | `SetPasswordRequest` |
| `combo.Handler.CheckDuplicate` | `CheckDuplicateRequest` |
| `combo.Handler.Create` | `CreateRequest` |
| `combo.Handler.UpdateMetadata` | `UpdateMetadataRequest` |
| `combo.Handler.UpdateWithKeyChange` | `PutRequest` |
| `combo.Handler.Materialize` | `MaterializeRequest` |
| `config.Handler.Update` | `UpdateConfigRequest` |
| `debug.Handler.SetMoveGameVersion` | `setMoveGameVersionRequest` |
| `debug.Handler.SetComboBaselineVersion` | `setComboBaselineRequest` |
| `intake.Handler.Resolve` | `resolveRequest` |
| `intake.Handler.BuildCSV` | `buildCSVRequest` |
| `move.Handler.Update` | `UpdateMoveRequest` |
| `preset.Handler.Create` | `CreatePresetRequest` |
| `preset.Handler.Update` | `UpdatePresetRequest` |
| `punish.Handler.CreateStarter` | `StarterVerdictRequest` |
| `punish.Handler.DeleteStarter` | `StarterVerdictRequest` |
| `punish.Handler.CreatePunish` | `PunishRequest` |
| `punish.Handler.DeletePunish` | `PunishRequest` |
| `punish.Handler.CreateCuration` | `CurationRequest` |
| `punish.Handler.DeleteCuration` | `CurationRequest` |
| `punish.Handler.CreatePruning` | `PruningRequest` |
| `punish.Handler.DeletePruning` | `PruningRequest` |
| `setup.Handler.CheckDuplicate` | `CheckSetupDuplicateRequest` |
| `setup.Handler.CreateSetup` | `CreateSetupRequest` |
| `setup.Handler.CreateSetupLink` | `CreateSetupLinkRequest` |
| `setup.Handler.UpdateSetup` | `UpdateSetupRequest` |
| `setup.Handler.UpsertSetupResult` | `UpsertSetupResultRequest` |
| `tag.Handler.Create` | `model.CreateTagInput` |
| `tag.Handler.Update` | `model.UpdateTagInput` |
| `user.Handler.Create` | `CreateUserRequest` |
| `user.Handler.Update` | `UpdateUserRequest` |

### 7-2-2. リクエスト/入力 DTO 構造体

> 選別: 名前(大小文字無視)に `request`/`input`/`params`/`payload` を含む、または
> `body` 終端の struct。`*Response`(§7)と `Handler`(依存保持)は除外。lowercase も含む。

- **LoginRequest** (`internal/api/auth/dto.go`): password `string`
- **SetPasswordRequest** (`internal/api/auth/dto.go`): currentPassword `string` / newPassword `string`
- **CreateRequest** (`internal/api/combo/dto.go`): characterId `int64` / isDraft `bool` / damage,omitempty `*int` / starterMoveId,omitempty `*int64` / position,omitempty `*string` / opponentStance,omitempty `*string` / startPositionMass,omitempty `*int` / carryDistanceMass,omitempty `*int` / hitType,omitempty `*string` / opponentSize,omitempty `*string` / starterMeaty `bool` / driveAvailableAtStart,omitempty `*float64` / saAvailableAtStart,omitempty `*int` / driveDamage,omitempty `*float64` / saGaugeConsumed,omitempty `*int` / driveGaugeConsumed,omitempty `*float64` / knockdownAdvantage,omitempty `*int` / okiVerified,omitempty `bool` / memo,omitempty `*string` / situation,omitempty `*string` / link,omitempty `*string` / videoPath,omitempty `*string` / imagePath,omitempty `*string` / okiOptions,omitempty `[]OkiOptionDTO` / steps,omitempty `[]StepRequest` / tagIds,omitempty `[]int64` / setups,omitempty `[]BundledSetupRequest` / setupCarryOptions,omitempty `*SetupCarryOptionsRequest`
- **StepRequest** (`internal/api/combo/dto.go`): stepOrder `int` / moveId,omitempty `*int64` / modifiers,omitempty `*model.Modifiers`
- **BundledSetupRequest** (`internal/api/combo/dto.go`): characterId `int64` / name,omitempty `*string` / description,omitempty `*string` / steps `[]BundledSetupStepRequest` / verifiedConditions,omitempty `[]setupapi.SetupResultConditionRequest`
- **BundledSetupStepRequest** (`internal/api/combo/dto.go`): moveId,omitempty `*int64` / modifiers,omitempty `*model.Modifiers`
- **UpdateMetadataRequest** (`internal/api/combo/dto.go`): version `int` / isDraft,omitempty `*bool` / damage `comborepo.Optional[int]` / driveAvailableAtStart `comborepo.Optional[float64]` / saAvailableAtStart `comborepo.Optional[int]` / driveDamage `comborepo.Optional[float64]` / saGaugeConsumed `comborepo.Optional[int]` / driveGaugeConsumed `comborepo.Optional[float64]` / knockdownAdvantage `comborepo.Optional[int]` / startPositionMass `comborepo.Optional[int]` / carryDistanceMass `comborepo.Optional[int]` / okiVerified `comborepo.Optional[bool]` / memo `comborepo.Optional[string]` / situation `comborepo.Optional[string]` / link `comborepo.Optional[string]` / videoPath `comborepo.Optional[string]` / imagePath `comborepo.Optional[string]` / okiOptions `*[]OkiOptionDTO` / tagIds,omitempty `*[]int64` / setupCarryOptions,omitempty `*SetupCarryOptionsRequest`
- **SetupCarryOptionsRequest** (`internal/api/combo/dto.go`): mode `string` / carrySetupIds,omitempty `[]int64`
- **PutRequest** (`internal/api/combo/dto.go`): version `int` / (embeds CreateRequest)
- **CheckDuplicateRequest** (`internal/api/combo/dto.go`): characterId `int64` / starterMoveId,omitempty `*int64` / position,omitempty `*string` / opponentStance,omitempty `*string` / hitType,omitempty `*string` / opponentSize,omitempty `*string` / starterMeaty `bool` / steps `[]StepRequest` / excludeComboId,omitempty `*int64`
- **MaterializeRequest** (`internal/api/combo/dto.go`): opponentMoveId `int64` / note,omitempty `*string`
- **UpdateConfigRequest** (`internal/api/config/dto.go`): server,omitempty `*ServerUpdateDTO` / database,omitempty `*DatabaseUpdateDTO` / logging,omitempty `*LoggingUpdateDTO` / security,omitempty `*SecurityUpdateDTO` / defaults,omitempty `*DefaultsUpdateDTO`
- **setMoveGameVersionRequest** (`internal/api/debug/game_version.go`): lastChangedGameVersion `string`
- **setComboBaselineRequest** (`internal/api/debug/game_version.go`): baselineVersion `string`
- **resolveRequest** (`internal/api/intake/dto.go`): characterCode `string` / text `string`
- **buildCSVRequest** (`internal/api/intake/dto.go`): characterCode `string` / combos `[]buildComboDTO`
- **UpdateMoveRequest** (`internal/api/move/dto.go`): total,omitempty `*int` / startup,omitempty `*int` / active,omitempty `*int` / onHit,omitempty `*int` / onBlock,omitempty `*int` / damage,omitempty `*int` / recovery,omitempty `*int` / isAerial,omitempty `*bool` / rawData,omitempty `*string`
- **CreatePresetRequest** (`internal/api/preset/dto.go`): basePresetCode `string` / name `string`
- **UpdatePresetRequest** (`internal/api/preset/dto.go`): name,omitempty `*string` / aliases,omitempty `[]AliasUpdateRequest`
- **AliasUpdateRequest** (`internal/api/preset/dto.go`): moveId `int64` / aliasText `string`
- **StarterVerdictRequest** (`internal/api/punish/dto.go`): selfCharacterId `int64` / opponentMoveId `int64` / starterMoveId `int64` / verdict `string` / note `*string`
- **PunishRequest** (`internal/api/punish/dto.go`): comboId `int64` / opponentMoveId `int64` / note `*string`
- **PruningRequest** (`internal/api/punish/dto.go`): selfCharacterId `int64` / opponentMoveId `int64` / note `*string`
- **CurationRequest** (`internal/api/punish/dto.go`): comboId `int64` / opponentMoveId `int64` / note `*string`
- **CreateSetupRequest** (`internal/api/setup/dto.go`): characterId `int64` / name,omitempty `*string` / description,omitempty `*string` / steps `[]SetupStepRequest` / verifiedConditions,omitempty `[]SetupResultConditionRequest`
- **SetupResultConditionRequest** (`internal/api/setup/dto.go`): techType `string` / inCorner `bool`
- **UpsertSetupResultRequest** (`internal/api/setup/dto.go`): techType `string` / inCorner `bool` / result `string` / note,omitempty `*string`
- **CheckSetupDuplicateRequest** (`internal/api/setup/dto.go`): characterId `int64` / steps `[]SetupStepRequest`
- **SetupStepRequest** (`internal/api/setup/dto.go`): moveId,omitempty `*int64` / modifiers,omitempty `*model.Modifiers`
- **CreateSetupLinkRequest** (`internal/api/setup/dto.go`): setupId `int64`
- **UpdateSetupRequest** (`internal/api/setup/dto.go`): name,omitempty `*string` / description,omitempty `*string` / steps,omitempty `*[]SetupStepRequest` / version `int`
- **CreateUserRequest** (`internal/api/user/dto.go`): name `string`
- **UpdateUserRequest** (`internal/api/user/dto.go`): name `string`

---

## 8. model 構造体(source: `internal/model/*.go`)

> ドメインモデルの実体。**`db` タグ = DB 列、`json` タグ = API 投影**。
> **`db:-` は DB マップ対象外**(JOIN 取得・サービス層注入・計算フィールド)で、
> repository の scan や GET ハンドラ/サービスの投影の実体を示す(推測投影の防止)。
> 各エントリは `名前 \`Go型\` (db:…, json:…)` 形式。タグ無しは `—`。

- **APIError** (`internal/model/api_error.go`): Code `string` (db:—, json:code) / Message `string` (db:—, json:message) / Details `map[string]any` (db:—, json:details,omitempty)
- **APIErrorResponse** (`internal/model/api_error.go`): Error `APIError` (db:—, json:error)
- **Character** (`internal/model/character.go`): ID `int64` (db:id, json:id) / GameID `int64` (db:game_id, json:gameId) / Code `string` (db:code, json:code) / NameJa `string` (db:name_ja, json:nameJa) / NameEn `string` (db:name_en, json:nameEn) / CustomStates `*string` (db:custom_states, json:customStates,omitempty)
- **Modifiers** (`internal/model/combo.go`): Flags `[]string` (db:—, json:flags,omitempty) / Type `string` (db:—, json:type,omitempty) / Notes `string` (db:—, json:notes,omitempty)
- **ComboStep** (`internal/model/combo.go`): ID `int64` (db:id, json:id) / ComboID `int64` (db:combo_id, json:-) / StepOrder `int` (db:step_order, json:stepOrder) / MoveID `*int64` (db:move_id, json:moveId,omitempty) / MoveCode `*string` (db:-, json:moveCode,omitempty) / Modifiers `*Modifiers` (db:-, json:modifiers,omitempty)
- **OkiOption** (`internal/model/combo.go`): AttackType `string` (db:attack_type, json:attackType) / TechType `string` (db:tech_type, json:techType) / UsesDR `bool` (db:uses_dr, json:usesDr)
- **Combo** (`internal/model/combo.go`): ID `int64` (db:id, json:id) / CharacterID `int64` (db:character_id, json:characterId) / IsDraft `bool` (db:is_draft, json:isDraft) / Damage `*int` (db:damage, json:damage,omitempty) / DriveAvailableAtStart `*float64` (db:drive_available_at_start, json:driveAvailableAtStart,omitempty) / SAAvailableAtStart `*int` (db:sa_available_at_start, json:saAvailableAtStart,omitempty) / DriveDamage `*float64` (db:drive_damage, json:driveDamage,omitempty) / SAGaugeConsumed `*int` (db:sa_gauge_consumed, json:saGaugeConsumed,omitempty) / DriveGaugeConsumed `*float64` (db:drive_gauge_consumed, json:driveGaugeConsumed,omitempty) / StarterMoveID `*int64` (db:starter_move_id, json:starterMoveId,omitempty) / Position `*string` (db:position, json:position,omitempty) / StartPositionMass `*int` (db:start_position_mass, json:startPositionMass,omitempty) / CarryDistanceMass `*int` (db:carry_distance_mass, json:carryDistanceMass,omitempty) / OpponentStance `*string` (db:opponent_stance, json:opponentStance,omitempty) / HitType `*string` (db:hit_type, json:hitType,omitempty) / OpponentSize `*string` (db:opponent_size, json:opponentSize,omitempty) / StarterMeaty `bool` (db:starter_meaty, json:starterMeaty) / Situation `*string` (db:situation, json:situation,omitempty) / KnockdownAdvantage `*int` (db:knockdown_advantage, json:knockdownAdvantage,omitempty) / OkiVerified `bool` (db:oki_verified, json:okiVerified) / Memo `*string` (db:memo, json:memo,omitempty) / Link `*string` (db:link, json:link,omitempty) / VideoPath `*string` (db:video_path, json:videoPath,omitempty) / ImagePath `*string` (db:image_path, json:imagePath,omitempty) / StepCount `int` (db:step_count, json:stepCount) / RecipeCache `*string` (db:recipe_cache, json:-) / Version `int` (db:version, json:version) / CreatedAt `time.Time` (db:created_at, json:createdAt) / UpdatedAt `time.Time` (db:updated_at, json:updatedAt) / DeletedAt `*time.Time` (db:deleted_at, json:-) / MaterializedFromComboID `*int64` (db:materialized_from_combo_id, json:materializedFromComboId,omitempty) / SupersededByComboID `*int64` (db:superseded_by_combo_id, json:supersededByComboId,omitempty) / BaselineVersion `*string` (db:baseline_version, json:baselineVersion,omitempty) / AffectedByGameUpdate `bool` (db:affected_by_game_update, json:affectedByGameUpdate) / AffectedMoves `[]AffectedMove` (db:-, json:-) / Steps `[]ComboStep` (db:-, json:steps,omitempty) / Tags `[]Tag` (db:-, json:-) / OkiOptions `[]OkiOption` (db:-, json:okiOptions,omitempty) / DefaultRecipe `string` (db:-, json:-) / StarterMoveCode `*string` (db:-, json:-) / StarterMoveNameJa `*string` (db:-, json:-)
- **AffectedMove** (`internal/model/combo.go`): MoveID `int64` (db:—, json:moveId) / Code `string` (db:—, json:code) / NameJa `*string` (db:—, json:nameJa,omitempty) / LastChangedGameVersion `string` (db:—, json:lastChangedGameVersion)
- **Game** (`internal/model/game.go`): ID `int64` (db:id, json:id) / Code `string` (db:code, json:code) / NameJa `string` (db:name_ja, json:nameJa) / NameEn `string` (db:name_en, json:nameEn) / CurrentDataVersion `string` (db:current_data_version, json:currentDataVersion)
- **Move** (`internal/model/move.go`): ID `int64` (db:id, json:id) / CharacterID `int64` (db:character_id, json:characterId) / Code `string` (db:code, json:code) / Category `string` (db:category, json:category) / OriginalMoveID `*int64` (db:original_move_id, json:originalMoveId,omitempty) / Startup `*int` (db:startup, json:startup,omitempty) / Active `*int` (db:active, json:active,omitempty) / Total `*int` (db:total, json:total,omitempty) / OnHit `*int` (db:on_hit, json:onHit,omitempty) / OnBlock `*int` (db:on_block, json:onBlock,omitempty) / Damage `*int` (db:damage, json:damage,omitempty) / Recovery `*int` (db:recovery, json:recovery,omitempty) / IsAerial `bool` (db:is_aerial, json:isAerial) / SetupOnly `bool` (db:setup_only, json:setupOnly) / IsDerived `bool` (db:is_derived, json:isDerived) / RawData `*string` (db:raw_data, json:rawData,omitempty) / LastChangedGameVersion `*string` (db:last_changed_game_version, json:lastChangedGameVersion,omitempty)
- **PositionBand** (`internal/model/position.go`): Code `string` / MinMass `int` / MaxMass `int` / RepresentativeMass `int`
- **Preset** (`internal/model/preset.go`): ID `int64` (db:id, json:id) / UserID `*int64` (db:user_id, json:userId,omitempty) / Code `string` (db:code, json:code) / Name `string` (db:name, json:name) / BasePresetCode `*string` (db:base_preset_code, json:basePresetCode,omitempty) / IsBuiltin `bool` (db:is_builtin, json:isBuiltin)
- **PresetAlias** (`internal/model/preset.go`): ID `int64` (db:id, json:id) / PresetID `int64` (db:preset_id, json:presetId) / MoveID `int64` (db:move_id, json:moveId) / AliasText `string` (db:alias_text, json:aliasText)
- **PresetAliasDetail** (`internal/model/preset.go`): MoveID `int64` (db:—, json:moveId) / MoveCode `string` (db:—, json:moveCode) / MoveCategory `string` (db:—, json:moveCategory) / CharacterID `int64` (db:—, json:characterId) / AliasText `string` (db:—, json:aliasText) / AliasTextEn `*string` (db:—, json:aliasTextEn,omitempty) / OfficialAliasText `*string` (db:—, json:officialAliasText,omitempty)
- **AliasEntry** (`internal/model/preset.go`): MoveCode `string` / AliasText `string` / AliasTextEn `*string`
- **SetupStep** (`internal/model/setup.go`): ID `int64` (db:id, json:id) / SetupID `int64` (db:setup_id, json:-) / StepOrder `int` (db:step_order, json:stepOrder) / MoveID `*int64` (db:move_id, json:moveId,omitempty) / MoveCode `*string` (db:-, json:moveCode,omitempty) / Modifiers `*Modifiers` (db:-, json:modifiers,omitempty)
- **Setup** (`internal/model/setup.go`): ID `int64` (db:id, json:id) / CharacterID `int64` (db:character_id, json:characterId) / Name `*string` (db:name, json:name,omitempty) / Description `*string` (db:description, json:description,omitempty) / StepCount `int` (db:step_count, json:stepCount) / RecipeCache `*string` (db:recipe_cache, json:-) / Version `int` (db:version, json:version) / CreatedAt `time.Time` (db:created_at, json:createdAt) / UpdatedAt `time.Time` (db:updated_at, json:updatedAt) / DeletedAt `*time.Time` (db:deleted_at, json:-) / Steps `[]SetupStep` (db:-, json:steps,omitempty)
- **ComboSetup** (`internal/model/setup.go`): ComboID `int64` (db:combo_id, json:comboId) / SetupID `int64` (db:setup_id, json:setupId)
- **ComboSetupResult** (`internal/model/setup.go`): ComboID `int64` (db:combo_id, json:-) / SetupID `int64` (db:setup_id, json:setupId) / TechType `string` (db:tech_type, json:techType) / InCorner `bool` (db:in_corner, json:inCorner) / Result `string` (db:result, json:result) / Note `*string` (db:note, json:note,omitempty)
- **ComboRef** (`internal/model/setup.go`): ID `int64` (db:—, json:id) / Memo `*string` (db:—, json:memo,omitempty)
- **SetupRef** (`internal/model/setup.go`): ID `int64` (db:—, json:id) / Name `*string` (db:—, json:name,omitempty)
- **DefaultMyComboStatusTag** (`internal/model/tag.go`): Name `string` / Color `string`
- **Tag** (`internal/model/tag.go`): ID `int64` (db:id, json:id) / UserID `int64` (db:user_id, json:userId) / Name `string` (db:name, json:name) / Category `*string` (db:category, json:category,omitempty) / Color `*string` (db:color, json:color,omitempty) / UsageCount `*int` (db:-, json:usageCount,omitempty)
- **CreateTagInput** (`internal/model/tag.go`): Name `string` (db:—, json:name) / Category `*string` (db:—, json:category,omitempty) / Color `*string` (db:—, json:color,omitempty)
- **UpdateTagInput** (`internal/model/tag.go`): Name `*string` (db:—, json:name,omitempty) / Category `*string` (db:—, json:category,omitempty) / Color `*string` (db:—, json:color,omitempty)
- **ComboTag** (`internal/model/tag.go`): ComboID `int64` (db:combo_id, json:comboId) / TagID `int64` (db:tag_id, json:tagId)
- **User** (`internal/model/user.go`): ID `int64` (db:id, json:id) / Name `string` (db:name, json:name) / PasswordHash `*string` (db:password_hash, json:-) / MainCharacterID `*int64` (db:main_character_id, json:mainCharacterId,omitempty) / CreatedAt `time.Time` (db:created_at, json:createdAt)

---

## 9. repository 構造体(source: `internal/repository/**/*.go`)

> scan 先 / フィルタ / 入力の **公開構造体**。例: `MoveListItem`(scan 先の列)、
> `ListFilter`(絞り込み)、`UpdateMetadataInput`(更新入力)。
> lowercase の `repository`(`*sql.DB` 保持)と interface は除外。
> repository の scan 実装が読む列の実体を示す(推測 scan の防止)。

- **DuplicateKey** (`internal/repository/combo/repository.go`): CharacterID `int64` / StarterMoveID `*int64` / Position `*string` / OpponentStance `*string` / HitType `*string` / OpponentSize `*string` / StarterMeaty `bool`
- **ListFilter** (`internal/repository/combo/repository.go`): CharacterID `*int64` / TagIDs `[]int64` / StarterMoveIDs `[]int64` / Position `*string` / HitType `*string` / OpponentStance `*string` / IsDraft `*bool` / SetupResult `*string` / SetupTechType `*string` / SetupInCorner `*bool` / AffectedByGameUpdate `*bool` / StarterMeaty `*bool` / UserID `int64` / IncludeDeleted `bool` / OnlyDeleted `bool` / Sort `string` / Order `string` / Limit `int` / Offset `int`
- **UpdateMetadataInput** (`internal/repository/combo/repository.go`): IsDraft `*bool` / Damage `Optional[int]` / DriveAvailableAtStart `Optional[float64]` / SAAvailableAtStart `Optional[int]` / DriveDamage `Optional[float64]` / SAGaugeConsumed `Optional[int]` / DriveGaugeConsumed `Optional[float64]` / KnockdownAdvantage `Optional[int]` / StartPositionMass `Optional[int]` / CarryDistanceMass `Optional[int]` / OkiVerified `Optional[bool]` / Memo `Optional[string]` / Link `Optional[string]` / VideoPath `Optional[string]` / ImagePath `Optional[string]` / Situation `Optional[string]` / OkiOptions `*[]model.OkiOption` / UserID `int64` / TagIDs `*[]int64` / SetupCarryOptions `*SetupCarryOptionsInput`
- **SetupCarryOptionsInput** (`internal/repository/combo/repository.go`): Mode `string` / CarrySetupIDs `[]int64`
- **MoveListItem** (`internal/repository/move/repository.go`): ID `int64` / CharacterID `int64` / Code `string` / Category `string` / OriginalMoveID `*int64` / Startup `*int` / Active `*int` / Total `*int` / OnHit `*int` / OnBlock `*int` / Recovery `*int` / IsAerial `bool` / SetupOnly `bool` / IsDerived `bool` / NameJa `*string`
- **MoveDetail** (`internal/repository/move/repository.go`): NameJa `*string`
- **UpdateMoveFields** (`internal/repository/move/repository.go`): Total `*int` / Startup `*int` / Active `*int` / OnHit `*int` / OnBlock `*int` / Damage `*int` / Recovery `*int` / IsAerial `*bool` / RawData `*string`
- **Row** (`internal/repository/movecommand/repository.go`): MoveID `int64` / MoveCode `string` / TokenKey `string` / Category `string` / IsAerial `bool`
- **ScanMove** (`internal/repository/punish/repository.go`): ID `int64` / CharacterID `int64` / Code `string` / Category `string` / Startup `*int` / Damage `*int` / OnBlock `*int` / Recovery `*int` / Total `*int` / IsProjectile `bool` / IsAerial `bool` / StartupBasis `string` / IsDerived `bool` / FirstHitStartup `*int` / NameJa `*string`
- **MovementTotals** (`internal/repository/punish/repository.go`): DashForward `*int` / JumpForward `*int`
- **StarterVerdict** (`internal/repository/punish/repository.go`): OpponentMoveID `int64` / StarterMoveID `int64` / Verdict `string` / Note `*string`
- **ComboPunishKey** (`internal/repository/punish/repository.go`): ComboID `int64` / OpponentMoveID `int64`
- **PunishEntry** (`internal/repository/punish/repository.go`): ComboID `int64` / OpponentMoveID `int64` / Note `*string` / OpponentMoveCode `string` / OpponentMoveNameJa `*string` / OpponentCharacterID `int64` / OpponentCharacterNameJa `string` / Damage `*int` / StepCount `int` / HitType `*string` / StarterMoveID `*int64` / StarterMoveCode `*string` / StarterMoveNameJa `*string` / RecipeCache `*string` / MaterializedFromComboID `*int64`
- **PunishEntryFilter** (`internal/repository/punish/repository.go`): SelfCharacterID `int64` / OpponentCharacterID `*int64` / ExcludeCurated `bool`
- **CurationEntry** (`internal/repository/punish/repository.go`): ComboID `int64` / OpponentMoveID `int64` / Note `*string` / OpponentMoveCode `string` / OpponentMoveNameJa `*string` / OpponentCharacterID `int64` / OpponentCharacterNameJa `string` / StarterMoveCode `*string` / StarterMoveNameJa `*string`
- **PruningEntry** (`internal/repository/punish/repository.go`): OpponentMoveID `int64` / Note `*string` / OpponentMoveCode `string` / OpponentMoveNameJa `*string` / OpponentCharacterID `int64` / OpponentCharacterNameJa `string`
- **MoveCandidate** (`internal/repository/setplay/repository.go`): ID `int64` / Code `string` / Category `string` / OriginalMoveID `*int64` / Startup `*int` / Active `*int` / Total `*int` / Damage `*int` / IsDerived `bool` / IsAerial `bool` / IsProjectile `bool` / SetupOnly `bool` / StartupBasis `string` / ChainCancelTotal `*int` / FastestUnreachable `bool`
- **MoveDerivation** (`internal/repository/setplay/repository.go`): ChildMoveID `int64` / ParentMoveID `int64`

---

## 10. マイグレーション(source: `migrations/*.sql`)

> **DB スキーマの一次情報**。SQL の列型・NOT NULL・DEFAULT・FK・INDEX は model 構造体
> (§8)/repository 構造体(§9)の Go 型では分からないため、ここを参照すること。
> 新規マイグレーションの **次の連番・命名規則** も 10-1 で確認する。

### 10-1. マイグレーション一覧(連番・up/down 対応)

| 連番 | 名前 | up | down |
|---|---|---|---|
| 000001 | init_schema | ✓ | ✓ |
| 000002 | seed_games | ✓ | ✓ |
| 000003 | data_seed_characters | ✓ | ✓ |
| 000004 | data_seed_moves | ✓ | ✓ |
| 000005 | data_seed_move_commands | ✓ | ✓ |
| 000006 | data_seed_move_derivations | ✓ | ✓ |
| 000007 | seed_presets | ✓ | ✓ |
| 000008 | data_seed_preset_aliases | ✓ | ✓ |
| 000009 | seed_initial_users_tags | ✓ | ✓ |

### 10-2. 各 up マイグレーションの DDL 操作

> スキーマ変更文(CREATE/ALTER/DROP TABLE・CREATE/DROP INDEX・RENAME)を抽出。
> `CREATE TABLE` は列定義を SQL のまま列挙する(これが列型・制約の一次情報)。
> データ投入/更新/削除(INSERT/UPDATE/DELETE)はテーブル単位で 1 行に要約(seed 行は展開しない)。
> テーブル再構築(C-11 等)は `CREATE TABLE new_xxx` → `INSERT` → `DROP TABLE` → `RENAME TO` が
> 並ぶ。**ある列の最新の定義は、その列を最後に触った連番のマイグレーションを見ること。**

- **000001_init_schema**
  - CREATE TABLE `games`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `code TEXT NOT NULL UNIQUE`
    - `name_ja TEXT NOT NULL`
    - `name_en TEXT NOT NULL`
    - `current_data_version TEXT NOT NULL DEFAULT '2026.08.03.01'`
    - `CHECK (`
    - `current_data_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'`
    - `AND CAST(substr(current_data_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12`
    - `AND CAST(substr(current_data_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31`
  - CREATE TABLE `characters`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `game_id INTEGER NOT NULL REFERENCES games(id)`
    - `code TEXT NOT NULL`
    - `name_ja TEXT NOT NULL`
    - `name_en TEXT NOT NULL`
    - `custom_states TEXT`
    - `UNIQUE (game_id, code)`
  - CREATE TABLE `users`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `name TEXT NOT NULL UNIQUE`
    - `password_hash TEXT`
    - `main_character_id INTEGER REFERENCES characters(id)`
    - `created_at DATETIME NOT NULL DEFAULT (datetime('now'))`
  - CREATE TABLE `moves`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `character_id INTEGER NOT NULL REFERENCES characters(id)`
    - `code TEXT NOT NULL`
    - `category TEXT NOT NULL`
    - `original_move_id INTEGER REFERENCES moves(id)`
    - `damage INTEGER`
    - `raw_data TEXT`
    - `startup INTEGER`
    - `active INTEGER`
    - `total INTEGER`
    - `on_hit INTEGER`
    - `on_block INTEGER`
    - `is_aerial INTEGER NOT NULL DEFAULT 0`
    - `setup_only INTEGER NOT NULL DEFAULT 0`
    - `recovery INTEGER`
    - `is_derived INTEGER NOT NULL DEFAULT 0`
    - `is_projectile INTEGER NOT NULL DEFAULT 0`
    - `startup_basis TEXT NOT NULL DEFAULT 'unknown'`
    - `chain_cancel_total INTEGER`
    - `fastest_unreachable INTEGER NOT NULL DEFAULT 0`
    - `last_changed_game_version TEXT`
    - `CHECK (`
    - `last_changed_game_version IS NULL OR (`
    - `last_changed_game_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'`
    - `AND CAST(substr(last_changed_game_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12`
    - `AND CAST(substr(last_changed_game_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31`
  - CREATE TABLE `presets`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
    - `code TEXT NOT NULL UNIQUE`
    - `name TEXT NOT NULL`
    - `base_preset_code TEXT`
    - `is_builtin INTEGER NOT NULL DEFAULT 0`
  - CREATE TABLE `tags`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
    - `name TEXT NOT NULL`
    - `category TEXT`
    - `color TEXT`
    - `UNIQUE (user_id, name)`
  - CREATE TABLE `preset_aliases`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `preset_id INTEGER NOT NULL REFERENCES presets(id) ON DELETE CASCADE`
    - `move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `alias_text TEXT NOT NULL`
    - `alias_text_en TEXT`
    - `character_id INTEGER`
    - `UNIQUE (preset_id, move_id)`
  - CREATE TABLE `move_commands`:
    - `move_id INTEGER NOT NULL REFERENCES moves(id) ON DELETE CASCADE`
    - `character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE`
    - `token_key TEXT NOT NULL`
    - `PRIMARY KEY (move_id, token_key)`
  - CREATE TABLE `move_derivations`:
    - `child_move_id INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE`
    - `parent_move_id INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE`
    - `PRIMARY KEY (child_move_id, parent_move_id)`
  - CREATE TABLE `setups`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `character_id INTEGER NOT NULL REFERENCES characters(id)`
    - `name TEXT`
    - `description TEXT`
    - `step_count INTEGER NOT NULL DEFAULT 0`
    - `recipe_cache TEXT`
    - `version INTEGER NOT NULL DEFAULT 1`
    - `created_at DATETIME NOT NULL DEFAULT (datetime('now'))`
    - `updated_at DATETIME NOT NULL DEFAULT (datetime('now'))`
    - `deleted_at DATETIME`
  - CREATE TABLE `combos`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `character_id INTEGER NOT NULL REFERENCES characters(id)`
    - `is_draft INTEGER NOT NULL DEFAULT 0`
    - `damage INTEGER`
    - `drive_available_at_start REAL`
    - `sa_available_at_start INTEGER`
    - `drive_damage REAL`
    - `starter_move_id INTEGER REFERENCES moves(id)`
    - `position TEXT`
    - `opponent_stance TEXT`
    - `hit_type TEXT`
    - `opponent_size TEXT`
    - `situation TEXT`
    - `knockdown_advantage INTEGER`
    - `memo TEXT`
    - `step_count INTEGER NOT NULL DEFAULT 0`
    - `recipe_cache TEXT`
    - `version INTEGER NOT NULL DEFAULT 1`
    - `created_at DATETIME NOT NULL DEFAULT (datetime('now'))`
    - `updated_at DATETIME NOT NULL DEFAULT (datetime('now'))`
    - `deleted_at DATETIME`
    - `sa_gauge_consumed INTEGER`
    - `drive_gauge_consumed REAL`
    - `link TEXT`
    - `video_path TEXT`
    - `image_path TEXT`
    - `materialized_from_combo_id INTEGER REFERENCES combos(id)`
    - `superseded_by_combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL`
    - `oki_verified INTEGER NOT NULL DEFAULT 0`
    - `baseline_version TEXT`
    - `CHECK (`
    - `baseline_version IS NULL OR (`
    - `baseline_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'`
    - `AND CAST(substr(baseline_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12`
    - `AND CAST(substr(baseline_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31`
  - CREATE TABLE `combo_steps`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `step_order INTEGER NOT NULL`
    - `move_id INTEGER REFERENCES moves(id)`
    - `modifiers TEXT`
    - `UNIQUE (combo_id, step_order)`
  - CREATE TABLE `setup_steps`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `setup_id INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE`
    - `step_order INTEGER NOT NULL`
    - `move_id INTEGER REFERENCES moves(id)`
    - `modifiers TEXT`
    - `UNIQUE (setup_id, step_order)`
  - CREATE TABLE `combo_tags`:
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE`
    - `PRIMARY KEY (combo_id, tag_id)`
  - CREATE TABLE `combo_setups`:
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `setup_id INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE`
    - `PRIMARY KEY (combo_id, setup_id)`
  - CREATE TABLE `combo_setup_results`:
    - `combo_id INTEGER NOT NULL`
    - `setup_id INTEGER NOT NULL`
    - `tech_type TEXT NOT NULL`
    - `in_corner BOOLEAN NOT NULL`
    - `result TEXT NOT NULL`
    - `note TEXT`
    - `PRIMARY KEY (combo_id, setup_id, tech_type, in_corner)`
    - `FOREIGN KEY (combo_id, setup_id) REFERENCES combo_setups(combo_id, setup_id)`
    - `ON UPDATE CASCADE ON DELETE CASCADE`
  - CREATE TABLE `combo_oki_options`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `attack_type TEXT NOT NULL`
    - `tech_type TEXT NOT NULL`
    - `uses_dr INTEGER NOT NULL`
    - `UNIQUE (combo_id, attack_type, tech_type, uses_dr)`
  - CREATE TABLE `combo_punishes`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `opponent_move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `note TEXT`
    - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `UNIQUE (combo_id, opponent_move_id)`
  - CREATE TABLE `combo_punish_curations`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE`
    - `opponent_move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `note TEXT`
    - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `UNIQUE (combo_id, opponent_move_id)`
  - CREATE TABLE `combo_punish_prunings`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `self_character_id INTEGER NOT NULL REFERENCES characters(id)`
    - `opponent_move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `note TEXT`
    - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `UNIQUE (self_character_id, opponent_move_id)`
  - CREATE TABLE `combo_punish_starters`:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `self_character_id INTEGER NOT NULL REFERENCES characters(id)`
    - `opponent_move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `starter_move_id INTEGER NOT NULL REFERENCES moves(id)`
    - `verdict TEXT NOT NULL`
    - `note TEXT`
    - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
    - `UNIQUE (self_character_id, opponent_move_id, starter_move_id)`
  - CREATE INDEX idx_combos_character_id ON combos(character_id)
  - CREATE INDEX idx_combos_starter_move_id ON combos(starter_move_id)
  - CREATE INDEX idx_combos_situation_filter ON combos(position, opponent_stance, hit_type)
  - CREATE INDEX idx_combos_updated_at ON combos(updated_at)
  - CREATE INDEX idx_combos_deleted_at ON combos(deleted_at)
  - CREATE INDEX idx_combo_steps_combo_id_order ON combo_steps(combo_id, step_order)
  - CREATE INDEX idx_combo_tags_tag_id ON combo_tags(tag_id)
  - CREATE INDEX idx_setups_character_id ON setups(character_id)
  - CREATE INDEX idx_setup_steps_setup_id_order ON setup_steps(setup_id, step_order)
  - CREATE INDEX idx_combo_setups_setup_id ON combo_setups(setup_id)
  - CREATE INDEX idx_combo_oki_options_combo_id ON combo_oki_options(combo_id)
  - CREATE INDEX idx_moves_character_category ON moves(character_id, category)
  - CREATE INDEX idx_move_commands_char_token ON move_commands (character_id, token_key)
  - CREATE INDEX idx_move_derivations_parent ON move_derivations (parent_move_id)
  - CREATE INDEX idx_preset_aliases_preset_move ON preset_aliases(preset_id, move_id)
  - CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias
  - CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias_en
  - CREATE INDEX idx_combo_punishes_opponent_move ON combo_punishes(opponent_move_id)
  - CREATE INDEX idx_cpc_opponent_move ON combo_punish_curations(opponent_move_id)
  - CREATE INDEX idx_cpp_opponent_move ON combo_punish_prunings(opponent_move_id)
  - CREATE INDEX idx_cps_opponent_move ON combo_punish_starters(opponent_move_id)
  - INSERT INTO `sqlite_sequence`(データ投入)
- **000002_seed_games**
  - INSERT INTO `games`(データ投入)
- **000003_data_seed_characters**
  - INSERT INTO `characters`(データ投入)
- **000004_data_seed_moves**
  - INSERT INTO `moves`(データ投入)
  - UPDATE `moves`(データ更新)
- **000005_data_seed_move_commands**
  - INSERT INTO `move_commands`(データ投入)
- **000006_data_seed_move_derivations**
  - INSERT INTO `move_derivations`(データ投入)
- **000007_seed_presets**
  - INSERT INTO `presets`(データ投入)
- **000008_data_seed_preset_aliases**
  - INSERT INTO `preset_aliases`(データ投入)
- **000009_seed_initial_users_tags**
  - INSERT INTO `users`(データ投入)
  - INSERT INTO `tags`(データ投入)
