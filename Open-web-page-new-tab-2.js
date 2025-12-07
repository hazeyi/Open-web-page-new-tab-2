// ==UserScript==
// @name         打开网页：新标签页2 (v3.0 终极融合版)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  完美融合：保留v2.9的高权限点击(修复MacKed)，引入v2.6的排版保护+动态纠错机制(修复MacApp懒加载问题)。
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
            :root {
                --haze-bg: rgba(255, 255, 255, 0.95); --haze-bg-hover: rgba(255, 255, 255, 0.7);
                --haze-text: #333; --haze-text-sub: #666; --haze-border: rgba(0,0,0,0.15);
                --haze-shadow: 0 8px 30px rgba(0,0,0,0.2);
                --haze-primary: #007AFF; --haze-primary-bg: rgba(0,122,255,0.1);
                --haze-ind-popup: #af52de; --haze-ind-newtab: #34c759;
            }
            [data-haze-theme="dark"] {
                --haze-bg: rgba(30, 30, 30, 0.9); --haze-bg-hover: rgba(60, 60, 60, 0.7);
                --haze-text: #f0f0f0; --haze-text-sub: #aaa; --haze-border: rgba(255,255,255,0.2);
                --haze-shadow: 0 10px 40px rgba(0,0,0,0.6);
                --haze-primary: #0A84FF; --haze-primary-bg: rgba(10,132,255,0.25);
                --haze-ind-popup: #bf5af2; --haze-ind-newtab: #32d74b;
            }
            
            /* 视觉层：指示器仅对标记为 text 的链接生效 */
            /* 关键：绝不使用通配符，防止污染图片链接 */
            a[data-haze-status="text"] { position: relative; } 
            a[data-haze-status="text"]::after {
                content: ""; display: inline-block; width: 5px; height: 5px; margin-left: 3px;
                border-radius: 50%; vertical-align: middle; opacity: 0.6; pointer-events: none;
                transition: transform 0.2s;
            }
            a[data-haze-status="text"]:hover::after { transform: scale(1.6); opacity: 1; }
            
            /* 颜色类 */
            .haze-ind-popup::after { background-color: var(--haze-ind-popup); box-shadow: 0 0 5px var(--haze-ind-popup); }
            .haze-ind-newtab::after { background-color: var(--haze-ind-newtab); box-shadow: 0 0 5px var(--haze-ind-newtab); }

            /* 弹窗样式 */
            #haze-popup {
                position: fixed; display: flex; gap: 6px; padding: 6px; z-index: 2147483647;
                background: var(--haze-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border-radius: 12px; border: 1px solid var(--haze-border); box-shadow: var(--haze-shadow);
                transform: translate(-65%, -50%); animation: haze-pop 0.1s ease-out forwards;
            }
            @keyframes haze-pop { from { opacity: 0; transform: translate(-65%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-65%, -50%) scale(1); } }
            
            .haze-popup-btn {
                padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
                color: var(--haze-text); transition: background 0.1s; white-space: nowrap; text-align: center;
            }
            .haze-popup-btn:hover { background: var(--haze-bg-hover); }
            .haze-popup-btn.primary { color: var(--haze-primary); background: var(--haze-primary-bg); font-weight: 600; min-width: 70px; }
            .haze-popup-btn.primary:hover { opacity: 0.8; }

            /* 设置面板样式 */
            #haze-settings-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647;
                background: rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(5px);
            }
            #haze-settings-panel {
                width: 360px; background: var(--haze-bg); border: 1px solid var(--haze-border);
                border-radius: 16px; box-shadow: var(--haze-shadow); backdrop-filter: blur(40px);
                color: var(--haze-text); font-family: system-ui, sans-serif; overflow: hidden;
            }
            .haze-header { padding: 15px 20px; border-bottom: 1px solid var(--haze-border); display: flex; justify-content: space-between; align-items: center; }
            .haze-body { padding: 0 20px; max-height: 70vh; overflow-y: auto; }
            .haze-section { padding: 15px 0; border-bottom: 1px solid var(--haze-border); }
            .haze-section:last-child { border-bottom: none; }
            .haze-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; }
            .haze-capsule { display: flex; background: var(--haze-bg-hover); padding: 3px; border-radius: 8px; }
            .haze-capsule-btn { flex: 1; text-align: center; padding: 6px; font-size: 12px; border-radius: 6px; cursor: pointer; color: var(--haze-text-sub); }
            .haze-capsule-btn.active { background: var(--haze-bg); color: var(--haze-primary); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .haze-switch { position: relative; width: 40px; height: 22px; }
            .haze-switch input { opacity: 0; width: 0; height: 0; }
            .haze-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--haze-border); transition: .3s; border-radius: 34px; }
            .haze-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
            input:checked + .haze-slider { background-color: var(--haze-primary); }
            input:checked + .haze-slider:before { transform: translateX(18px); }
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

    // === 关键逻辑：富媒体检测 ===
    const isRichMediaLink = (link) => {
        // 1. 结构检查：包含图片、SVG、视频等
        if (link.querySelector('img, svg, picture, video, canvas, div, section, article')) return true;
        
        // 2. Class 关键词检查 (防御 MacApp 这种用 background-image 的)
        const cls = (link.className || '').toLowerCase();
        if (/thumb|img|pic|cover|card|banner|poster|photo/.test(cls)) return true;

        // 3. 内容为空 (通常是背景图链接)
        if (link.textContent.trim() === '') return true;
        
        return false;
    };

    // === 核心功能判断 ===
    const isFunctionalLink = (link) => {
        // 穿透：图片链接虽然不加指示器，但必须允许被 handleLinkClick 接管
        if (isRichMediaLink(link)) return false;

        const rawHref = link.getAttribute('href');
        if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) return true;
        if (link.target === '_self' || link.target === '_iframe') return true;
        if (link.getAttribute('class')?.includes('script-link')) return false;

        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;

        const checkStr = (link.className + link.id + text).toLowerCase();
        const keywords = ['login', 'logout', 'sign', 'cart', 'buy', 'like', 'fav', 'share', 'comment', 'play', '登录', '注册', '注销', '购物车', '购买', '点赞', '收藏', '评论', '播放', '展开', '收起'];
        
        if (text.length <= 5 && keywords.some(kw => text.toLowerCase().includes(kw))) return true;
        if (keywords.some(kw => checkStr.includes(kw))) return true;

        return false;
    };

    // === 视觉指示器 (动态纠错版) ===
    const updateLinkIndicators = () => {
        // 全局清理：如果关闭功能，或者网站排除，移除所有标记
        if (!state.indicator || state.excluded.includes(location.hostname) || state.mode === 'default') {
            document.querySelectorAll('a[data-haze-status]').forEach(el => {
                el.removeAttribute('data-haze-status');
                el.className = el.className.replace(/haze-ind-\w+/g, '').trim();
            });
            return;
        }
        
        const cls = state.mode === 'popup' ? 'haze-ind-popup' : 'haze-ind-newtab';
        
        document.querySelectorAll('a').forEach(link => {
            // [纠错核心]: 如果之前被标记为 text，但现在变成了富媒体(图片加载出来了)，立即移除标记！
            // 这就是修复 MacApp 图片显示一半的关键
            if (isRichMediaLink(link)) {
                if (link.getAttribute('data-haze-status') === 'text') {
                    link.removeAttribute('data-haze-status');
                    link.classList.remove(cls);
                }
                return; // 跳过后续添加逻辑
            }

            // 如果已经标记正确，跳过
            if (link.getAttribute('data-haze-status') === 'text') return;

            // 功能链接跳过
            if (isFunctionalLink(link)) return;
            
            // 标记为纯文本链接
            link.setAttribute('data-haze-status', 'text');
            link.classList.add(cls);
        });
        applyTheme();
    };

    // === 交互核心 (v2.9 继承：最高权限捕获) ===
    const handleLinkClick = (event) => {
        let link = event.target.closest('a');
        
        // 穿透逻辑：MacKed 修复
        if (link && (!link.getAttribute('href') || link.getAttribute('href') === '#')) {
             const parentLink = link.parentElement ? link.parentElement.closest('a') : null;
             if (parentLink) link = parentLink;
        }

        if (!link) return;
        const rawHref = link.getAttribute('href');
        if (!rawHref) return;

        if (state.excluded.includes(location.hostname)) return;
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;
        
        if (isFunctionalLink(link)) return;

        const mode = state.mode;
        // 强制接管，阻止冒泡，战胜其他脚本
        if (mode === 'popup') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation(); 
            createPopup(event, link, rawHref);
        } else if (mode === 'newtab') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (state.background) GM_openInTab(rawHref, { active: false, insert: true, setParent: true });
            else window.open(rawHref, '_blank');
        }
    };

    // === UI 组件 ===
    const createPopup = (e, link, url) => {
        const old = document.getElementById('haze-popup'); if (old) old.remove();
        injectStyle();
        
        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        Object.assign(popup.style, { top: `${e.clientY}px`, left: `${e.clientX}px` });

        const btn1 = document.createElement('div');
        btn1.className = 'haze-popup-btn'; btn1.textContent = '🏠 当前';
        btn1.onclick = (ev) => { ev.stopPropagation(); location.href = url; popup.remove(); };

        const btn2 = document.createElement('div');
        btn2.className = 'haze-popup-btn primary'; 
        btn2.textContent = state.background ? '🚀 后台' : '↗ 新标签';
        btn2.onclick = (ev) => {
            ev.stopPropagation();
            if (state.background) GM_openInTab(url, { active: false, insert: true, setParent: true });
            else window.open(url, '_blank');
            popup.remove();
        };

        popup.append(btn1, btn2);
        document.body.appendChild(popup);
        applyTheme();

        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;
        popup.onmouseenter = () => { clearTimeout(closeTimer); clearTimeout(leaveTimer); };
        popup.onmouseleave = () => leaveTimer = setTimeout(() => popup.remove(), MOUSE_LEAVE_DELAY);
    };

    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;
        injectStyle();
        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';
        const isEx = state.excluded.includes(location.hostname);

        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div class="haze-header"><div class="haze-title">✨ 脚本设置中心</div><div class="haze-close">✕</div></div>
                <div class="haze-body">
                    <div class="haze-section">
                        <div class="haze-row" style="font-size:12px;color:#888;">v3.0 终极融合版</div>
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
                        <div class="haze-label">外观主题</div>
                        <div class="haze-capsule">
                            <div class="haze-capsule-btn ${state.theme==='auto'?'active':''}" data-k="theme" data-v="auto">🔮 自动</div>
                            <div class="haze-capsule-btn ${state.theme==='light'?'active':''}" data-k="theme" data-v="light">☀️ 浅色</div>
                            <div class="haze-capsule-btn ${state.theme==='dark'?'active':''}" data-k="theme" data-v="dark">🌑 深色</div>
                        </div>
                    </div>
                    <div class="haze-section">
                        <div class="haze-row"><div>后台静默打开</div><label class="haze-switch"><input type="checkbox" id="sw-bg" ${state.background?'checked':''}><span class="haze-slider"></span></label></div>
                        <div class="haze-row"><div>链接指示器 (仅文本)</div><label class="haze-switch"><input type="checkbox" id="sw-ind" ${state.indicator?'checked':''}><span class="haze-slider"></span></label></div>
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
            if(btn.dataset.k === 'theme') applyTheme();
        });
        
        overlay.querySelector('#sw-bg').onchange = (e) => state.background = e.target.checked;
        overlay.querySelector('#sw-ind').onchange = (e) => { state.indicator = e.target.checked; updateLinkIndicators(); };
        overlay.querySelector('#btn-ex').onclick = (e) => {
            const list = state.excluded;
            if(list.includes(location.hostname)) { state.excluded = list.filter(d=>d!==location.hostname); e.target.textContent = '🚫 排除'; e.target.classList.remove('primary'); } 
            else { list.push(location.hostname); state.excluded = list; e.target.textContent = '✅ 恢复'; e.target.classList.add('primary'); }
        };
        document.body.appendChild(overlay);
        applyTheme();
    };

    // === 主程序 ===
    const main = () => {
        injectStyle();
        applyTheme();
        updateLinkIndicators();
        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel);

        // 使用 Capture 阶段 (true) 确保点击被优先处理
        document.addEventListener('click', handleLinkClick, true);

        const observer = new MutationObserver((mutations) => {
            // 高频检测，确保懒加载图片被及时"除名"指示器
            if (mutations.some(m => m.addedNodes.length)) setTimeout(updateLinkIndicators, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
