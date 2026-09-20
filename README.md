# 龙圣人 · 批量邀请函生成工具

纯前端单页网站，浏览器本地运行，无需后端。上传背景图 → 批量输入姓名 → 一键合成邀请函 → 打包下载 ZIP。全部图片处理在浏览器本地完成，不上传任何服务器。

## 目录结构

```
outputs/        网站全部文件（部署这个目录即可）
  index.html    页面
  style.css     样式
  app.js        逻辑（Canvas 合成 + 拖拽 + JSZip 打包）
  jszip.min.js  本地内置的 JSZip（离线可用）
  favicon.svg   网站图标
  robots.txt    搜索引擎抓取规则
  sitemap.xml   站点地图（提交搜索引擎用）
work/           本地测试脚本（不需要部署）
```

## 本地运行

直接用浏览器打开 `outputs/index.html` 即可，无需安装任何东西。

## 如何发布到公网

> 「只有我能修改」的关键：**部署必须绑定你自己的账号**（GitHub / Vercel / Cloudflare 等）。
> 只要账号只归你一人，别人就只能浏览、无法修改或替换网站文件。

### 方案 A：GitHub Pages（推荐，免费）

1. 在终端登录 GitHub：
   ```bash
   gh auth login
   ```
2. 创建仓库并发布：
   ```bash
   gh repo create long-sheng-ren --public --source outputs --push
   gh repo edit long-sheng-ren --pages-source outputs 2>/dev/null || true
   ```
   或登录 github.com，进入仓库 → Settings → Pages → Source 选 `outputs` 文件夹。
3. 访问地址：`https://你的用户名.github.io/long-sheng-ren/`

### 方案 B：Cloudflare Pages（全球 CDN，国内访问较好）

1. 登录 dash.cloudflare.com → Workers & Pages → Create → Pages → 上传 `outputs` 文件夹。
2. 免费绑定自定义域名。

### 方案 C：Vercel / Netlify

1. 注册 vercel.com 或 netlify.com，用 GitHub 授权导入仓库。
2. 构建输出目录设为 `outputs`，无需构建命令。

## 让搜索引擎能搜到（手机 / 电脑 / 所有浏览器）

1. **绑定自定义域名**（强烈建议）：`github.io` 等免费域名也能被收录，但绑定自己的域名收录更快、更可信。
2. 把 `robots.txt` 和 `sitemap.xml` 里的 `YOUR-DOMAIN` 替换成你的真实域名（含 `https://`）。
3. 提交到搜索引擎站长平台：
   - 谷歌：search.google.com/search-console → 添加资源 → 提交 sitemap.xml
   - 必应：bing.com/webmasters → 导入谷歌数据或手动提交
   - 百度：ziyuan.baidu.com → 站点验证 → 提交 sitemap（国内域名/服务器收录效果更好）
4. 等待数天至数周，收录后用户即可在手机、电脑、所有主流浏览器搜索到。

## 常见问题

- **生成慢 / 失败？** 全程本地 Canvas 处理，与网速无关，取决于设备性能。
- **图片会泄露吗？** 不会。代码里没有任何网络上传逻辑，图片只在你的浏览器里处理。
