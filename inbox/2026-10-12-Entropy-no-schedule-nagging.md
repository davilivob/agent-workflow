Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: adds
Touches: global.md

## What

`CLAUDE.md`「Working with the author」,原文:

> - **不要反覆提醒「時間不夠」「時程很緊」。** 排程取捨由人決定。Claude 的職責是:知道接下來有哪些工作、記錄下來、讓後續 session 保有共識——不是當鬧鐘。

建議在 `global.md` 加一條:

> - Don't keep reminding the owner that time is short or the schedule is tight. Trade-offs in the schedule are the owner's; your job is to know what work is left, write it down, and keep later sessions in agreement — not to be an alarm clock.

## Why

2026-08-28(`e7678b6`)加進 `CLAUDE.md`,同時建立「Working with the author」這一節。commit message 沒寫原因;同一天 owner 這台機器的 auto-memory 記下了理由(`no-schedule-nagging`,2026-08-28):

> 排程取捨是他的決定;反覆提醒沒有資訊量,只有噪音。他要的是工作清單與共識,不是急迫感。

這條目前只存在兩處:Entropy 的 `CLAUDE.md`,以及這台機器上**只屬於 Entropy 這個專案**的 memory。owner 在其他 repo、其他機器上的 session 都看不到它。

## Generality

- **Portable**:跟任何 repo 的 stack 與內容無關,是 owner 和 agent 合作的方式。
- **New**:`global.md` 與 kit 的 `templates/` 都沒有提到時程或提醒。
- **A rule, not a value**:對每個 repo、每台機器都一樣,符合 `global.md`「True in every project on every device」的定義;放在 `templates/` 反而要每個 repo 各存一份。
