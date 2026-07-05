(function () {
    if (window.__HSA_UI_LOADED__) {
        return;
    }
    window.__HSA_UI_LOADED__ = true;

    const body = document.body;
    const drawer = document.getElementById('mobile-nav-panel');
    const toggles = document.querySelectorAll('[data-nav-toggle]');
    const closers = document.querySelectorAll('[data-nav-close]');

    if (drawer && toggles.length) {
        const setOpen = function (open) {
            drawer.hidden = !open;
            body.classList.toggle('nav-open', open);
            toggles.forEach(function (toggle) {
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        };

        toggles.forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                setOpen(drawer.hidden);
            });
        });

        closers.forEach(function (closer) {
            closer.addEventListener('click', function () {
                setOpen(false);
            });
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        });
    }

    const mega = document.querySelector('[data-mega-menu]');
    if (mega) {
        document.addEventListener('click', function (event) {
            if (mega.open && !mega.contains(event.target)) {
                mega.open = false;
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                mega.open = false;
            }
        });
    }

    const root = document.querySelector('[data-hsa-search]');
    const input = document.querySelector('[data-hsa-search-input]');
    const panel = document.querySelector('[data-hsa-search-panel]');
    const status = document.querySelector('[data-hsa-search-status]');
    const results = document.querySelector('[data-hsa-search-results]');

    if (!root || !input || !panel || !status || !results || !window.HSA_SEARCH || !window.HSA_SEARCH.endpoint) {
        return;
    }

    let timer = null;
    let controller = null;

    const escapeHtml = function (value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char];
        });
    };

    const showPanel = function () {
        panel.hidden = false;
        root.classList.add('site-search--open');
    };

    const hidePanel = function () {
        panel.hidden = true;
        root.classList.remove('site-search--open');
    };

    const renderGroups = function (groups, query) {
        results.innerHTML = '';

        if (!groups || !groups.length) {
            status.textContent = 'No quick matches yet. Press Enter to run a full site search.';
            showPanel();
            return;
        }

        status.textContent = 'Quick results for "' + query + '"';
        const fragment = document.createDocumentFragment();

        groups.forEach(function (group) {
            const section = document.createElement('section');
            section.className = 'search-preview__group';
            section.innerHTML = '<h2>' + escapeHtml(group.label) + '</h2>';

            (group.items || []).forEach(function (item) {
                const link = document.createElement('a');
                link.className = 'search-preview__item';
                link.href = item.url;

                const image = item.image
                    ? '<img src="' + escapeHtml(item.image) + '" alt="">'
                    : '<span class="search-preview__icon" aria-hidden="true">' + escapeHtml((item.type || 'R').charAt(0)) + '</span>';

                link.innerHTML =
                    image +
                    '<span class="search-preview__copy">' +
                    '<strong>' + escapeHtml(item.title) + '</strong>' +
                    '<small>' + escapeHtml(item.type || 'Result') + (item.meta ? ' - ' + escapeHtml(item.meta) : '') + '</small>' +
                    (item.excerpt ? '<em>' + escapeHtml(item.excerpt) + '</em>' : '') +
                    '</span>';
                section.appendChild(link);
            });

            fragment.appendChild(section);
        });

        const footer = document.createElement('div');
        footer.className = 'search-preview__footer';
        footer.innerHTML = '<a href="' + escapeHtml(window.HSA_SEARCH.home || '/') + '?s=' + encodeURIComponent(query) + '">View full site results for "' + escapeHtml(query) + '"</a>';
        fragment.appendChild(footer);

        results.appendChild(fragment);
        showPanel();
    };

    const runSearch = function () {
        const query = input.value.trim();
        if (query.length < 2) {
            status.textContent = 'Start typing to preview products, categories, tags, and guides.';
            results.innerHTML = '';
            hidePanel();
            return;
        }

        showPanel();
        status.textContent = 'Searching...';

        if (controller) {
            controller.abort();
        }

        controller = new AbortController();

        fetch(window.HSA_SEARCH.endpoint + '?q=' + encodeURIComponent(query), { signal: controller.signal })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Search failed');
                }
                return response.json();
            })
            .then(function (payload) {
                renderGroups(payload.groups, query);
            })
            .catch(function (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                status.textContent = 'Quick search is unavailable. Press Enter to run a full site search.';
                results.innerHTML = '';
                showPanel();
            });
    };

    input.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(runSearch, 180);
    });

    input.addEventListener('focus', function () {
        if (input.value.trim().length >= 2) {
            runSearch();
        }
    });

    document.addEventListener('click', function (event) {
        if (!root.contains(event.target)) {
            hidePanel();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            hidePanel();
        }
    });
}());
