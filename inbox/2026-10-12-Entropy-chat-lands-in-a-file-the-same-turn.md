Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: merges templates/workflow.md step 1 **Grill**「A grill always lands in writing — a spec, an ADR, or (Direct) commit messages plus `CONTEXT.md` — never in chat alone.」
Touches: templates/workflow.md

## What

`docs/agents/project.md`「Rules and lessons」,原文:

> - **What is said in chat that changes what gets built goes into the file in the same turn**
>   — the spec, `CONTEXT.md` or an ADR — because the conversation is lost at the next compaction.

kit 只要求 grill 落成文字(step 1),以及 lesson 寫進 `docs/agents/`(Project lessons)。grill 之外的對話——執行到一半在 chat 裡改了範圍、Direct 的小改動、「Continue」時順口裁掉一件事——沒有規則管。建議加一條通則(放在「Say where the authorization came from」旁,step 1 那句改成指回它):

> **What is said in chat that changes what gets built goes into its file in the same turn**: not at the end of the task, not once it settles. The spec, `CONTEXT.md`, an ADR or `project.md`, whichever the statement belongs to. The conversation is lost at the next compaction, and the next session reads only files. A grill landing in writing (step 1) is one case of this.

## Why

**2026-08-17**(`076fc55`「What we decided is in the files now, not only in the conversation」)。commit message:「This session told the author to redo work they had already finished, and rebuilt a plan from a scope that had been superseded an hour earlier. Both had one cause: state was living in the conversation, and the conversation gets compacted.」

當時寫進 `docs/worklist.md` 的原始規則(§2「The file is the state. The conversation is not.」)說得更具體:demo 的範圍在對話裡重新講過,工作也照新範圍做了,檔案卻從沒改,所以下一次讀檔產出的是一份沒人在做的 demo 的 plan。同一節還有一條推論:agent 要依賴自己「記得」而不是剛讀到的東西時,先去讀,或明說自己是憑記憶。

這是 Entropy 最早的流程規則之一。2026-10-07(`a5d1c14`)舊流程清理時,`worklist.md` 刪除,這條縮成一行搬進 `docs/agents/project.md`,適用範圍從 `TODO.md` 擴大到 spec、`CONTEXT.md`、ADR。

## Generality

- **Portable**:不依賴任何 stack;只要 agent 的 context 會被 compaction,任何 repo 都一樣。
- **New**:kit 的 step 1 只管 grill,Project lessons 只管 lesson;沒有一條管其他時候在 chat 裡改變了要做什麼的話。把 step 1 那句推廣成通則,所以是 `merges`。
- **A rule, not a value**:寫進哪個檔沿用 kit 已有的分類(spec、`CONTEXT.md`、ADR、`project.md`),不新增欄位。
