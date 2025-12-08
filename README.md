# 🚀 Open Links: New Tab 2 (打开网页：新标签页2)

[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Script-green?logo=tampermonkey)](http://tampermonkey.net/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2-orange.svg)]()

> **[中文]** 一个极简、智能的油猴脚本，让你能够完全掌控链接的打开方式。
>
> **[English]** A minimalist, smart Userscript that gives you full control over how links open.

---

## ✨ 特性 / Features

### 1. 三重模式随心切换 (Triple Modes)
你可以通过脚本菜单实时切换三种模式：
* **🟣 启用选择框 (Popup Mode)**: *Default*. 点击链接时在鼠标旁弹出一个极简的选择框，由你决定是「🏠 当前页打开」还是「↗ 新标签页打开」。
* **🟢 默认新标签页 (Direct New Tab)**: 点击链接直接在新标签页打开（支持后台静默打开）。
* **⚪ 浏览器默认 (Browser Default)**: 脚本暂停工作，恢复浏览器原生行为。

### 2. 🧠 深度智能识别 (Deep Intelligence)
脚本内置了 **v1.2 核心识别引擎**。它不像普通脚本那样暴力拦截所有 `<a>` 标签，而是像经验丰富的网民一样思考。
它会自动**放行**以下类型的链接（在当前页执行，不弹窗）：
* 🚫 **功能按钮**: 登录、注册、注销、评论、回复、点赞。
* 🛒 **电商交互**: 加入购物车、选择颜色/尺码 (SKU)、筛选排序、领取优惠券。
* 📄 **页面操作**: 展开全文、加载更多、分页数字 (1, 2, 3...)、目录跳转。
* 📺 **多媒体**: 播放、暂停、全屏、弹幕开关。
* 💻 **开发工具**: GitHub 的 Copy, Fork, Star, Blame 等操作。

### 3. 👁️ 可视化指示器 (Visual Indicators)
*New in v1.2*
不再需要猜测链接会如何打开。脚本会在链接右侧添加一个微小的呼吸圆点：
* 🟣 **紫色圆点**: 点击将弹出选择框。
* 🟢 **绿色圆点**: 点击将直接在新标签页打开。
* (无圆点): 这是一个功能按钮，点击将执行网页默认逻辑。
*(此功能可在菜单中一键关闭)*

### 4. 🚀 强力后台打开 (Force Background Tab)
完美解决了 Chrome/Edge 等现代浏览器强制聚焦新标签页的问题。
* 开启「后台静默打开」后，新链接会在背景加载，你的视线不会离开当前阅读的内容。

---

## 🛠️ 使用说明 / Usage

1.  安装 [Tampermonkey](http://tampermonkey.net/) 扩展。
2.  点击 **[安装脚本]([https://github.com/hazeyi/Open-web-page-new-tab-2/blob/main/Open-web-page-new-tab-2.js])** (Install Script)。
3.  浏览任意网页，点击链接体验。
4.  **菜单设置**: 点击浏览器右上角的 Tampermonkey 图标，选择本脚本，即可看到动态控制面板：
    * `⚙️ 打开方式：...` (切换 Popup/Direct/Default)
    * `⚙️ 新标签页：后台/前台` (切换是否静默打开)
    * `👁️ 链接指示器：开启/关闭` (Toggle visual dots)
    * `🚫 排除当前网站` (Add current site to blacklist)



## ⚖️ License
Distributed under the MIT License.
