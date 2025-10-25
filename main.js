// ==UserScript==
// @name         api purchase
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  direct api call for purchasing
// @author       pythonplugin
// @match        https://www.pekora.zip/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    let observer = null;
    let retryTimer = null;

    let lastUrl = location.href;

    const info = {
        version: '1.1',
        author: '@pythonplugin',
    };

    // helpers
    const getItemId = () => {
        const m = window.location.pathname.match(/\/catalog\/(\d+)/);
        return m ? m[1] : null;
    };

    const getCsrf = () => {
        const cookies = document.cookie.split(';');

        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');

            if (name.toLowerCase().includes('csrf')) return value;
        }

        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    };

    const getPrice = () => {
        const label = document.querySelector('.priceLabel-0-2-61');
        if (!label) return 0;

        const text = label.textContent.trim().toLowerCase();
        if (text.includes('free')) return 0;

        const m = text.match(/\d+/);

        return m ? parseInt(m[0]) : 0;
    };

    // main
    const notify = (msg, ok = true) => {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: -300px;
            z-index: 9999;
            background: ${ok ? '#00a76b' : '#c34242'};
            color: white;
            padding: 10px 16px;
            border: 1px solid ${ok ? '#009963' : '#9b2f2f'};
            font-family: "Gotham SSm A", "Gotham SSm B", "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 13px;
            font-weight: 400;
            padding: 8px 16px;
            height: 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: right 0.35s ease;
            text-transform: lowercase;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.right = '20px';
        }, 100);

        setTimeout(() => {
            toast.style.right = '-300px';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };

    const purchase = async (id, price = 0) => {
        const csrf = getCsrf();

        try {
            const res = await fetch(`https://www.pekora.zip/apisite/economy/v1/purchases/products/${id}`, {
                method: 'POST',

                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf || '',
                    'Referer': window.location.href
                },

                credentials: 'include',

                body: JSON.stringify({
                    assetId: parseInt(id),
                    expectedPrice: price,
                    expectedSellerId: 1,
                    userAssetId: null,
                    expectedCurrency: 1
                })
            });

            const data = await res.json();

            if (res.ok) {
                notify('purchase successful');
                setTimeout(() => location.reload(), 1500);
            } else {
                notify(`failed: ${data.message || JSON.stringify(data)}`, false);
            }
        } catch (err) {
            notify(`failed: ${err.message}`, false);
        }
    };

    const purchase_button = () => {
        const id = getItemId();
        if (!id) return false;

        if (document.querySelector('#bypbtn')) return true;

        const buyButton =
            document.querySelector('button.newBuyButton-0-2-58') ||
            document.querySelector('button[class*="newBuyButton"]') ||
            document.querySelector('button[class*="buyBtn"]');

        if (!buyButton) {
            return false;
        }

        if (buyButton.classList.contains('newCancelButton-0-2-61') ||
            buyButton.textContent.toLowerCase().includes('edit avatar')) {
            return true;
        }

        if (buyButton.disabled) {
            return true;
        }

        const container = buyButton.parentElement;
        if (!container) {
            return false;
        }

        const btn = document.createElement('button');
        btn.id = 'bypbtn';
        btn.type = 'button';
        btn.textContent = 'api buy';

        btn.style.cssText = `
            background: rgb(0, 167, 107) !important;
            color: white !important;
            margin-top: 6px;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-family: "Gotham SSm A", "Gotham SSm B", "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            height: 38px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: background 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        btn.onmouseenter = () => {
            if (!btn.disabled) {
                btn.style.background = 'rgb(0, 153, 99) !important';
            }
        };

        btn.onmouseleave = () => {
            if (!btn.disabled) {
                btn.style.background = 'rgb(0, 167, 107) !important';
            }
        };

        btn.onclick = async (e) => {
            e.preventDefault();

            if (btn.disabled) return;
            btn.disabled = true;

            btn.textContent = 'processing...';

            btn.style.background = '#777 !important';
            btn.style.cursor = 'not-allowed';

            try {
                const currentId = getItemId();
                const currentPrice = getPrice();
                
                await purchase(currentId, currentPrice);
            } finally {
                btn.disabled = false;

                btn.textContent = 'api buy';

                btn.style.background = 'rgb(0, 167, 107) !important';
                btn.style.cursor = 'pointer';
            }
        };

        container.appendChild(btn);
        return true;
    };

    // init
    const start_retry = () => {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }

        let attempts = 0;
        const maxAttempts = 20;

        const retry = () => {
            const id = getItemId();

            if (!id) {
                return;
            }

            const success = purchase_button();

            if (success) {
                return;
            }

            attempts++;

            if (attempts < maxAttempts) {
                retryTimer = setTimeout(retry, 300);
            }
        };

        retry();
    };

    const monitor_button = () => {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            const id = getItemId();

            if (id && !document.querySelector('#bypbtn')) {
                purchase_button();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    const history_navigation = () => {
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        const handler = () => {
            const currentUrl = location.href;
            if (currentUrl === lastUrl) return;

            lastUrl = currentUrl;

            setTimeout(() => {
                start_retry();
            }, 100);
        };

        history.pushState = function (...args) {
            pushState.apply(this, args);
            handler();
        };

        history.replaceState = function (...args) {
            replaceState.apply(this, args);
            handler();
        };

        window.addEventListener('popstate', handler);
    };

    // setup    
    console.log(`
                                                                                                                                            
                            ██                                                       ▄▄                                                         
                            ▀▀                                                       ██                                                         
      ▄█████▄  ██▄███▄    ████               ██▄███▄   ██    ██   ██▄████   ▄█████▄  ██▄████▄   ▄█████▄  ▄▄█████▄   ▄████▄    ██▄████           
      ▀ ▄▄▄██  ██▀  ▀██     ██               ██▀  ▀██  ██    ██   ██▀      ██▀    ▀  ██▀   ██   ▀ ▄▄▄██  ██▄▄▄▄ ▀  ██▄▄▄▄██   ██▀               
     ▄██▀▀▀██  ██    ██     ██               ██    ██  ██    ██   ██       ██        ██    ██  ▄██▀▀▀██   ▀▀▀▀██▄  ██▀▀▀▀▀▀   ██                
     ██▄▄▄███  ███▄▄██▀  ▄▄▄██▄▄▄            ███▄▄██▀  ██▄▄▄███   ██       ▀██▄▄▄▄█  ██    ██  ██▄▄▄███  █▄▄▄▄▄██  ▀██▄▄▄▄█   ██                
      ▀▀▀▀ ▀▀  ██ ▀▀▀    ▀▀▀▀▀▀▀▀            ██ ▀▀▀     ▀▀▀▀ ▀▀   ▀▀         ▀▀▀▀▀   ▀▀    ▀▀   ▀▀▀▀ ▀▀   ▀▀▀▀▀▀     ▀▀▀▀▀    ▀▀                
               ██                            ██                                                                                                 

    `);
    
    console.log(`%cversion: %c${info.version}`, 'color: #00a76b; font-weight: bold;', 'color: #ffffff;');
    console.log(`%cauthor: %c${info.author}`, 'color: #00a76b; font-weight: bold;', 'color: #ffffff;');
    console.log(`%ccompile time: %c${(performance.now() / 1000).toFixed(3)} seconds`, 'color: #00a76b; font-weight: bold;', 'color: #ffffff;');
    console.log('%cAPI purchase loaded successfully', 'color: #00a76b; font-weight: bold;');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            start_retry();
            monitor_button();
        });
    } else {
        start_retry();
        monitor_button();
    }

    history_navigation();
})();
