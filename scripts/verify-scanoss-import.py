#!/usr/bin/env python3
"""Validate a SCANOSS package produced by run-scanoss-local.ps1."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from collections import Counter
from pathlib import Path


REQUIRED_FILES = {
    "artifact-hashes.csv",
    "run-metadata.json",
    "run-report.md",
    "scan-matches.csv",
    "scan-results-formatted.json",
    "scan-results.json",
    "source-manifest.csv",
}
SCOPES = ("cmd/", "internal/", "web/src/")
MATCH_KEY_FIELDS = ("File", "Id", "Component", "OssFile", "Lines", "OssLines")


class VerificationError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_git(repo: Path, *args: str) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise VerificationError(f"Git検証に失敗しました: {detail}")
    return result.stdout.splitlines()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    members = archive.infolist()
    names = {member.filename for member in members if not member.is_dir()}
    if len(names) != len([member for member in members if not member.is_dir()]):
        raise VerificationError("ZIPに重複ファイル名があります。")
    if names != REQUIRED_FILES:
        missing = sorted(REQUIRED_FILES - names)
        extra = sorted(names - REQUIRED_FILES)
        raise VerificationError(
            f"ZIP内容が想定と異なります。不足={missing or 'なし'} / 余分={extra or 'なし'}"
        )
    for member in members:
        target = (destination / member.filename).resolve()
        if destination.resolve() not in target.parents and target != destination.resolve():
            raise VerificationError(f"危険なZIPパスを検出しました: {member.filename}")
    archive.extractall(destination)


def parse_tree(lines: list[str]) -> dict[str, str]:
    tree: dict[str, str] = {}
    for line in lines:
        try:
            header, path = line.split("\t", 1)
            _mode, object_type, object_id = header.split()
        except ValueError as exc:
            raise VerificationError(f"git ls-tree出力を解釈できません: {line}") from exc
        if object_type != "blob":
            raise VerificationError(f"対象範囲に通常ファイル以外があります: {path}")
        tree[path] = object_id
    return tree


def flatten_results(results: object) -> list[tuple[str, dict[str, object]]]:
    if not isinstance(results, dict):
        raise VerificationError("scan-results.jsonの最上位がオブジェクトではありません。")
    flattened: list[tuple[str, dict[str, object]]] = []
    for path, value in results.items():
        values = value if isinstance(value, list) else [value]
        for entry in values:
            if not isinstance(entry, dict):
                raise VerificationError(f"結果エントリがオブジェクトではありません: {path}")
            flattened.append((path, entry))
    return flattened


def match_key(row: dict[str, str]) -> tuple[str, ...]:
    return tuple(row.get(field, "") for field in MATCH_KEY_FIELDS)


def write_delta(
    current: list[dict[str, str]], baseline_path: Path | None, output_path: Path
) -> tuple[int, int, int]:
    current_by_key = {match_key(row): row for row in current}
    baseline: list[dict[str, str]] = []
    if baseline_path is not None and baseline_path.exists():
        baseline = read_csv(baseline_path)
    baseline_by_key = {match_key(row): row for row in baseline}

    added = sorted(current_by_key.keys() - baseline_by_key.keys())
    removed = sorted(baseline_by_key.keys() - current_by_key.keys())
    unchanged = sorted(current_by_key.keys() & baseline_by_key.keys())
    rows: list[dict[str, str]] = []
    for status, keys, source in (
        ("added", added, current_by_key),
        ("removed", removed, baseline_by_key),
        ("unchanged", unchanged, current_by_key),
    ):
        for key in keys:
            row = {"Delta": status}
            row.update(source[key])
            rows.append(row)

    fieldnames = ["Delta"]
    for source_rows in (current, baseline):
        for row in source_rows:
            for field in row:
                if field not in fieldnames:
                    fieldnames.append(field)
    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return len(added), len(removed), len(unchanged)


def verify(package: Path, repo: Path, output_root: Path, baseline: Path | None) -> Path:
    if not package.is_file():
        raise VerificationError(f"持込ZIPが見つかりません: {package}")
    if not (repo / ".git").exists():
        raise VerificationError(f"Gitリポジトリではありません: {repo}")

    with tempfile.TemporaryDirectory(prefix="scanoss-import-") as temporary:
        extracted = Path(temporary)
        try:
            with zipfile.ZipFile(package) as archive:
                safe_extract(archive, extracted)
        except zipfile.BadZipFile as exc:
            raise VerificationError("持込ファイルは正常なZIPではありません。") from exc

        hash_rows = read_csv(extracted / "artifact-hashes.csv")
        if len(hash_rows) != len(REQUIRED_FILES) - 1:
            raise VerificationError("artifact-hashes.csvの行数が不正です。")
        if {row.get("File", "") for row in hash_rows} != REQUIRED_FILES - {"artifact-hashes.csv"}:
            raise VerificationError("artifact-hashes.csvの対象ファイル一覧が不正です。")
        for row in hash_rows:
            path = extracted / row["File"]
            if sha256(path) != row.get("Sha256", "").lower():
                raise VerificationError(f"持込ファイルのSHA-256が一致しません: {row['File']}")
            if path.stat().st_size != int(row.get("Bytes", "-1")):
                raise VerificationError(f"持込ファイルのサイズが一致しません: {row['File']}")

        metadata = json.loads((extracted / "run-metadata.json").read_text(encoding="utf-8-sig"))
        if metadata.get("schemaVersion") != 1:
            raise VerificationError("未対応のrun-metadataスキーマです。")
        commit = str(metadata.get("sourceCommit", ""))
        if len(commit) != 40 or any(char not in "0123456789abcdef" for char in commit.lower()):
            raise VerificationError("sourceCommitが40桁SHAではありません。")
        if metadata.get("scope") != ["cmd", "internal", "web/src"]:
            raise VerificationError("検査対象範囲が想定と異なります。")

        run_git(repo, "cat-file", "-e", f"{commit}^{{commit}}")
        tree = parse_tree(
            run_git(repo, "ls-tree", "-r", commit, "--", "cmd", "internal", "web/src")
        )
        source_manifest = read_csv(extracted / "source-manifest.csv")
        manifest_tree = {row.get("Path", ""): row.get("GitBlobSha1", "") for row in source_manifest}
        if tree != manifest_tree:
            missing = sorted(tree.keys() - manifest_tree.keys())[:5]
            extra = sorted(manifest_tree.keys() - tree.keys())[:5]
            changed = sorted(
                path for path in tree.keys() & manifest_tree.keys() if tree[path] != manifest_tree[path]
            )[:5]
            raise VerificationError(
                f"持込元とdevContainerのGit treeが一致しません。不足={missing} / 余分={extra} / 内容差={changed}"
            )
        for row in source_manifest:
            path = row.get("Path", "")
            if not path.startswith(SCOPES):
                raise VerificationError(f"source-manifestに対象外パスがあります: {path}")
            if row.get("GitBlobSha1") != row.get("ExtractedGitBlobSha1"):
                raise VerificationError(f"ローカル抽出時のblob照合が不一致です: {path}")
        if len(source_manifest) != int(metadata.get("sourceFileCount", -1)):
            raise VerificationError("source-manifest件数とmetadataが一致しません。")

        results = json.loads((extracted / "scan-results.json").read_text(encoding="utf-8-sig"))
        formatted = json.loads(
            (extracted / "scan-results-formatted.json").read_text(encoding="utf-8-sig")
        )
        if results != formatted:
            raise VerificationError("整形前後のSCANOSS結果が一致しません。")
        flattened = flatten_results(results)
        if len(results) != int(metadata.get("resultFileCount", -1)):
            raise VerificationError("結果ファイル件数とmetadataが一致しません。")
        if len(flattened) != int(metadata.get("resultEntryCount", -1)):
            raise VerificationError("結果エントリ件数とmetadataが一致しません。")
        id_counts = Counter(str(entry.get("id", "")) for _, entry in flattened)
        expected_counts = metadata.get("idCounts", {})
        for identifier in ("none", "snippet", "file"):
            if id_counts[identifier] != int(expected_counts.get(identifier, -1)):
                raise VerificationError(f"{identifier}件数とmetadataが一致しません。")
        if any(not identifier for identifier in id_counts):
            raise VerificationError("idのないSCANOSS結果があります。")

        matches = read_csv(extracted / "scan-matches.csv")
        if len(matches) != int(metadata.get("matchCount", -1)):
            raise VerificationError("scan-matches.csv件数とmetadataが一致しません。")
        if any(row.get("Id") == "none" for row in matches):
            raise VerificationError("scan-matches.csvにnone判定が混入しています。")
        expected_matches = id_counts["snippet"] + id_counts["file"]
        if len(matches) != expected_matches:
            raise VerificationError("一致CSV件数とSCANOSS結果内の一致件数が異なります。")

        output_dir = output_root / f"scanoss-validated-{commit[:12]}"
        if output_dir.exists():
            raise VerificationError(f"検証出力先が既に存在します: {output_dir}")
        output_dir.mkdir(parents=True)
        for name in REQUIRED_FILES:
            if name != "artifact-hashes.csv":
                (output_dir / name).write_bytes((extracted / name).read_bytes())
        (output_dir / "import-package-sha256.txt").write_text(
            f"{sha256(package)}  {package.name}\n", encoding="utf-8"
        )
        added, removed, unchanged = write_delta(
            matches, baseline, output_dir / "scan-match-delta.csv"
        )
        report = f"""# SCANOSS持込検証レポート

