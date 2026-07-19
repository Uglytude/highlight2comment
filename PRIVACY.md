# Privacy Policy · highlight2comment

Last updated: 2026-07-19

## The short version

highlight2comment does not collect, transmit, store remotely, or share any data. Period.

## What the extension stores, and where

- Your highlights and comments are stored locally in your browser's extension storage (`chrome.storage.local`) on your own device.
- If you choose to connect a folder (for example an Obsidian vault), notes are written to a Markdown file in that folder on your own device. Folder access is granted by you through the browser's own permission dialog and can be revoked at any time in Chrome settings.
- A small technical activity log (for example "note saved", "sync succeeded") is kept locally in the same extension storage, capped at 200 entries, to help you troubleshoot. It never leaves your device.

## What the extension does NOT do

- No accounts, no sign-in.
- No servers. The extension makes zero network requests. You can verify this in the source code or in your browser's DevTools.
- No analytics, no telemetry, no crash reporting.
- No cookies, no fingerprinting, no tracking of any kind.
- No selling or sharing of data, because no data ever leaves your device.

## Permissions explained

- `storage`: used to save your notes locally in your browser.
- `offscreen`: used to run a background helper document that writes your notes to the folder you selected. It has no network capability.
- Content script on web pages: used only to detect your text selection and show the save button. It reads nothing else on the page and sends nothing anywhere except into your local browser storage.

## Open source

The complete source code is public at https://github.com/Uglytude/highlight2comment. What you read there is exactly what runs.

## Contact

Questions: uglytude.spacemiao@gmail.com

---

# 隐私政策(中文)

最后更新:2026-07-19

## 一句话版本

highlight2comment 不收集、不上传、不远程存储、不分享任何数据。

## 数据存在哪里

- 你的划线和评论存在你自己设备上的浏览器扩展存储里。
- 如果你选择连接一个文件夹(比如 Obsidian 库),笔记会写入你设备上该文件夹内的 Markdown 文件。文件夹访问由你通过浏览器自带的授权弹窗亲自授予,随时可在 Chrome 设置中撤销。
- 一份本地技术日志(如「保存成功」「同步成功」)保存在同一扩展存储中,上限 200 条,仅用于排查问题,永不离开你的设备。

## 这个扩展不做的事

无账号、无服务器、零网络请求、无统计、无追踪、无 Cookie。数据从未离开你的设备,所以也不存在出售或分享。

## 权限说明

`storage` 用于本地保存笔记;`offscreen` 用于后台把笔记写进你选定的文件夹;网页上的脚本只用于识别你选中的文字并显示保存按钮。

## 开源

完整源码公开于 https://github.com/Uglytude/highlight2comment,你看到的代码就是运行的代码。
