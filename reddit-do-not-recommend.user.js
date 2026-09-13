// ==UserScript==
// @name         Reddit do not recommend
// @namespace    https://github.com/luizfx22/tampermonkey-scripts
// @version      0.0.2
// @description  Removes the annoying recommended posts of Reddit
// @author       luizfx22
// @match        https://reddit.com/*
// @match        https://www.reddit.com/*
// @match        https://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @noframes
// @homepage     https://github.com/luizfx22/tampermonkey-scripts
// ==/UserScript==

(function () {
    'use strict';

    let removedCount = 0;

    const RECOMMENDATION_TEXTS = [
        'Suggested for you',
        'Popular near you',
        'Because you\'ve shown interest in a similar post',
        'Because you\'ve shown interest in similar posts',
    ];

    function createRdrCounter() {
        if (document.getElementById('rdr-counter-container')) {
            return;
        }

        const container = document.createElement('span');

        container.id = 'rdr-counter-container';

        Object.assign(container.style, {
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            background: '#484848',
            padding: '16px 12px',
            borderRadius: '6px',
            zIndex: '9999',
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            display: 'flex',
            flexDirection: 'row',
            gap: '.25rem',
            justifyContent: 'center',
            alignItems: 'center',
            lineHeight: '0',
            opacity: '0.65',
            transition: 'opacity 0.2s ease-in-out',
        });

        container.addEventListener('mouseenter', () => {
            container.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            container.style.opacity = '0.65';
        });

        const label = document.createElement('p');

        label.textContent = 'Removed:';

        Object.assign(label.style, {
            margin: '0',
        });

        const counter = document.createElement('p');

        counter.id = 'rdr-counter';
        counter.textContent = '0';

        Object.assign(counter.style, {
            margin: '0',
        });

        container.appendChild(label);
        container.appendChild(counter);

        document.body.appendChild(container);
    }

    function updateRdrCounter(newValue, duration = 300) {
        const element = document.getElementById('rdr-counter');

        if (!element) {
            return;
        }

        const startValue = Number.parseInt(element.textContent, 10) || 0;
        const endValue = Number(newValue);

        if (startValue === endValue) {
            return;
        }

        const startTime = performance.now();

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentValue = Math.round(
                startValue + (endValue - startValue) * eased
            );

            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    function cleanupHrSiblings(referenceNode) {
        const hrs = [];

        let previous = referenceNode.previousElementSibling;

        while (previous && previous.tagName === 'HR') {
            hrs.push(previous);
            previous = previous.previousElementSibling;
        }

        let next = referenceNode.nextElementSibling;

        while (next && next.tagName === 'HR') {
            hrs.push(next);
            next = next.nextElementSibling;
        }

        // Mantém a lógica original:
        // só remove os HRs quando existem pelo menos dois.
        if (hrs.length >= 2) {
            hrs.forEach(hr => hr.remove());
        }
    }

    function hasRecommendationText(post) {
        const text = post.textContent || '';

        return RECOMMENDATION_TEXTS.some(
            recommendation =>
            text.toLowerCase().includes(recommendation.toLowerCase())
        );
    }

    function isRecommendedPost(post) {
        /*
         * Método principal:
         *
         * <shreddit-post recommendation-source="user_to_post">
         *
         * ou
         *
         * <shreddit-post recommendation-source="responsive_post_to_post">
         */
        if (post.hasAttribute('recommendation-source')) {
            return true;
        }

        /*
         * Outro indicador utilizado pelo Reddit:
         *
         * <shreddit-post-overflow-menu is-recommended-post="">
         */
        const overflowMenu = post.querySelector(
            'shreddit-post-overflow-menu[is-recommended-post]'
        );

        if (overflowMenu) {
            return true;
        }

        /*
         * Fallback para mudanças futuras no HTML do Reddit.
         */
        if (hasRecommendationText(post)) {
            return true;
        }

        return false;
    }

    function removePost(post) {
        if (!post || post.dataset.rdrRemoved === 'true') {
            return false;
        }

        if (!isRecommendedPost(post)) {
            return false;
        }

        /*
         * Marca antes de remover para evitar que múltiplas
         * mutações do MutationObserver processem o mesmo elemento.
         */
        post.dataset.rdrRemoved = 'true';

        cleanupHrSiblings(post);

        post.remove();

        removedCount++;

        updateRdrCounter(removedCount);

        return true;
    }

    function scan(root = document) {
        const posts = root.querySelectorAll('shreddit-post');

        for (const post of posts) {
            removePost(post);
        }
    }

    function start() {
        createRdrCounter();

        /*
         * Processa o que já estiver carregado.
         */
        scan();

        /*
         * O Reddit carrega conteúdo dinamicamente conforme:
         *
         * - scroll
         * - navegação
         * - mudança de feed
         * - carregamento de componentes
         *
         * Por isso observamos o document inteiro.
         */
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') {
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }

                    /*
                     * O próprio node pode ser um shreddit-post.
                     */
                    if (
                        node instanceof Element &&
                        node.matches('shreddit-post')
                    ) {
                        removePost(node);
                    }

                    /*
                     * Ou pode ser um container que contém
                     * um ou vários posts.
                     */
                    if (node instanceof Element) {
                        scan(node);
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        /*
         * Alguns componentes do Reddit podem ser preenchidos
         * depois de o <shreddit-post> já existir.
         *
         * Este scan periódico funciona como uma segunda camada
         * de segurança, sem precisar processar o DOM inteiro
         * o tempo todo.
         */
        setInterval(() => {
            scan();
        }, 1000);
    }

    /*
     * O userscript pode executar antes do body existir.
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, {
            once: true,
        });
    } else {
        start();
    }
})();