- 固定コミット: `{commit}`
- 持込ZIP SHA-256: `{sha256(package)}`
- ソースファイル: {len(source_manifest)}
- SCANOSS結果ファイル: {len(results)}
- 判定: none={id_counts['none']}, snippet={id_counts['snippet']}, file={id_counts['file']}
- 要確認一致: {len(matches)}
- 初回基準との差分: 追加={added}, 解消={removed}, 継続={unchanged}

## 検証済み

- ZIP内容と全成果物のSHA-256・サイズ
- 固定commitの存在
- ローカル抽出元とdevContainer側Git tree/blobの完全一致
- source manifest、SCANOSS JSON、CSV、metadataの件数整合
- 整形前後JSONの同値性

## 次の判断

`scan-match-delta.csv` の `added` と `unchanged` を確認し、公開可否を判断してください。
問題がなければ必要なレポートだけを `docs/progress/evidence/` に永続化します。
"""
        (output_dir / "validation-report.md").write_text(report, encoding="utf-8")
        return output_dir


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Windowsローカルで作成したSCANOSS持込ZIPを検証します。"
    )
    parser.add_argument("package", type=Path, help="scanoss-import-<SHA>.zip")
    parser.add_argument(
        "--repo", type=Path, default=Path.cwd(), help="検証対象Gitリポジトリ"
    )
    parser.add_argument(
        "--output-root", type=Path, default=Path("tmp"), help="検証済み成果物の出力先"
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        default=Path("docs/progress/evidence/m26-04-scanoss/scan-matches-initial.csv"),
        help="差分比較する初回SCANOSS一致CSV",
    )
    args = parser.parse_args()

    try:
        output = verify(
            args.package.resolve(),
            args.repo.resolve(),
            args.output_root.resolve(),
            args.baseline.resolve() if args.baseline else None,
        )
    except (VerificationError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"SCANOSS持込検証に失敗しました: {exc}", file=sys.stderr)
        return 1

    report = output / "validation-report.md"
    print("SCANOSS持込検証は正常に完了しました。")
    print(f"検証済み成果物: {output}")
    print(f"判定レポート  : {report}")
    print("次はvalidation-report.mdとscan-match-delta.csvだけを確認してください。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
