// ==UserScript==
// @name         打开网页：新标签页2 (v3.4 双重保险版)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  完美逻辑：1. 按住 Alt/Option 点击可强制召唤选择框(解决误放行)；2. "当前页"按钮升级为原生模拟点击(解决误拦截)。
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
    
    // === 内部状态 ===
    let isBypassing = false; // 用于"原生点击"的穿透标记

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
    const injectStyle = () => {
        if (document.getElementById('haze-style')) return;
        const s = document.createElement('style');
        s.id = 'haze-style';
        s.textContent = `
            :root { --haze-bg: rgba(255,255,255,0.95); --haze-text: #333; --haze-primary: #007AFF; --haze-ind-popup: #af52de; --haze-ind-newtab: #34c759; }
            [data-haze-theme="dark"] { --haze-bg: rgba(30,30,30,0.9); --haze-text: #f0f0f0; --haze-primary: #0A84FF; --haze-ind-popup: #bf5af2; --haze-ind-newtab: #32d74b; }
            
            a[data-haze-status="text"] { position: relative; } 
            a[data-haze-status="text"]::after {
                content: ""; display: inline-block; width: 5px; height: 5px; margin-left: 3px;
                border-radius: 50%; vertical-align: middle; opacity: 0.6; pointer-events: none; transition: transform 0.2s;
            }
            a[data-haze-status="text"]:hover::after { transform: scale(1.6); opacity: 1; }
            .haze-ind-popup::after { background: var(--haze-ind-popup); box-shadow: 0 0 5px var(--haze-ind-popup); }
            .haze-ind-newtab::after { background: var(--haze-ind-newtab); box-shadow: 0 0 5px var(--haze-ind-newtab); }

            #haze-popup {
                position: fixed; display: flex; gap: 6px; padding: 6px; z-index: 2147483647;
                background: var(--haze-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                transform: translate(-65%, -50%); animation: haze-pop 0.1s ease-out forwards;
            }
            @keyframes haze-pop { from { opacity: 0; transform: translate(-65%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-65%, -50%) scale(1); } }
            
            .haze-popup-btn {
                padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
                color: var(--haze-text); transition: background 0.1s; white-space: nowrap;
            }
            .haze-popup-btn:hover { background: rgba(128,128,128,0.1); }
            .haze-popup-btn.primary { color: var(--haze-primary); background: rgba(0,122,255,0.1); font-weight: 600; min-width: 70px; }
            .haze-popup-btn.primary:hover { opacity: 0.8; }

            #haze-settings-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; background: rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px); }
            #haze-settings-panel { width: 360px; background: var(--haze-bg); border-radius: 16px; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); color: var(--haze-text); font-family: system-ui; }
            .haze-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 14px; }
            .haze-btn { padding: 5px 10px; border-radius: 6px; background: rgba(128,128,128,0.1); cursor: pointer; }
            .haze-btn.active { background: var(--haze-primary); color: #fff; }
        `;
        (document.head || document.documentElement).appendChild(s);
    };

    const applyTheme = () => {
        const theme = state.theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.theme;
        document.documentElement.setAttribute('data-haze-global-theme', theme);
        const els = document.querySelectorAll('#haze-popup, #haze-settings-overlay');
        els.forEach(el => el.setAttribute('data-haze-theme', theme));
        if (theme === 'dark') {
            document.documentElement.style.setProperty('--haze-ind-popup', '#bf5af2');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#32d74b');
        } else {
            document.documentElement.style.setProperty('--haze-ind-popup', '#af52de');
            document.documentElement.style.setProperty('--haze-ind-newtab', '#34c759');
        }
    };

    // === 核心逻辑 ===
    const isRichMediaLink = (link) => {
        if (link.querySelector('img, svg, picture, video, canvas, div, section, article')) return true;
        const cls = (link.className || '').toLowerCase();
        if (/thumb|img|pic|cover|card|banner|poster|photo/.test(cls)) return true;
        if (link.textContent.trim() === '') return true;
        return false;
    };

    const isFunctionalLink = (link, isForceMode) => {
        // [保险机制1] 如果用户按住 Alt 键，所有规则失效，强制返回 false (接管点击)
        if (isForceMode) return false;

        const rawHref = link.getAttribute('href');
        if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) return true;
        if (link.target === '_self' || link.target === '_iframe') return true;
        if (link.getAttribute('class')?.includes('script-link')) return false;

        if (link.closest('h1, h2, h3, h4, h5, h6')) return false;
        if (isRichMediaLink(link)) return false; 

        try {
            if (rawHref.startsWith('#')) return true;
            const urlObj = new URL(link.href);
            if (urlObj.pathname === window.location.pathname && urlObj.hash !== '') return true;
        } catch(e) {}

        const attrs = ['onclick', 'data-toggle', 'data-target', 'aria-controls', 'aria-expanded', 'ng-click', '@click', 'v-on:click'];
        for (const attr of attrs) if (link.hasAttribute(attr)) return true;

        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;

        const checkStr = (link.className + ' ' + link.id + ' ' + text).toLowerCase();
        const keywords = ['login', 'logout', 'sign', 'cart', 'buy', 'like', 'fav', 'share', 'comment', 'play', '登录', '注册', '注销', '购物车', '购买', '点赞', '收藏', '评论', '播放', '展开', '收起'];
        
        const isKeywordMatch = keywords.some(kw => {
            if (/[\u4e00-\u9fa5]/.test(kw)) return checkStr.includes(kw);
            return new RegExp(`\\b${kw}\\b`).test(checkStr);
        });

        if (text.length <= 5 && isKeywordMatch) return true;
        if (isKeywordMatch) return true;

        return false;
    };

    const updateLinkIndicators = () => {
        document.querySelectorAll('a[data-haze-status]').forEach(el => {
            el.removeAttribute('data-haze-status');
            el.className = el.className.replace(/haze-ind-\w+/g, '').trim();
        });

        if (!state.indicator || state.excluded.includes(location.hostname) || state.mode === 'default') return;
        const cls = state.mode === 'popup' ? 'haze-ind-popup' : 'haze-ind-newtab';
        
        document.querySelectorAll('a').forEach(link => {
            if (isRichMediaLink(link)) return;
            if (isFunctionalLink(link, false)) return;
            link.setAttribute('data-haze-status', 'text');
            link.classList.add(cls);
        });
        applyTheme();
    };

    const handleLinkClick = (event) => {
        // [保险机制2] 如果正在执行原生模拟点击，直接放行，不拦截
        if (isBypassing) return;

        let link = event.target.closest('a');
        if (link && (!link.getAttribute('href') || link.getAttribute('href') === '#')) {
             const parentLink = link.parentElement ? link.parentElement.closest('a') : null;
             if (parentLink) link = parentLink;
        }
        if (!link) return;
        const rawHref = link.getAttribute('href');
        if (!rawHref) return;

        if (state.excluded.includes(location.hostname)) return;
        
        // 允许 Ctrl/Meta/Shift 默认行为
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;
        
        // 检查 Alt 键 (强制模式)
        const isForceMode = event.altKey;
        
        // 如果是功能链接，且没有按 Alt 强制，则放行
        if (isFunctionalLink(link, isForceMode)) return;

        const mode = state.mode;
        if (mode === 'popup') {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); 
            createPopup(event, link, rawHref);
        } else if (mode === 'newtab') {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            if (state.background) GM_openInTab(rawHref, { active: false, insert: true, setParent: true });
            else window.open(rawHref, '_blank');
        }
    };

    const createPopup = (e, link, url) => {
        const old = document.getElementById('haze-popup'); if (old) old.remove();
        injectStyle();
        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        Object.assign(popup.style, { top: `${e.clientY}px`, left: `${e.clientX}px` });
        
        // [保险机制2] 升级版"当前页"按钮：执行原生点击
        const btn1 = document.createElement('div'); 
        btn1.className = 'haze-popup-btn'; 
        btn1.textContent = '🏠 当前';
        btn1.onclick = (ev) => { 
            popup.remove();
            isBypassing = true; // 开启穿透标记
            link.click();       // 触发原生点击 (让网页自带JS执行)
            // 50ms后重置标记，恢复拦截
            setTimeout(() => isBypassing = false, 50); 
        };
        
        const btn2 = document.createElement('div'); btn2.className = 'haze-popup-btn primary'; 
        btn2.textContent = state.background ? '🚀 后台' : '↗ 新标签';
        btn2.onclick = (ev) => {
            ev.stopPropagation();
            if (state.background) GM_openInTab(url, { active: false, insert: true, setParent: true });
            else window.open(url, '_blank');
            popup.remove();
        };
        
        popup.append(btn1, btn2); document.body.appendChild(popup); applyTheme();
        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;
        popup.onmouseenter = () => { clearTimeout(closeTimer); clearTimeout(leaveTimer); };
        popup.onmouseleave = () => leaveTimer = setTimeout(() => popup.remove(), 800);
    };

    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;
        injectStyle();
        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';
        const isEx = state.excluded.includes(location.hostname);

        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
                    <div style="font-weight:600;font-size:16px;">✨ 脚本设置</div>
                    <div class="haze-close" style="cursor:pointer;">✕</div>
                </div>
                <div class="haze-row">
                    <div>模式</div>
                    <div>
                        <span class="haze-btn ${state.mode==='popup'?'active':''}" data-k="mode" data-v="popup">选择框</span>
                        <span class="haze-btn ${state.mode==='newtab'?'active':''}" data-k="mode" data-v="newtab">新标签</span>
                        <span class="haze-btn ${state.mode==='default'?'active':''}" data-k="mode" data-v="default">禁用</span>
                    </div>
                </div>
                <div class="haze-row">
                    <div>主题</div>
                    <div>
                        <span class="haze-btn ${state.theme==='auto'?'active':''}" data-k="theme" data-v="auto">自动</span>
                        <span class="haze-btn ${state.theme==='light'?'active':''}" data-k="theme" data-v="light">☀️</span>
                        <span class="haze-btn ${state.theme==='dark'?'active':''}" data-k="theme" data-v="dark">🌑</span>
                    </div>
                </div>
                <div class="haze-row">
                    <div>指示器</div>
                    <span class="haze-btn ${state.indicator?'active':''}" id="sw-ind">${state.indicator?'开启':'关闭'}</span>
                </div>
                <div class="haze-row">
                    <div>当前网站</div>
                    <span class="haze-btn ${isEx?'':'active'}" id="btn-ex">${isEx?'已排除':'生效中'}</span>
                </div>
                <div style="font-size:12px;color:#999;margin-top:20px;text-align:center;">
                    按住 Alt/Option 点击可强制召唤选择框
                </div>
            </div>`;
        
        const close = () => { overlay.remove(); updateLinkIndicators(); };
        overlay.querySelector('.haze-close').onclick = close;
        overlay.onclick = (e) => { if(e.target===overlay) close(); };
        overlay.querySelectorAll('[data-k]').forEach(btn => btn.onclick = () => {
            state[btn.dataset.k] = btn.dataset.v;
            btn.parentNode.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            if(btn.dataset.k === 'theme') applyTheme();
        });
        overlay.querySelector('#sw-ind').onclick = (e) => { 
            state.indicator = !state.indicator; 
            e.target.textContent = state.indicator ? '开启' : '关闭';
            e.target.classList.toggle('active');
            updateLinkIndicators(); 
        };
        overlay.querySelector('#btn-ex').onclick = (e) => {
            const list = state.excluded;
            if(list.includes(location.hostname)) { 
                state.excluded = list.filter(d=>d!==location.hostname); 
                e.target.textContent = '生效中'; e.target.classList.add('active'); 
            } else { 
                list.push(location.hostname); state.excluded = list; 
                e.target.textContent = '已排除'; e.target.classList.remove('active'); 
            }
        };
        document.body.appendChild(overlay); applyTheme();
    };

    const main = () => {
        injectStyle(); applyTheme(); updateLinkIndicators();
        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel);
        document.addEventListener('click', handleLinkClick, true);
        const observer = new MutationObserver((mutations) => { if (mutations.some(m => m.addedNodes.length)) setTimeout(updateLinkIndicators, 500); });
        observer.observe(document.body, { childList: true, subtree: true });
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
