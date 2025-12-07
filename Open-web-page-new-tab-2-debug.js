// ==UserScript==
// @name         打开网页：新标签页2 (v2.7 Debug版)
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  包含详细的控制台日志，用于诊断 MacKed 等网站点击失效的问题。
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

    // === UI 配置 ===
    const AUTO_CLOSE_TIMEOUT = 3500;
    const MOUSE_LEAVE_DELAY = 800;

    // === 调试日志工具 ===
    const log = (msg, data = '') => {
        console.log(`%c[HAZE-DEBUG] ${msg}`, 'color: #fff; background: #007AFF; padding: 2px 5px; border-radius: 3px;', data);
    };
    const warn = (msg, data = '') => {
        console.log(`%c[HAZE-DEBUG] 🚫 ${msg}`, 'color: #fff; background: #FF3B30; padding: 2px 5px; border-radius: 3px;', data);
    };

    // === 状态管理 ===
    const state = {
        get mode() { return GM_getValue('openMode', 'popup'); },
        set mode(v) { GM_setValue('openMode', v); },
        get background() { return GM_getValue('backgroundMode', false); },
        set background(v) { GM_setValue('backgroundMode', v); },
        get indicator() { return GM_getValue('showIndicator', true); },
        set indicator(v) { GM_setValue('showIndicator', v); },
        get theme() { return GM_getValue('theme', 'auto'); },
        set theme(v) { GM_setValue('theme', v); },
        get excluded() { return GM_getValue('excludedSites', []); },
        set excluded(v) { GM_setValue('excludedSites', v); }
    };

    // === CSS 注入 ===
    const cssContent = `
        :root {
            --haze-bg: rgba(255, 255, 255, 0.95); --haze-bg-hover: rgba(255, 255, 255, 0.7);
            --haze-text: #333; --haze-text-sub: #666; --haze-border: rgba(0,0,0,0.1);
            --haze-shadow: 0 8px 30px rgba(0,0,0,0.15);
            --haze-primary: #007AFF; --haze-primary-bg: rgba(0,122,255,0.1);
            --haze-ind-popup: #af52de; --haze-ind-newtab: #34c759;
        }
        [data-haze-theme="dark"] {
            --haze-bg: rgba(30, 30, 30, 0.9); --haze-bg-hover: rgba(60, 60, 60, 0.7);
            --haze-text: #f0f0f0; --haze-text-sub: #aaa; --haze-border: rgba(255,255,255,0.15);
            --haze-shadow: 0 10px 40px rgba(0,0,0,0.6);
            --haze-primary: #0A84FF; --haze-primary-bg: rgba(10,132,255,0.25);
            --haze-ind-popup: #bf5af2; --haze-ind-newtab: #32d74b;
        }
        
        a[data-haze-status="text"] { position: relative; } 
        a[data-haze-status="text"]::after {
            content: ""; display: inline-block; width: 5px; height: 5px; margin-left: 3px;
            border-radius: 50%; vertical-align: middle; opacity: 0.6; pointer-events: none;
            transition: transform 0.2s;
        }
        a[data-haze-status="text"]:hover::after { transform: scale(1.6); opacity: 1; }
        .haze-ind-popup::after { background-color: var(--haze-ind-popup); box-shadow: 0 0 5px var(--haze-ind-popup); }
        .haze-ind-newtab::after { background-color: var(--haze-ind-newtab); box-shadow: 0 0 5px var(--haze-ind-newtab); }

        #haze-popup {
            position: fixed; display: flex; gap: 6px; padding: 6px; z-index: 2147483647;
            background: var(--haze-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-radius: 12px; border: 1px solid var(--haze-border); box-shadow: var(--haze-shadow);
            transform: translate(-65%, -50%);
            animation: haze-pop 0.15s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
        }
        @keyframes haze-pop { from { opacity: 0; transform: translate(-65%, -45%) scale(0.9); } to { opacity: 1; transform: translate(-65%, -50%) scale(1); } }
        
        .haze-popup-btn {
            padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
            color: var(--haze-text); transition: all 0.1s; white-space: nowrap; text-align: center;
        }
        .haze-popup-btn:hover { background: var(--haze-bg-hover); }
        .haze-popup-btn.primary { color: var(--haze-primary); background: var(--haze-primary-bg); font-weight: 600; min-width: 70px; }
        .haze-popup-btn.primary:hover { opacity: 0.8; }

        #haze-settings-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647;
            background: rgba(0,0,0,0.25); display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(5px); opacity: 0; animation: haze-fade 0.2s forwards;
        }
        @keyframes haze-fade { to { opacity: 1; } }
        #haze-settings-panel {
            width: 360px; background: var(--haze-bg); border: 1px solid var(--haze-border);
            border-radius: 16px; box-shadow: var(--haze-shadow); backdrop-filter: blur(40px);
            color: var(--haze-text); font-family: system-ui, sans-serif; overflow: hidden;
            transform: scale(0.95); animation: haze-scale 0.2s forwards;
        }
        @keyframes haze-scale { to { transform: scale(1); } }
        .haze-header { padding: 16px 20px; border-bottom: 1px solid var(--haze-border); display: flex; justify-content: space-between; align-items: center; }
        .haze-title { font-weight: 600; font-size: 16px; }
        .haze-close { cursor: pointer; opacity: 0.6; font-size: 18px; }
        .haze-body { padding: 0 20px; max-height: 70vh; overflow-y: auto; }
        .haze-section { padding: 16px 0; border-bottom: 1px solid var(--haze-border); }
        .haze-section:last-child { border-bottom: none; }
        .haze-label { font-size: 12px; color: var(--haze-text-sub); margin-bottom: 8px; font-weight: 600; }
        .haze-capsule { display: flex; background: var(--haze-bg-hover); padding: 3px; border-radius: 8px; }
        .haze-capsule-btn { flex: 1; text-align: center; padding: 6px; font-size: 12px; border-radius: 6px; cursor: pointer; color: var(--haze-text-sub); }
        .haze-capsule-btn.active { background: var(--haze-bg); color: var(--haze-primary); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .haze-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 14px; }
        .haze-switch { position: relative; width: 40px; height: 22px; }
        .haze-switch input { opacity: 0; width: 0; height: 0; }
        .haze-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--haze-border); transition: .3s; border-radius: 34px; }
        .haze-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .haze-slider { background-color: var(--haze-primary); }
        input:checked + .haze-slider:before { transform: translateX(18px); }
    `;

    const injectStyle = () => {
        if (document.getElementById('haze-style')) return;
        const s = document.createElement('style');
        s.id = 'haze-style'; s.textContent = cssContent;
        (document.head || document.documentElement).appendChild(s);
    };

    const applyTheme = () => {
        const overlay = document.getElementById('haze-settings-overlay');
        const popup = document.getElementById('haze-popup');
        let theme = state.theme;
        if (theme === 'auto') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        
        if (overlay) overlay.setAttribute('data-haze-theme', theme);
        if (popup) popup.setAttribute('data-haze-theme', theme);
        document.documentElement.setAttribute('data-haze-global-theme', theme);
        
        if (theme === 'dark') {
            document.documentElement.style.setProperty('--haze-ind-popup', '#bf5af2');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#32d74b');
        } else {
            document.documentElement.style.setProperty('--haze-ind-popup', '#af52de');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#34c759');
        }
    };

    const isRichMediaLink = (link) => {
        if (link.querySelector('img, svg, picture, video, canvas, div, section, article')) return true;
        if (link.textContent.trim() === '') return true;
        return false;
    };

    const isFunctionalLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.includes('javascript:') || href.includes('mailto:')) {
            warn('拦截原因: 无效 href', href);
            return true;
        }
        if (link.target === '_self' || link.target === '_top' || link.target === 'iframe') {
            warn('拦截原因: Target 属性', link.target);
            return true;
        }
        
        const className = (link.getAttribute('class') || '').toLowerCase();
        if (className.includes('script-link')) return false; 

        const role = link.getAttribute('role');
        if (role && ['button', 'tab', 'menuitem', 'option', 'checkbox'].includes(role)) {
            warn('拦截原因: Role 属性', role);
            return true;
        }

        try {
            if (href.startsWith('#')) return true;
            const urlObj = new URL(link.href);
            if (urlObj.pathname === location.pathname && urlObj.hash) {
                warn('拦截原因: 页内锚点');
                return true;
            }
        } catch(e) {}

        const attrs = ['onclick', 'data-toggle', 'data-target', 'aria-controls', 'aria-expanded', 'ng-click', '@click', 'v-on:click'];
        for (const attr of attrs) if (link.hasAttribute(attr)) {
            warn('拦截原因: 功能属性', attr);
            return true;
        }

        if (isRichMediaLink(link)) {
            log('检测到富媒体链接 (图片等)，放行点击逻辑');
            return false;
        }

        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;

        const keywords = ['login', 'logout', 'signin', 'register', 'submit', 'cancel', 'edit', 'delete', 'close', 'expand', 'collapse', 'load more', 'next', 'prev', 'filter', 'sort', 'cart', 'buy', 'like', 'fav', 'share', 'reply', 'comment', 'play', 'pause', '登录', '注册', '注销', '购物车', '购买', '点赞', '收藏', '分享', '回复', '评论', '播放', '展开', '收起'];
        
        if (text.length > 0 && text.length <= 5 && keywords.some(kw => text.toLowerCase().includes(kw))) {
            warn('拦截原因: 短文本关键词', text);
            return true;
        }
        
        return false;
    };
    const isSystemFolderLink = (href) => /^file:\/\/\/[a-zA-Z]:\//.test(href);

    const updateLinkIndicators = () => {
        document.querySelectorAll('a[data-haze-status]').forEach(el => {
            el.removeAttribute('data-haze-status');
            el.className = el.className.replace(/haze-ind-\w+/g, '').trim();
        });

        if (!state.indicator || state.excluded.includes(location.hostname) || state.mode === 'default') return;
        const cls = state.mode === 'popup' ? 'haze-ind-popup' : 'haze-ind-newtab';
        
        document.querySelectorAll('a').forEach(link => {
            if (isRichMediaLink(link)) return; // 视觉跳过
            if (isFunctionalLink(link) || isSystemFolderLink(link.href)) return;
            link.setAttribute('data-haze-status', 'text');
            link.classList.add(cls);
        });
        applyTheme();
    };

    // === 设置面板逻辑 (省略部分重复代码，核心逻辑一致) ===
    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;
        injectStyle();
        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';
        const domain = location.hostname;
        const isEx = state.excluded.includes(domain);

        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div class="haze-header"><div class="haze-title">⚙️ 调试模式控制台</div><div class="haze-close">✕</div></div>
                <div class="haze-body">
                    <div class="haze-section">
                        <div class="haze-row" style="color:red;font-size:12px;">当前为 Debug 版本，请按 F12 查看 Console 日志</div>
                    </div>
                    <div class="haze-section">
                        <div class="haze-label">默认模式</div>
                        <div class="haze-capsule">
                            <div class="haze-capsule-btn ${state.mode==='popup'?'active':''}" data-k="mode" data-v="popup">选择框</div>
                            <div class="haze-capsule-btn ${state.mode==='newtab'?'active':''}" data-k="mode" data-v="newtab">直接新标签</div>
                            <div class="haze-capsule-btn ${state.mode==='default'?'active':''}" data-k="mode" data-v="default">已禁用</div>
                        </div>
                    </div>
                    <div class="haze-section">
                        <div class="haze-row"><div>排除当前网站</div><div class="haze-popup-btn ${isEx?'primary':''}" id="btn-ex">${isEx ? '✅ 恢复' : '🚫 排除'}</div></div>
                    </div>
                </div>
            </div>
        `;
        const close = () => { overlay.remove(); updateLinkIndicators(); };
        overlay.querySelector('.haze-close').onclick = close;
        overlay.onclick = (e) => { if(e.target===overlay) close(); };
        overlay.querySelectorAll('.haze-capsule-btn').forEach(btn => btn.onclick = () => {
            state[btn.dataset.k] = btn.dataset.v;
            btn.parentNode.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
        });
        overlay.querySelector('#btn-ex').onclick = (e) => {
            const list = state.excluded;
            if(list.includes(domain)) { state.excluded = list.filter(d=>d!==domain); e.target.textContent = '🚫 排除'; e.target.classList.remove('primary'); } 
            else { list.push(domain); state.excluded = list; e.target.textContent = '✅ 恢复'; e.target.classList.add('primary'); }
        };
        document.body.appendChild(overlay);
        applyTheme();
    };

    const createPopup = (e, link) => {
        log('正在创建选择框...');
        const old = document.getElementById('haze-popup'); if (old) old.remove();
        injectStyle();
        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        Object.assign(popup.style, { top: `${e.clientY}px`, left: `${e.clientX}px` });
        const btn1 = document.createElement('div'); btn1.className = 'haze-popup-btn'; btn1.textContent = '🏠 当前';
        btn1.onclick = (ev) => { ev.stopPropagation(); location.href = link.href; popup.remove(); };
        const btn2 = document.createElement('div'); btn2.className = 'haze-popup-btn primary'; btn2.textContent = state.background ? '🚀 后台' : '↗ 新标签';
        btn2.onclick = (ev) => {
            ev.stopPropagation();
            if (state.background) GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            else window.open(link.href, '_blank');
            popup.remove();
        };
        popup.append(btn1, btn2); document.body.appendChild(popup); applyTheme();
        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;
        popup.onmouseenter = () => { clearTimeout(closeTimer); clearTimeout(leaveTimer); };
        popup.onmouseleave = () => leaveTimer = setTimeout(() => popup.remove(), MOUSE_LEAVE_DELAY);
    };

    const main = () => {
        injectStyle(); applyTheme(); updateLinkIndicators();
        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel);

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            
            log('捕获点击事件:', link);
            log('链接 HREF:', link.href);

            if (!link.href) { warn('无Href属性'); return; }
            if (e.ctrlKey || e.metaKey || e.shiftKey) { warn('检测到修饰键'); return; }
            if (state.excluded.includes(location.hostname)) { warn('网站在黑名单中'); return; }
            
            if (isFunctionalLink(link) || isSystemFolderLink(link.href)) {
                warn('isFunctionalLink 返回 true, 判定为功能链接');
                return;
            }

            log('✅ 判定通过，执行脚本逻辑');
            if (state.mode === 'popup') {
                e.preventDefault(); e.stopPropagation();
                createPopup(e, link);
            } else if (state.mode === 'newtab') {
                e.preventDefault(); e.stopPropagation();
                if (state.background) GM_openInTab(link.href, { active: false, insert: true, setParent: true });
                else window.open(link.href, '_blank');
            }
        }, true);

        const observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length)) setTimeout(updateLinkIndicators, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
