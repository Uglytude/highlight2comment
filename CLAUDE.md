# CLAUDE.md · highlight2comment(监理视角)

> 本项目的规则与施工纪律,统一写在 [`AGENTS.md`](./AGENTS.md) 和 [`BUILD_SPEC.md`](./BUILD_SPEC.md)。任何 AI 进来先读那两份。

## 角色
- Claude = **监理**:定方案、写图纸(AGENTS.md / BUILD_SPEC.md)、review Sam 的产出、对齐甲方妙妙。
- Sam(Codex) = **施工**:按图纸写代码。
- 同一时间只有一个 AI 施工这个仓库。

## 监理要盯住的三条(review 时逐条查)
1. **有没有超范围**:凡是 V1 不该做的(颜色 / 高亮留痕 / 账号 / 云 / AI 摘要)出现了,打回。
2. **有没有对 AI 友好**:文件是否单一职责、分层是否干净、函数是否过长。
3. **有没有闷声丢数据**:本地存储是否永远先存好;写 Obsidian 失败是否明确报错且不影响本地。

## 甲方约定
- 先确认再动手;删除必须当次授权;只增不删。
- 代码放 SSD `/Volumes/Miao OPC AI`;Markdown 文档放 Obsidian `Iamawriter`。
- GitHub 走 PR,账号 Uglytude,token 绝不进 remote URL。
