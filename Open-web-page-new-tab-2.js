// ==UserScript==
// @name         打开网页：新标签页2 (防抖容错版)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  智能识别+可视化指示器。优化交互：支持"点击-再点击"极速流，新增鼠标移出防抖机制，容错率更高。
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

    // === UI 配置 (Zen Mode) ===
    const AUTO_CLOSE_TIMEOUT = 3500;   // 全局自动关闭时间（稍微延长以配合容错）
    const MOUSE_LEAVE_DELAY = 800;     // 关键修改：鼠标移出后的容错时间 (0.8秒)
    
    // 颜色配置
    const COLOR_PRIMARY = '#007AFF'; // macOS Blue
    const COLOR_SECONDARY = '#555555';
    const COLOR_POPUP_BG = 'rgba(255, 255, 255, 0.90)'; // 稍微增加一点不透明度，提升可见性
    
    // 指示器颜色
    const IND_COLOR_POPUP = '#af52de'; // macOS Purple
    const IND_COLOR_NEWTAB = '#34c759'; // macOS Green

    // === 状态管理 ===
    const getCurrentMode = () => GM_getValue('openMode', 'popup');
    const getBackgroundMode = () => GM_getValue('backgroundMode', false);
    const getIndicatorState = () => GM_getValue('showIndicator', true);
    const getCurrentDomain = () => window.location.hostname;
    const getExcludedSites = () => GM_getValue('excludedSites', []);
    const isCurrentSiteExcluded = () => getExcludedSites().includes(getCurrentDomain());

    // === CSS 注入 ===
    const style = document.createElement('style');
    style.textContent = `
        /* 指示器样式 */
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
        @keyframes haze-pop-in {
            0% { opacity: 0; transform: translate(-65%, -45%) scale(0.95); }
            100% { opacity: 1; transform: translate(-65%, -50%) scale(1); }
        }
    `;
    document.head.appendChild(style);

    // === 智能链接识别 ===
    const isFunctionalLink = (link) => {
        const href = link.getAttribute('href');
        if (!href || href === '' || href === '#' || href === 'javascript:;' || href.includes('javascript:void')) return true;
        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('sms:')) return true;
        if (link.target === '_self' || link.target === '_top' || link.target === 'iframe') return true;
        
        const role = link.getAttribute('role');
        if (role && ['button', 'tab', 'menuitem', 'option', 'switch', 'checkbox', 'radio', 'treeitem'].includes(role)) return true;

        try {
            if (href.startsWith('#')) return true;
            const urlObj = new URL(link.href);
            if (urlObj.pathname === window.location.pathname && urlObj.hash !== '') return true;
        } catch (e) {}

        const functionalityAttrs = [
            'onclick', 'download', 'data-toggle', 'data-trigger', 'data-target', 'data-action', 'data-dismiss', 'data-cmd',
            'aria-controls', 'aria-expanded', 'aria-haspopup', 'aria-disabled', 'aria-selected',
            'ng-click', '@click', 'v-on:click', ':click', 'hx-get', 'hx-post'
        ];
        for (const attr of functionalityAttrs) {
            if (link.hasAttribute(attr)) return true;
        }

        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) return true;

        const className = (link.className || '').toLowerCase();
        if (className.includes('script-link')) return false;

        const strToCheck = (
            className + ' ' + (link.id || '') + ' ' + (link.title || '') + ' ' +
            (link.getAttribute('aria-label') || '') + ' ' + (link.parentElement ? link.parentElement.className : '')
        ).toLowerCase();

        const functionalKeywords = [
            'login', 'logout', 'signin', 'register', 'submit', 'cancel', 'edit', 'delete', 'setting', 'close', 
            'expand', 'collapse', 'load more', 'next', 'prev', 'filter', 'sort', 'search', 'cart', 'buy', 
            'sku', 'select', 'like', 'fav', 'share', 'reply', 'comment', 'play', 'pause'
        ];
        if (functionalKeywords.some(kw => strToCheck.includes(kw))) return true;

        const cnKeywords = ['登录', '注册', '注销', '提交', '取消', '编辑', '删除', '设置', '更多', '展开', '收起', '筛选', '排序', '购物车', '购买', '点赞', '收藏', '分享', '回复', '评论', '播放'];
        const lowerText = text.toLowerCase();
        if (lowerText.length <= 5 && cnKeywords.some(kw => lowerText.includes(kw))) return true;
        if (cnKeywords.some(kw => strToCheck.includes(kw))) return true;

        return false;
    };

    const isSystemFolderLink = (href) => /^file:\/\/\/[a-zA-Z]:\//.test(href);

    // === 指示器逻辑 ===
    const updateLinkIndicators = () => {
        if (!getIndicatorState() || isCurrentSiteExcluded() || getCurrentMode() === 'default') {
            document.querySelectorAll('a[data-haze-link]').forEach(el => {
                el.removeAttribute('data-haze-link');
                el.className = el.className.replace(/haze-ind-\w+/g, '').trim();
            });
            return;
        }
        const mode = getCurrentMode();
        const indicatorClass = mode === 'popup' ? 'haze-ind-popup' : 'haze-ind-newtab';
        
        document.querySelectorAll('a:not([data-haze-link])').forEach(link => {
            if (!isFunctionalLink(link) && !isSystemFolderLink(link.href)) {
                link.setAttribute('data-haze-link', 'active');
                link.classList.add(indicatorClass);
            }
        });
    };

    const observeDOM = () => {
        const observer = new MutationObserver((mutations) => {
            if (mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0)) {
                setTimeout(updateLinkIndicators, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // === UI 渲染 (关键修改：防抖机制) ===
    const createLinkOptionsPopup = (event, link) => {
        if (isCurrentSiteExcluded() || isFunctionalLink(link) || isSystemFolderLink(link.href)) return;

        // 移除已存在的弹窗（防止多开）
        const existing = document.getElementById('haze-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'haze-popup';
        
        Object.assign(popup.style, {
            position: 'fixed',
            top: `${event.clientY}px`,
            left: `${event.clientX}px`,
            transform: 'translate(-65%, -50%)', // 保持偏移，确保右侧按钮在鼠标下
            backgroundColor: COLOR_POPUP_BG,
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.05)',
            border: '1px solid rgba(255,255,255,0.4)',
            padding: '5px',
            zIndex: '2147483647',
            display: 'flex',
            gap: '6px',
            pointerEvents: 'auto',
            animation: 'haze-pop-in 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards',
            boxSizing: 'border-box'
        });

        const createBtn = (text, isPrimary) => {
            const btn = document.createElement('div');
            btn.textContent = text;
            Object.assign(btn.style, {
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: isPrimary ? '600' : '400',
                color: isPrimary ? COLOR_PRIMARY : COLOR_SECONDARY,
                backgroundColor: isPrimary ? 'rgba(0, 122, 255, 0.1)' : 'transparent',
                transition: 'all 0.1s ease',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                textAlign: 'center',
                minWidth: isPrimary ? '80px' : '60px',
                flex: isPrimary ? '1.5' : '1'
            });

            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = isPrimary ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0,0,0,0.05)';
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = isPrimary ? 'rgba(0, 122, 255, 0.1)' : 'transparent';
                btn.style.transform = 'translateY(0)';
            });
            
            return btn;
        };

        const btnCurrent = createBtn('🏠 当前', false);
        const isBg = getBackgroundMode();
        const btnNewTab = createBtn(isBg ? '🚀 后台' : '↗ 新标签', true);

        btnCurrent.onclick = (e) => {
            e.stopPropagation();
            window.location.href = link.href;
            popup.remove();
        };

        btnNewTab.onclick = (e) => {
            e.stopPropagation();
            if (getBackgroundMode()) {
                GM_openInTab(link.href, { active: false, insert: true, setParent: true });
            } else {
                window.open(link.href, '_blank');
            }
            popup.remove();
        };

        popup.appendChild(btnCurrent);
        popup.appendChild(btnNewTab);
        document.body.appendChild(popup);

        // === 智能防抖关闭逻辑 (关键) ===
        let autoCloseTimer = setTimeout(() => { if (popup.parentNode) popup.remove(); }, AUTO_CLOSE_TIMEOUT);
        let leaveTimer = null;

        popup.addEventListener('mouseenter', () => {
            // 鼠标进入，清除所有关闭倒计时
            clearTimeout(autoCloseTimer);
            if (leaveTimer) clearTimeout(leaveTimer);
        });

        popup.addEventListener('mouseleave', () => {
            // 鼠标离开，启动容错倒计时 (800ms)
            // 如果用户只是手滑并在800ms内移回，这里会被 mouseenter 的 clear 清除，从而不关闭
            leaveTimer = setTimeout(() => { 
                if (popup.parentNode) popup.remove(); 
            }, MOUSE_LEAVE_DELAY);
        });
    };

    // === 事件监听 ===
    const handleLinkClick = (event) => {
        if (isCurrentSiteExcluded()) return;
        const link = event.target.closest('a');
        if (!link || !link.href) return;
        
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

    // === 菜单注册 ===
    let menuIds = [];
    const registerMenu = () => {
        menuIds.forEach(id => GM_unregisterMenuCommand(id));
        menuIds = [];

        const mode = getCurrentMode();
        const isBg = getBackgroundMode();
        const showInd = getIndicatorState();
        
        const modeText = {
            'popup': '🟣 模式：选择框 (当前)',
            'newtab': '🟢 模式：直接新标签',
            'default': '⚪ 模式：浏览器默认'
        };

        menuIds.push(GM_registerMenuCommand(modeText[mode], () => {
            const next = mode === 'popup' ? 'newtab' : (mode === 'newtab' ? 'default' : 'popup');
            GM_setValue('openMode', next);
            location.reload();
        }));

        if (mode !== 'default') {
            menuIds.push(GM_registerMenuCommand(isBg ? '⚙️ 新标签：后台静默' : '⚙️ 新标签：前台跳转', () => {
                GM_setValue('backgroundMode', !isBg);
                registerMenu();
            }));
        }

        menuIds.push(GM_registerMenuCommand(showInd ? '👁️ 指示器：开启' : '👁️ 指示器：关闭', () => {
            GM_setValue('showIndicator', !showInd);
            location.reload();
        }));

        if (isCurrentSiteExcluded()) {
            menuIds.push(GM_registerMenuCommand(`✅ 恢复此网站`, () => {
                const s = getExcludedSites();
                s.splice(s.indexOf(getCurrentDomain()), 1);
                GM_setValue('excludedSites', s);
                location.reload();
            }));
        } else {
            menuIds.push(GM_registerMenuCommand(`🚫 排除此网站`, () => {
                const s = getExcludedSites();
                s.push(getCurrentDomain());
                GM_setValue('excludedSites', s);
                location.reload();
            }));
        }
    };

    const init = () => {
        document.addEventListener('click', handleLinkClick, true);
        registerMenu();
        updateLinkIndicators();
        observeDOM();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
