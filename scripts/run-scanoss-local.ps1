[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string]$Ref,

    [string]$WorkspaceRoot = (Get-Location).Path,
    [string]$RepositoryUrl = "https://github.com/plexiblinp/combomgr.git",
    [string]$SourceRepo,
    [string]$OutputRoot,
    [string]$ScanossVersion = "1.54.2",
    [string]$ExistingScanResult,
    [string]$ExpectedWfpSha256
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)
    Write-Host "[SCANOSS] $Message" -ForegroundColor Cyan
}

function Stop-Run {
    param([string]$Message)
    throw "SCANOSS事前検証に失敗しました: $Message"
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $output = @(& $Command @Arguments 2>&1 | ForEach-Object { "$_" })
    if ($LASTEXITCODE -ne 0) {
        $detail = ($output -join [Environment]::NewLine).Trim()
        Stop-Run "$Command が終了コード $LASTEXITCODE で失敗しました。`n$detail"
    }
    return $output
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-ObjectPropertyValue {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        return $null
    }
    return $property.Value
}

function Get-RelativePathUnix {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$Path
    )
    return [IO.Path]::GetRelativePath($BasePath, $Path).Replace('\', '/')
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-Run "git が見つかりません。Git for Windowsをインストールしてください。"
    }
    if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
        Stop-Run "tar が見つかりません。"
    }
    if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
        Stop-Run "Python Launcher (py.exe) が見つかりません。Python 3.13をインストールしてください。"
    }

    $WorkspaceRoot = [IO.Path]::GetFullPath($WorkspaceRoot)
    if (-not (Test-Path -LiteralPath $WorkspaceRoot -PathType Container)) {
        Stop-Run "作業ルートが存在しません: $WorkspaceRoot"
    }
    if ([string]::IsNullOrWhiteSpace($SourceRepo)) {
        $SourceRepo = Join-Path $WorkspaceRoot "combomgr-source"
    }
    if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
        $OutputRoot = $WorkspaceRoot
    }
    $SourceRepo = [IO.Path]::GetFullPath($SourceRepo)
    $OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
    New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

    Write-Step "ソースリポジトリを準備しています"
    if (-not (Test-Path -LiteralPath $SourceRepo)) {
        Invoke-Native git @("clone", "--origin", "origin", $RepositoryUrl, $SourceRepo) | Out-Null
    }
    if (-not (Test-Path -LiteralPath (Join-Path $SourceRepo ".git"))) {
        Stop-Run "ソースディレクトリはGitリポジトリではありません: $SourceRepo"
    }

    $actualRemote = (Invoke-Native git @("-C", $SourceRepo, "remote", "get-url", "origin") | Select-Object -First 1).Trim()
    $normalizeUrl = {
        param([string]$Url)
        return $Url.Trim().TrimEnd('/').ToLowerInvariant() -replace '\.git$', ''
    }
    if ((& $normalizeUrl $actualRemote) -ne (& $normalizeUrl $RepositoryUrl)) {
        Stop-Run "originが想定外です。期待値: $RepositoryUrl / 実値: $actualRemote"
    }

    $dirty = @(Invoke-Native git @("-C", $SourceRepo, "status", "--porcelain"))
    if ($dirty.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace(($dirty -join ""))) {
        Stop-Run "ソースリポジトリに未コミット変更があります。別のクリーンなcloneを使用してください。"
    }
    $isShallow = (Invoke-Native git @("-C", $SourceRepo, "rev-parse", "--is-shallow-repository") | Select-Object -First 1).Trim()
    if ($isShallow -ne "false") {
        Stop-Run "shallow cloneは使用できません。完全なcloneを使用してください。"
    }

    Write-Step "originを更新し、指定SHAを固定しています"
    Invoke-Native git @("-C", $SourceRepo, "fetch", "--prune", "origin") | Out-Null
    $commit = (Invoke-Native git @("-C", $SourceRepo, "rev-parse", "$Ref^{commit}") | Select-Object -First 1).Trim().ToLowerInvariant()
    if ($commit -ne $Ref.ToLowerInvariant()) {
        Stop-Run "指定SHAがcommitとして同一に解決されませんでした。指定: $Ref / 解決: $commit"
    }

    $runId = Get-Date -Format "yyyyMMdd-HHmmss"
    $shortCommit = $commit.Substring(0, 12)
    $runDir = Join-Path $OutputRoot "scanoss-$runId-$shortCommit"
    if (Test-Path -LiteralPath $runDir) {
        Stop-Run "出力先が既に存在します: $runDir"
    }
    $sourceDir = Join-Path $runDir "source"
    $archivePath = Join-Path $runDir "tacpendium-source.tar"
    $wfpPath = Join-Path $runDir "tacpendium.wfp"
    $resultPath = Join-Path $runDir "scan-results.json"
    $formattedResultPath = Join-Path $runDir "scan-results-formatted.json"
    $matchCsvPath = Join-Path $runDir "scan-matches.csv"
    $sourceManifestPath = Join-Path $runDir "source-manifest.csv"
    $metadataPath = Join-Path $runDir "run-metadata.json"
    $reportPath = Join-Path $runDir "run-report.md"
    $artifactHashesPath = Join-Path $runDir "artifact-hashes.csv"
    $stagingDir = Join-Path $runDir "import-package"
    $zipPath = Join-Path $runDir "scanoss-import-$shortCommit.zip"

    New-Item -ItemType Directory -Path $sourceDir | Out-Null
    New-Item -ItemType Directory -Path $stagingDir | Out-Null

    $scope = @("cmd", "internal", "web/src")
    Write-Step "対象コードをGitオブジェクトから抽出しています"
    Invoke-Native git (@("-C", $SourceRepo, "archive", "--format=tar", "--output=$archivePath", $commit, "--") + $scope) | Out-Null
    Invoke-Native tar @("-xf", $archivePath, "-C", $sourceDir) | Out-Null

    Write-Step "抽出物をGit blobと照合しています"
    $treeLines = @(Invoke-Native git (@("-C", $SourceRepo, "ls-tree", "-r", $commit, "--") + $scope))
    $expected = @{}
    foreach ($line in $treeLines) {
        if ($line -notmatch '^[0-9]+\s+blob\s+([0-9a-f]{40})\t(.+)$') {
            Stop-Run "対象範囲に通常ファイル以外、または解釈不能なGitエントリがあります: $line"
        }
        $expected[$Matches[2]] = $Matches[1]
    }
    if ($expected.Count -eq 0) {
        Stop-Run "指定範囲にファイルがありません。"
    }

    $actualFiles = @(Get-ChildItem -LiteralPath $sourceDir -File -Recurse -Force)
    if ($actualFiles.Count -ne $expected.Count) {
        Stop-Run "抽出ファイル数がGitと一致しません。Git: $($expected.Count) / 抽出: $($actualFiles.Count)"
    }

    $sourceManifest = [Collections.Generic.List[object]]::new()
    foreach ($file in $actualFiles) {
        $relativePath = Get-RelativePathUnix -BasePath $sourceDir -Path $file.FullName
        if (-not $expected.ContainsKey($relativePath)) {
            Stop-Run "Gitに存在しないファイルが抽出先にあります: $relativePath"
        }
        $actualBlob = (Invoke-Native git @("hash-object", "--no-filters", "--", $file.FullName) | Select-Object -First 1).Trim()
        if ($actualBlob -ne $expected[$relativePath]) {
            Stop-Run "抽出内容がGit blobと一致しません: $relativePath"
        }
        $sourceManifest.Add([PSCustomObject]@{
            Path                  = $relativePath
            GitBlobSha1           = $expected[$relativePath]
            ExtractedGitBlobSha1  = $actualBlob
            SizeBytes             = $file.Length
            Sha256                = Get-Sha256 -Path $file.FullName
        })
    }
    $sourceManifest = @($sourceManifest | Sort-Object Path)
    $sourceManifest | Export-Csv -LiteralPath $sourceManifestPath -NoTypeInformation -Encoding utf8

    $suspiciousPatterns = @(
        '(^|/)\.env($|\.)',
        '(^|/)config\.toml$',
        '\.(db|sqlite|sqlite3|pem|key)$',
        '(^|/)id_(rsa|ed25519)',
        '(^|/)(\.git|node_modules)(/|$)'
    )
    $suspicious = @($sourceManifest.Path | Where-Object {
        $path = $_
        $suspiciousPatterns | Where-Object { $path -match $_ }
    })
    if ($suspicious.Count -gt 0) {
        Stop-Run "送信対象に除外すべき可能性のあるファイルがあります: $($suspicious -join ', ')"
    }

    Write-Step "固定版SCANOSS CLIを準備しています"
    $pythonVersionText = (& py -3.13 --version 2>&1 | ForEach-Object { "$_" }) -join " "
    if ($LASTEXITCODE -ne 0 -or $pythonVersionText -notmatch 'Python\s+(\d+)\.(\d+)\.(\d+)') {
        Stop-Run "Python 3.13を起動できません。"
    }
    $pythonMajor = [int]$Matches[1]
    $pythonMinor = [int]$Matches[2]
    if ($pythonMajor -lt 3 -or ($pythonMajor -eq 3 -and $pythonMinor -lt 9)) {
        Stop-Run "SCANOSS CLIにはPython 3.9以上が必要です。実値: $pythonVersionText"
    }

    $toolRoot = Join-Path $WorkspaceRoot ".scanoss-tools"
    $venvDir = Join-Path $toolRoot "venv-$ScanossVersion"
    $venvPython = Join-Path $venvDir "Scripts\python.exe"
    $scanossExe = Join-Path $venvDir "Scripts\scanoss-py.exe"
    if (-not (Test-Path -LiteralPath $venvPython)) {
        New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
        Invoke-Native py @("-3.13", "-m", "venv", $venvDir) | Out-Null
    }
    if (-not (Test-Path -LiteralPath $scanossExe)) {
        Invoke-Native $venvPython @("-m", "pip", "install", "--disable-pip-version-check", "scanoss==$ScanossVersion") | Out-Null
    }
    $scanossVersionText = (Invoke-Native $scanossExe @("--version") | Select-Object -First 1).Trim()
    if ($scanossVersionText -notmatch [regex]::Escape($ScanossVersion)) {
        Stop-Run "SCANOSS CLIの版が不一致です。期待値: $ScanossVersion / 実値: $scanossVersionText"
    }
    Invoke-Native $venvPython @("-m", "pip", "check") | Out-Null

    Write-Step "WFPを生成しています"
    Invoke-Native $scanossExe @("wfp", "-o", $wfpPath, $sourceDir) | Out-Null
    if (-not (Test-Path -LiteralPath $wfpPath) -or (Get-Item -LiteralPath $wfpPath).Length -eq 0) {
        Stop-Run "WFPが生成されませんでした。"
    }
    $wfpFileLines = @(Select-String -LiteralPath $wfpPath -Pattern '^file=')
    if ($wfpFileLines.Count -eq 0) {
        Stop-Run "WFPにファイル指紋がありません。"
    }
    foreach ($match in $wfpFileLines) {
        if ($match.Line -notmatch '^file=[^,]+,[^,]+,(.+)$') {
            Stop-Run "WFPのfile行を解釈できません: $($match.Line)"
        }
        $wfpSourcePath = $Matches[1].Replace('\', '/')
        if ($wfpSourcePath -notmatch '^(cmd|internal|web/src)/') {
            Stop-Run "WFPに対象外パスがあります: $wfpSourcePath"
        }
    }

    Write-Step "SCANOSSサーバーへWFPを送信し、照合しています"
    if (-not [string]::IsNullOrWhiteSpace($ExistingScanResult)) {
        if ([string]::IsNullOrWhiteSpace($ExpectedWfpSha256)) {
            Stop-Run "既存結果を再利用する場合はExpectedWfpSha256が必要です。"
        }
        $ExistingScanResult = [IO.Path]::GetFullPath($ExistingScanResult)
        if (-not (Test-Path -LiteralPath $ExistingScanResult -PathType Leaf)) {
            Stop-Run "再利用するSCANOSS結果が見つかりません: $ExistingScanResult"
        }
        $actualWfpSha256 = Get-Sha256 -Path $wfpPath
        if ($actualWfpSha256 -ne $ExpectedWfpSha256.ToLowerInvariant()) {
            Stop-Run "再利用結果のWFP SHA-256が一致しません。期待値: $ExpectedWfpSha256 / 実値: $actualWfpSha256"
        }
        Copy-Item -LiteralPath $ExistingScanResult -Destination $resultPath
        Write-Step "同一WFPで取得済みのSCANOSS結果を再利用しました"
    }
    else {
        Invoke-Native $scanossExe @("scan", "-w", $wfpPath, "-o", $resultPath) | Out-Null
    }
    if (-not (Test-Path -LiteralPath $resultPath) -or (Get-Item -LiteralPath $resultPath).Length -eq 0) {
        Stop-Run "SCANOSS結果JSONが生成されませんでした。"
    }

    Write-Step "結果を検証し、持込レポートを作成しています"
    $scanResults = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    $resultProperties = @($scanResults.PSObject.Properties)
    if ($resultProperties.Count -ne $wfpFileLines.Count) {
        Stop-Run "結果ファイル数とWFPファイル数が一致しません。結果: $($resultProperties.Count) / WFP: $($wfpFileLines.Count)"
    }
    Invoke-Native $venvPython @("-m", "json.tool", $resultPath, $formattedResultPath) | Out-Null

    $entries = [Collections.Generic.List[object]]::new()
    foreach ($property in $resultProperties) {
        foreach ($item in @($property.Value)) {
            $id = [string](Get-ObjectPropertyValue -Object $item -Name "id")
            if ([string]::IsNullOrWhiteSpace($id)) {
                Stop-Run "結果にidのないエントリがあります: $($property.Name)"
            }
            $licenseItems = @(Get-ObjectPropertyValue -Object $item -Name "licenses")
            $licenses = @($licenseItems | Where-Object { $null -ne $_ } | ForEach-Object {
                [string](Get-ObjectPropertyValue -Object $_ -Name "name")
            } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ", "
            $purls = @(Get-ObjectPropertyValue -Object $item -Name "purl" | ForEach-Object { "$_" }) -join " | "
            $entries.Add([PSCustomObject]@{
                File        = $property.Name
                Id          = $id
                Status      = [string](Get-ObjectPropertyValue -Object $item -Name "status")
                Matched     = [string](Get-ObjectPropertyValue -Object $item -Name "matched")
                Lines       = [string](Get-ObjectPropertyValue -Object $item -Name "lines")
                OssLines    = [string](Get-ObjectPropertyValue -Object $item -Name "oss_lines")
                Vendor      = [string](Get-ObjectPropertyValue -Object $item -Name "vendor")
                Component   = [string](Get-ObjectPropertyValue -Object $item -Name "component")
                Version     = [string](Get-ObjectPropertyValue -Object $item -Name "version")
                Latest      = [string](Get-ObjectPropertyValue -Object $item -Name "latest")
                Licenses    = $licenses
                OssFile     = [string](Get-ObjectPropertyValue -Object $item -Name "file")
                ReleaseDate = [string](Get-ObjectPropertyValue -Object $item -Name "release_date")
                Url         = [string](Get-ObjectPropertyValue -Object $item -Name "url")
                Purl        = $purls
                SourceHash  = [string](Get-ObjectPropertyValue -Object $item -Name "source_hash")
                FileHash    = [string](Get-ObjectPropertyValue -Object $item -Name "file_hash")
            })
        }
    }
    $matches = @($entries | Where-Object Id -ne "none")
    $matches | Export-Csv -LiteralPath $matchCsvPath -NoTypeInformation -Encoding utf8
    $idCounts = @{}
    foreach ($group in @($entries | Group-Object Id)) {
        $idCounts[$group.Name] = $group.Count
    }
    foreach ($expectedId in @("none", "snippet", "file")) {
        if (-not $idCounts.ContainsKey($expectedId)) {
            $idCounts[$expectedId] = 0
        }
    }

    $gitVersion = (Invoke-Native git @("--version") | Select-Object -First 1).Trim()
    $tarVersion = (Invoke-Native tar @("--version") | Select-Object -First 1).Trim()
    $metadata = [ordered]@{
        schemaVersion       = 1
        generatedAtUtc      = (Get-Date).ToUniversalTime().ToString("o")
        repositoryUrl       = $RepositoryUrl
        originUrlObserved   = $actualRemote
        sourceCommit        = $commit
        scope               = $scope
        sourceFileCount     = $sourceManifest.Count
        wfpFileCount        = $wfpFileLines.Count
        resultFileCount     = $resultProperties.Count
        resultEntryCount    = $entries.Count
        matchCount          = $matches.Count
        idCounts            = [ordered]@{
            none    = [int]$idCounts["none"]
            snippet = [int]$idCounts["snippet"]
            file    = [int]$idCounts["file"]
        }
        tools               = [ordered]@{
            git       = $gitVersion
            python    = $pythonVersionText.Trim()
            tar       = $tarVersion
            scanossPy = $scanossVersionText
        }
        sourceArchiveSha256 = Get-Sha256 -Path $archivePath
        wfpSha256           = Get-Sha256 -Path $wfpPath
        resultSha256        = Get-Sha256 -Path $resultPath
    }
    $metadata | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $metadataPath -Encoding utf8

    $report = @"
# SCANOSSローカル実行レポート

- 実行日時 (UTC): $($metadata.generatedAtUtc)
- リポジトリ: $RepositoryUrl
- 固定コミット: $commit
- 対象範囲: cmd, internal, web/src
- Git対象ファイル: $($metadata.sourceFileCount)
- WFP対象ファイル: $($metadata.wfpFileCount)
- 結果ファイル: $($metadata.resultFileCount)
- 判定: none=$($metadata.idCounts.none), snippet=$($metadata.idCounts.snippet), file=$($metadata.idCounts.file)
- 要確認一致: $($metadata.matchCount)
- SCANOSS CLI: $scanossVersionText

## 自動検証済み

- origin URL
- cleanかつ非shallowなGit clone
- 指定した40桁commit SHAの解決
- 抽出ファイル一覧とGit treeの一致
- 全抽出ファイルとGit blob SHA-1の一致
- 秘密情報候補および不要ディレクトリの不在
- WFPパスが対象範囲内であること
- WFP件数とSCANOSS結果件数の一致
- Python依存関係 (`pip check`)

## 次の操作

持込ZIPをウイルス対策ソフトでスキャンした後、devContainerの tmp/ へコピーし、
python3 scripts/verify-scanoss-import.py <ZIP> を実行してください。
"@
    $report | Set-Content -LiteralPath $reportPath -Encoding utf8

    $payloadFiles = @(
        $metadataPath,
        $reportPath,
        $sourceManifestPath,
        $resultPath,
        $formattedResultPath,
        $matchCsvPath
    )
    foreach ($payloadFile in $payloadFiles) {
        Copy-Item -LiteralPath $payloadFile -Destination $stagingDir
    }
    $hashRows = foreach ($payloadFile in $payloadFiles) {
        [PSCustomObject]@{
            File   = [IO.Path]::GetFileName($payloadFile)
            Sha256 = Get-Sha256 -Path $payloadFile
            Bytes  = (Get-Item -LiteralPath $payloadFile).Length
        }
    }
    $hashRows | Export-Csv -LiteralPath $artifactHashesPath -NoTypeInformation -Encoding utf8
    Copy-Item -LiteralPath $artifactHashesPath -Destination $stagingDir
    Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

    $zipHash = Get-Sha256 -Path $zipPath
    Write-Host ""
    Write-Host "SCANOSSローカル処理は正常に完了しました。" -ForegroundColor Green
    Write-Host "固定コミット : $commit"
    Write-Host "検査結果     : none=$($metadata.idCounts.none), snippet=$($metadata.idCounts.snippet), file=$($metadata.idCounts.file)"
    Write-Host "持込ZIP      : $zipPath"
    Write-Host "ZIP SHA-256  : $zipHash"
    Write-Host "次の操作     : NortonでこのZIPをスキャンし、devContainerのtmp/へコピーしてください。"
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
