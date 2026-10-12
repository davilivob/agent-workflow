Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: merges templates/workflow.md「When a grill applies」:「Anything with a design decision the owner has to make starts with a grill … `project.md` lists changes that are always a design decision」
Touches: templates/workflow.md

## What

`docs/agents/project.md`「Rules and lessons」,原文:

> - **Purely technical decisions are Claude's**, as long as no existing behaviour changes
>   (owner, 2026-09-03). Anything touching the show's content, or something
>   the owner said they want to play with first goes back to chat.

kit 只講了哪些決策要問 owner,沒講哪些**不用問**。建議在「When a grill applies」第一段之後加:

> **A purely technical decision is yours**, as long as no existing behaviour changes: make it and give a one-line reason, instead of asking. What goes to the owner is what changes behaviour, what `project.md` lists as always a design decision, and anything the owner said they want to try first. Being handed a decision ("that's technical, you decide") settles who decides; it is not leave to act on it — see "Say where the authorization came from".

Entropy 的「the show's content」是這個 repo 對「Always a design decision」的值,所以通則改指那個欄位。

## Why

- **2026-09-03**(`8783bf9`「RoomAnchor's decisions move behind the Oneiros.Space seam」):一次架構評審之後,owner 裁決「純技術決策 Claude 自己定,只要不影響現有功能」。同一 commit 的重構就照這條做:行為零改動、測試釘住現行行為。
- **2026-09-04**(`0c0e3d3`):owner 又把一張舊票(O-08)的退休判定委託給 Claude。
- **2026-09-06**(`60b798f`):這條被用錯一次。owner 回「這些好像都算技術決策,給你決定」,Claude 把它當成動手的放行,直接改了 66 顆旋鈕。這就是 kit 已收的「Say where the authorization came from」的起因,也是建議文字最後一句的由來:把決定交給 Claude,不等於准許動手。

這條在 owner 這台機器的 auto-memory 裡也有一份(「純技術決策直接替他定」);memory 不跟著到其他機器,其他 repo 的 session 看不到。

owner 下這個裁決的理由(2026-10-12):「有些東西已經完全超出我的知識範圍,同時體感上也不見得感受得到差異,我覺得與其讓我做決定不如請 agent 幫我做,省時又省心」。也就是說,把這類決策交給 owner,他既沒有判斷的依據,也看不出結果的差別,只是多花時間。

## Generality

- **Portable**:不依賴任何 stack;任何 repo 都有「只有 owner 能決定的」和「agent 可以自己決定的」兩種決策,kit 目前只定義了前者。
- **New**:kit 的「When a grill applies」與 `project.md` 的「Always a design decision」只列要問的;「Say where the authorization came from」管的是動手,不是誰決定。把第一段講完整,所以是 `merges`。
- **A rule, not a value**:哪些事永遠是設計決策,本來就由 `project.md` 的「Always a design decision」承載;這條不新增欄位,只把它當成例外清單引用。
