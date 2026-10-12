Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: merges templates/workflow.md「**"Continue" carries no authorization to start work.** … Until the owner says so explicitly, do not open a worktree, dispatch a subagent, write code, or change any file.」
Touches: templates/workflow.md

## What

`docs/agents/project.md`「Rules and lessons」第一條,原文:

> - **Say where the authorization came from before acting.** Before the first change in a
>   batch of work, write one line: "I take <the owner's sentence> as authorization; next I do X."
>   If no sentence can be quoted, there is no authorization yet: ask. It is an output rule, so
>   the owner can interrupt when the line is missing. Two ways it goes wrong with the right
>   sentence quoted (2026-09-06, 2026-09-07): **a ruling is not a write permission** — the owner
>   settling how the system should behave is not leave to edit files, and the two are asked for
>   separately; and **the scope does not grow by itself** — it covers what the owner named, not
>   a file inferred along the way.

kit 現在只有「"Continue" carries no authorization」這一個特例。這條是它的一般形:任何一批工作的第一個改動之前,都要引出 owner 的那一句;「Continue」不能被引用為動手的那一句,只是其中一例。建議放在 `templates/workflow.md` 的「Continue」段旁邊(或取代該段的通則部分,保留「X just started 就別碰 X」這個特例)。

## Why

**2026-09-06(`60b798f`「Two gates, because the prose was already there and got skipped」)。** `/grill-with-docs` 談完一批可調參數後,Claude 在同一個 session 裡自己手寫了一張票、直接實作了 66 顆旋鈕,還把一個參數從票 04 搬到票 08、拆掉 `blocked by 04`。它拿來當放行的,是三輪之前 owner 說的「先照你的建議做完,我驗過覺得有問題再改」;最後一輪 owner 回的其實是「這些好像都算技術決策,給你決定」——那是在回答問題,不是放行。Claude 把兩句合成授權,下一則訊息就已經是 tool call,中間沒有任何一句話。owner 原話:「問題是你也沒有在當時的回覆說你有拿到授權啊,所以你有沒有拿到授權完全要我猜喔?」

當時的取捨(同一 commit 的票內 Comments):

- **hook 攔不到這件事**:hook 看得到路徑,看不到「這是一批工作的第一個動作」。所以做成輸出規則——意圖只有 Claude 看得到,輸出 owner 看得到,那一行缺席就是可偵測的訊號,owner 可以直接打斷。
- **不再寫一條 memory**:memory 裡已經有 `ask-before-each-item`(「每項開工前先問;『告訴我』不等於『去做』」),這次沒攔住,因為 Claude 認定三輪前那句就是那個「先問」。再加一條靠同一個機制(Claude 自己的判斷)的規則,等於提議一個已經失效過的東西。

**2026-09-07(`6339625`)。** 同一個 session 裡又發生兩次,owner 當場喊停,補成規則裡的兩種失敗模式:一是 owner 裁掉一個設計問題,Claude 把那句裁決引來當寫入授權去改票;二是同一個動作裡順手改了一個 owner 從頭到尾沒提過的檔。

**2026-10-07(`a5d1c14`)。** 舊時代的規則清理時,這條從 `CLAUDE.md`「Working with the author」搬進 `docs/agents/project.md`,縮成現在的英文一段;當時同一批的另一道閘門(`worklist_gate.py` hook)隨舊流程一起刪掉,這條輸出規則留了下來。

owner(2026-10-12):09-07 之後沒有再出現「引用了一句、但還是錯」的情況——規則裡的兩種失敗模式至今是完整的。

## Generality

- **Portable**:不依賴 Unity、Rust 或這個 repo 的任何路徑與工具;只牽涉「owner 在 chat 說的話」和「agent 的第一個改動」,任何 repo 都有這兩樣。
- **New**:kit 的 `templates/`、`skills/`、`global.md` 只有「"Continue" carries no authorization」這一個特例,以及 owner boundary(哪些指令永遠是 owner 的)。沒有一條要求 agent 把授權來源說出口,也沒有寫到「裁決不是寫入許可」「範圍不會自己長大」。`inbox/` 現有三份提案都不談這件事。它把「Continue」那條推廣成通則,所以是 `merges`。
- **A rule, not a value**:沒有任何 repo 特定的值;每個 repo 都套用同一行格式。
