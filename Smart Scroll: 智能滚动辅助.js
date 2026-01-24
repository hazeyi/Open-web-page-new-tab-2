// ==UserScript==
// @name         Smart Scroll: 智能滚动辅助 (v1.3 暴力适配版)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  强制显示：右下角隐形感应区，鼠标移入即显。暴力滚动：点击同时卷动Window/Body/HTML及所有可滚动容器。适配MacKed及Zibll主题。
// @author       HAZE
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    // === 配置 ===
    const HIDE_TIMEOUT = 2500;
    
    // 状态
    let hideTimer = null;
    let shadowRoot = null;
    let isHovering = false; // 是否在感应区内

    // === 样式 (增加感应区) ===
    const shadowStyles = `
        :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, sans-serif; z-index: 2147483640; position: fixed; bottom: 0; right: 0; pointer-events: none; }
        * { box-sizing: border-box; }

        .ss-vars {
            --ss-bg: rgba(255, 255, 255, 0.95); 
            --ss-border: rgba(0,0,0,0.08); 
            --ss-shadow: 0 8px 32px rgba(0,0,0,0.15); 
            --ss-text: #333; 
        }
        @media (prefers-color-scheme: dark) { 
            .ss-vars {
                --ss-bg: rgba(30, 30, 30, 0.95); 
                --ss-border: rgba(255,255,255,0.15); 
                --ss-shadow: 0 8px 32px rgba(0,0,0,0.6); 
                --ss-text: #f0f0f0;
            } 
        }

        /* 隐形感应区：右下角大范围触发 */
        #ss-zone {
            position: fixed; bottom: 0; right: 0;
            width: 120px; height: 200px;
            pointer-events: auto; /* 允许鼠标交互 */
            z-index: 2147483640;
            display: flex; flex-direction: column; 
            justify-content: flex-end; align-items: center;
            padding-bottom: 100px; /* 抬高按钮位置 */
            padding-right: 30px;
        }

        #ss-container {
            display: flex; flex-direction: column; gap: 10px; align-items: center;
            transition: opacity 0.2s ease, transform 0.2s ease;
            opacity: 0; transform: translateY(20px);
        }
        
        /* 只要鼠标进入感应区，或者触发了滚动，就显示 */
        #ss-zone:hover #ss-container,
        #ss-container.visible { opacity: 1; transform: translateY(0); }

        .ss-btn {
            width: 44px; height: 44px; border-radius: 50%;
            background: var(--ss-bg); backdrop-filter: blur(15px);
            border: 1px solid var(--ss-border); box-shadow: var(--ss-shadow);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.2s;
            color: var(--ss-text); pointer-events: auto;
        }
        
        .ss-btn:hover { transform: scale(1.15); z-index: 10; }
        .ss-btn:active { transform: scale(0.95); }

        svg { width: 22px; height: 22px; fill: currentColor; }
    `;

    // === 暴力滚动逻辑 (Shotgun Scroll) ===
    const bruteForceScroll = (direction) => {
        const isTop = direction === 'top';
        const targetPos = isTop ? 0 : 99999999;
        
        // 1. 滚动标准容器 (HTML/Body/Window)
        // 许多网站的滚动条其实是在这些元素上
        try {
            window.scrollTo({ top: targetPos, behavior: 'smooth' });
            document.documentElement.scrollTo({ top: targetPos, behavior: 'smooth' });
            document.body.scrollTo({ top: targetPos, behavior: 'smooth' });
        } catch(e) {}

        // 2. 滚动页面上所有"看起来在滚动"的元素
        // 如果页面结构复杂，这一步能抓到那个真正负责滚动的 div
        const allElements = document.querySelectorAll('*');
        for (let el of allElements) {
            // 只有当元素有滚动条，且当前不在顶部(回顶时)或不在底部(去底时)才操作
            // 避免触发不必要的重绘
            if (el.scrollTop > 0 && isTop) {
                try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){}
            }
            // 检查 scrollHeight > clientHeight 来判断是否可滚动
            else if (!isTop && el.scrollHeight > el.clientHeight && el.scrollTop < (el.scrollHeight - el.clientHeight)) {
                try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch(e){}
            }
        }
    };

    // === UI 构建 ===
    const createUI = () => {
        if (document.getElementById('ss-host')) return;
        const host = document.createElement('div');
        host.id = 'ss-host';
        (document.documentElement || document.body).appendChild(host);
        shadowRoot = host.attachShadow({ mode: 'open' });
        
        const wrapper = document.createElement('div');
        wrapper.className = 'ss-vars';
        wrapper.innerHTML = `
            <style>${shadowStyles}</style>
            <div id="ss-zone" title="智能滚动区域">
                <div id="ss-container">
                    <div id="btn-top" class="ss-btn" title="暴力回顶">
                        <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
                    </div>
                    <div id="btn-bottom" class="ss-btn" title="暴力到底">
                        <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    </div>
                </div>
            </div>
        `;
        shadowRoot.appendChild(wrapper);

        // 绑定点击
        shadowRoot.getElementById('btn-top').onclick = (e) => { 
            e.stopPropagation(); 
            bruteForceScroll('top'); 
        };
        shadowRoot.getElementById('btn-bottom').onclick = (e) => { 
            e.stopPropagation(); 
            bruteForceScroll('bottom'); 
        };

        // 绑定感应区
        const zone = shadowRoot.getElementById('ss-zone');
        zone.onmouseenter = () => { isHovering = true; showButtons(); };
        zone.onmouseleave = () => { isHovering = false; scheduleHide(); };
    };

    // === 简单的显示控制 ===
    const updateVisibility = () => {
        if (!shadowRoot) return;
        showButtons();
        scheduleHide();
    };

    const showButtons = () => {
        if (!shadowRoot) return;
        shadowRoot.getElementById('ss-container').classList.add('visible');
        if (hideTimer) clearTimeout(hideTimer);
    };

    const scheduleHide = () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            // 只有当鼠标不在感应区时才隐藏
            if (!isHovering && shadowRoot) {
                shadowRoot.getElementById('ss-container').classList.remove('visible');
            }
        }, HIDE_TIMEOUT);
    };

    // === 初始化 ===
    const init = () => {
        createUI();
        
        // 极简监听：任何滚动都触发显示
        // useCapture: true 确保捕获所有元素的滚动
        document.addEventListener('scroll', () => {
            requestAnimationFrame(updateVisibility);
        }, true);

        // 不死鸟守护
        const observer = new MutationObserver(() => {
            if (!document.getElementById('ss-host')) createUI();
        });
        observer.observe(document.documentElement, { childList: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
