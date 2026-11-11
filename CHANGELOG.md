# 版本记录 Changelog

版本号每次改动都会前进：修 bug / 改文案 → patch，加功能 → minor。倒序，最新在最上。

## 0.3.1

- 页面给路由起中文名并排在 id 旁边：`额度下限 · 保留余量` + 原样显示 `quota-floor/keep`（magpie 的路由选择器只认 ASCII id，那边仍显示 id，这里两行对照着看）。
- 修掉页面上「改参数」提示里的老路径（`…\magpie-plugins\floor` → `…\magpie-plugins\quota-floor`），并让它跟着当前 softCap 走。
- `package.json` 补 `magpie.name`、`magpie.summary`、`homepage`、`bugs`，Market 卡片能显示中文简介。

## 0.3.0

- 路由策略 `quota-floor/keep`：给每个席位留 `floor`% 余量（默认 1，触发线 99%），接近用满的排到最后；读不到用量的席位排在已读到的后面。
- 只读页面：席位表、路由现状、为什么这样排。
