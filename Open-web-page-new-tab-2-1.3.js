// ==UserScript==
// @name         打开网页：新标签页2 (v6.0 Neon Hover版)
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  基于 v5.9：选择框极速弹出，无弹出动画；鼠标悬停选项时增强字体放大、颜色变亮、霓虹光影和玻璃流光；保留真实导航链接接管、智能防误触与 Liquid Glass 质感。
// @author       HAZE
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const AUTO_CLOSE_TIMEOUT = 3800;
    const MOUSE_LEAVE_DELAY = 900;
    let isBypassing = false;

    const FUNCTION_KEYWORDS = [
        'account', 'profile', 'avatar', 'user menu', 'my account', 'sign in', 'signin', 'login', 'logout', 'log out',
        '个人资料', '头像', '账户', '账号', '登录', '登陆', '退出', '注销',

        'new chat', 'new conversation', 'start chat', 'search', 'history', 'library', 'explore', 'sidebar', 'collapse sidebar', 'expand sidebar',
        '新对话', '新建对话', '开始聊天', '搜索', '历史', '记录', '库', '侧边栏', '收起侧边栏', '展开侧边栏',

        'settings', 'setting', 'preferences', 'menu', 'more', 'more options', 'options', 'open menu', 'close', 'back', 'next', 'previous', 'prev',
        '设置', '偏好设置', '菜单', '更多', '更多选项', '关闭', '返回', '下一页', '上一页', '下一个', '上一个',

        'download', 'save', 'export', 'print', 'copy', 'share', 'upload', 'import', 'refresh', 'reload', 'submit', 'cancel', 'confirm',
        '下载', '保存', '导出', '打印', '复制', '分享', '上传', '导入', '刷新', '提交', '取消', '确认',

        'edit', 'delete', 'remove', 'like', 'favorite', 'fav', 'star', 'reply', 'comment', 'filter', 'sort', 'cart', 'buy', 'play', 'pause',
        '编辑', '删除', '移除', '点赞', '收藏', '星标', '回复', '评论', '筛选', '排序', '购物车', '购买', '播放', '暂停',

        'expand', 'collapse', 'show more', 'load more', 'dropdown', 'popover',
        '展开', '收起', '显示更多', '加载更多', '下拉', '弹出'
    ];

    const UI_ZONE_SELECTORS = [
        'header', 'nav', 'aside', 'footer', 'form', 'dialog',
        '[role="navigation"]', '[role="toolbar"]', '[role="menubar"]', '[role="menu"]', '[role="tablist"]', '[role="listbox"]',
        '.navbar', '.nav-bar', '.topbar', '.top-bar', '.toolbar', '.tool-bar', '.sidebar', '.side-bar', '.menu', '.dropdown',
        '.popover', '.modal', '.drawer', '.panel', '.tabs', '.tabbar', '.tab-bar', '.breadcrumb', '.pagination'
    ].join(',');

    const CONTENT_ZONE_SELECTORS = [
        'main', 'article', '[role="main"]', '.content', '.article', '.post', '.entry', '.markdown', '.prose', '.readme', '.body',
        '.message-content', '.item-body', '.posts-item', '.post-list', '.article-list'
    ].join(',');

    const SITE_NAV_SELECTORS = [
        'nav a[href]',
        'header a[href]',
        '.navbar a[href]',
        '.nav a[href]',
        '.navbar-nav a[href]',
        '.mobile-menus a[href]',
        '.mobile-navbar a[href]',
        '.menu-item > a[href]',
        '.sub-menu a[href]',
        '.breadcrumb a[href]',
        '.pagination a[href]',
        '.pager a[href]',
        '.fcode-links a[href]',
        'footer a[href]'
    ].join(',');

    const INTERACTIVE_SELECTORS = [
        'button', 'input', 'select', 'textarea', 'label', 'summary', 'details',
        '[contenteditable="true"]', '[contenteditable=""]',
        '[role="button"]', '[role="menuitem"]', '[role="tab"]', '[role="option"]', '[role="switch"]', '[role="checkbox"]',
        '[role="radio"]', '[role="combobox"]', '[role="listbox"]', '[role="treeitem"]',
        '[aria-haspopup]', '[aria-expanded]', '[aria-controls]', '[data-toggle]', '[data-target]', '[data-state]',
        '[data-radix-collection-item]', '[data-headlessui-state]', '[popover]'
    ].join(',');

    const CONTROL_ATTRS = [
        'onclick', 'data-toggle', 'data-target', 'data-action', 'data-testid', 'data-state', 'aria-controls', 'aria-expanded',
        'aria-haspopup', 'ng-click', '@click', 'v-on:click', 'x-on:click', 'hx-get', 'hx-post'
    ];

    const CONTROL_CLASS_RE = /\b(btn|button|icon|avatar|profile|account|menu|toggle|dropdown|popover|modal|dialog|drawer|sidebar|toolbar|tab|chip|pill|action|control|download|upload|search|settings?|more|pagination|pager)\b/i;

    const FILE_DOWNLOAD_RE = /\.(zip|rar|7z|tar|gz|exe|dmg|pkg|msi|deb|rpm|apk|ipa|torrent|iso|csv)(\?|#|$)/i;

    const ARTICLE_LINK_SELECTORS = [
        'posts.posts-item .item-heading > a[href]',
        '.posts-item .item-heading > a[href]',
        '.ajax-item .item-heading > a[href]',
        '.item-body .item-heading > a[href]',
        '.related-posts .item-heading > a[href]',
        '.related-item .item-heading > a[href]',
        '.post-list .item-heading > a[href]',
        '.article-list .item-heading > a[href]',
        'h1.item-heading > a[href]',
        'h2.item-heading > a[href]',
        'h3.item-heading > a[href]',
        '.item-heading > a[href][data-tippy-content]',
        '.item-heading > a[href][data-original-title]',
        '.item-heading > a[href][title]'
    ].join(',');

    const HAZE_INDICATOR_CLASSES = ['haze-ind-cur', 'haze-ind-newfore', 'haze-ind-newback', 'haze-ind-nav'];

    const state = {
        _runMode: GM_getValue('hazeRunMode', 'popup'),
        _primaryTarget: GM_getValue('hazePrimaryTarget', 'newtab'),
        _newtabBehavior: GM_getValue('hazeNewtabBehavior', 'background'),
        _indicator: GM_getValue('showIndicator', true),
        _theme: GM_getValue('theme', 'auto'),
        _excluded: GM_getValue('excludedSites', []),
        _academic: GM_getValue('academicMode', true),
        _smartGuard: GM_getValue('hazeSmartGuard', true),
        _glassEffect: GM_getValue('hazeGlassEffect', true),
        _motionEffect: GM_getValue('hazeMotionEffect', true),
        _siteNav: GM_getValue('hazeSiteNav', true),

        get runMode() { return this._runMode; },
        set runMode(v) { this._runMode = v; GM_setValue('hazeRunMode', v); },

        get primaryTarget() { return this._primaryTarget; },
        set primaryTarget(v) { this._primaryTarget = v; GM_setValue('hazePrimaryTarget', v); },

        get newtabBehavior() { return this._newtabBehavior; },
        set newtabBehavior(v) { this._newtabBehavior = v; GM_setValue('hazeNewtabBehavior', v); },

        get indicator() { return this._indicator; },
        set indicator(v) { this._indicator = v; GM_setValue('showIndicator', v); },

        get theme() { return this._theme; },
        set theme(v) { this._theme = v; GM_setValue('theme', v); },

        get excluded() { return Array.isArray(this._excluded) ? this._excluded : []; },
        set excluded(v) { this._excluded = Array.isArray(v) ? v : []; GM_setValue('excludedSites', this._excluded); },

        get academic() { return this._academic; },
        set academic(v) { this._academic = v; GM_setValue('academicMode', v); },

        get smartGuard() { return this._smartGuard; },
        set smartGuard(v) { this._smartGuard = v; GM_setValue('hazeSmartGuard', v); },

        get glassEffect() { return this._glassEffect; },
        set glassEffect(v) { this._glassEffect = v; GM_setValue('hazeGlassEffect', v); },

        get motionEffect() { return this._motionEffect; },
        set motionEffect(v) { this._motionEffect = v; GM_setValue('hazeMotionEffect', v); },

        get siteNav() { return this._siteNav; },
        set siteNav(v) { this._siteNav = v; GM_setValue('hazeSiteNav', v); }
    };

    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    const getAbsoluteUrl = (url) => {
        try { return new URL(url, window.location.href).href; }
        catch (e) { return url; }
    };

    const safeUrl = (url) => {
        try { return new URL(url, window.location.href); }
        catch (e) { return null; }
    };

    const debounce = (func, delay) => {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const getElClass = (el) => String((el && el.getAttribute && el.getAttribute('class')) || '');

    const getAccessibleText = (el) => normalize([
        el.innerText,
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('alt'),
        el.getAttribute('data-testid'),
        el.getAttribute('data-test-id'),
        el.getAttribute('data-tooltip'),
        el.getAttribute('data-tippy-content'),
        el.getAttribute('data-original-title'),
        el.getAttribute('id'),
        getElClass(el)
    ].filter(Boolean).join(' '));

    const containsKeyword = (text, keywords = FUNCTION_KEYWORDS) => {
        if (!text) return false;
        return keywords.some((kw) => {
            const k = normalize(kw);
            if (!k) return false;

            if (/^[a-z0-9 ]+$/.test(k)) {
                const pattern = escapeRegExp(k).replace(/\s+/g, '\\s+');
                return new RegExp(`\\b${pattern}\\b`, 'i').test(text);
            }

            return text.includes(k);
        });
    };

    const parseCssColor = (color) => {
        if (!color || color === 'transparent') return null;

        const rgba = color.match(/rgba?\(([^)]+)\)/i);
        if (rgba) {
            const parts = rgba[1].split(',').map(v => v.trim());
            const r = parseFloat(parts[0]);
            const g = parseFloat(parts[1]);
            const b = parseFloat(parts[2]);
            const a = parts[3] === undefined ? 1 : parseFloat(parts[3]);
            if ([r, g, b, a].some(Number.isNaN)) return null;
            return { r, g, b, a };
        }

        const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            let h = hex[1];
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16),
                a: 1
            };
        }

        return null;
    };

    const luminance = ({ r, g, b }) => {
        const srgb = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    };

    const getComputedThemeFromPage = () => {
        const root = document.documentElement;
        const body = document.body;

        const classBag = normalize([
            root && root.className,
            body && body.className,
            root && root.getAttribute('data-theme'),
            body && body.getAttribute('data-theme'),
            root && root.getAttribute('theme'),
            body && body.getAttribute('theme')
        ].filter(Boolean).join(' '));

        if (/(^|[\s_-])(dark|darktheme|dark-theme|theme-dark|night|night-mode|black)([\s_-]|$)/i.test(classBag)) return 'dark';
        if (/(^|[\s_-])(light|lighttheme|light-theme|theme-light|day|white)([\s_-]|$)/i.test(classBag)) return 'light';

        const candidates = [body, root].filter(Boolean);
        for (const el of candidates) {
            try {
                const color = parseCssColor(getComputedStyle(el).backgroundColor);
                if (color && color.a >= 0.35) {
                    return luminance(color) < 0.42 ? 'dark' : 'light';
                }
            } catch (e) {}
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const getEffectiveTheme = () => {
        if (state.theme === 'dark' || state.theme === 'light') return state.theme;
        return getComputedThemeFromPage();
    };

    const injectStyle = () => {
        if (document.getElementById('haze-style')) return;

        const s = document.createElement('style');
        s.id = 'haze-style';
        s.textContent = `
            :root {
                --haze-bg: rgba(252,253,255,0.70);
                --haze-bg-strong: rgba(255,255,255,0.88);
                --haze-bg-soft: rgba(255,255,255,0.52);
                --haze-bg-hover: rgba(255,255,255,0.42);
                --haze-text: rgba(16,20,28,0.94);
                --haze-text-sub: rgba(65,72,86,0.74);
                --haze-border: rgba(255,255,255,0.56);
                --haze-border-strong: rgba(255,255,255,0.82);
                --haze-hairline: rgba(20,24,32,0.08);
                --haze-shadow: 0 22px 70px rgba(16,24,40,0.20), 0 3px 14px rgba(16,24,40,0.12);
                --haze-shadow-small: 0 8px 24px rgba(16,24,40,0.14);
                --haze-inner: inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -1px 0 rgba(255,255,255,0.28);
                --haze-primary: #007AFF;
                --haze-primary-soft: rgba(0,122,255,0.16);
                --haze-accent-2: #34C759;
                --haze-ind-cur: #0A84FF;
                --haze-ind-newfore: #FF9500;
                --haze-ind-newback: #34C759;
            }

            [data-haze-theme="dark"] {
                --haze-bg: rgba(24,27,33,0.72);
                --haze-bg-strong: rgba(36,39,48,0.86);
                --haze-bg-soft: rgba(255,255,255,0.08);
                --haze-bg-hover: rgba(255,255,255,0.12);
                --haze-text: rgba(248,250,255,0.96);
                --haze-text-sub: rgba(218,225,238,0.76);
                --haze-border: rgba(255,255,255,0.16);
                --haze-border-strong: rgba(255,255,255,0.26);
                --haze-hairline: rgba(255,255,255,0.10);
                --haze-shadow: 0 24px 78px rgba(0,0,0,0.56), 0 4px 20px rgba(0,0,0,0.34);
                --haze-shadow-small: 0 10px 30px rgba(0,0,0,0.36);
                --haze-inner: inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(255,255,255,0.08);
                --haze-primary: #0A84FF;
                --haze-primary-soft: rgba(10,132,255,0.24);
                --haze-accent-2: #32D74B;
                --haze-ind-cur: #64B5FF;
                --haze-ind-newfore: #FFB340;
                --haze-ind-newback: #54E46B;
            }

            [data-haze-glass="off"] {
                --haze-bg: rgba(255,255,255,0.97);
                --haze-bg-strong: rgba(255,255,255,0.99);
                --haze-bg-soft: rgba(0,0,0,0.04);
                --haze-bg-hover: rgba(0,0,0,0.06);
                --haze-border: rgba(0,0,0,0.10);
                --haze-border-strong: rgba(0,0,0,0.14);
                --haze-shadow: 0 18px 50px rgba(16,24,40,0.16);
                --haze-inner: inset 0 1px 0 rgba(255,255,255,0.60);
            }

            [data-haze-theme="dark"][data-haze-glass="off"] {
                --haze-bg: rgba(32,34,40,0.98);
                --haze-bg-strong: rgba(42,44,52,0.99);
                --haze-bg-soft: rgba(255,255,255,0.08);
                --haze-bg-hover: rgba(255,255,255,0.11);
                --haze-border: rgba(255,255,255,0.14);
                --haze-border-strong: rgba(255,255,255,0.20);
                --haze-shadow: 0 22px 60px rgba(0,0,0,0.48);
                --haze-inner: inset 0 1px 0 rgba(255,255,255,0.14);
            }

            a[data-haze-status="text"] {
                position: relative !important;
                padding-left: 10px !important;
            }

            a[data-haze-status="text"]::before {
                content: "";
                position: absolute;
                left: 0;
                top: 50%;
                width: 5px;
                height: 5px;
                border-radius: 999px;
                opacity: 0.76;
                pointer-events: none;
                transform: translateY(-50%);
                transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
                z-index: 2;
            }

            a[data-haze-status="text"]:hover::before {
                transform: translateY(-50%) scale(1.68);
                opacity: 1;
            }

            a[data-haze-status="text"]::after {
                content: none !important;
            }

            a[data-haze-status="text"].haze-ind-nav {
                padding-left: 9px !important;
            }

            a[data-haze-status="text"].haze-ind-nav::before {
                width: 4px;
                height: 4px;
                left: 1px;
                opacity: 0.68;
            }

            a[data-haze-status="text"].haze-ind-nav:hover::before {
                transform: translateY(-50%) scale(1.9);
                opacity: 1;
            }

            .haze-ind-cur::before {
                background: var(--haze-ind-cur);
                box-shadow: 0 0 7px var(--haze-ind-cur), 0 0 18px rgba(10,132,255,0.42);
            }

            .haze-ind-newfore::before {
                background: var(--haze-ind-newfore);
                box-shadow: 0 0 7px var(--haze-ind-newfore), 0 0 18px rgba(255,149,0,0.42);
            }

            .haze-ind-newback::before {
                background: var(--haze-ind-newback);
                box-shadow: 0 0 7px var(--haze-ind-newback), 0 0 18px rgba(52,199,89,0.42);
            }

            #haze-popup {
                position: absolute;
                display: flex;
                gap: 6px;
                padding: 6px;
                z-index: 2147483647;
                background:
                    linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.06)),
                    radial-gradient(circle at 12% 0%, rgba(255,255,255,0.44), transparent 36%),
                    radial-gradient(circle at 100% 120%, rgba(10,132,255,0.16), transparent 44%),
                    var(--haze-bg);
                backdrop-filter: blur(30px) saturate(1.85) brightness(1.05);
                -webkit-backdrop-filter: blur(30px) saturate(1.85) brightness(1.05);
                border-radius: 18px;
                border: 1px solid var(--haze-border);
                box-shadow:
                    var(--haze-shadow),
                    var(--haze-inner),
                    0 0 0 1px rgba(255,255,255,0.08),
                    0 0 22px rgba(10,132,255,0.10);
                transform: translate(-65%, -50%);
                user-select: none;
                isolation: isolate;
                overflow: hidden;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
                animation: none !important;
            }

            #haze-popup::before {
                content: "";
                position: absolute;
                inset: 1px;
                border-radius: 17px;
                pointer-events: none;
                background:
                    linear-gradient(180deg, rgba(255,255,255,0.34), transparent 34%),
                    linear-gradient(90deg, rgba(255,255,255,0.18), transparent 28%, transparent 72%, rgba(255,255,255,0.10));
                opacity: 0.92;
                z-index: -1;
            }

            #haze-popup::after {
                content: none !important;
            }

            .haze-popup-btn {
                position: relative;
                padding: 7px 11px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 12.5px;
                line-height: 1.1;
                font-weight: 680;
                color: var(--haze-text);
                transition:
                    background 0.12s ease,
                    transform 0.12s ease,
                    opacity 0.12s ease,
                    box-shadow 0.12s ease,
                    filter 0.12s ease,
                    color 0.12s ease,
                    text-shadow 0.12s ease,
                    letter-spacing 0.12s ease;
                white-space: nowrap;
                min-width: 43px;
                text-align: center;
                overflow: hidden;
                z-index: 1;
            }

            .haze-popup-btn::before {
                content: "";
                position: absolute;
                inset: 0;
                border-radius: inherit;
                pointer-events: none;
                background:
                    radial-gradient(circle at 30% 0%, rgba(255,255,255,0.42), transparent 40%),
                    linear-gradient(135deg, rgba(255,255,255,0.20), transparent 55%);
                opacity: 0;
                transition: opacity 0.12s ease;
                z-index: -1;
            }

            .haze-popup-btn::after {
                content: "";
                position: absolute;
                top: -70%;
                left: -85%;
                width: 52%;
                height: 240%;
                pointer-events: none;
                background: linear-gradient(
                    115deg,
                    transparent 0%,
                    rgba(255,255,255,0.00) 22%,
                    rgba(255,255,255,0.55) 48%,
                    rgba(255,255,255,0.16) 62%,
                    transparent 100%
                );
                transform: translateX(0) rotate(12deg);
                opacity: 0;
                z-index: 2;
            }

            .haze-popup-btn:hover {
                color: var(--haze-primary);
                background:
                    linear-gradient(135deg, rgba(10,132,255,0.20), rgba(52,199,89,0.08)),
                    var(--haze-bg-hover);
                transform: translateY(-1px) scale(1.075);
                filter: brightness(1.14) saturate(1.18);
                letter-spacing: 0.15px;
                text-shadow:
                    0 0 7px rgba(10,132,255,0.42),
                    0 0 16px rgba(10,132,255,0.24);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.28),
                    0 5px 16px rgba(0,0,0,0.10),
                    0 0 18px rgba(10,132,255,0.20),
                    0 0 30px rgba(52,199,89,0.10);
            }

            .haze-popup-btn:hover::before {
                opacity: 0.86;
            }

            .haze-popup-btn:hover::after {
                animation: haze-option-neon-sheen 0.48s ease-out forwards;
            }

            .haze-popup-btn:active {
                transform: translateY(0) scale(0.97);
                filter: brightness(1.02) saturate(1.08);
            }

            .haze-popup-btn.primary {
                color: var(--haze-primary);
                background:
                    linear-gradient(135deg, rgba(10,132,255,0.26), rgba(52,199,89,0.10)),
                    var(--haze-primary-soft);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.30),
                    0 5px 16px rgba(10,132,255,0.20),
                    0 0 18px rgba(10,132,255,0.14);
                font-weight: 790;
                min-width: 54px;
                animation: none !important;
            }

            .haze-popup-btn.primary::before {
                opacity: 0.58;
            }

            .haze-popup-btn.primary:hover {
                color: #ffffff;
                background:
                    linear-gradient(135deg, rgba(10,132,255,0.78), rgba(52,199,89,0.42)),
                    var(--haze-primary);
                transform: translateY(-1px) scale(1.09);
                filter: brightness(1.18) saturate(1.25);
                text-shadow:
                    0 0 8px rgba(255,255,255,0.78),
                    0 0 18px rgba(10,132,255,0.56),
                    0 0 28px rgba(52,199,89,0.24);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.42),
                    0 7px 22px rgba(10,132,255,0.34),
                    0 0 28px rgba(10,132,255,0.34),
                    0 0 44px rgba(52,199,89,0.18);
            }

            .haze-popup-btn.primary:hover::before {
                opacity: 0.95;
            }

            @keyframes haze-option-neon-sheen {
                0% {
                    opacity: 0;
                    transform: translateX(0) rotate(12deg);
                }
                15% {
                    opacity: 0.9;
                }
                100% {
                    opacity: 0;
                    transform: translateX(390%) rotate(12deg);
                }
            }

            #haze-popup[data-haze-motion="off"] .haze-popup-btn:hover::after {
                animation: none !important;
            }

            #haze-settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 2147483647;
                background:
                    radial-gradient(circle at 50% 18%, rgba(10,132,255,0.20), transparent 34%),
                    radial-gradient(circle at 80% 78%, rgba(52,199,89,0.12), transparent 32%),
                    rgba(0,0,0,0.30);
                display: flex;
                justify-content: center;
                align-items: center;
                backdrop-filter: blur(12px) saturate(1.35);
                -webkit-backdrop-filter: blur(12px) saturate(1.35);
                animation: haze-overlay-in 0.18s ease forwards;
            }

            @keyframes haze-overlay-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            #haze-settings-panel {
                width: min(450px, calc(100vw - 28px));
                max-height: 90vh;
                background:
                    linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.05)),
                    radial-gradient(circle at 8% 0%, rgba(255,255,255,0.42), transparent 34%),
                    radial-gradient(circle at 100% 100%, rgba(10,132,255,0.16), transparent 36%),
                    var(--haze-bg);
                backdrop-filter: blur(34px) saturate(1.85) brightness(1.05);
                -webkit-backdrop-filter: blur(34px) saturate(1.85) brightness(1.05);
                border-radius: 24px;
                box-shadow: var(--haze-shadow), var(--haze-inner);
                color: var(--haze-text);
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid var(--haze-border-strong);
                transform: scale(0.97) translateY(6px);
                animation: haze-panel-in 0.18s cubic-bezier(0.2, 0.9, 0.24, 1.08) forwards;
                isolation: isolate;
            }

            #haze-settings-panel::before {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                border-radius: inherit;
                background:
                    linear-gradient(180deg, rgba(255,255,255,0.32), transparent 28%),
                    linear-gradient(90deg, rgba(255,255,255,0.16), transparent 35%, transparent 70%, rgba(255,255,255,0.08));
                z-index: -1;
            }

            @keyframes haze-panel-in {
                to { transform: scale(1) translateY(0); }
            }

            .haze-header {
                padding: 20px 24px 0;
                flex-shrink: 0;
            }

            .haze-title-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }

            .haze-title {
                font-weight: 800;
                font-size: 18px;
                letter-spacing: -0.01em;
            }

            .haze-close {
                cursor: pointer;
                opacity: 0.62;
                font-size: 20px;
                transition: 0.16s ease;
            }

            .haze-close:hover {
                opacity: 1;
                transform: scale(1.06);
            }

            .haze-tabs {
                display: flex;
                border-bottom: 1px solid var(--haze-border);
                gap: 22px;
            }

            .haze-tab-item {
                padding: 10px 0 12px;
                font-size: 13.5px;
                color: var(--haze-text-sub);
                cursor: pointer;
                position: relative;
                transition: 0.18s ease;
            }

            .haze-tab-item.active {
                color: var(--haze-text);
                font-weight: 740;
            }

            .haze-tab-item.active::after {
                content: '';
                position: absolute;
                bottom: -1px;
                left: 0;
                width: 100%;
                height: 2px;
                background: linear-gradient(90deg, var(--haze-primary), var(--haze-accent-2));
                border-radius: 999px;
                box-shadow: 0 0 12px rgba(10,132,255,0.38);
            }

            .haze-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            }

            .haze-tab-content {
                display: none;
                animation: haze-fade 0.18s ease;
            }

            .haze-tab-content.active {
                display: block;
            }

            @keyframes haze-fade {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .haze-section {
                margin-bottom: 22px;
            }

            .haze-label {
                font-size: 12.5px;
                color: var(--haze-text-sub);
                margin-bottom: 9px;
                font-weight: 700;
            }

            .haze-capsule {
                display: flex;
                background: rgba(128,128,128,0.10);
                padding: 4px;
                border-radius: 14px;
                border: 1px solid var(--haze-border);
                gap: 3px;
                box-shadow: inset 0 1px 1px rgba(0,0,0,0.03);
            }

            .haze-capsule-btn {
                flex: 1;
                text-align: center;
                padding: 8px 7px;
                font-size: 12.8px;
                border-radius: 11px;
                cursor: pointer;
                color: var(--haze-text-sub);
                transition: 0.16s ease;
            }

            .haze-capsule-btn:hover {
                background: var(--haze-bg-hover);
                color: var(--haze-text);
            }

            .haze-capsule-btn.active {
                background: var(--haze-bg-strong);
                color: var(--haze-primary);
                font-weight: 760;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 18px rgba(0,0,0,0.10);
            }

            .haze-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                padding: 13px 0;
                border-bottom: 1px solid var(--haze-border);
            }

            .haze-row:last-child {
                border-bottom: none;
            }

            .haze-row-title {
                font-weight: 730;
                font-size: 13.5px;
            }

            .haze-row-sub {
                color: var(--haze-text-sub);
                font-size: 12px;
                margin-top: 5px;
                line-height: 1.5;
            }

            .haze-switch {
                position: relative;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
            }

            .haze-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .haze-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background-color: rgba(128,128,128,0.30);
                transition: .28s ease;
                border-radius: 999px;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.14);
            }

            .haze-slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 2px;
                bottom: 2px;
                background: linear-gradient(180deg, #fff, #f2f4f8);
                transition: .28s ease;
                border-radius: 50%;
                box-shadow: 0 2px 7px rgba(0,0,0,0.25);
            }

            input:checked + .haze-slider {
                background: linear-gradient(90deg, var(--haze-primary), var(--haze-accent-2));
            }

            input:checked + .haze-slider:before {
                transform: translateX(20px);
            }

            .haze-list-container {
                background: rgba(128,128,128,0.10);
                border: 1px solid var(--haze-border);
                border-radius: 14px;
                overflow: hidden;
                max-height: 250px;
                overflow-y: auto;
                margin-bottom: 10px;
            }

            .haze-list-item {
                display: flex;
                justify-content: space-between;
                padding: 12px 14px;
                font-size: 13px;
                border-bottom: 1px solid var(--haze-border);
                align-items: center;
            }

            .haze-list-item:last-child {
                border-bottom: none;
            }

            .haze-del-btn {
                color: #ff453a;
                cursor: pointer;
                font-size: 12px;
                padding: 3px 7px;
                border-radius: 7px;
            }

            .haze-del-btn:hover {
                background: rgba(255, 69, 58, 0.12);
            }

            .haze-input-group {
                display: flex;
                gap: 8px;
            }

            .haze-input {
                flex: 1;
                background: rgba(128,128,128,0.10);
                border: 1px solid var(--haze-border);
                border-radius: 11px;
                padding: 9px 12px;
                color: var(--haze-text);
                font-size: 13px;
                outline: none;
            }

            .haze-input:focus {
                border-color: rgba(10,132,255,0.62);
                box-shadow: 0 0 0 3px rgba(10,132,255,0.16);
            }

            .haze-btn-add {
                padding: 0 16px;
                background: linear-gradient(135deg, var(--haze-primary), var(--haze-accent-2));
                color: white;
                border-radius: 11px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 730;
                box-shadow: var(--haze-shadow-small);
            }

            .haze-tip {
                font-size: 12px;
                color: var(--haze-text-sub);
                background: rgba(128,128,128,0.10);
                padding: 11px 12px;
                border-radius: 13px;
                line-height: 1.55;
                margin-top: 10px;
                border: 1px solid var(--haze-border);
            }

            .haze-footer {
                text-align: center;
                padding: 15px;
                font-size: 12px;
                color: var(--haze-text-sub);
                border-top: 1px solid var(--haze-border);
                opacity: 0.82;
            }

            #haze-popup[data-haze-motion="off"] .haze-popup-btn:hover::after,
            #haze-settings-overlay[data-haze-motion="off"],
            #haze-settings-overlay[data-haze-motion="off"] #haze-settings-panel,
            #haze-settings-overlay[data-haze-motion="off"] .haze-tab-content {
                animation: none !important;
            }

            @media (prefers-reduced-motion: reduce) {
                #haze-popup,
                #haze-popup::after,
                .haze-popup-btn,
                .haze-popup-btn::after,
                .haze-popup-btn.primary,
                #haze-settings-overlay,
                #haze-settings-panel,
                .haze-tab-content {
                    animation: none !important;
                }

                .haze-popup-btn,
                .haze-popup-btn:hover,
                .haze-popup-btn:active {
                    transition: none !important;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(s);
    };

    const applyTheme = () => {
        const theme = getEffectiveTheme();

        document.documentElement.setAttribute('data-haze-theme', theme);
        document.documentElement.setAttribute('data-haze-glass', state.glassEffect ? 'on' : 'off');
        document.documentElement.setAttribute('data-haze-motion', state.motionEffect ? 'on' : 'off');
        document.documentElement.setAttribute('data-haze-detected-theme', theme);

        document.querySelectorAll('#haze-popup, #haze-settings-overlay').forEach(el => {
            el.setAttribute('data-haze-theme', theme);
            el.setAttribute('data-haze-glass', state.glassEffect ? 'on' : 'off');
            el.setAttribute('data-haze-motion', state.motionEffect ? 'on' : 'off');
        });
    };

    const isRealHttpUrl = (url) => {
        if (!url) return false;
        return url.protocol === 'http:' || url.protocol === 'https:';
    };

    const isArticleCardTitleLink = (link) => {
        if (!link || !link.matches) return false;
        if (link.matches(ARTICLE_LINK_SELECTORS)) return true;

        const heading = link.closest('.item-heading, h1, h2, h3, h4');
        const card = link.closest('.posts-item, posts, .ajax-item, .related-posts, .related-item, .post-list, .article-list, .item-body');
        const text = normalize(link.innerText || link.textContent);

        return !!(heading && card && text && text.length <= 120);
    };

    const hasMediaOrIcon = (link) => !!link.querySelector('img, svg, picture, video, canvas, use, i[class*="icon"], span[class*="icon"]');

    const isRichMediaLink = (link) => {
        if (!link) return false;
        if (isArticleCardTitleLink(link)) return false;
        if (isSiteNavigationLink(link)) return false;
        if (link.querySelector('img, svg, picture, video, canvas')) return true;
        const cls = getElClass(link).toLowerCase();
        if (/thumb|img|pic|cover|card|banner|poster|photo/.test(cls)) return true;
        if (normalize(link.textContent) === '') return true;
        return false;
    };

    const getRect = (el) => {
        try { return el.getBoundingClientRect(); }
        catch (e) { return { width: 0, height: 0 }; }
    };

    const isTinyOrIconLikeLink = (link) => {
        if (isArticleCardTitleLink(link)) return false;
        if (isSiteNavigationLink(link)) return false;

        const visibleText = normalize(link.innerText || link.textContent);
        const a11y = getAccessibleText(link);
        const rect = getRect(link);
        const hasMedia = hasMediaOrIcon(link);
        const smallBox = rect.width > 0 && rect.height > 0 && rect.width <= 96 && rect.height <= 66;
        const veryShortText = visibleText.length <= 3;
        const looksAvatarOrIcon = /\b(icon|avatar|profile|account|user|menu|settings?|gear|bell|notification|search|close|more|dots|ellipsis)\b/i.test(a11y);

        if (hasMedia && veryShortText) return true;
        if (smallBox && veryShortText && (hasMedia || looksAvatarOrIcon || CONTROL_CLASS_RE.test(a11y))) return true;
        return false;
    };

    const isInvalidOrSpecialHref = (rawHref, url) => {
        if (!rawHref) return true;
        const raw = rawHref.trim().toLowerCase();
        if (!raw || raw === '#') return true;
        return raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('sms:') ||
            raw.startsWith('blob:') || raw.startsWith('data:') || raw.startsWith('about:') || raw.startsWith('chrome:') ||
            raw.startsWith('edge:') || raw.startsWith('moz-extension:') || raw.startsWith('chrome-extension:') ||
            (url && ['javascript:', 'mailto:', 'tel:', 'sms:', 'blob:', 'data:', 'about:', 'chrome:', 'edge:', 'moz-extension:', 'chrome-extension:'].includes(url.protocol));
    };

    const isSamePageHash = (url) => {
        if (!url) return false;
        return url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && !!url.hash;
    };

    const hasControlAttrs = (link) => CONTROL_ATTRS.some((attr) => link.hasAttribute(attr));

    const isDownloadLike = (link, rawHref, url) => {
        const text = getAccessibleText(link);
        if (link.hasAttribute('download')) return true;
        if (containsKeyword(text, ['download', 'save', 'export', '下载', '保存', '导出'])) return true;
        const path = url ? (url.pathname + url.search) : rawHref;
        if (FILE_DOWNLOAD_RE.test(path)) return true;
        return false;
    };

    const isInAppShell = (link) => !!link.closest(UI_ZONE_SELECTORS);
    const isInContent = (link) => !!link.closest(CONTENT_ZONE_SELECTORS);

    const hasExplicitForce = (link) => {
        const cls = getElClass(link);
        return link.dataset.hazeForce === '1' || link.dataset.haze === 'force' || /\bscript-link\b/i.test(cls);
    };

    const isSiteNavigationLink = (link) => {
        if (!state.siteNav) return false;
        if (!link || !link.matches) return false;
        if (!link.matches(SITE_NAV_SELECTORS)) return false;

        const rawHref = link.getAttribute('href') || '';
        const urlObj = safeUrl(link.href || rawHref);
        const visibleText = normalize(link.innerText || link.textContent);

        if (!visibleText) return false;
        if (isInvalidOrSpecialHref(rawHref, urlObj)) return false;
        if (!isRealHttpUrl(urlObj)) return false;
        if (isSamePageHash(urlObj) || rawHref.trim().startsWith('#')) return false;
        if (isDownloadLike(link, rawHref, urlObj)) return false;

        const role = normalize(link.getAttribute('role'));
        if (['button', 'tab', 'switch', 'dialog', 'treeitem', 'presentation', 'option', 'checkbox', 'radio'].includes(role)) {
            return false;
        }

        if (hasControlAttrs(link)) return false;
        if (link.closest('#haze-popup, #haze-settings-overlay')) return false;

        const cls = getElClass(link).toLowerCase();
        const text = getAccessibleText(link);

        if (/\b(search|avatar|profile|account|signin|login|logout|toggle|modal|popup|ajax|refreshmodal|pay-vip|balance-charge|main-search-btn|nav-search-btn)\b/i.test(cls + ' ' + text)) {
            return false;
        }

        return true;
    };

    const getClosestAnchor = (event) => {
        if (!event || !event.target) return null;
        if (event.target.closest) {
            const a = event.target.closest('a[href]');
            if (a) return a;
        }
        if (typeof event.composedPath === 'function') {
            return event.composedPath().find((node) => node && node.tagName === 'A' && node.href) || null;
        }
        return null;
    };

    const clickedInsideInteractiveChild = (event, link) => {
        const target = event && event.target;
        if (!target || !target.closest) return false;
        const interactive = target.closest(INTERACTIVE_SELECTORS);
        if (!interactive) return false;
        if (interactive === link) return true;
        return link.contains(interactive);
    };

    const isAcademicFunctionalLink = (link, rawHref) => {
        if (!state.academic) return false;
        const domain = location.hostname;

        const bioDataDomains = ['ncbi.nlm.nih.gov', 'uniprot.org', 'ebi.ac.uk', 'kegg.jp'];
        if (bioDataDomains.some(d => domain.includes(d))) {
            if (link.closest('.rprt, .jig-ncbipopper, [id*="viewer"], .usa-accordion, canvas, svg')) return true;
            if (rawHref.includes('ftp://') || rawHref.includes('download')) return true;
        }

        const journalDomains = ['mdpi.com', 'biomedcentral.com', 'sciencedirect.com', 'sciencedirectassets.com', 'nature.com', 'science.org'];
        if (journalDomains.some(d => domain.includes(d))) {
            if (link.closest('.figure-modal, .download-pdf, .supplementary-material, .article-nav, .anchor, .c-pdf-download')) return true;
        }

        return false;
    };

    const isFunctionalLink = (link, isForceMode, event = null) => {
        if (!link) return true;

        const rawHref = link.getAttribute('href') || '';
        const urlObj = safeUrl(link.href || rawHref);
        const target = normalize(link.getAttribute('target'));
        const visibleText = normalize(link.innerText || link.textContent);
        const text = getAccessibleText(link);
        const sameOrigin = urlObj ? urlObj.origin === location.origin : false;
        const inAppShell = isInAppShell(link);
        const inContent = isInContent(link);

        if (isInvalidOrSpecialHref(rawHref, urlObj)) return true;
        if (/^file:\/\/\/[a-zA-Z]:\//.test(link.href || rawHref)) return true;
        if (isSamePageHash(urlObj) || rawHref.trim().startsWith('#')) return true;

        if (hasExplicitForce(link)) return false;
        if (isForceMode) return false;

        if (isArticleCardTitleLink(link)) return false;
        if (isSiteNavigationLink(link)) return false;

        if (link.closest('#haze-popup, #haze-settings-overlay')) return true;
        if (target === '_self' || target === '_top' || target === '_iframe' || target === 'iframe') return true;

        if (target === '_blank' && state.smartGuard && state.runMode === 'direct' && state.primaryTarget === 'newtab' && state.newtabBehavior === 'foreground') {
            return true;
        }

        if (event && clickedInsideInteractiveChild(event, link)) return true;

        const role = normalize(link.getAttribute('role'));
        const uiRoles = ['button', 'tab', 'menuitem', 'switch', 'dialog', 'treeitem', 'presentation', 'option', 'checkbox', 'radio'];
        if (uiRoles.includes(role)) return true;
        if (hasControlAttrs(link)) return true;

        if (link.closest('h1, h2, h3, h4, h5, h6')) return false;
        if (!state.smartGuard) return false;

        if (isDownloadLike(link, rawHref, urlObj)) return true;
        if (isAcademicFunctionalLink(link, rawHref)) return true;
        if (/^\d+$/.test(visibleText)) return true;
        if (isTinyOrIconLikeLink(link)) return true;

        if (sameOrigin && inAppShell && (visibleText.length <= 16 || containsKeyword(text) || CONTROL_CLASS_RE.test(text))) return true;

        if (link.closest('[class*="attachment"], [class*="file"], [class*="document"]') && (visibleText.length <= 30 || containsKeyword(text, ['download', 'save', 'export', '下载', '保存', '导出']))) return true;

        if (containsKeyword(text) && (visibleText.length <= 18 || inAppShell || CONTROL_CLASS_RE.test(text))) return true;

        if (CONTROL_CLASS_RE.test(text) && (!inContent || visibleText.length <= 18)) return true;

        if (sameOrigin && !inContent && visibleText.length > 0 && visibleText.length <= 10) return true;

        if (!visibleText && hasMediaOrIcon(link)) return true;

        return false;
    };

    const updateLinkIndicators = () => {
        const clearOne = (el) => {
            el.removeAttribute('data-haze-status');
            el.classList.remove(...HAZE_INDICATOR_CLASSES);
        };

        const clearAll = () => {
            document.querySelectorAll('a[data-haze-status]').forEach(clearOne);
        };

        if (!state.indicator || state.excluded.includes(location.hostname) || state.runMode === 'disabled') {
            clearAll();
            return;
        }

        let indicatorClass = 'haze-ind-cur';
        if (state.primaryTarget === 'newtab') {
            indicatorClass = state.newtabBehavior === 'foreground' ? 'haze-ind-newfore' : 'haze-ind-newback';
        }

        const shouldKeep = new Set();

        document.querySelectorAll('a[href]').forEach(link => {
            const visibleText = normalize(link.innerText || link.textContent);
            if (!visibleText) return;
            if (isFunctionalLink(link, false)) return;

            link.setAttribute('data-haze-status', 'text');
            link.classList.remove(...HAZE_INDICATOR_CLASSES);
            link.classList.add(indicatorClass);

            if (isSiteNavigationLink(link)) {
                link.classList.add('haze-ind-nav');
            }

            shouldKeep.add(link);
        });

        document.querySelectorAll('a[data-haze-status]').forEach(link => {
            if (!shouldKeep.has(link)) clearOne(link);
        });

        applyTheme();
    };

    const openNewTab = (absUrl) => {
        const isActive = state.newtabBehavior === 'foreground';
        GM_openInTab(absUrl, { active: isActive, insert: true, setParent: true });
    };

    const handleLinkClick = (event) => {
        if (isBypassing) return;
        if (event.defaultPrevented) return;
        if (typeof event.button === 'number' && event.button !== 0) return;

        let link = getClosestAnchor(event);
        if (link && (!link.getAttribute('href') || link.getAttribute('href') === '#')) {
            const parentLink = link.parentElement ? link.parentElement.closest('a[href]') : null;
            if (parentLink) link = parentLink;
        }
        if (!link) return;

        const rawHref = link.getAttribute('href');
        if (!rawHref) return;
        if (state.excluded.includes(location.hostname)) return;
        if (state.runMode === 'disabled') return;

        if (event.ctrlKey || event.metaKey || event.shiftKey) return;
        const isForceMode = event.altKey;
        if (isFunctionalLink(link, isForceMode, event)) return;

        const absUrl = getAbsoluteUrl(rawHref);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const effectiveMode = (state.runMode === 'direct' && isForceMode) ? 'popup' : state.runMode;

        if (effectiveMode === 'popup') {
            createPopup(event, link, absUrl);
        } else if (effectiveMode === 'direct') {
            if (state.primaryTarget === 'current') window.location.href = absUrl;
            else openNewTab(absUrl);
        }
    };

    const createPopup = (e, link, url) => {
        const old = document.getElementById('haze-popup');
        if (old) old.remove();

        injectStyle();

        const popup = document.createElement('div');
        popup.id = 'haze-popup';

        popup.style.top = `${e.pageY}px`;
        popup.style.left = `${e.pageX}px`;

        const btnCurrent = document.createElement('div');
        btnCurrent.textContent = '当前';
        btnCurrent.title = '在当前页打开';
        btnCurrent.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            popup.remove();

            const originalWindowOpen = pageWindow.open;
            pageWindow.open = function(openUrl) {
                const finalUrl = openUrl ? getAbsoluteUrl(openUrl) : url;
                window.location.href = finalUrl;
                return null;
            };

            const originalTarget = link.getAttribute('target');
            link.setAttribute('target', '_self');

            isBypassing = true;

            setTimeout(() => {
                isBypassing = false;
                pageWindow.open = originalWindowOpen;
                if (originalTarget !== null) link.setAttribute('target', originalTarget);
                else link.removeAttribute('target');
            }, 300);

            try {
                link.click();
            } catch(err) {
                window.location.href = url;
            }
        };

        const btnNew = document.createElement('div');
        btnNew.textContent = state.newtabBehavior === 'foreground' ? '新页(+)' : '后台';
        btnNew.title = state.newtabBehavior === 'foreground' ? '在前台新标签打开' : '在后台新标签打开';
        btnNew.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openNewTab(url);
            popup.remove();
        };

        if (state.primaryTarget === 'newtab') {
            btnNew.className = 'haze-popup-btn primary';
            btnCurrent.className = 'haze-popup-btn';
            popup.append(btnCurrent, btnNew);
        } else {
            btnNew.className = 'haze-popup-btn';
            btnCurrent.className = 'haze-popup-btn primary';
            popup.append(btnNew, btnCurrent);
        }

        document.documentElement.appendChild(popup);
        applyTheme();

        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;

        popup.onmouseenter = () => {
            clearTimeout(closeTimer);
            clearTimeout(leaveTimer);
        };

        popup.onmouseleave = () => {
            leaveTimer = setTimeout(() => popup.remove(), MOUSE_LEAVE_DELAY);
        };
    };

    const makeSwitch = (id, checked) => `
        <label class="haze-switch" style="margin-top: 4px;">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
            <span class="haze-slider"></span>
        </label>
    `;

    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;

        injectStyle();
        applyTheme();

        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';

        const domain = location.hostname;
        const detectedTheme = getEffectiveTheme();

        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div class="haze-header">
                    <div class="haze-title-row">
                        <div class="haze-title">✨ Link Master</div>
                        <div class="haze-close">✕</div>
                    </div>
                    <div class="haze-tabs">
                        <div class="haze-tab-item active" data-tab="basic">基础设置</div>
                        <div class="haze-tab-item" data-tab="advanced">高级功能</div>
                        <div class="haze-tab-item" data-tab="excluded">排除列表</div>
                    </div>
                </div>

                <div class="haze-body">
                    <div class="haze-tab-content active" id="tab-basic">
                        <div class="haze-section">
                            <div class="haze-label">1. 怎么触发插件？</div>
                            <div class="haze-capsule">
                                <div class="haze-capsule-btn ${state.runMode === 'popup' ? 'active' : ''}" data-k="runMode" data-v="popup">💬 弹选择框</div>
                                <div class="haze-capsule-btn ${state.runMode === 'direct' ? 'active' : ''}" data-k="runMode" data-v="direct">⚡ 静默执行</div>
                                <div class="haze-capsule-btn ${state.runMode === 'disabled' ? 'active' : ''}" data-k="runMode" data-v="disabled">⏸️ 禁用插件</div>
                            </div>
                        </div>

                        <div class="haze-section">
                            <div class="haze-label">2. 首要意图 / 高亮按钮</div>
                            <div class="haze-capsule">
                                <div class="haze-capsule-btn ${state.primaryTarget === 'current' ? 'active' : ''}" data-k="primaryTarget" data-v="current">🏠 当前</div>
                                <div class="haze-capsule-btn ${state.primaryTarget === 'newtab' ? 'active' : ''}" data-k="primaryTarget" data-v="newtab">🚀 新标签</div>
                            </div>
                        </div>

                        <div class="haze-section">
                            <div class="haze-label">3. 新标签打开方式</div>
                            <div class="haze-capsule">
                                <div class="haze-capsule-btn ${state.newtabBehavior === 'foreground' ? 'active' : ''}" data-k="newtabBehavior" data-v="foreground">🆕 前台</div>
                                <div class="haze-capsule-btn ${state.newtabBehavior === 'background' ? 'active' : ''}" data-k="newtabBehavior" data-v="background">👻 后台</div>
                            </div>
                            <div class="haze-tip">💡 保留人体工学锁定：首要意图按钮仍会出现在鼠标点击点附近，方便原地连击确认。</div>
                        </div>

                        <div class="haze-section">
                            <div class="haze-label">界面主题</div>
                            <div class="haze-capsule">
                                <div class="haze-capsule-btn ${state.theme === 'auto' ? 'active' : ''}" data-k="theme" data-v="auto">🔮 自动</div>
                                <div class="haze-capsule-btn ${state.theme === 'light' ? 'active' : ''}" data-k="theme" data-v="light">☀️ 浅色</div>
                                <div class="haze-capsule-btn ${state.theme === 'dark' ? 'active' : ''}" data-k="theme" data-v="dark">🌑 深色</div>
                            </div>
                            <div class="haze-tip">当前判断：${detectedTheme === 'dark' ? '深色' : '浅色'}。自动模式会优先识别网页自身 dark/light 类名，再读取页面背景，最后参考系统偏好。</div>
                        </div>
                    </div>

                    <div class="haze-tab-content" id="tab-advanced">
                        <div class="haze-section">
                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">三色智能预告</div>
                                    <div class="haze-row-sub">
                                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0A84FF;margin-right:4px;"></span>蓝色 = 当前页<br>
                                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#FF9500;margin-right:4px;"></span>橙色 = 新标签前台<br>
                                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;margin-right:4px;"></span>绿色 = 新标签后台
                                    </div>
                                </div>
                                ${makeSwitch('sw-ind', state.indicator)}
                            </div>

                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">真实导航链接接管</div>
                                    <div class="haze-row-sub">顶部导航、下拉导航、面包屑、页脚真实 URL 链接会统一启用插件；搜索、弹窗、头像等控件仍然放行。</div>
                                </div>
                                ${makeSwitch('sw-site-nav', state.siteNav)}
                            </div>

                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">Liquid Glass 质感</div>
                                    <div class="haze-row-sub">透明、模糊、光泽、柔和阴影和深浅色自适应；老浏览器或低性能设备可关闭。</div>
                                </div>
                                ${makeSwitch('sw-glass', state.glassEffect)}
                            </div>

                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">选项霓虹悬停</div>
                                    <div class="haze-row-sub">选择框本身极速弹出；鼠标移到“当前 / 新页 / 后台”按钮上时，按钮会放大、变亮，并显示霓虹光影和玻璃流光。</div>
                                </div>
                                ${makeSwitch('sw-motion', state.motionEffect)}
                            </div>

                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">智能防误触</div>
                                    <div class="haze-row-sub">放行头像、设置、下载、搜索、新对话、侧边栏、菜单、小图标等网站原生交互。</div>
                                </div>
                                ${makeSwitch('sw-smart', state.smartGuard)}
                            </div>

                            <div class="haze-row" style="align-items: flex-start;">
                                <div>
                                    <div class="haze-row-title">学术 / 生信特判</div>
                                    <div class="haze-row-sub">额外放行生信图表、论文站下载、学术站点里的图表/附件交互。</div>
                                </div>
                                ${makeSwitch('sw-academic', state.academic)}
                            </div>
                        </div>
                    </div>

                    <div class="haze-tab-content" id="tab-excluded">
                        <div class="haze-section">
                            <div class="haze-label">当前网站</div>
                            <div class="haze-capsule" style="margin-bottom:15px;">
                                <div class="haze-capsule-btn ${state.excluded.includes(domain) ? '' : 'active'}" id="btn-toggle-site">
                                    ${state.excluded.includes(domain) ? '🚫 已排除，点击恢复' : '✅ 正在运行，点击排除'}
                                </div>
                            </div>

                            <div class="haze-label">黑名单管理</div>
                            <div class="haze-list-container" id="haze-blacklist"></div>
                            <div class="haze-input-group">
                                <input type="text" class="haze-input" id="input-domain" placeholder="输入域名，例如 example.com">
                                <button class="haze-btn-add" id="btn-add-domain">添加</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="haze-footer">Link Master v6.0 · Neon Hover · Designed by HAZE</div>
            </div>
        `;

        const panel = overlay.querySelector('#haze-settings-panel');

        const close = () => {
            overlay.remove();
            updateLinkIndicators();
        };

        overlay.querySelector('.haze-close').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        panel.querySelectorAll('.haze-tab-item').forEach(tab => {
            tab.onclick = () => {
                panel.querySelectorAll('.haze-tab-item').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.haze-tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                panel.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');
            };
        });

        panel.querySelectorAll('[data-k]').forEach(btn => {
            btn.onclick = () => {
                state[btn.dataset.k] = btn.dataset.v;
                btn.parentNode.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyTheme();
                updateLinkIndicators();
            };
        });

        panel.querySelector('#sw-ind').onchange = (e) => {
            state.indicator = e.target.checked;
            updateLinkIndicators();
        };

        panel.querySelector('#sw-site-nav').onchange = (e) => {
            state.siteNav = e.target.checked;
            updateLinkIndicators();
        };

        panel.querySelector('#sw-glass').onchange = (e) => {
            state.glassEffect = e.target.checked;
            applyTheme();
        };

        panel.querySelector('#sw-motion').onchange = (e) => {
            state.motionEffect = e.target.checked;
            applyTheme();
        };

        panel.querySelector('#sw-smart').onchange = (e) => {
            state.smartGuard = e.target.checked;
            updateLinkIndicators();
        };

        panel.querySelector('#sw-academic').onchange = (e) => {
            state.academic = e.target.checked;
            updateLinkIndicators();
        };

        const renderBlacklist = () => {
            const listEl = panel.querySelector('#haze-blacklist');
            if (state.excluded.length === 0) {
                listEl.innerHTML = '<div style="padding:15px;text-align:center;color:var(--haze-text-sub);font-size:12px;">暂无排除网站</div>';
                return;
            }

            listEl.innerHTML = '';
            state.excluded.forEach(site => {
                const item = document.createElement('div');
                item.className = 'haze-list-item';
                item.innerHTML = `<span>${site}</span><span class="haze-del-btn">移除</span>`;
                item.querySelector('.haze-del-btn').onclick = () => {
                    state.excluded = state.excluded.filter(s => s !== site);
                    renderBlacklist();
                    updateToggleBtn();
                    updateLinkIndicators();
                };
                listEl.appendChild(item);
            });
        };

        const updateToggleBtn = () => {
            const btn = panel.querySelector('#btn-toggle-site');
            const isEx = state.excluded.includes(domain);
            btn.textContent = isEx ? '🚫 已排除，点击恢复' : '✅ 正在运行，点击排除';
            btn.className = `haze-capsule-btn ${isEx ? '' : 'active'}`;
        };

        panel.querySelector('#btn-toggle-site').onclick = () => {
            if (state.excluded.includes(domain)) state.excluded = state.excluded.filter(d => d !== domain);
            else state.excluded = Array.from(new Set([...state.excluded, domain]));
            renderBlacklist();
            updateToggleBtn();
            updateLinkIndicators();
        };

        panel.querySelector('#btn-add-domain').onclick = () => {
            const input = panel.querySelector('#input-domain');
            const val = input.value.trim().toLowerCase();
            if (val && !state.excluded.includes(val)) {
                state.excluded = Array.from(new Set([...state.excluded, val]));
                input.value = '';
                renderBlacklist();
                updateToggleBtn();
                updateLinkIndicators();
            }
        };

        renderBlacklist();
        document.body.appendChild(overlay);
        applyTheme();
    };

    const main = () => {
        injectStyle();
        applyTheme();
        updateLinkIndicators();

        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel);
        document.addEventListener('click', handleLinkClick, true);

        const debouncedUpdate = debounce(updateLinkIndicators, 300);
        const observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes && m.addedNodes.length)) debouncedUpdate();
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onThemeChange = () => {
            if (state.theme === 'auto') {
                applyTheme();
                updateLinkIndicators();
            }
        };

        if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
        else if (mq.addListener) mq.addListener(onThemeChange);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main, { once: true });
    } else {
        main();
    }
})();
