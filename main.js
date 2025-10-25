// ==UserScript==
// @name         api purchase
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  direct api call for purchasing
// @author       pythonplugin
// @match        https://www.pekora.zip/catalog/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

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
            font-weight: 700;
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
        if (!id || document.querySelector('#bypbtn')) return;

        const container =
            document.querySelector('.buyBtnContainer-0-2-58') ||
            document.querySelector('.newBuyButton-0-2-153')?.parentElement ||
            document.querySelector('.buyBtn-0-2-116')?.parentElement;

        if (!container) return;

        const edit_avatar = container.querySelector('button');
        if (edit_avatar?.textContent.trim().toLowerCase() === 'edit avatar') return;

        const price = getPrice();

        const btn = document.createElement('button');
        btn.id = 'bypbtn';
        btn.type = 'button';
        btn.textContent = 'api buy';
        btn.className = 'btn-0-2-219 editBtn-0-2-57 buyBtn-0-2-56 newCancelButton-0-2-96';
        btn.style.cssText += `
            background: rgb(0, 167, 107) !important;
            color: white !important;
            margin-top: 6px; /* add vertical spacing below native button */
        `;

        btn.onmouseenter = () => { if (!btn.disabled) btn.style.background = 'rgb(0,153,99)'; };
        btn.onmouseleave = () => { if (!btn.disabled) btn.style.background = 'rgb(0,167,107)'; };

        btn.onclick = async (e) => {
            e.preventDefault();
            if (btn.disabled) return;

            btn.disabled = true;
            btn.textContent = 'processing...';
            btn.style.background = '#777';

            try {
                await purchase(id, getPrice());
            } finally {
                btn.disabled = false;
                btn.textContent = 'api buy';
                btn.style.background = 'rgb(0,167,107)';
            }
        };

        container.appendChild(btn);
    };

    // init
    const init = () => {
        const container = document.querySelector('.buyBtnContainer-0-2-58');
        if (container && !document.querySelector('#bypbtn')) purchase_button();
    };

    const history_navigation = () => {
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        const handleChange = () => {
            setTimeout(() => {
                init();
                waitForContainerAndAdd();
            }, 300);
        };

        history.pushState = function(...args) {
            pushState.apply(this, args);
            handleChange();
        };

        history.replaceState = function(...args) {
            replaceState.apply(this, args);
            handleChange();
        };

        window.addEventListener('popstate', handleChange);
    };

    const monitor_button = () => {
        const observer = new MutationObserver(() => {
            const container = document.querySelector('.buyBtnContainer-0-2-58');

            if (container && !document.querySelector('#bypbtn')) {
                purchase_button();
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            monitor_button();
        });
    } else {
        init();
        monitor_button();
    }

    setTimeout(init, 500);
    setTimeout(init, 1000);
    setTimeout(init, 2000);

    history_navigation();
})();
