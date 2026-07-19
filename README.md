# highlight2comment

A tiny Chrome extension for people who read long articles and want to keep the good sentences.

Select a sentence on any page, add a one line comment (or skip it), and everything lands in a clean Markdown log on your own computer. Numbered entries, sources tucked away as footnotes, one file that grows day by day.

**Free. Open source. No account. No cloud. No tracking.** Your notes never leave your machine.

## Why this exists

Existing highlighters either charge a monthly fee for private highlights, publish your notes to a social feed by default, or bundle a swiss army knife of features you never asked for. This tool does exactly one thing: highlight, comment, Markdown. That's it.

## Install (3 steps, no store needed)

1. Download or clone this repository.
2. Open `chrome://extensions`, turn on **Developer mode** (top right corner).
3. Click **Load unpacked** and select the **`src/` folder inside this repository** (not the repository root).

Works on Chrome and Chromium based browsers (Edge, Brave, Arc). The UI follows your browser language: English, 中文, Deutsch.

## Use

- Select text on any page. A small pill appears near the end of your selection.
- Click **✓** to save the highlight instantly, or **💬** to add a one line comment (Enter saves, Esc cancels).
- Click the extension icon to download all notes as one `.md` file, or connect a folder (for example your Obsidian vault) once. After that, notes append automatically to `highlight2comment-log.md` whenever you open the popup. A badge on the icon shows how many notes are waiting to sync.

Each note is stored like this:

```markdown
## 260717

**1.**

> "All the water in the world cannot sink a ship unless it gets inside the ship."[^abc123]

Comment: worth remembering

[^abc123]: jamesclear.com · 08:00 · https://jamesclear.com/3-2-1/example
```

## FAQ

**What is that small pinned tab on the far left?**
That is the auto-sync guardian. Chrome only keeps folder permission alive while the extension has a real open tab, so this little tab is what makes background writing possible. Leave it alone and everything stays automatic.

**I closed the pinned tab. Did I break something?**
No. Your notes are always saved in the browser first. The popup will show "Auto-sync paused" with a one-click button to bring the guardian back.

**Why does it ask me to reconnect after restarting the browser?**
Chrome revokes folder permission for all extensions on restart and offers extensions no "allow forever" option yet. One click on Reconnect after a restart is the entire cost. If Chrome ever adds persistent permission for extensions, this click disappears too.

**I never connected a folder. Do I need to care about any of this?**
No. Highlighting, commenting, and "Download all" work with zero permissions and zero setup.

## Privacy, honestly

- Notes are stored in your browser's local extension storage and, if you connect one, in the folder you chose. Nothing else.
- The extension makes **zero network requests**. There is no server, no account, no analytics. You can verify this in the source (it's small) or in DevTools.
- The only permission it asks for is `storage`. Folder access is granted by you, explicitly, through the browser's own picker.

## Requirements

- Chrome (or a Chromium based browser) with Developer mode.
- That's all. No build step, no dependencies.

---

# highlight2comment(中文)

一个极简 Chrome 扩展,给读长文章、想留住好句子的人。

在任意网页选中一句话,写一句评论(不写也行),一切都会存成你自己电脑上的一份干净 Markdown 日志:条目带编号,来源收进脚注,一个文件按天累积。

**免费、开源、无账号、无云端、无追踪。** 笔记从不离开你的电脑。

## 为什么做它

市面上的划线工具,要么私密笔记要收月费,要么默认把你的笔记发到社区,要么塞满一堆用不到的功能。这个工具只做一件事:划线、评论、Markdown。

## 安装(三步,不用商店)

1. 下载或 clone 本仓库。
2. 打开 `chrome://extensions`,右上角开启**开发者模式**。
3. 点**加载已解压的扩展程序**,选择**仓库里面的 `src/` 文件夹**(注意是里面的 src,不是仓库根目录)。

## 用法

- 选中文字,选区末尾会出现一个小胶囊:**✓** 一键只存划线,**💬** 写一句评论(回车即存,Esc 取消)。
- 点扩展图标:可一键下载全部笔记为 `.md`,或连接一个文件夹(比如你的 Obsidian 库),之后打开面板时笔记自动追加进 `highlight2comment-log.md`。图标角标会显示还有几条待同步。

## 常见问题

**标签栏最左边那个钉住的小标签是什么?**
它是自动同步的守护者。Chrome 只在插件拥有一个真正打开的标签页时才保留文件夹授权,这个小标签就是后台自动写入能成立的原因。放着别管,一切自动。

**我把小标签关了,坏了吗?**
没坏。笔记永远先安全存在浏览器里。面板会显示「自动同步已暂停」,一键就能把守护标签请回来。

**为什么浏览器重启后要点一次 Reconnect?**
Chrome 重启时会收回所有插件的文件夹授权,而且暂时不给插件「永久允许」的选项。重启后点一次,就是全部成本。哪天 Chrome 补上这个选项,这一下也会消失。

**我不连文件夹,需要管这些吗?**
不需要。划线、评论、「Download all」导出,零授权零设置,装好就能用。

## 隐私,说实话

- 笔记只存在浏览器本地和你自己选的文件夹里,没有服务器、没有账号、没有统计,**零网络请求**,源码很小,欢迎自查。
- 唯一申请的权限是 `storage`;文件夹访问由你通过浏览器自己的弹窗明确授权。

---

MIT License · Uglytude · made by [spacemiao](https://github.com/Uglytude)
