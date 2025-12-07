// ==UserScript==
// @name         打开网页：新标签页2
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  全能模式：智能识别电商SKU、代码操作、社交互动等"功能链接"。保持完美UI和Chrome后台打开功能。
// @author       HAZEyi
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // === 核心配置 (UI保持不变) ===
    const AUTO_CLOSE_TIMEOUT = 3000;
    const POPUP_RADIUS = '8px';
    const POPUP_SHADOW = '0 2px 8px rgba(0,0,0,0.1)';
    const POPUP_BG = 'rgba(255, 255, 255, 0.95)';

    // === 状态管理 ===
    const getCurrentMode = () => GM_getValue('openMode', 'popup');
    const getBackgroundMode = () => GM_getValue('backgroundMode', false);
    const getCurrentDomain = () => window.location.hostname;
    const getExcludedSites = () => GM_getValue('excludedSites', []);
    const isCurrentSiteExcluded = () => getExcludedSites().includes(getCurrentDomain());

    // === 核心逻辑：大师级链接识别 ===
    const isFunctionalLink = (link) => {
        const href = link.getAttribute('href');

        // 1. 基础物理层过滤 (URL & Protocol)
        if (!href || href === '' || href === '#' || href === 'javascript:;' || href.includes('javascript:void')) return true;
        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('sms:')) return true;

        // 2. 开发者意图过滤 (Attributes)
        if (link.target === '_self' || link.target === '_top' || link.target === 'iframe') return true;
        const role = link.getAttribute('role');
        // 增加 'treeitem' (目录), 'checkbox', 'radio' (选项)
        if (role && ['button', 'tab', 'menuitem', 'option', 'switch', 'checkbox', 'radio', 'treeitem'].includes(role)) return true;

        // 3. 页内锚点 (Internal Anchor) - 解决目录跳转问题
        try {
            if (href.startsWith('#')) return true;
            const urlObj = new URL(link.href);
            // 只要 Path 相同且带有 Hash，就视为页内跳转 (忽略 Search 参数的变化，防止某些动态参数干扰)
            if (urlObj.pathname === window.location.pathname && urlObj.hash !== '') return true;
        } catch (e) {}

        // 4. 强功能属性 (Framework Triggers)
        const functionalityAttrs = [
            'onclick', 'download',
            'data-toggle', 'data-trigger', 'data-target', 'data-action', 'data-dismiss', 'data-cmd', // data-cmd 常见于老论坛
            'aria-controls', 'aria-expanded', 'aria-haspopup', 'aria-disabled', 'aria-selected', // 选中状态
            'ng-click', '@click', 'v-on:click', ':click', // Vue/Angular
            'hx-get', 'hx-post', 'hx-target' // HTMX
        ];
        for (const attr of functionalityAttrs) {
            if (link.hasAttribute(attr)) return true;
        }

        // 5. 内容纯数字 (Pagination)
        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;

        // 6. 关键词深度匹配 (Deep Keywords Analysis)
        // 组合检查：Class, ID, Title, Aria-Label, Text, 以及父元素的Class (用于捕捉组件内的链接)
        const parentClass = link.parentElement ? link.parentElement.className : '';
        const strToCheck = (
            (link.className || '') + ' ' +
            (link.id || '') + ' ' +
            (link.title || '') + ' ' +
            (link.getAttribute('aria-label') || '') + ' ' +
            parentClass + ' ' +
            text
        ).toLowerCase();

        const functionalKeywords = [
            // === 账户与系统 (System) ===
            'login', 'logout', 'signin', 'signout', 'register', 'auth', // 认证
            'submit', 'confirm', 'cancel', 'reset', 'save', // 表单
            'edit', 'delete', 'remove', 'modify', 'update', 'destroy', // CRUD
            'setting', 'config', 'preference', 'option', 'tool', // 设置
            'close', 'dismiss', 'hide', 'open', 'menu', 'nav', // 窗口控制
            'copy', 'duplicate', 'paste', 'clipboard', // 剪贴板 (CSDN/GitHub)
            'translate', 'language', 'locale', // 语言切换 (必须本页)

            // === 交互与浏览 (Interaction) ===
            'expand', 'collapse', 'fold', 'unfold', 'toggle', // 展开收起 (知乎/微博)
            'show more', 'load more', 'view more', 'read more', // 加载更多
            'next', 'prev', 'previous', 'first', 'last', 'pagination', // 翻页
            'filter', 'sort', 'order', 'switch', 'view', 'grid', 'list', // 筛选排序
            'search', 'find', 'zoom', 'preview', 'modal', 'dialog', // 搜索预览

            // === 电商专用 (E-Commerce) - 重点增强 ===
            'cart', 'basket', 'checkout', 'buy', 'purchase', // 购买
            'sku', 'spec', 'attr', 'variant', 'prop', 'dimension', // 规格选择 (淘宝/京东)
            'color', 'size', 'weight', 'select', 'selected', // 属性选择
            'coupon', 'voucher', 'bonus', 'promotion', // 优惠券
            'thumb', 'thumbnail', 'gallery', // 图片切换

            // === 社交与内容 (Social & Content) ===
            'like', 'dislike', 'vote', 'upvote', 'downvote', 'agree', // 态度 (知乎)
            'fav', 'star', 'watch', 'follow', 'subscribe', 'fans', // 关注 (GitHub/B站)
            'share', 'retweet', 'repost', 'forward', 'quote', // 传播 (微博/推特)
            'reply', 'comment', 'chat', 'message', 'dm', // 交流
            'report', 'block', 'mute', 'flag', // 治理

            // === 开发与工具 (Dev & Tools) ===
            'fork', 'branch', 'blame', 'raw', 'history', // GitHub
            'run', 'compile', 'debug', 'console', // 在线编辑器

            // === 多媒体控制 (Media) ===
            'play', 'pause', 'stop', 'mute', 'volume', 'fullscreen', 'danmaku',

            // === 中文关键词库 (全面覆盖) ===
            '登录', '登入', '注册', '注销', '退出', '账户',
            '提交', '确认', '取消', '重置', '保存', '应用',
            '编辑', '修改', '删除', '移除', '设置', '管理',
            '复制', '剪贴', '代码', '翻译', '语言',
            '更多', '展开', '收起', '显示', '隐藏', '阅读全文',
            '上一页', '下一页', '首页', '尾页', '加载',
            '筛选', '排序', '切换', '视图', '搜索', '查找',
            '下载', '导出', '打印', '预览',
            '购物车', '加入', '购买', '结算', '支付', '下单',
            '规格', '选择', '颜色', '尺码', '套餐', '优惠券', '领券',
            '点赞', '喜欢', '收藏', '关注', '粉丝', '分享', '转发',
            '回复', '评论', '私信', '消息', '举报', '屏蔽',
            '赞同', '反对', '感谢', '帮助', '有用',
            '播放', '暂停', '全屏', '弹幕', '清晰度'
        ];

        // 7. 特殊Class模式匹配 (Pattern Matching)
        const btnClassPatterns = [
            'btn', 'button', 'ui-btn', 'js-', 'action', 'toggle',
            'sku', 'attr', 'prop', // 电商SKU Class
            'icon-', 'fa-', 'glyph' // 纯图标按钮
        ];

        if (functionalKeywords.some(kw => strToCheck.includes(kw))) return true;

        // 对Class进行更严格的单词边界检查，防止误杀 (例如 class="btn-link" 可能只是样式)
        const classList = (link.className || '').toLowerCase().split(/\s+/);
        if (classList.some(cls => btnClassPatterns.some(pt => cls.includes(pt)))) {
            // 二次确认：如果是 .btn 但 href 很长且看起来像文章链接，可能只是样式像按钮
            // 但为了安全起见，只要长得像按钮，我们倾向于它是功能
            return true;
        }

        return false;
    };

    const isSystemFolderLink = (href) => {
        if (/^file:\/\/\/[a-zA-Z]:\//.test(href)) return true;
        return false;
    };

    // === UI渲染逻辑 (保持 UI 完全不变) ===
    const createLinkOptionsPopup = (event, link) => {
        if (isCurrentSiteExcluded() || isFunctionalLink(link) || isSystemFolderLink(link.href)) return;

        const popup = document.createElement('div');
        popup.id = 'link-options-popup';
        Object.assign(popup.style, {
            position: 'fixed',
            top: `${event.clientY}px`,
            left: `${event.clientX}px`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: POPUP_BG,
            border: '1px solid rgba(0,0,0,0.05)',
            borderRadius: POPUP_RADIUS,
            boxShadow: POPUP_SHADOW,
            padding: '5px 8px',
            zIndex: '99999',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            lineHeight: '1.4',
            maxWidth: '220px',
            pointerEvents: 'all',
            cursor: 'default'
        });

        const optionsContainer = document.createElement('div');
        optionsContainer.style.display = 'flex';
        optionsContainer.style.gap = '2px';
        optionsContainer.style.justifyContent = 'space-between';

        const createBtn = (text, flex, minWidth, color, bg, hoverBg) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            Object.assign(btn.style, {
                padding: '4px 6px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: bg,
                cursor: 'pointer',
                color: color,
                fontWeight: text.includes('新标签') || text.includes('后台') ? '500' : '400',
                transition: 'all 0.1s',
                flex: flex,
                minWidth: minWidth
            });
            if (hoverBg) {
                btn.addEventListener('mouseenter', () => btn.style.backgroundColor = hoverBg);
                btn.addEventListener('mouseleave', () => btn.style.backgroundColor = bg);
            }
            return btn;
        };

        const currentBtn = createBtn('🏠 当前页', '1', '70px', '#555', 'transparent');
        const isBg = getBackgroundMode();
        const newTabBtn = createBtn(
            isBg ? '❐ 后台打开' : '↗ 新标签页',
            '1.5',
            '100px',
            '#4a90e2',
            'rgba(74, 144, 226, 0.15)',
            'rgba(74, 144, 226, 0.25)'
        );

        currentBtn.addEventListener('click', () => {
            window.location.href = link.href;
            popup.remove();
        });

        newTabBtn.addEventListener('click', () => {
            if (getBackgroundMode()) {
                GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            } else {
                window.open(link.href, '_blank');
            }
            popup.remove();
        });

        optionsContainer.appendChild(currentBtn);
        optionsContainer.appendChild(newTabBtn);
        popup.appendChild(optionsContainer);
        document.body.appendChild(popup);

        setTimeout(() => { if (popup.parentNode) popup.remove(); }, AUTO_CLOSE_TIMEOUT);
        popup.addEventListener('mouseleave', () => popup.remove());
    };

    // === 事件处理 (保持不变) ===
    const handleLinkClick = (event) => {
        if (isCurrentSiteExcluded()) return;

        const link = event.target.closest('a');
        if (!link || !link.href) return;

        // 全局快捷键跳过 (Ctrl/Cmd/Shift + Click)
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;

        if (isFunctionalLink(link) || isSystemFolderLink(link.href)) return;

        const currentMode = getCurrentMode();

        if (currentMode === 'popup') {
            event.preventDefault();
            event.stopPropagation();
            createLinkOptionsPopup(event, link);
        } else if (currentMode === 'newtab') {
            event.preventDefault();
            event.stopPropagation();
            if (getBackgroundMode()) {
                GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            } else {
                window.open(link.href, '_blank');
            }
        }
    };

    const init = () => {
        document.addEventListener('click', handleLinkClick, true);
    };

    // === 菜单命令 (保持不变) ===
    GM_registerMenuCommand('1. ⚙️ 切换：前台/后台打开', () => {
        const next = !getBackgroundMode();
        GM_setValue('backgroundMode', next);
        alert(`已切换为：${next ? '后台静默打开' : '前台立即跳转'}`);
    });
    GM_registerMenuCommand('2. 打开方式：启用选择框', () => { GM_setValue('openMode', 'popup'); alert('已启用选择框模式'); });
    GM_registerMenuCommand('3. 打开方式：直接新标签页', () => { GM_setValue('openMode', 'newtab'); alert('已切换为直接新标签页模式'); });
    GM_registerMenuCommand('4. 打开方式：浏览器默认', () => { GM_setValue('openMode', 'default'); alert('已切换为浏览器默认模式'); });
    GM_registerMenuCommand('🚫 排除当前网站', () => {
        const d = getCurrentDomain(); const s = getExcludedSites();
        if (!s.includes(d)) { s.push(d); GM_setValue('excludedSites', s); alert(`已排除: ${d}`); }
    });
    GM_registerMenuCommand('✅ 恢复当前网站', () => {
        const d = getCurrentDomain(); const s = getExcludedSites();
        const i = s.indexOf(d); if (i !== -1) { s.splice(i, 1); GM_setValue('excludedSites', s); alert(`已恢复: ${d}`); }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();