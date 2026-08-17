# highlight2comment

A tiny Chrome extension for people who read long articles and want to keep the good sentences. Built for the AI era: every highlight lands in one plain Markdown file you can hand straight to ChatGPT, Claude, or any AI. No organizing needed.

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

**How is this different from a traditional highlighter?**
Traditional highlighters assume you will come back later to organize: tags, colors, folders, exports. highlight2comment assumes your next reader is an AI. Everything lands in one plain Markdown log that ChatGPT, Claude, or any AI can read as-is, so there is nothing to tidy up. Highlight, comment, done.

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

**Can I use it on two computers with the same vault (multiple devices)?**
Yes. Each computer keeps its own local notes, and both append into the same Markdown log; entries merge and numbering continues, nothing gets overwritten by design. Three habits keep it safe: don't write from both computers at the same moment, let iCloud/your sync finish before switching machines, and connect the folder once on each computer. Since v1.3.0 the extension also checks the log on every sync: if saved notes ever go missing after a sync conflict, the popup offers a one-click "Write them back".

## Privacy, honestly

- Notes are stored in your browser's local extension storage and, if you connect one, in the folder you chose. Nothing else.
- The extension makes **zero network requests**. There is no server, no account, no analytics. You can verify this in the source (it's small) or in DevTools.
- The only permission it asks for is `storage`. Folder access is granted by you, explicitly, through the browser's own picker.

## Requirements

- Chrome (or a Chromium based browser) with Developer mode.
- That's all. No build step, no dependencies.

## About Uglytude

I'm SpaceMiao. You can call me MiaoMiao. Uglytude is a brand I made up.

I'm a drawing hobbyist, not a programmer. Apart from a required C course at university, I had never written a single app in my life. My philosophy is simple: if you want to make something, make an ugly one first. Ugly is better than nothing.

Uglytude didn't start as a brand. It started as an idea.

I crash all the time when I draw on livestream. The eyes go wrong, the face shape is off, the colors come out as something I never wanted. You can't talk yourself into "keep going, the next one will be pretty," because the next one probably won't be. So swap the goal: make ugly ones. When ugly is the goal, ugly becomes normal. You make ninety-nine failures normal, and that's how you reach the hundredth.

I gave the idea a name. In Chinese, 耐丑力, the ability to endure the ugly. Then I went looking for an English word and ended up inventing one. Uglytude. An attitude towards your own drawings.

First it became a video, where people sketched along with me, drawing whatever they saw, not thinking about the result.

Then it became an app.

I had never made an app before, and never put anything on the App Store. I started vibe coding in January 2026, and the app shipped on 26 February. The first version did almost nothing: it hands you a random reference, you just draw, you don't decide anything else. Make one ugly drawing, that's the goal. Now it can hand you a random color palette too.

It's on build 14 now. But I have never changed a single thing about the UI. It's still ugly. Everything I ship is performance and features. It works, that's enough. It was an ugly thing on day one and it still is.

👉 [Uglytude](https://apps.apple.com/us/app/uglytude/id6759151455)

Then it became a shop. In Zurich, fourteen square meters, a stationery shop where you can draw.

I used to keep Uglytude for drawing only. Then it wandered off somewhere else.

Building the website for that shop, I realised I was using the same thing. I had never used GitHub, never built a website. I'm a perfectionist. An app had to be perfect before launching, a drawing had to be perfect before anyone could see it.

Then I found out that if you set the goal to "make an ugly thing", an ugly skill, an ugly extension, and share it publicly, you can actually start.

These are all tools I use every day. They're ugly and plainly packaged, but each one is a starting point, so the next build never starts from zero.

I share my ugly tools on GitHub. Most of them exist because I ran into the problem myself, at work, in life, or while learning to use AI. I needed it, so I made one. Once it worked, I put it out there.

- [highlight2comment](https://github.com/Uglytude/highlight2comment) — there are plenty of highlighters for the web already. I found all of them fussy. Mine does two things: keep the sentence, add a comment. Then it stops. Nothing else.
- [photo2md](https://github.com/Uglytude/photo2md) — whatever is inside a screenshot on your phone is stuck there. This gets it out.
- [md-save-app](https://github.com/Uglytude/md-save-app) — no picking a folder, no feeding it to an AI first. One click and the note is in your Obsidian vault.
- [pain2product](https://github.com/Uglytude/pain2product) — I have a lot of pain points. Collect them, and a pain point turns into a project. Then I share the project.
- [delegate-to-chatgpt-pro](https://github.com/Uglytude/delegate-to-chatgpt-pro) — I never knew whether to trust what the AI told me. This checks the answer against your own sources.
- [spacemiao-lesezimmer](https://github.com/Uglytude/spacemiao-lesezimmer) — I'm learning German. Tap a word in a picture book and the translation shows up.

They all live here 👉 [github.com/Uglytude](https://github.com/Uglytude)

The one you just downloaded is only one of them. One of the others might happen to solve something else for you.

So Uglytude isn't just the name of that app. It's my philosophy for making things. Making a drawing, making an app, opening a shop, writing a small tool. Same thing to me.

Making an ugly thing is OK. Ugly is better than nothing.

It's exactly because someone this bad at it could still pull it off that you get to think: maybe I could try too.

---

# highlight2comment(中文)

一个极简 Chrome 扩展,给读长文章、想留住好句子的人。为 AI 时代而生:所有划线落进同一份纯 Markdown 文件,直接丢给 ChatGPT、Claude 或任何 AI,不用整理。

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

**它和传统划线工具有什么本质不同?**
传统划线工具默认你以后会回来整理:打标签、分颜色、归文件夹、导出。highlight2comment 默认你的下一个读者是 AI:所有划线落在一份纯 Markdown 日志里,ChatGPT、Claude 或任何 AI 拿来就能读,根本没有「整理」这一步。划线,评论,闭环。

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

**两台电脑用同一个笔记库(多设备)可以吗?**
可以。每台电脑各存各的本地笔记,写入同一份 Markdown 日志时是合并追加:条目保留、编号接着数,设计上不会互相覆盖。三个习惯保平安:两台电脑别同时写、换电脑前等 iCloud 或你的同步工具搬完、每台电脑各自连一次文件夹。v1.3.0 起插件每次同步还会自动点名:万一同步冲突弄丢了已存笔记,面板会提示并提供一键「补写回文件」。

## 隐私,说实话

- 笔记只存在浏览器本地和你自己选的文件夹里,没有服务器、没有账号、没有统计,**零网络请求**,源码很小,欢迎自查。
- 唯一申请的权限是 `storage`;文件夹访问由你通过浏览器自己的弹窗明确授权。

## 关于 Uglytude

我叫 SpaceMiao，你可以叫我妙妙。Uglytude 是我创造的一个品牌。

我是一个画画爱好者，不是程序员。除了大学必修 C 语言，我从来没有自己编过任何 APP。我的 philosophy 很简单：你要做一个东西，就先把一个丑的东西做出来。丑比没有好。

一开始 Uglytude 不是一个品牌，它就是我的一个想法。

我直播画画经常翻车。眼睛画坏了，脸型不对，颜色涂出来根本不是我要的。你很难说服自己「再坚持一下，下一幅就好看了」，因为下一幅多半还是不好看。那干脆把目标换掉：就画丑画。丑变成目标，丑就成了正常的事。你把九十九次失败变成正常，才画得到第一百张。

我给这个想法起了个名字，叫耐丑力，忍耐丑的能力。后来想找一个对应的英文，就造了一个词：Uglytude。一种面对自己的画的态度。

它先变成了一期视频，带大家画人物速写，看到什么画什么，不想结果。

后来变成了一个 App。

我以前从来没有做过 App，也没有在苹果商店上发过任何东西。2026 年 1 月我开始学 Vibe Coding，2 月 26 号 App 就上线了。第一版功能特别简单，随机给你一张参考图，你只管画，别的都不用管。画一张丑画，这就是目标。现在它也能随机出色卡了。

到现在是 build 14。但是它的 UI 到今天一个字都没改过，还是很丑。我改的都是性能和功能，能用就行。它从一开始就是一个丑东西，现在还是。

👉 [Uglytude（耐丑力）](https://apps.apple.com/us/app/uglytude/id6759151455)

再后来它变成一家店。在苏黎世，十四平方米，一家可以画画的文具店。

本来我是把 Uglytude 用在学画画上面的。后来用着用着，它就跑到别的地方去了。

我给这家店做网站的时候发现，我在用同一个东西。我以前从来没用过 GitHub，没建过网站。我是一个很完美主义的人，觉得 App 要完美才能放上去，画要完美才能放出来。

后来我发现，把目标定成「我做一个丑东西」，做一个丑的 skill，一个丑的插件，然后公开分享出去，这件事就能开始了。

这些都是我自己每天在用的工具。它丑，包装也不好看，但它是一个起点，让你下次再 build 什么东西，不是从零开始。

我在 GitHub 上分享我做的丑工具。大部分都是为了解决我自己在工作、生活、学 AI 的过程中真实碰到的问题。我需要，我就做一个；能用了，就公开分享。

- [highlight2comment](https://github.com/Uglytude/highlight2comment)：网页上的划线工具已经很多了，但我觉得都太花里胡哨。我这个只做两件事，把句子存下来，写一句评论，然后就结束了，不做别的。
- [photo2md](https://github.com/Uglytude/photo2md)：手机截图里的内容存不下来，这个把它弄出来。
- [md-save-app](https://github.com/Uglytude/md-save-app)：不用挑文件夹，也不用先喂给 AI，一键就进你的 Obsidian vault。
- [pain2product](https://github.com/Uglytude/pain2product)：我有很多痛点。把痛点收集起来，它就变成一个项目，然后我把这个项目分享出去。
- [delegate-to-chatgpt-pro](https://github.com/Uglytude/delegate-to-chatgpt-pro)：AI 给的答案我一直不知道能不能信，这个会拿你自己的原始资料再核一遍。
- [spacemiao-lesezimmer](https://github.com/Uglytude/spacemiao-lesezimmer)：我在学德语，绘本点一下就出翻译。

全部在这里 👉 [github.com/Uglytude](https://github.com/Uglytude)

你现在下载的这个只是其中一个。剩下几个可能正好解决你别的问题。

所以 Uglytude 不只是那个 App 的名字，是我做东西的 philosophy。画一幅画、做一个 App、开一家店、写一个小工具，对我来说是同一件事。

做个丑东西，it's OK。丑比没有好。

正是因为我这么烂都能做成，你才会有信心说：「好像我也可以试一下。」


---

MIT License · Uglytude · made by [spacemiao](https://github.com/Uglytude)
