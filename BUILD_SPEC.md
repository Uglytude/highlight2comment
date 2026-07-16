# BUILD_SPEC.md · highlight2comment V1 施工图纸

> 施工前先读 [`AGENTS.md`](./AGENTS.md)。本文件定"做什么 / 怎么拆 / 验收标准"。"怎么写"由 Sam 决定,但下面标了已知坑点,别踩。

---

## 1. 目标(核心闭环)
用户在任意网页:
1. 选中一段文字 →
2. 冒出一个小按钮,点它弹出极简小框 →
3. 写一句评论,保存 →
4. 「原话 + 评论 + 来源」存进本地,按日期累积 →
5. 一键导出成一个 `.md`;并可(一次授权后)自动追加进 Obsidian 库里的固定 log 文件。

纯本地,无账号,无云,无服务器。

## 2. 明确不做(V1 非目标)
页面高亮留痕、颜色、标签、主题、账号、登录、云同步、多设备、YouTube/PDF/音频/AI 摘要。一个都不做。

## 3. 目标文件结构
```
src/
  manifest.json            # MV3 配置
  content/
    content.js             # 注入页面:监听选中、显示"加评论"按钮、弹极简小框、抓来源
    content.css            # 小框 + 按钮样式(极简,无花哨配色)
  popup/
    popup.html             # 已存条数 + 「连接 Obsidian 文件夹」+「下载全部」+ 状态
    popup.js
    popup.css
  background/
    service-worker.js      # 协调:接收存请求、调 storage、调 logger
  lib/
    storage.js             # 存储层:chrome.storage.local 读 / 写 / 列出(单一职责)
    markdown.js            # 渲染层:一条 -> MD 片段;全部 -> 完整 MD(单一职责,纯函数)
    obsidian-writer.js     # File System Access:授权文件夹 + 追加写 log(单一职责)
    logger.js              # 足迹日志(黑匣子),第一天就装
  icons/
    icon-16.png icon-48.png icon-128.png   # 占位图标即可
```

## 4. 每个文件的职责(一句话)
- `content.js`:监听选中文字;非空时在选区附近显示小按钮;点击弹小框写评论;保存时把一条 note 发给 service-worker;抓当前 `url / title / 作者(能抓就抓,抓不到留空) / 时间`。
- `markdown.js`:**纯函数**,不碰存储、不碰 DOM。输入 note(s),输出符合下方格式的 Markdown 字符串。
- `storage.js`:只负责 chrome.storage.local 的增 / 查 / 全量读。不懂 UI、不懂 markdown。
- `obsidian-writer.js`:只负责 File System Access(拿文件夹句柄、持久化句柄、追加写入)。
- `logger.js`:统一打点函数,如 `log(action, detail)`。
- `service-worker.js`:接消息 -> 调 storage 存 -> 调 logger 记。只做调度。
- `popup.js`:显示条数;「连接 Obsidian 文件夹」触发授权;「下载全部」导出;失败明确提示。

## 5. 数据模型(一条 note)
```json
{
  "id": "时间戳+随机短串",
  "text": "选中的原话",
  "comment": "用户写的评论",
  "url": "来源完整 url",
  "title": "页面标题",
  "author": "作者,抓不到就空字符串",
  "ts": "ISO 时间戳",
  "dateKey": "YYMMDD"
}
```

## 6. MD 渲染格式(严格按这个)
一天一个 `## YYMMDD` 小节,同一天的多条累积在下面。每条:
```markdown
## 260716

> "选中的原话"

我的评论:这里是评论

> [!info]- 来源:网站名 · 作者 · HH:MM
> 完整长 url 收在这个可折叠抽屉里
```
要点:
- 日期用 **YYMMDD**(六位,无横杠),不用 YYYY-MM-DD。
- 来源用 Obsidian 可折叠 callout `> [!info]-`,默认收起;可见行短(网站名 · 作者 · 时:分),完整长 url 收在抽屉里。
- 作者抓不到就省略"· 作者"那段。

## 7. 核心流程
1. `content.js` 监听 `mouseup` / selectionchange;有非空选区 -> 选区附近显示小按钮。
2. 点按钮 -> 极简小框(一个 textarea + 保存 / 取消)。
3. 保存 -> 组装 note -> 发消息给 `service-worker`。
4. `service-worker` -> `storage.js` 追加存入 chrome.storage.local -> `logger` 记一条。**这步成功就算"存住了",绝不丢。**
5. Obsidian 写入(见坑点):在 popup 里,把本地存储中"尚未写入文件"的 note 追加进 log 文件;写失败明确报错,但本地数据不受影响。
6. `popup`:显示已存 N 条;「连接 Obsidian 文件夹」第一次授权(句柄持久化);「下载全部」用 `markdown.js` 生成完整 MD 并触发下载。

## 8. 已知坑点(别踩)
- **MV3 service worker 没有 DOM、不能用 File System Access API**。所以「连接文件夹 / 写文件 / 下载」这类要在 **popup(有 DOM + 用户手势)**里做。content 与 popup 之间通过 chrome.storage / messaging 传数据。
- **File System Access 句柄要持久化**:把目录句柄存 IndexedDB,重启后用 `queryPermission` / `requestPermission` 恢复,实现"授权一次,以后自动记得"。
- **service worker 会休眠**:不要把状态只放在内存里,状态放 chrome.storage。
- 选区小按钮注意别挡住页面、别在输入框里误触发。

## 9. 分阶段(里程碑,按顺序做,每步能独立验证)
- M1:选中 -> 弹框 -> 存进 chrome.storage;popup 显示条数。(闭环最小可用)
- M2:「下载全部」导出符合格式的完整 MD。
- M3:「连接 Obsidian 文件夹」+ 授权持久化 + 自动追加写 log。
- M4:logger 打点齐全;错误路径都有明确提示;README 写好安装说明。

## 10. 验收清单(每条要实际跑通)
- [ ] 在一个普通网页选中文字,出现小按钮,点击能写评论并保存。
- [ ] 保存后 popup 条数 +1;刷新页面 / 重开浏览器后数据还在。
- [ ] 「下载全部」得到的 `.md` 完全符合第 6 节格式(日期 YYMMDD、来源可折叠)。
- [ ] 「连接 Obsidian 文件夹」授权一次后,再存新笔记能自动追加进同一个 log 文件;重启浏览器后仍记得授权。
- [ ] 写 Obsidian 失败时(比如撤销授权)有明确报错,且本地已存数据不丢。
- [ ] 全程无账号、无网络请求发往任何服务器(可在 Network 面板核对)。
- [ ] logger 里能看到关键动作的打点。
- [ ] 代码分层干净:markdown.js 是纯函数;storage / writer 不含 UI 逻辑。

---
*V1 完成 = 上面每条打勾且能演示。超范围的东西一律不做。*
