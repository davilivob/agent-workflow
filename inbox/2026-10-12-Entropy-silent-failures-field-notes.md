Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: adds
Touches: templates/workflow.md

## What

`docs/silent-failures.md` 開頭,原文:

> Things on this project that break without saying so, or say something else. Each
> entry is: what you see, what it actually was, how to tell, what to do.
>
> Not a diary and not a changelog. Add an entry when something costs you more than
> half an hour and the message you were given pointed the wrong way.

`CLAUDE.md` 指向它的那一行:

> - **[docs/silent-failures.md](docs/silent-failures.md)** — toolchain landmines that report something other than their cause (…). Check it before debugging anything on the headset → hub → Bevy chain; add an entry when something costs more than half an hour and the message pointed the wrong way.

建議在 kit 的「Project lessons」加一段,並在「Bugs: use `diagnosing-bugs`」後補「check `docs/silent-failures.md` first」:

> A toolchain failure that cost more than half an hour, and whose message pointed at the wrong cause, goes into `docs/silent-failures.md`: one entry each — what you see, what it actually was, how to tell, what to do — and a symptom index at the top. A wrong lead is recorded as one, so nobody follows it twice. Not a diary, not a changelog. Create the file with its first entry. Read it before debugging.

## Why

**2026-08-16**(`61604d6`「Field notes: the failures that reported something else」):一個下午在模擬器裡試著做校準,留下八個條目。commit message:「none of them was silent, and every one of them named the wrong cause. An interaction profile rejection presented as a missing controller. A stale slot assignment presented as a sleeping controller. A stale assembly presented as a code path that was never reached.」同一 commit 也說明為什麼錯的線索要留下:「so it does not get followed twice」。

例:第 1 條「An absent log is not evidence」——新加的 `Debug.Log` 沒印,以為那段程式沒被執行;其實是 Unity 沒重新編譯,磁碟上的 assembly 比原始碼舊。條目寫著花了一小時,調查走進一條不存在的分支。

到 2026-10-12 約 57 個 commit 動過這個檔,累積 50 多個條目,頂端有「症狀 → 條目」索引表;解決了的條目標「已解決」留檔(`docs/README.md`)。

它和 `project.md` 的 lesson 是兩回事:lesson 是 **agent 該怎麼做事**,silent-failures 是 **工具鏈怎麼騙人**。kit 目前只有前者的歸處,後者只會被寫成 memory,或沒被寫。

## Generality

- **Portable**:每個 toolchain 都有報錯指錯方向的時候(Unity、bundler、CI、驅動)。「headset → hub → Bevy」是 Entropy 自己的範圍,不進 kit。
- **New**:kit 的「Project lessons」只收 agent 行為的 lesson;`diagnosing-bugs` 是除錯流程,不留跨 session 的現場筆記。沒有一處說工具鏈的誤導要記在哪。
- **A rule, not a value**:檔名與門檻(半小時、訊息指錯方向)在每個 repo 都一樣;檔案第一次需要時才建立,比照 kit `domain.md` 對 `CONTEXT.md` 的做法,不加範本檔。
