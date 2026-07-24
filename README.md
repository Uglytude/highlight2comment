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

**How is this different from Glasp, Web Highlights, or Obsidian Web Clipper?**
Those are all good tools with different goals. highlight2comment keeps private highlighting free forever, has no social feed, no account, and saves plain Markdown locally. If you want the smallest possible flow (select, comment, Enter) and one Markdown file you can hand to any AI, this is that tool.

**Where are my highlights stored?**
In your browser's local extension storage, and, if you connect a folder, in one Markdown file (`highlight2comment-log.md`) inside that folder, for example your Obsidian vault. There is no server copy.

**Can I use my highlights with ChatGPT, Claude, or other AI tools?**
Yes, that is the main design goal. Everything lands in one plain Markdown file, and Markdown is the input format AI reads best. Drop the file into any AI chat and ask for summaries, connections, or a review of what you read this week.

**Does it work with Obsidian?**
Yes. Connect your vault folder once and notes append automatically to a Markdown log inside it. No plugin needed on the Obsidian side.

**Does it work on pages that block copying?**
Yes. Selecting and saving works even on many pages that disable normal copy and paste.

**Is it really free? What's the catch?**
Free, open source (MIT), no account, no premium tier. It was built by one person who needed exactly this tool. The code is small enough to read in one sitting.

## Privacy, honestly

- Notes are stored in your browser's local extension storage and, if you connect one, in the folder you chose. Nothing else.
- The extension makes **zero network requests**. There is no server, no account, no analytics. You can verify this in the source (it's small) or in DevTools.
- The only permission it asks for is `storage`. Folder access is granted by you, explicitly, through the browser's own picker.

## Requirements

- Chrome (or a Chromium based browser) with Developer mode.
- That's all. No build step, no dependencies.

## About the author: why "ugly"?

Hi, I'm MiaoMiao (online: SpaceMiao). I'm a painting hobbyist, not a programmer. In January 2026 I started vibe coding, using AI to solve problems in my painting life.

The first app I made is called Uglytude. The name is ugly plus attitude: literally "tolerance for ugly" (耐丑力), really a stance: I choose to make ugly things. Then I realized it's not just an app name. It's my philosophy for making things: I used to be a perfectionist. An app had to be perfect before launching, a painting had to be perfect before anyone could see it. Now I set my goal to "make an ugly thing": an ugly extension, an ugly skill, then share it publicly. Making an ugly thing is OK. **Ugly is better than nothing.**

These are all tools I actually use every day. They're ugly and plainly packaged, but each one is a starting point, so the next build never starts from zero.

You're looking at this ugly thing right now. Which means: if I can, you can too.

- 🎨 Like painting? Try my app [Uglytude](https://uglytude.com)
- 🏠 In Zurich? I'm setting up a little hut for ugly paintings. Address on [the website](https://uglytude.com). Come play.
- 🔧 Curious how a non-coder builds tools with AI? Follow [@Uglytude](https://github.com/Uglytude)

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

**它和 Glasp、Web Highlights、Obsidian Web Clipper 有什么不同?**
它们都是好工具,只是目标不同。highlight2comment 的私密划线永远免费,没有社区信息流、没有账号,笔记以纯 Markdown 存在本地。如果你想要最短的流程(选中、评论、回车)和一份能直接丢给任何 AI 的 Markdown 文件,就是它了。

**我的划线存在哪里?**
浏览器本地扩展存储里;如果你连接了文件夹,还会写进那个文件夹里的一份 Markdown 文件(`highlight2comment-log.md`),比如你的 Obsidian 库。没有服务器副本。

**划线能喂给 ChatGPT、Claude 这些 AI 吗?**
能,这正是设计目标。所有笔记落在一份纯 Markdown 文件里,而 Markdown 是 AI 读得最顺的格式。把文件丢进任何 AI 对话,让它总结、找关联、回顾你这周读了什么。

**支持 Obsidian 吗?**
支持。连接一次你的库文件夹,笔记就自动追加进里面的 Markdown 日志,Obsidian 那边不用装任何插件。

**禁止复制的网页能用吗?**
能。很多禁用了复制粘贴的页面,选中和保存照样工作。

**真的免费?有什么坑?**
免费、开源(MIT)、无账号、没有付费版。作者就是因为自己需要这样一个工具才做的。源码小到一次就能读完。

## 隐私,说实话

- 笔记只存在浏览器本地和你自己选的文件夹里,没有服务器、没有账号、没有统计,**零网络请求**,源码很小,欢迎自查。
- 唯一申请的权限是 `storage`;文件夹访问由你通过浏览器自己的弹窗明确授权。

## 关于作者:为什么是「丑东西」

我是妙妙(网名 SpaceMiao),一个画画爱好者,不是程序员。2026 年 1 月我开始接触 Vibe Coding,想用 AI 解决画画里的问题。

我做的第一个 App 叫 Uglytude(耐丑力)。这个名字是 ugly 加 attitude:字面是「耐得住丑」,其实是一种态度:我就要做丑东西。后来我意识到,这不只是一个 App 的名字,它是我做东西的 philosophy:我以前是完美主义者,App 要完美才敢上架,画要完美才敢给人看。现在我把目标定成「做一个丑东西」:一个丑插件、一个丑 skill,做完就公开分享。做个丑东西,it's OK。**丑比没有好。**

这些都是我自己每天在用的工具。它丑,包装也不好看,但它是一个起点:下次再做什么,就不用从零开始了。

你现在看到了这个丑东西,那就说明:我如果可以,你也可以。

- 🎨 喜欢画画?试试我的 App [Uglytude(耐丑力)](https://uglytude.com)
- 🏠 在苏黎世?我正在搭一个画丑画的小屋,地址就在[网站](https://uglytude.com)上,欢迎来玩
- 🔧 想知道一个不会代码的人怎么用 AI 做工具?关注 [@Uglytude](https://github.com/Uglytude)

---

MIT License · Uglytude · made by [spacemiao](https://github.com/Uglytude)
