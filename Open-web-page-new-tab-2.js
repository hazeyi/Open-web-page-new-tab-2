// ==UserScript==
// @name         打开网页：新标签页2 (设置面板版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  智能识别+可视化指示器+设置面板。集成黑名单管理，支持"点击-再点击"极速流，防抖容错。
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
    
    // 颜色配置
    const COLOR_PRIMARY = '#007AFF';
    const COLOR_BG_BLUR = 'rgba(255, 255, 255, 0.85)';
    
    // 指示器颜色
    const IND_COLOR_POPUP = '#af52de';
    const IND_COLOR_NEWTAB = '#34c759';

    // === 状态管理 ===
    const state = {
        get mode() { return GM_getValue('openMode', 'popup'); },
        set mode(v) { GM_setValue('openMode', v); },
        
        get background() { return GM_getValue('backgroundMode', false); },
        set background(v) { GM_setValue('backgroundMode', v); },
        
        get indicator() { return GM_getValue('showIndicator', true); },
        set indicator(v) { GM_setValue('showIndicator', v); },
        
        get excluded() { return GM_getValue('excludedSites', []); },
        set excluded(v) { GM_setValue('excludedSites', v); }
    };

    const getCurrentDomain = () => window.location.hostname;
    const isCurrentSiteExcluded = () => state.excluded.includes(getCurrentDomain());

    // === CSS 注入 ===
    const style = document.createElement('style');
    style.textContent = `
        /* 指示器 */
        a[data-haze-link="active"] { position: relative; }
        a[data-haze-link="active"]::after {
            content: ""; display: inline-block; width: 5px; height: 5px;
            margin-left: 3px; border-radius: 50%; vertical-align: middle;
            opacity: 0.5; transition: all 0.2s; pointer-events: none;
        }
        a[data-haze-link="active"]:hover::after { transform: scale(1.5); opacity: 1; }
        .haze-ind-popup::after { background-color: ${IND_COLOR_POPUP}; box-shadow: 0 0 6px ${IND_COLOR_POPUP}; }
        .haze-ind-newtab::after { background-color: ${IND_COLOR_NEWTAB}; box-shadow: 0 0 6px ${IND_COLOR_NEWTAB}; }

        /* 弹窗动画 */
        @keyframes haze-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        /* 设置面板样式 */
        #haze-settings-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.2); z-index: 2147483647;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(2px);
        }
        #haze-settings-panel {
            background: #fff; width: 400px; max-height: 80vh;
            border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden; display: flex; flex-direction: column;
            animation: haze-fade-in 0.2s ease-out;
        }
        .haze-header {
            padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
            background: #f9f9f9;
        }
        .haze-title { font-size: 16px; font-weight: 600; color: #333; }
        .haze-close { cursor: pointer; font-size: 20px; color: #999; line-height: 1; }
        .haze-close:hover { color: #333; }
        
        .haze-body { padding: 0 20px; overflow-y: auto; flex: 1; }
        .haze-section { padding: 16px 0; border-bottom: 1px solid #f0f0f0; }
        .haze-section:last-child { border-bottom: none; }
        .haze-section-title { font-size: 12px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* 表单控件 */
        .haze-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .haze-label { font-size: 14px; color: #333; }
        
        /* 模式选择 */
        .haze-mode-select { display: flex; gap: 8px; background: #f0f0f5; padding: 4px; border-radius: 8px; }
        .haze-mode-btn { 
            flex: 1; padding: 6px; font-size: 12px; text-align: center; cursor: pointer; 
            border-radius: 6px; color: #666; transition: all 0.2s;
        }
        .haze-mode-btn.active { background: #fff; color: ${COLOR_PRIMARY}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-weight: 500; }
        
        /* 开关 Switch */
        .haze-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
        .haze-switch input { opacity: 0; width: 0; height: 0; }
        .haze-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .haze-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .haze-slider { background-color: ${COLOR_PRIMARY}; }
        input:checked + .haze-slider:before { transform: translateX(18px); }

        /* 黑名单列表 */
        .haze-list { max-height: 150px; overflow-y: auto; background: #f9f9f9; border-radius: 8px; border: 1px solid #eee; }
        .haze-list-item { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; color: #555; border-bottom: 1px solid #eee; }
        .haze-list-item:last-child { border-bottom: none; }
        .haze-remove-btn { color: #ff3b30; cursor: pointer; font-size: 12px; }
        .haze-input-group { display: flex; gap: 8px; margin-top: 10px; }
        .haze-input { flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
        .haze-btn { padding: 6px 12px; background: ${COLOR_PRIMARY}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .haze-btn:hover { opacity: 0.9; }
        
        .haze-footer { padding: 12px 20px; background: #f9f9f9; text-align: right; font-size: 12px; color: #999; }
    `;
    document.head.appendChild(style);

    // === 智能识别逻辑 (保持不变) ===
    const isFunctionalLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.includes('javascript:')) return true;
        if (link.target === '_self' || link.target === '_top' || link.target === 'iframe') return true;
        if (['button', 'tab', 'menuitem'].includes(link.getAttribute('role'))) return true;
        try { if (new URL(link.href).pathname === location.pathname && link.hash) return true; } catch(e){}
        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;
        if (link.className.includes('script-link')) return false; // GreasyFork 特例

        const str = (link.className + link.id + (link.title||'') + text).toLowerCase();
        const keywords = ['login', 'logout', 'sign', 'cart', 'buy', 'sku', 'like', 'fav', 'share', 'comment', 'play', '登录', '注册', '购物车', '购买', '点赞', '收藏', '评论', '回复'];
        if (keywords.some(kw => str.includes(kw))) return true;
        return false;
    };
    const isSystemFolderLink = (href) => /^file:\/\/\/[a-zA-Z]:\//.test(href);

    // === 指示器逻辑 ===
    const updateLinkIndicators = () => {
        // 清理旧标记
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
    };

    // === 设置面板逻辑 ===
    const createSettingsPanel = () => {
        if (document.getElementById('haze-settings-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'haze-settings-overlay';
        
        // 面板 HTML 结构
        const currentDomain = getCurrentDomain();
        const isExcluded = isCurrentSiteExcluded();
        
        overlay.innerHTML = `
            <div id="haze-settings-panel">
                <div class="haze-header">
                    <div class="haze-title">脚本设置中心</div>
                    <div class="haze-close">×</div>
                </div>
                <div class="haze-body">
                    <div class="haze-section">
                        <div class="haze-section-title">默认打开模式</div>
                        <div class="haze-mode-select">
                            <div class="haze-mode-btn ${state.mode==='popup'?'active':''}" data-val="popup">选择框</div>
                            <div class="haze-mode-btn ${state.mode==='newtab'?'active':''}" data-val="newtab">直接新标签</div>
                            <div class="haze-mode-btn ${state.mode==='default'?'active':''}" data-val="default">禁用脚本</div>
                        </div>
                    </div>

                    <div class="haze-section">
                        <div class="haze-section-title">交互体验</div>
                        <div class="haze-row">
                            <div class="haze-label">后台静默打开新标签</div>
                            <label class="haze-switch">
                                <input type="checkbox" id="sw-bg" ${state.background?'checked':''}>
                                <span class="haze-slider"></span>
                            </label>
                        </div>
                        <div class="haze-row">
                            <div class="haze-label">显示链接指示器 (圆点)</div>
                            <label class="haze-switch">
                                <input type="checkbox" id="sw-ind" ${state.indicator?'checked':''}>
                                <span class="haze-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="haze-section">
                        <div class="haze-section-title">排除列表 (Blacklist)</div>
                        <div class="haze-row">
                            <div class="haze-label">当前网站: <b>${currentDomain}</b></div>
                            <button class="haze-btn" id="btn-toggle-site">${isExcluded ? '✅ 恢复生效' : '🚫 排除此站'}</button>
                        </div>
                        <div class="haze-list" id="haze-blacklist">
                            </div>
                        <div class="haze-input-group">
                            <input type="text" class="haze-input" id="input-domain" placeholder="输入域名 (如 example.com)">
                            <button class="haze-btn" id="btn-add-domain">添加</button>
                        </div>
                    </div>
                </div>
                <div class="haze-footer">v2.0 · Designed by HAZE</div>
            </div>
        `;

        // === 逻辑绑定 ===
        
        // 1. 关闭面板
        const closePanel = () => {
            overlay.remove();
            updateLinkIndicators(); // 退出时刷新页面指示器
        };
        overlay.querySelector('.haze-close').onclick = closePanel;
        overlay.onclick = (e) => { if(e.target === overlay) closePanel(); };

        // 2. 模式切换
        overlay.querySelectorAll('.haze-mode-btn').forEach(btn => {
            btn.onclick = () => {
                state.mode = btn.dataset.val;
                overlay.querySelectorAll('.haze-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });

        // 3. 开关切换
        overlay.querySelector('#sw-bg').onchange = (e) => state.background = e.target.checked;
        overlay.querySelector('#sw-ind').onchange = (e) => state.indicator = e.target.checked;

        // 4. 黑名单渲染与操作
        const renderBlacklist = () => {
            const listEl = overlay.querySelector('#haze-blacklist');
            listEl.innerHTML = state.excluded.length ? '' : '<div style="padding:10px;text-align:center;color:#ccc">暂无排除网站</div>';
            state.excluded.forEach(site => {
                const item = document.createElement('div');
                item.className = 'haze-list-item';
                item.innerHTML = `<span>${site}</span><span class="haze-remove-btn" data-site="${site}">移除</span>`;
                listEl.appendChild(item);
            });
            
            // 绑定移除事件
            listEl.querySelectorAll('.haze-remove-btn').forEach(btn => {
                btn.onclick = () => {
                    const s = state.excluded.filter(x => x !== btn.dataset.site);
                    state.excluded = s;
                    renderBlacklist();
                    refreshToggleBtn();
                };
            });
        };

        const refreshToggleBtn = () => {
            const btn = overlay.querySelector('#btn-toggle-site');
            const isEx = state.excluded.includes(currentDomain);
            btn.textContent = isEx ? '✅ 恢复生效' : '🚫 排除此站';
            btn.style.backgroundColor = isEx ? '#34c759' : '#ff3b30';
        };

        // 切换当前站
        overlay.querySelector('#btn-toggle-site').onclick = () => {
            const list = state.excluded;
            if (list.includes(currentDomain)) {
                state.excluded = list.filter(x => x !== currentDomain);
            } else {
                list.push(currentDomain);
                state.excluded = list;
            }
            renderBlacklist();
            refreshToggleBtn();
        };

        // 手动添加
        overlay.querySelector('#btn-add-domain').onclick = () => {
            const input = overlay.querySelector('#input-domain');
            const domain = input.value.trim();
            if (domain && !state.excluded.includes(domain)) {
                const list = state.excluded;
                list.push(domain);
                state.excluded = list;
                renderBlacklist();
                input.value = '';
                refreshToggleBtn();
            }
        };

        // 初始化渲染
        renderBlacklist();
        refreshToggleBtn();
        document.body.appendChild(overlay);
    };

    // === UI 渲染 (Popup) ===
    const createLinkOptionsPopup = (event, link) => {
        if (isCurrentSiteExcluded() || isFunctionalLink(link) || isSystemFolderLink(link.href)) return;
        const existing = document.getElementById('haze-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        
        Object.assign(popup.style, {
            position: 'fixed', top: `${event.clientY}px`, left: `${event.clientX}px`,
            transform: 'translate(-65%, -50%)', backgroundColor: COLOR_BG_BLUR,
            backdropFilter: 'blur(12px)', webkitBackdropFilter: 'blur(12px)',
            borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid rgba(255,255,255,0.4)', padding: '5px', zIndex: '2147483646',
            display: 'flex', gap: '6px', animation: 'haze-pop-in 0.15s ease-out forwards'
        });

        const createBtn = (text, isPrimary, onClick) => {
            const btn = document.createElement('div');
            btn.textContent = text;
            Object.assign(btn.style, {
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                fontWeight: isPrimary ? '600' : '400', color: isPrimary ? COLOR_PRIMARY : '#555',
                backgroundColor: isPrimary ? 'rgba(0, 122, 255, 0.1)' : 'transparent',
                minWidth: isPrimary ? '80px' : '60px', textAlign: 'center', transition: 'all 0.1s'
            });
            btn.onmouseenter = () => btn.style.backgroundColor = isPrimary ? 'rgba(0,122,255,0.2)' : 'rgba(0,0,0,0.05)';
            btn.onmouseleave = () => btn.style.backgroundColor = isPrimary ? 'rgba(0,122,255,0.1)' : 'transparent';
            btn.onclick = (e) => { e.stopPropagation(); onClick(); popup.remove(); };
            return btn;
        };

        popup.appendChild(createBtn('🏠 当前', false, () => location.href = link.href));
        popup.appendChild(createBtn(state.background ? '🚀 后台' : '↗ 新标签', true, () => {
            if (state.background) GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            else window.open(link.href, '_blank');
        }));

        document.body.appendChild(popup);
        
        let closeTimer = setTimeout(() => popup.remove(), AUTO_CLOSE_TIMEOUT);
        let leaveTimer;
        popup.onmouseenter = () => { clearTimeout(closeTimer); clearTimeout(leaveTimer); };
        popup.onmouseleave = () => leaveTimer = setTimeout(() => popup.remove(), MOUSE_LEAVE_DELAY);
    };

    // === 主逻辑 ===
    const handleLinkClick = (event) => {
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
    };

    // === 初始化 ===
    const init = () => {
        GM_registerMenuCommand('⚙️ 脚本设置中心', createSettingsPanel); // 唯一的菜单入口
        document.addEventListener('click', handleLinkClick, true);
        updateLinkIndicators();
        
        const observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.addedNodes.length)) setTimeout(updateLinkIndicators, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
