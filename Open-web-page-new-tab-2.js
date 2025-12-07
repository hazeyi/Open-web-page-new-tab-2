// ==UserScript==
// @name         打开网页：新标签页2 (极致美化版)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  智能识别+可视化指示器+设置面板。集成云母/玻璃拟态材质，支持自动暗黑模式，"双击流"交互体验。
// @author       HAZE
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // === 核心配置 ===
    const AUTO_CLOSE_TIMEOUT = 3500;
    const MOUSE_LEAVE_DELAY = 800;

    // === 状态管理 ===
    const state = {
        get mode() { return GM_getValue('openMode', 'popup'); },
        set mode(v) { GM_setValue('openMode', v); },
        
        get background() { return GM_getValue('backgroundMode', false); },
        set background(v) { GM_setValue('backgroundMode', v); },
        
        get indicator() { return GM_getValue('showIndicator', true); },
        set indicator(v) { GM_setValue('showIndicator', v); },
        
        get theme() { return GM_getValue('theme', 'auto'); }, // auto, light, dark
        set theme(v) { GM_setValue('theme', v); },

        get excluded() { return GM_getValue('excludedSites', []); },
        set excluded(v) { GM_setValue('excludedSites', v); }
    };

    // === CSS 设计系统 (CSS Variables) ===
    const style = document.createElement('style');
    style.textContent = `
        :root {
            /* 默认浅色主题变量 (Mica/Glass Light) */
            --haze-bg: rgba(255, 255, 255, 0.75);
            --haze-bg-hover: rgba(255, 255, 255, 0.5);
            --haze-text: #333333;
            --haze-text-sub: #666666;
            --haze-border: rgba(255, 255, 255, 0.6);
            --haze-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0,0,0,0.05);
            --haze-primary: #007AFF;
            --haze-primary-bg: rgba(0, 122, 255, 0.1);
            --haze-primary-hover: rgba(0, 122, 255, 0.2);
            --haze-blur: 20px;
            --haze-radius: 12px;
            
            /* 指示器颜色 */
            --haze-ind-popup: #af52de;
            --haze-ind-newtab: #34c759;
        }

        /* 深色模式变量 (Glass Dark) */
        [data-haze-theme="dark"] {
            --haze-bg: rgba(30, 30, 30, 0.70);
            --haze-bg-hover: rgba(50, 50, 50, 0.5);
            --haze-text: #f0f0f0;
            --haze-text-sub: #aaaaaa;
            --haze-border: rgba(255, 255, 255, 0.1);
            --haze-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 2px 10px rgba(0,0,0,0.2);
            --haze-primary: #0A84FF;
            --haze-primary-bg: rgba(10, 132, 255, 0.15);
            --haze-primary-hover: rgba(10, 132, 255, 0.25);
            --haze-ind-popup: #bf5af2;
            --haze-ind-newtab: #32d74b;
        }

        /* ---------------- 指示器样式 ---------------- */
        a[data-haze-link="active"] { position: relative; }
        a[data-haze-link="active"]::after {
            content: ""; display: inline-block; width: 5px; height: 5px;
            margin-left: 3px; border-radius: 50%; vertical-align: middle;
            opacity: 0.6; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); pointer-events: none;
        }
        a[data-haze-link="active"]:hover::after { transform: scale(1.6); opacity: 1; }
        .haze-ind-popup::after { background-color: var(--haze-ind-popup); box-shadow: 0 0 6px var(--haze-ind-popup); }
        .haze-ind-newtab::after { background-color: var(--haze-ind-newtab); box-shadow: 0 0 6px var(--haze-ind-newtab); }

        /* ---------------- 弹窗样式 (选择框) ---------------- */
        #haze-popup {
            position: fixed; display: flex; gap: 6px; padding: 6px; z-index: 2147483647;
            background-color: var(--haze-bg);
            backdrop-filter: blur(var(--haze-blur)) saturate(180%);
            -webkit-backdrop-filter: blur(var(--haze-blur)) saturate(180%);
            border-radius: var(--haze-radius);
            box-shadow: var(--haze-shadow);
            border: 1px solid var(--haze-border);
            animation: haze-pop-in 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
            pointer-events: auto; box-sizing: border-box;
            transform-origin: center center;
        }
        @keyframes haze-pop-in {
            0% { opacity: 0; transform: translate(-65%, -45%) scale(0.9); }
            100% { opacity: 1; transform: translate(-65%, -50%) scale(1); }
        }

        .haze-popup-btn {
            padding: 6px 14px; border-radius: 8px; cursor: pointer;
            font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 500; color: var(--haze-text);
            transition: all 0.15s ease; white-space: nowrap; user-select: none; text-align: center;
        }
        .haze-popup-btn:hover { background-color: var(--haze-bg-hover); transform: translateY(-1px); }
        
        .haze-popup-btn.primary {
            color: var(--haze-primary);
            background-color: var(--haze-primary-bg);
            font-weight: 600;
        }
        .haze-popup-btn.primary:hover {
            background-color: var(--haze-primary-hover);
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        /* ---------------- 设置面板样式 ---------------- */
        #haze-settings-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.1); z-index: 2147483647;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(4px); opacity: 0; animation: haze-fade-in 0.2s forwards;
        }
        @keyframes haze-fade-in { to { opacity: 1; } }

        #haze-settings-panel {
            width: 380px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
            background-color: var(--haze-bg);
            backdrop-filter: blur(40px) saturate(150%);
            -webkit-backdrop-filter: blur(40px) saturate(150%);
            border-radius: 16px; border: 1px solid var(--haze-border);
            box-shadow: var(--haze-shadow);
            color: var(--haze-text);
            font-family: system-ui, -apple-system, sans-serif;
            transform: scale(0.95); animation: haze-scale-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes haze-scale-up { to { transform: scale(1); } }

        .haze-header { padding: 18px 24px; border-bottom: 1px solid var(--haze-border); display: flex; justify-content: space-between; align-items: center; }
        .haze-title { font-size: 17px; font-weight: 600; letter-spacing: -0.5px; }
        .haze-close { cursor: pointer; opacity: 0.6; font-size: 20px; transition: opacity 0.2s; }
        .haze-close:hover { opacity: 1; }

        .haze-body { padding: 0 24px; overflow-y: auto; flex: 1; }
        .haze-section { padding: 20px 0; border-bottom: 1px solid var(--haze-border); }
        .haze-section:last-child { border-bottom: none; }
        .haze-section-title { font-size: 12px; color: var(--haze-text-sub); margin-bottom: 12px; font-weight: 600; text-transform: uppercase; opacity: 0.8; }

        /* 组件 */
        .haze-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .haze-label { font-size: 14px; }
        
        /* 胶囊切换器 */
        .haze-capsule { display: flex; background: var(--haze-bg-hover); padding: 3px; border-radius: 10px; border: 1px solid var(--haze-border); }
        .haze-capsule-btn { 
            flex: 1; padding: 6px 10px; font-size: 12px; text-align: center; cursor: pointer; 
            border-radius: 7px; color: var(--haze-text-sub); transition: all 0.2s;
        }
        .haze-capsule-btn:hover { color: var(--haze-text); }
        .haze-capsule-btn.active { background: var(--haze-bg); color: var(--haze-primary); font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }

        /* iOS 风格开关 */
        .haze-switch { position: relative; display: inline-block; width: 42px; height: 24px; }
        .haze-switch input { opacity: 0; width: 0; height: 0; }
        .haze-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--haze-border); transition: .3s; border-radius: 34px; }
        .haze-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input:checked + .haze-slider { background-color: var(--haze-primary); }
        input:checked + .haze-slider:before { transform: translateX(18px); }

        /* 列表 */
        .haze-list { max-height: 120px; overflow-y: auto; background: var(--haze-bg-hover); border-radius: 10px; margin-top: 10px; }
        .haze-list-item { display: flex; justify-content: space-between; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--haze-border); }
        .haze-list-item:last-child { border-bottom: none; }
        .haze-remove { color: #ff453a; cursor: pointer; font-size: 12px; font-weight: 500; }
        
        .haze-footer { padding: 16px 24px; text-align: center; font-size: 12px; color: var(--haze-text-sub); opacity: 0.6; border-top: 1px solid var(--haze-border); }
    `;
    document.head.appendChild(style);

    // === 主题引擎 ===
    const applyTheme = () => {
        const overlay = document.getElementById('haze-settings-overlay');
        const popup = document.getElementById('haze-popup');
        
        // 计算当前应该使用的模式
        let targetTheme = state.theme;
        if (targetTheme === 'auto') {
            targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // 应用属性到容器 (使用 data-haze-theme 属性控制 CSS 变量)
        if (overlay) overlay.setAttribute('data-haze-theme', targetTheme);
        if (popup) popup.setAttribute('data-haze-theme', targetTheme);
        
        // 同时给 body 设置一个临时的属性用于指示器 CSS 变量生效 (可选，如果想全局生效)
        // 为了不污染全局，我们尽量在组件内部闭环，但指示器是注入到全局 a 标签的
        // 这里采用更轻量的方法：给 html 标签加一个辅助属性，仅用于CSS变量作用域
        document.documentElement.setAttribute('data-haze-global-theme', targetTheme);
        
        // 动态修改 style 标签中的 :root 作用域 (高级技巧)
        // 实际上上面的 CSS [data-haze-theme="dark"] 已经处理了容器内部
        // 对于全局指示器，我们需要这一行JS来让 CSS 变量在全局生效
        if (targetTheme === 'dark') {
            document.documentElement.style.setProperty('--haze-ind-popup', '#bf5af2');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#32d74b');
        } else {
            document.documentElement.style.setProperty('--haze-ind-popup', '#af52de');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#34c759');
        }
    };

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.theme === 'auto') applyTheme();
    });

    // === 智能逻辑 (v1.3) ===
    const isFunctionalLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.includes('javascript:')) return true;
        if (link.target === '_self' || link.target === '_top' || link.target === 'iframe') return true;
        if (['button', 'tab', 'menuitem'].includes(link.getAttribute('role'))) return true;
        try { if (new URL(link.href).pathname === location.pathname && link.hash) return true; } catch(e){}
        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;
        if (link.className.includes('script-link')) return false; 

        const str = (link.className + link.id + (link.title||'') + text).toLowerCase();
        const keywords = ['login', 'logout', 'sign', 'cart', 'buy', 'sku', 'like', 'fav', 'share', 'comment', 'play', '登录', '注册', '购物车', '购买', '点赞', '收藏', '评论', '回复'];
        if (keywords.some(kw => str.includes(kw))) return true;
        return false;
    };
    const isSystemFolderLink = (href) => /^file:\/\/\/[a-zA-Z]:\//.test(href);

    // === 渲染逻辑 ===
    const updateLinkIndicators = () => {
        document.querySelectorAll('a[data-haze-link]').forEach(el => {
            el.removeAttribute('data-haze-link');
            el.className = el.className.replace(/haze-ind-\w+/g, '').trim();
        });
        if (!state.indicator || isCurrentSiteExcluded() || state.mode === 'default') return;
        const indicatorClass = state.mode === 'popup' ? 'haze-ind-popup' : 'haze-ind-newtab';
        document.querySelectorAll('a').forEach(link => {
            if (!link.hasAttribute('data-haze-link') && !isFunctionalLink(link) && !isSystemFolderLink(link.href)) {
                link.setAttribute('data-haze-link', 'active');
                link.classList.add(indicatorClass);
            }
        });
        applyTheme(); // 确保指示器颜色正确
    };

    // === 设置面板 ===
    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';
        
        const currentDomain = window.location.hostname;
        const isExcluded = state.excluded.includes(currentDomain);
        
        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div class="haze-header">
                    <div class="haze-title">✨ Link Master 设置</div>
                    <div class="haze-close">✕</div>
                </div>
                <div class="haze-body">
                    <div class="haze-section">
                        <div class="haze-section-title">默认模式</div>
                        <div class="haze-capsule">
                            <div class="haze-capsule-btn ${state.mode==='popup'?'active':''}" data-key="mode" data-val="popup">选择框</div>
                            <div class="haze-capsule-btn ${state.mode==='newtab'?'active':''}" data-key="mode" data-val="newtab">直接新标签</div>
                            <div class="haze-capsule-btn ${state.mode==='default'?'active':''}" data-key="mode" data-val="default">已禁用</div>
                        </div>
                    </div>

                    <div class="haze-section">
                        <div class="haze-section-title">外观与主题 (Theme)</div>
                        <div class="haze-capsule">
                            <div class="haze-capsule-btn ${state.theme==='auto'?'active':''}" data-key="theme" data-val="auto">🔮 跟随系统</div>
                            <div class="haze-capsule-btn ${state.theme==='light'?'active':''}" data-key="theme" data-val="light">☀️ 浅色</div>
                            <div class="haze-capsule-btn ${state.theme==='dark'?'active':''}" data-key="theme" data-val="dark">🌑 深色</div>
                        </div>
                    </div>

                    <div class="haze-section">
                        <div class="haze-section-title">交互细节</div>
                        <div class="haze-row">
                            <div class="haze-label">后台静默打开 (Background)</div>
                            <label class="haze-switch"><input type="checkbox" id="sw-bg" ${state.background?'checked':''}><span class="haze-slider"></span></label>
                        </div>
                        <div class="haze-row">
                            <div class="haze-label">链接指示器圆点 (Indicator)</div>
                            <label class="haze-switch"><input type="checkbox" id="sw-ind" ${state.indicator?'checked':''}><span class="haze-slider"></span></label>
                        </div>
                    </div>

                    <div class="haze-section">
                        <div class="haze-section-title">排除列表</div>
                        <div class="haze-row">
                            <div class="haze-label">当前: ${currentDomain}</div>
                            <button class="haze-popup-btn ${isExcluded?'primary':''}" id="btn-toggle-site" style="font-size:12px;padding:4px 10px;">${isExcluded ? '✅ 恢复' : '🚫 排除'}</button>
                        </div>
                    </div>
                </div>
                <div class="haze-footer">Version 2.1 · Designed by HAZE</div>
            </div>
        `;

        // 绑定事件
        const closePanel = () => { overlay.remove(); updateLinkIndicators(); };
        overlay.querySelector('.haze-close').onclick = closePanel;
        overlay.onclick = (e) => { if(e.target === overlay) closePanel(); };

        // 胶囊按钮通用逻辑
        overlay.querySelectorAll('.haze-capsule-btn').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.key;
                const val = btn.dataset.val;
                state[key] = val; // 更新状态
                
                // UI 更新
                btn.parentNode.querySelectorAll('.haze-capsule-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (key === 'theme') applyTheme(); // 立即应用主题
            };
        });

        // 开关
        overlay.querySelector('#sw-bg').onchange = (e) => state.background = e.target.checked;
        overlay.querySelector('#sw-ind').onchange = (e) => state.indicator = e.target.checked;

        // 排除网站
        overlay.querySelector('#btn-toggle-site').onclick = (e) => {
            const list = state.excluded;
            if (list.includes(currentDomain)) {
                state.excluded = list.filter(x => x !== currentDomain);
                e.target.textContent = '🚫 排除';
                e.target.classList.remove('primary');
            } else {
                list.push(currentDomain);
                state.excluded = list;
                e.target.textContent = '✅ 恢复';
                e.target.classList.add('primary');
            }
        };

        document.body.appendChild(overlay);
        applyTheme(); // 打开时立即应用一次主题确保颜色正确
    };

    // === Popup 渲染 ===
    const createLinkOptionsPopup = (event, link) => {
        if (isCurrentSiteExcluded() || isFunctionalLink(link) || isSystemFolderLink(link.href)) return;
        const existing = document.getElementById('haze-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        // 样式偏移：-65% X轴 (左偏), -50% Y轴 (居中)
        Object.assign(popup.style, {
            top: `${event.clientY}px`, left: `${event.clientX}px`,
            transform: 'translate(-65%, -50%)'
        });

        const btnCurrent = document.createElement('div');
        btnCurrent.className = 'haze-popup-btn';
        btnCurrent.textContent = '🏠 当前';
        btnCurrent.onclick = (e) => { e.stopPropagation(); location.href = link.href; popup.remove(); };

        const btnNewTab = document.createElement('div');
        btnNewTab.className = 'haze-popup-btn primary';
        btnNewTab.textContent = state.background ? '🚀 后台' : '↗ 新标签';
        btnNewTab.style.minWidth = '70px';
        btnNewTab.onclick = (e) => {
            e.stopPropagation();
            if (state.background) GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            else window.open(link.href, '_blank');
            popup.remove();
        };

        popup.appendChild(btnCurrent);
        popup.appendChild(btnNewTab);
        document.body.appendChild(popup);
        applyTheme(); // 确保弹窗主题正确

        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;
        popup.onmouseenter = () => { clearTimeout(closeTimer); clearTimeout(leaveTimer); };
        popup.onmouseleave = () => leaveTimer = setTimeout(() => popup.remove(), MOUSE_LEAVE_DELAY);
    };

    // === 初始化 ===
    const init = () => {
        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel);
        document.addEventListener('click', (event) => {
            if (isCurrentSiteExcluded()) return;
            const link = event.target.closest('a');
            if (!link || !link.href) return;
            if (event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (isFunctionalLink(link) || isSystemFolderLink(link.href)) return;

            const mode = state.mode;
            if (mode === 'popup') {
                event.preventDefault(); event.stopPropagation();
                createLinkOptionsPopup(event, link);
            } else if (mode === 'newtab') {
                event.preventDefault(); event.stopPropagation();
                if (state.background) GM_openInTab(link.href, { active: false, insert: true, setParent: true });
                else window.open(link.href, '_blank');
            }
        }, true);
        
        updateLinkIndicators();
        const observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length)) setTimeout(updateLinkIndicators, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
