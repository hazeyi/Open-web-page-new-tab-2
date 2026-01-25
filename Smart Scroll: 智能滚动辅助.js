// ==UserScript==
// @name         Smart Scroll: 智能滚动辅助 (v26.0 电光蓝调版)
// @namespace    http://tampermonkey.net/
// @version      26.0
// @description  基于v25微调：保持整体架构不变，仅将向下的颜色从"赛博青"调整为更冷峻、更具科技感的"电光蓝"(#0085FF)。
// @author       HAZE
// @match        *://*/*
// @grant        none
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    // === 配置 ===
    const HIDE_TIMEOUT = 2500;
    const SCROLL_THRESHOLD = 30;
    
    // 状态
    let lastScrollTop = 0;
    let hideTimer = null;
    let shadowRoot = null;
    let isHovering = false;
    let lifeCycleTimer = null;

    // === 样式 (Electric Blue Tune Aesthetic) ===
    const shadowStyles = `
        :host { 
            all: initial; 
            font-family: sans-serif; 
            z-index: 2147483647 !important; 
            position: fixed; bottom: 0; right: 0; pointer-events: none; 
        }
        * { box-sizing: border-box; }

        /* -----------------------------------------------------------
           ★ 白天模式 (Light Mode) ★
           ----------------------------------------------------------- */
        .ss-vars {
            /* 材质：高透磨砂白 */
            --glass-blur: blur(16px) saturate(180%);
            --idle-bg: rgba(255, 255, 255, 0.65);
            --active-bg: rgba(255, 255, 255, 0.85);
            
            /* 待机环：深灰色细边 */
            --idle-border: rgba(0, 0, 0, 0.15); 
            --idle-glow: 0 4px 10px rgba(0, 0, 0, 0.1);

            /* 图标颜色：深灰 */
            --icon-dim: rgba(0, 0, 0, 0.6);

            /* === 色彩定调 (New Blue) === */
            --color-up: #FF3B30;   /* 保持：经典红 */
            --color-down: #0085FF; /* 更新：电光蓝 (Electric Blue) */
            --color-scan: #00FF9C;

            /* === 白天光影 (Day Glows) === */
            
            /* 红色共鸣 */
            --glow-red: 
                inset 0 0 20px rgba(255, 59, 48, 0.15),
                0 0 0 1px rgba(255, 59, 48, 0.3),
                0 8px 20px rgba(255, 59, 48, 0.25);

            /* 蓝色共鸣 (更新为电光蓝RGB: 0, 133, 255) */
            --glow-blue: 
                inset 0 0 20px rgba(0, 133, 255, 0.15),
                0 0 0 1px rgba(0, 133, 255, 0.3),
                0 8px 20px rgba(0, 133, 255, 0.25);

            /* 默认展开 (中性光) */
            --glow-neutral:
                0 0 0 1px rgba(0, 0, 0, 0.1),
                0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        /* -----------------------------------------------------------
           ★ 黑夜模式 (Dark Mode) ★
           ----------------------------------------------------------- */
        @media (prefers-color-scheme: dark) { 
            .ss-vars {
                /* 材质：深色雨夜玻璃 */
                --idle-bg: rgba(20, 20, 30, 0.2);
                --active-bg: rgba(15, 15, 20, 0.7);
                
                /* 待机环：银白微光 */
                --idle-border: rgba(220, 220, 255, 0.4); 
                --idle-glow: 0 0 10px rgba(200, 200, 255, 0.15); 

                /* 图标颜色：浅白 */
                --icon-dim: rgba(255, 255, 255, 0.6);

                /* === 黑夜光影 (Night Glows) === */
                /* 红色共鸣 (高亮自发光) */
                --glow-red: 
                    inset 0 0 15px rgba(255, 59, 48, 0.2), 
                    0 0 8px rgba(255, 59, 48, 0.6), 
                    0 0 25px 2px rgba(255, 59, 48, 0.3);

                /* 蓝色共鸣 (更新为电光蓝高亮) */
                --glow-blue: 
                    inset 0 0 15px rgba(0, 133, 255, 0.2),
                    0 0 8px rgba(0, 133, 255, 0.6),
                    0 0 25px 2px rgba(0, 133, 255, 0.3);

                /* 默认展开 */
                --glow-neutral:
                    inset 0 0 15px rgba(255, 255, 255, 0.05),
                    0 0 5px rgba(255, 255, 255, 0.3),
                    0 0 20px rgba(200, 220, 255, 0.15);
            } 
        }

        #ss-zone {
            position: fixed; bottom: 40px; right: 20px;
            width: 100px; height: 300px;
            pointer-events: auto;
            display: flex; justify-content: center; align-items: flex-end;
            padding-bottom: 20px;
        }

        /* === 胶囊主体 === */
        #halo-capsule {
            position: relative;
            width: 44px;
            border-radius: 50px;
            
            background: var(--idle-bg);
            backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
            
            /* 待机边框 */
            border: 1.5px solid var(--idle-border);
            box-shadow: var(--idle-glow);
            
            transition: 
                height 0.5s cubic-bezier(0.23, 1, 0.32, 1),
                width 0.5s cubic-bezier(0.23, 1, 0.32, 1),
                border-color 0.3s ease, 
                box-shadow 0.3s ease,
                background-color 0.3s ease,
                transform 0.5s ease,
                opacity 0.3s ease;
                
            opacity: 1; 
            overflow: visible; 
        }
        
        #halo-capsule:not(.mode-idle) { overflow: hidden; }

        /* ----------------------------------
           ★ 状态定义 ★
           ---------------------------------- */
        
        /* 0. 待机 (Idle) */
        #halo-capsule.mode-idle {
            width: 14px; height: 14px;
            border-width: 1.5px;
            background: transparent; backdrop-filter: none;
            animation: breathe 5s infinite ease-in-out;
        }
        @keyframes breathe {
            0%, 100% { transform: scale(1); opacity: 0.7; box-shadow: 0 0 0 transparent; }
            50% { transform: scale(1.1); opacity: 1; box-shadow: var(--idle-glow); }
        }

        /* 1. 滚动激活 (Active Scroll) */
        #halo-capsule.mode-up, #halo-capsule.mode-down {
            width: 44px; height: 58px;
            border-width: 1.5px;
            opacity: 1; transform: translate(0,0) !important;
            animation: none !important;
            background: var(--active-bg);
        }
        /* 滚动时的颜色注入 */
        #halo-capsule.mode-up { border-color: var(--color-up); box-shadow: var(--glow-red); }
        #halo-capsule.mode-down { border-color: var(--color-down); box-shadow: var(--glow-blue); }

        /* 2. 悬停展开 (Hover Expand) */
        #ss-zone:hover #halo-capsule, #halo-capsule.mode-expand {
            width: 44px; height: 96px;
            border-width: 1.5px;
            border-color: var(--idle-border); /* 默认用待机边框色 */
            box-shadow: var(--glow-neutral);
            opacity: 1;
            background: var(--active-bg);
            transform: translate(0,0) !important;
            animation: none !important;
        }

        /* ----------------------------------
           ★ 全局共鸣交互 (Global Resonance) ★
           ---------------------------------- */
        
        /* 悬停上箭头：全红 */
        #halo-capsule.hover-top {
            border-color: var(--color-up) !important;
            box-shadow: var(--glow-red) !important;
            transform: scale(1.02) translate(0,0) !important; 
        }

        /* 悬停下箭头：全蓝 */
        #halo-capsule.hover-bottom {
            border-color: var(--color-down) !important;
            box-shadow: var(--glow-blue) !important;
            transform: scale(1.02) translate(0,0) !important;
        }

        /* ----------------------------------
           ★ 轨道滑行箭头 (Kinetic Arrows) ★
           ---------------------------------- */
        .chevron-btn {
            position: absolute; left: 50%; width: 100%; height: 50%;
            transform: translateX(-50%);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.3s ease;
        }
        .chevron-btn svg {
            width: 22px; height: 22px;
            fill: none; stroke: var(--icon-dim); stroke-width: 2.5px; 
            stroke-linecap: round; stroke-linejoin: round;
            transition: all 0.3s ease;
            filter: drop-shadow(0 0 0 transparent);
        }

        /* 待机隐藏 */
        #halo-capsule.mode-idle .chevron-btn { opacity: 0; top: 25%; pointer-events: none; }

        /* 滚动 */
        #halo-capsule.mode-up #btn-top { top: 12%; opacity: 1; pointer-events: auto; }
        #halo-capsule.mode-up #btn-top svg { stroke: var(--color-up); filter: drop-shadow(0 0 5px var(--color-up)); }
        #halo-capsule.mode-up #btn-bottom { top: 100%; opacity: 0; }

        #halo-capsule.mode-down #btn-bottom { top: 38%; opacity: 1; pointer-events: auto; }
        #halo-capsule.mode-down #btn-bottom svg { stroke: var(--color-down); filter: drop-shadow(0 0 5px var(--color-down)); }
        #halo-capsule.mode-down #btn-top { top: -50%; opacity: 0; }

        /* 悬停展开 */
        #ss-zone:hover #btn-top, #halo-capsule.mode-expand #btn-top { top: 0; opacity: 1; pointer-events: auto; }
        #ss-zone:hover #btn-bottom, #halo-capsule.mode-expand #btn-bottom { top: 50%; opacity: 1; pointer-events: auto; }
        #ss-zone:hover svg { stroke: var(--icon-dim); filter: none; }

        /* 箭头悬停高亮 */
        /* 白天模式下，滤镜颜色调整，避免过曝 */
        #btn-top:hover svg { stroke: var(--color-up) !important; filter: drop-shadow(0 0 5px var(--color-up)) !important; transform: scale(1.15); }
        #btn-bottom:hover svg { stroke: var(--color-down) !important; filter: drop-shadow(0 0 5px var(--color-down)) !important; transform: scale(1.15); }
        
        #halo-capsule:active { transform: scale(0.95) !important; }

        /* ----------------------------------
           ★ AI 行为特效 (保留全套) ★
           ---------------------------------- */
        #halo-capsule:not(.behavior-scan)::after { content: none; }
        #halo-capsule:not(.behavior-ripple-out):not(.behavior-ripple-in)::before { content: none; }

        /* 扫描 */
        #halo-capsule.behavior-scan::after {
            content: ''; position: absolute; inset: -2px; border-radius: 50%;
            background: conic-gradient(from 0deg, transparent 70%, var(--color-scan) 100%);
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude;
            animation: spin 1s linear infinite; box-shadow: 0 0 10px var(--color-scan);
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 扩散 */
        #halo-capsule.behavior-ripple-out::before {
            content: ''; position: absolute; inset: 0; border-radius: 50%;
            border: 1px solid var(--idle-border);
            animation: ripple-out 1.2s ease-out infinite; z-index: -1;
        }
        @keyframes ripple-out { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(3.5); opacity: 0; } }

        /* 坍缩 */
        #halo-capsule.behavior-ripple-in::before {
            content: ''; position: absolute; inset: -20px; border-radius: 50%;
            border: 1px solid var(--idle-border);
            animation: ripple-in 1.2s ease-in infinite; opacity: 0;
        }
        @keyframes ripple-in { 0% { transform: scale(1.5); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: scale(0.5); opacity: 0; } }

        /* 故障 */
        #halo-capsule.behavior-glitch { animation: glitch-anim 0.2s steps(2) infinite !important; border-width: 2px; opacity: 1 !important;}
        @keyframes glitch-anim {
            0% { transform: translate(1px, 1px); border-color: var(--color-up); }
            50% { transform: translate(-1px, -1px); border-color: var(--color-down); }
            100% { transform: translate(0, 0); border-color: var(--idle-border); }
        }

        /* 游离 */
        #halo-capsule.behavior-wander { border-color: var(--idle-border); transition: transform 2s ease-in-out; }
    `;

    // === 暴力滚动内核 ===
    const bruteForceScroll = (direction) => {
        const isTop = direction === 'top';
        const targetPos = isTop ? 0 : 99999999;
        try {
            window.scrollTo({ top: targetPos, behavior: 'smooth' });
            document.documentElement.scrollTo({ top: targetPos, behavior: 'smooth' });
            document.body.scrollTo({ top: targetPos, behavior: 'smooth' });
        } catch(e) {}
        document.querySelectorAll('*').forEach(el => {
            if (el.scrollTop > 0 && isTop) try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){}
            else if (!isTop && el.scrollHeight > el.clientHeight) try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch(e){}
        });
    };

    // === 行为引擎 ===
    const triggerRandomBehavior = () => {
        if (!shadowRoot || isHovering) return;
        const cap = shadowRoot.getElementById('halo-capsule');
        if (!cap.classList.contains('mode-idle')) return;

        const rand = Math.random();
        cap.classList.remove('behavior-scan', 'behavior-ripple-out', 'behavior-ripple-in', 'behavior-glitch', 'behavior-wander');
        cap.style.transform = '';

        if (rand < 0.10) { cap.classList.add('behavior-scan'); setTimeout(() => cap.classList.remove('behavior-scan'), 2000); }
        else if (rand < 0.20) { cap.classList.add('behavior-ripple-out'); setTimeout(() => cap.classList.remove('behavior-ripple-out'), 2000); }
        else if (rand < 0.30) { cap.classList.add('behavior-ripple-in'); setTimeout(() => cap.classList.remove('behavior-ripple-in'), 2000); }
        else if (rand < 0.40) { cap.classList.add('behavior-glitch'); setTimeout(() => cap.classList.remove('behavior-glitch'), 400); }
        else if (rand < 0.60) { 
            cap.classList.add('behavior-wander'); 
            const x = (Math.random() - 0.5) * 12; const y = (Math.random() - 0.5) * 12;
            cap.style.transform = `translate(${x}px, ${y}px)`; 
            setTimeout(() => cap.style.transform = 'translate(0, 0)', 2000); 
        }
    };

    const startLifeCycle = () => {
        if (lifeCycleTimer) clearInterval(lifeCycleTimer);
        lifeCycleTimer = setInterval(triggerRandomBehavior, 4000);
    };

    // === UI 构建 ===
    const createUI = () => {
        if (document.getElementById('ss-host')) return;
        const host = document.createElement('div');
        host.id = 'ss-host';
        document.body.appendChild(host);
        try { shadowRoot = host.attachShadow({ mode: 'open' }); } catch(e) { return; }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'ss-vars';
        wrapper.innerHTML = `
            <style>${shadowStyles}</style>
            <div id="ss-zone">
                <div id="halo-capsule" class="mode-idle">
                    <div id="btn-top" class="chevron-btn" title="Top">
                        <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </div>
                    <div id="btn-bottom" class="chevron-btn" title="Bottom">
                        <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
            </div>
        `;
        shadowRoot.appendChild(wrapper);

        const btnTop = shadowRoot.getElementById('btn-top');
        const btnBottom = shadowRoot.getElementById('btn-bottom');
        const capsule = shadowRoot.getElementById('halo-capsule');

        btnTop.onclick = (e) => { e.stopPropagation(); bruteForceScroll('top'); };
        btnBottom.onclick = (e) => { e.stopPropagation(); bruteForceScroll('bottom'); };

        // 全局共鸣逻辑
        btnTop.onmouseenter = () => { capsule.classList.add('hover-top'); };
        btnTop.onmouseleave = () => { capsule.classList.remove('hover-top'); };
        
        btnBottom.onmouseenter = () => { capsule.classList.add('hover-bottom'); };
        btnBottom.onmouseleave = () => { capsule.classList.remove('hover-bottom'); };

        const zone = shadowRoot.getElementById('ss-zone');
        zone.onmouseenter = () => { 
            isHovering = true; 
            setMode('expand');
            if (hideTimer) clearTimeout(hideTimer);
        };
        zone.onmouseleave = () => { 
            isHovering = false; 
            scheduleHide(); 
        };
        
        startLifeCycle();
        
        setTimeout(() => {
            setMode('expand');
            setTimeout(() => { if (!isHovering) scheduleHide(); }, 1500);
        }, 500);
    };

    const setMode = (mode) => {
        const cap = shadowRoot.getElementById('halo-capsule');
        cap.classList.remove('mode-idle', 'mode-up', 'mode-down', 'mode-expand', 
            'behavior-scan', 'behavior-ripple-out', 'behavior-ripple-in', 'behavior-glitch', 'behavior-wander');
        cap.style.transform = ''; 
        cap.classList.add(`mode-${mode}`);
    };

    const updateVisibility = () => {
        if (!shadowRoot || isHovering) return;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        
        if (Math.abs(scrollTop - lastScrollTop) > SCROLL_THRESHOLD) {
            if (scrollTop > lastScrollTop) setMode('down');
            else setMode('up');
            lastScrollTop = scrollTop;
            scheduleHide();
        }
    };

    const scheduleHide = () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!isHovering && shadowRoot) setMode('idle');
        }, HIDE_TIMEOUT);
    };

    const init = () => {
        setInterval(() => { if (!document.getElementById('ss-host')) createUI(); }, 1000);
        createUI();
        window.addEventListener('scroll', () => { requestAnimationFrame(updateVisibility); }, true);
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

})();
