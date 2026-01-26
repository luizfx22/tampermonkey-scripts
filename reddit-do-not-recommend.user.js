// ==UserScript==
// @name         Reddit do not recommend
// @namespace    https://github.com/luizfx22/tampermonkey-scripts
// @version      2026-01-26
// @description  Removes recommended posts of Reddit
// @author       You
// @match        https://www.reddit.com/?feed=home
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @homepage     https://github.com/luizfx22/tampermonkey-scripts
// @homepageUrl  https://github.com/luizfx22/tampermonkey-scripts
// @downloadUrl  https://github.com/luizfx22/tampermonkey-scripts/blob/master/reddit-do-not-recommend.user.js
// @updateUrl    https://github.com/luizfx22/tampermonkey-scripts/blob/master/reddit-do-not-recommend.user.js
// ==/UserScript==

(function() {
    'use strict';

    let removedCount = 0;

    function createRdrCounter() {
        if (document.getElementById("rdr-counter")) return;

        const span = document.createElement("span");
        span.style.position = "fixed";
        span.style.bottom = "16px";
        span.style.right = "16px";
        span.style.background = "#484848";
        span.style.padding = "16px 12px";
        span.style.borderRadius = "6px";
        span.style.zIndex = "9999";
        span.style.color = "#fff";
        span.style.fontFamily = "Arial, sans-serif";
        span.style.fontSize = "14px";
        span.style.display = "flex";
        span.style.flexDirection = "row";
        span.style.gap = ".25rem";
        span.style.justifyContent = "center";
        span.style.alignItems = "center"
        span.style.lineHeight = "0";

        span.style.opacity = "0.65";
        span.style.transition = "opacity 0.2s ease-in-out";

        span.addEventListener("mouseenter", () => {
            span.style.opacity = "1";
        });

        span.addEventListener("mouseleave", () => {
            span.style.opacity = "0.65";
        });

        const label = document.createElement("p");
        label.textContent = "Removed:";
        label.style.margin = "0px";

        const p = document.createElement("p");
        p.id = "rdr-counter";
        p.style.margin = "0";
        p.textContent = "0";

        span.appendChild(label);
        span.appendChild(p);
        document.body.appendChild(span);
    }

    function updateRdrCounter(newValue, duration = 500) {
        const el = document.getElementById("rdr-counter");
        if (!el) return;

        const startValue = parseInt(el.textContent, 10) || 0;
        const endValue = Number(newValue);

        if (startValue === endValue) return;

        const startTime = performance.now();

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // easing (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentValue = Math.round(
                startValue + (endValue - startValue) * eased
            );

            el.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    function cleanupHrSiblings(referenceNode) {
        const hrs = [];

        let prev = referenceNode.previousElementSibling;
        while (prev && prev.tagName === "HR") {
            hrs.push(prev);
            prev = prev.previousElementSibling;
        }

        let next = referenceNode.nextElementSibling;
        while (next && next.tagName === "HR") {
            hrs.push(next);
            next = next.nextElementSibling;
        }

        if (hrs.length >= 2) hrs.forEach(hr => hr.remove());
    }


    function removeRecommendedPosts(parentElement) {
        if (!parentElement) return false;

        const posts = Array.from(
            parentElement.getElementsByTagName("shreddit-post")
        );

        for (const post of posts) {
            if (!post.hasAttribute("recommendation-source")) continue;

            // Remove o post recomendado
            post.remove();

            // Remove HRs consecutivos ao redor
            cleanupHrSiblings(post);

            removedCount++;
            updateRdrCounter(removedCount);
        }
    }

    const target = document.getElementById("main-content");

    if (!target) {
        console.warn("Target not found");
        return;
    }

    let feed = null;

    for (const child of target.children) {
        if (child.localName !== "shreddit-feed") continue;
        feed = child;
    }

    createRdrCounter()
    removeRecommendedPosts(feed);

    const obs = new MutationObserver((muts) => {
        for (const mutation of muts) {
            if (mutation.type === "childList") {
                removeRecommendedPosts(feed);
                break;
            }
        }
    });

    obs.observe(target, {
        childList: true,
        subtree: true,
    });
})();
