# GM · AI & Security 日报

为了每天北京时间早上 **08:30 打开瞅一眼**。首页默认展示前 3 个完整自然日的重要新闻，例如 10 月 14 日早上看 10 月 11—13 日全部新闻；日期从新到旧，每天按重要程度排序。

网站：https://jeanettehuang0703.github.io/GM-AISecurity/

## 范围与检索

收录重大网络攻击、漏洞与补丁、数据泄漏、供应链、云与身份安全；加密货币、区块链、钱包、稳定币及重大行业与监管新闻；AI 系统与单／多 Agent 安全、AI 辅助攻防，以及模型能力、推理、训练／后训练、评测和科研应用。共识、合约、跨链、Agent 和分布式系统是重点研究方向，不排除其他重大新闻。

搜索覆盖全部八列、关键词及标签。空格分隔的多个词需要同时匹配；标签支持任一／全部匹配，还可限定日期与研究相关性。每页 40 条，JSON 导出包含全部匹配结果。

## 共同收藏：任何一位协作者保存，全站保留

爱心是仓库共享的保留标记，不是浏览器收藏或个人点赞。点击新闻下的 **♡ 收藏** 后打开 GitHub 原生新文件页面，登录作者或有写权限协作者的 GitHub 账号，确认 **Commit changes** 并提交到 main 后生效；若选择新分支，需要合并后才生效。任一协作者保存一次，所有访问者都可在“♥ 共同收藏”里检索该新闻，超过三天也保留。

GitHub 校验写权限：普通读者不能直接改变主仓库收藏；无权限账号即使进入入口，也只能在自己的 fork 中修改或提出需维护者合并的 PR。网页不自行识别 GitHub 登录身份，因此入口可见性不代表写权限。收藏不会在点击时虚报成功，提交且 Pages 部署完成后刷新才显示“♥ 已收藏”。详见 [GitHub 新建文件与权限](https://docs.github.com/en/repositories/working-with-files/managing-files/creating-new-files)。

一条收藏对应 `data/saved/YYYY-MM-DD-NN.json`，初始只需新闻 ID 和该网页的 Git 版本，因此不同协作者收藏不同新闻不会改写同一个列表。构建从该版本读取完整原始新闻，保留全部八列、来源、标签和前序说明；只接受当前分支历史中的版本。每天清理前先把完整快照写入同一个收藏文件，再删除过期日文件，以后不再依赖历史查询。旧的 `data/favorites.json` 格式仍兼容；发布时的同名 JSON 是合并后的完整收藏导出。

每日源文件为 `data/days/YYYY-MM-DD.json`。`node scripts/prune.mjs` 只清理早于“北京时间今天减三天”的普通日文件，永远不删除 `data/saved/` 收藏。取消收藏由作者／协作者从仓库删除对应收藏文件，提交并部署后生效，旧格式收藏还需从旧文件移除。前序正文未收藏且被清理时保留标题、日期及说明。

前端没有存储或索取访问令牌，不使用 localStorage 保存收藏，不新增访客 Issue 触发器或具有内容写权限的 Actions。仍由原有只读构建工作流发布，用户通过 GitHub 的原生提交完成仓库写入。

当前三天共 24 条：10 月 11 日保留五条早期范例，12—13 日是已有日报导入；各期保留原有核验范围说明。本次不补录 10 月 1—10 日。

## 数据容量

只保存摘要、分析、标签和原始链接，不保存全文、图片、PDF 或运行日志。构建目录 `site/` 不提交，部署产物不反复进入 Git 历史。

**清理当前日文件不会清空 Git 提交历史**，因此仓库总大小并非永久不变。按每条文本约 2—3 KB、每天 20 条估算，新增源内容约 15—22 MB／年，实际 Git 大小受压缩与修改次数影响。目前无需外部数据库；可在 Git 对象或将来收藏接近 200 MB、检索变慢时评估年度归档或对象存储。

GitHub Pages 已发布站点上限为 1 GB，普通 Git 单文件超过 100 MiB 会被阻止。参考 [Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[GitHub 大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

## 更新与发布

以 08:30 可读为目标，本地 Codex 日程在北京时间 **08:00 提前启动**，整理前一天新闻、清理过期记录、验证后推送 GitHub，再由 GitHub Actions 发布 Pages。页面显示本版本生成时间；采集、网络或部署异常可能延后。

电脑和 Codex 应用需要运行且 GitHub 认证有效。GitHub Actions 负责构建发布，不自行检索新闻或调用模型；网页发布后可独立访问。参考 [本地日程条件](https://learn.chatgpt.com/docs/automations)。

## 本地验证

需要 Node.js 22 或更新版本，无需安装依赖：

```powershell
node scripts/prune.mjs
node scripts/validate.mjs
node --test tests/archive.test.mjs
node scripts/build.mjs
node scripts/serve.mjs
```

预览 http://127.0.0.1:4173 。生成的 `site/index.html` 内嵌当前保留内容；构建也输出月分片、新闻索引和标签 JSON。Pages Source 使用 GitHub Actions，推送 main 自动触发 `.github/workflows/pages.yml`。
