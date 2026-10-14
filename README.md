# GM · AI & Security 日报

最简单的静态新闻档案：一个 HTML 页面、按天存储的 JSON、浏览器内标签检索。无需数据库、前端框架或运行时 API 密钥。

## 浏览与检索

- 默认显示最新一期，保留八列表格，每日按重要程度排序。
- 点击标签会检索全部历史，支持“任一标签”或“全部标签”；可继续限定日期和研究相关性。
- 关键词搜索覆盖标题、信息、判断、研究方向及来源。多个空格分隔的词需同时匹配。
- 前序记录可点击跳转；检索条件保存在 URL，可复制分享。
- 当前结果可以导出为 JSON；`data/archive.json` 是部署时生成的全量档案。

初始档案来自本对话已输出的 2026-10-11 至 2026-10-13 内容，共 24 条。10 月 11 日是范例，非完整日报。导入没有重新核验原始报道；旧闻解读、实验限制及来源可信度保留在各条记录中。

## 本地预览

需要 Node.js 22 或更新版本，不需要安装 npm 依赖。

```powershell
npm run validate
npm test
npm run build
npm run preview
```

打开 http://127.0.0.1:4173 。也可以直接打开生成的 `site/index.html`；页面内嵌完整档案，检索无需服务器。直接打开文件时，复制在线检索链接不可用。

## GitHub Pages

在仓库 Settings → Pages → Build and deployment 中，将 Source 设为 **GitHub Actions**。提交到 `main` 会自动验证 JSON、运行检索测试、生成静态页面并发布。仓库仅上传 `site/` 目录作为网站，不发布本地研究资料。

网站地址：https://JeanetteHuang0703.github.io/GM-AISecurity/

以上是预期地址，首次 Actions 部署成功后才可访问。工作流位于 `.github/workflows/pages.yml`。

## 每天更新

现有 Codex 日程在每天北京时间 **9:00** 检索和整理新闻，然后写入 `data/days/YYYY-MM-DD.json`。日期统一指北京时间前一天，`rank` 是当日重要程度顺序；更新和旧闻不能伪装为当天首次事件。

1. 按 `UPDATE_GUIDE.md` 新增当日 JSON；历史日期文件保持原样，事实纠错应保留说明。
2. 运行 `npm run validate`、`npm test`、`npm run build`。
3. 仅提交本仓库的新闻数据和必要标签变更，推送 `main`。
4. GitHub Actions 自动更新网页。

**新闻生成依赖本地 Codex 日程**：电脑和桌面应用需要运行，且本地需有 GitHub 写入权限。GitHub Actions 负责发布，不会自行搜集或生成新闻。失败时旧站点继续保留，不写虚构占位日报。

文档：[GitHub Pages 发布](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically)、[本地日程运行条件](https://learn.chatgpt.com/docs/automations)。
