Source: 2enter/dvtp-2026 @ 69c81d3
Date: 2026-10-12
Kind: replaces setup.sh 第 4 節的「--check leaves all three alone」
Touches: setup.sh, tests/setup.test.sh

## What

`setup.sh` 第 4 節（Guard、Drift check、language）在 `--check` 下完全不檢查：

    #    language puts global.md's reply-language rule into the system prompt, where it outlasts a long session. --check leaves all three alone.
    ...
    if [ -n "$CHECK" ]; then :

第 6 節的 Device code 也依賴第 4 節裝好的 Drift check hook：

    # 6. The Device code differs per device too: the Drift check hook hands it to the agent for the Session title.

## Why

在 dvtp-2026（win 裝置）跑 `/sync-workflow` 時，`setup.sh --check` 只回報了 drift 不在 PATH 的 TODO，沒有其他問題。實際上 `~/.claude/settings.json` 少了 SessionStart 的 Drift check hook，也少了 `language`，只有 Guard 的 PreToolUse hook 在。

後果：`/clear` 之後的 session 開頭沒有 `Device:` 行，也沒有 Drift report。agent 照 `global.md` 找不到 Device code，因此漏設 Session title，後來又沒想到去讀 `~/.claude/device`，反過來問 owner。手動執行 `node ~/.claude/kit/hooks/drift.cjs --session` 輸出正常（`Device: win` 加 Drift report），可見問題出在 hook 沒有登記，不在 drift.cjs。之後跑一次 `sh ~/.claude/kit/setup.sh`（非 `--check`）就補上了。

`/sync-workflow` 和 `/propose-to-kit` 的 preflight 都依賴 `--check` 找出缺漏，第 4 節不回報，缺漏就一直沒被發現。

這台裝置上 hook 當初為什麼不見，原因不明。

## Generality

- Portable：只跟 kit 自己的 setup.sh 和 `~/.claude/settings.json` 有關，與任何 repo 的 stack 無關。
- New：kit 目前沒有規則要求 `--check` 回報缺少的 hook 或 language；這份提案是取代「--check leaves all three alone」。
- A rule, not a value：每台裝置都適用「--check 要把第 4 節的缺漏印成 TODO（例如 `TODO: run sh ~/.claude/kit/setup.sh to install the Drift check hook`）」，不是某個 repo 的設定值。
