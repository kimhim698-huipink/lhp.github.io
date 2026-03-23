# 分享站点说明

这个目录用于做 GitHub Pages 分享页。

## 当前结构

- `index.html`
  - 根首页，默认跳到最新一期
- `2026-03-23/index.html`
  - 2026-03-23 当日消费汇总页

## 每日更新步骤

1. 新建日期目录，例如 `2026-03-24/`
2. 把当天的汇总 HTML 放成 `2026-03-24/index.html`
3. 修改根目录 `index.html`
   - 把“最新一期”改成新日期
   - 在历史列表新增一条链接
4. 提交并推送到 GitHub

## GitHub Pages 发布

如果这是一个新仓库：

```bash
cd /Users/tb/alphapai-research/share-site
git init
git branch -M main
git add .
git commit -m "init share site"
git remote add origin <你的仓库地址>
git push -u origin main
```

然后在 GitHub 仓库页面：

1. `Settings`
2. `Pages`
3. `Deploy from a branch`
4. 选择 `main` 和 `/ (root)`

发布完成后，分享链接通常是：

```text
https://<你的GitHub用户名>.github.io/<仓库名>/
```

## 本地预览

```bash
cd /Users/tb/alphapai-research/share-site
python3 -m http.server 8000
```

浏览器打开：

```text
http://localhost:8000/
```
