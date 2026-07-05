<?php
if (!defined('ABSPATH')) {
    exit;
}

define('HSA_VERSION', '0.4.1');
define('HSA_MARKETPLACE_URL', home_url('/marketplace'));

function hsa_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('woocommerce');
    add_theme_support('wc-product-gallery-zoom');
    add_theme_support('wc-product-gallery-lightbox');
    add_theme_support('wc-product-gallery-slider');

    register_nav_menus([
        'primary' => 'Primary Menu',
        'footer' => 'Footer Menu',
    ]);
}
add_action('after_setup_theme', 'hsa_setup');

function hsa_assets() {
    // Shared type system with the BHFNM Marketplace app (Inter + Space Grotesk).
    wp_enqueue_style('hsa-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap', [], null);
    wp_enqueue_style('hsa-style', get_stylesheet_uri(), [], HSA_VERSION);
    wp_enqueue_script('hsa-script', get_template_directory_uri() . '/hsa-ui.js', [], HSA_VERSION, true);
    wp_localize_script('hsa-script', 'HSA_SEARCH', [
        'endpoint' => esc_url_raw(rest_url('hse/v1/search')),
        'home' => esc_url_raw(home_url('/')),
    ]);
}
add_action('wp_enqueue_scripts', 'hsa_assets');

function hsa_inline_ui_script() {
    return <<<'JS'
(function () {
    const body = document.body;
    const drawer = document.getElementById('mobile-nav-panel');
    const toggles = document.querySelectorAll('[data-nav-toggle]');
    const closers = document.querySelectorAll('[data-nav-close]');

    if (drawer && toggles.length) {
        const setOpen = (open) => {
            drawer.hidden = !open;
            body.classList.toggle('nav-open', open);
            toggles.forEach((toggle) => {
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        };

        toggles.forEach((toggle) => {
            toggle.addEventListener('click', function () {
                setOpen(drawer.hidden);
            });
        });

        closers.forEach((closer) => {
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
}());

(function () {
    const mega = document.querySelector('[data-mega-menu]');

    if (!mega) {
        return;
    }

    document.addEventListener('click', function (event) {
        if (!mega.open || mega.contains(event.target)) {
            return;
        }

        mega.open = false;
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            mega.open = false;
        }
    });
}());

(function () {
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
        const url = window.HSA_SEARCH.endpoint + '?q=' + encodeURIComponent(query);

        fetch(url, { signal: controller.signal })
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
JS;
}

function hsa_resource_hints($urls, $relation_type) {
    if ('preconnect' !== $relation_type) {
        return $urls;
    }

    $urls[] = [
        'href' => 'https://fonts.googleapis.com',
    ];
    $urls[] = [
        'href' => 'https://fonts.gstatic.com',
        'crossorigin' => 'anonymous',
    ];

    return $urls;
}
add_filter('wp_resource_hints', 'hsa_resource_hints', 10, 2);

function hsa_body_classes($classes) {
    if (function_exists('is_woocommerce') && (is_woocommerce() || is_cart() || is_checkout() || is_account_page())) {
        $classes[] = 'hsa-woo-surface';
    }

    return $classes;
}
add_filter('body_class', 'hsa_body_classes');

function hsa_seed_menu_pages() {
    return [
        'Hemp Flower' => '/hemp-flower-near-me/',
        'THCA Flower' => '/thca-flower-near-me/',
        'CBD Flower' => '/cbd-flower-near-me/',
        'CBG Flower' => '/cbg-flower-near-me/',
        'THC Drinks' => '/thc-drinks-near-me/',
        'Hemp Laws' => '/hemp-laws-by-state/',
        'COA Guide' => '/how-to-read-a-hemp-coa/',
        'Wholesale' => '/wholesale-hemp-flower/',
    ];
}

function hsa_trending_paths() {
    return [
        'Hemp Flower' => '/hemp-flower-near-me/',
        'THCA Flower' => '/thca-flower-near-me/',
        'Accessories' => '/product-category/hemp-accessories/',
        'CBD Flower' => '/cbd-flower-near-me/',
        'THC Drinks' => '/thc-drinks-near-me/',
        'COA Guide' => '/how-to-read-a-hemp-coa/',
        'Hemp Laws' => '/hemp-laws-by-state/',
        'Wholesale Hemp' => '/wholesale-hemp-flower/',
        'Texas Guide' => '/hemp-flower-near-me/texas/',
    ];
}

function hsa_navigation_groups() {
    return [
        'Shop by Search' => [
            'Hemp Flower Near Me' => '/hemp-flower-near-me/',
            'THCA Flower Near Me' => '/thca-flower-near-me/',
            'CBD Flower Near Me' => '/cbd-flower-near-me/',
            'CBG Flower Near Me' => '/cbg-flower-near-me/',
            'THC Drinks Near Me' => '/thc-drinks-near-me/',
        ],
        'Collections' => [
            'Hemp Flower Category' => '/product-category/hemp-flower/',
            'Hemp Accessories' => '/product-category/hemp-accessories/',
            'Hemp Flower Storage' => '/product-category/hemp-accessories/hemp-flower-storage/',
            'Rolling Accessories' => '/product-category/hemp-accessories/rolling-accessories/',
            'CBD Flower Category' => '/product-category/cbd-flower/',
            'THCA Flower Category' => '/product-category/thca-flower/',
            'COA Verified Tag' => '/product-tag/coa-verified/',
            'Lab Tested Hemp Tag' => '/product-tag/lab-tested-hemp/',
        ],
        'States and Law' => [
            'Texas Hemp Guide' => '/hemp-flower-near-me/texas/',
            'Florida Hemp Guide' => '/hemp-flower-near-me/florida/',
            'California Hemp Laws' => '/hemp-laws/california/',
            'Texas Hemp Laws' => '/hemp-laws/texas/',
            'All Hemp Laws' => '/hemp-laws-by-state/',
        ],
        'Trust and Guides' => [
            'How to Read a COA' => '/how-to-read-a-hemp-coa/',
            'CBD vs CBG vs THCA' => '/cbd-vs-cbg-vs-thca/',
            'CBN Gummies for Sleep' => '/cbn-gummies-for-sleep/',
            'Hemp THC Drinks Guide' => '/hemp-derived-thc-drinks/',
            'Authority Guides' => '/hemp-authority-guides/',
        ],
    ];
}

function hsa_footer_navigation_groups() {
    return [
        'Commerce' => [
            'Shop THCA Flower' => '/product-category/thca-flower/',
            'Shop Hemp Flower' => '/product-category/hemp-flower/',
            'Hemp Accessories' => '/product-category/hemp-accessories/',
            'Cart' => '/cart/',
            'My Account' => '/my-account/',
            'Wholesale THCA' => '/wholesale-thca-flower/',
        ],
        'Shop Categories' => [
            'Hemp Flower' => '/hemp-flower-near-me/',
            'Hemp Flower Archive' => '/product-category/hemp-flower/',
            'THCA Flower' => '/thca-flower-near-me/',
            'CBD Flower' => '/cbd-flower-near-me/',
            'CBG Flower' => '/cbg-flower-near-me/',
            'CBN Sleep' => '/cbn-gummies-for-sleep/',
        ],
        'Popular Searches' => [
            'COA Verified Hemp' => '/product-tag/coa-verified/',
            'Lab Tested Hemp' => '/product-tag/lab-tested-hemp/',
            'THCA Near Me' => '/product-tag/thca-near-me/',
            'Bulk Hemp Flower' => '/product-tag/bulk-hemp-flower/',
            'Legal Hemp Products' => '/product-tag/legal-hemp-products-tag/',
        ],
        'State and Law' => [
            'Hemp Laws by State' => '/hemp-laws-by-state/',
            'Texas' => '/hemp-laws/texas/',
            'Florida' => '/hemp-laws/florida/',
            'California' => '/hemp-laws/california/',
            'New York' => '/hemp-laws/new-york/',
        ],
        'Learn and Compare' => [
            'How to Read a COA' => '/how-to-read-a-hemp-coa/',
            'CBD vs CBG vs THCA' => '/cbd-vs-cbg-vs-thca/',
            'Best THCA Brands' => '/best-thca-flower-brands/',
            'Best Hemp THC Drinks' => '/best-hemp-thc-drinks/',
            'Buyer Guides Hub' => '/hemp-authority-guides/',
        ],
        'Wholesale and Drinks' => [
            'Wholesale Hemp Flower' => '/wholesale-hemp-flower/',
            'Wholesale THCA Flower' => '/wholesale-thca-flower/',
            'Hemp THC Drinks' => '/hemp-derived-thc-drinks/',
            'THC Drinks Near Me' => '/thc-drinks-near-me/',
            'Texas Drink Guide' => '/thc-drinks-near-me/texas/',
        ],
    ];
}

function hsa_woo_cart_count() {
    if (!function_exists('WC') || !WC() || !WC()->cart) {
        return 0;
    }

    return (int) WC()->cart->get_cart_contents_count();
}

function hsa_cart_url() {
    return function_exists('wc_get_cart_url') ? wc_get_cart_url() : home_url('/cart/');
}

function hsa_account_url() {
    return function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : home_url('/my-account/');
}

function hsa_render_header_actions() {
    $cart_count = hsa_woo_cart_count();

    $actions = [
        [
            'class' => 'header-action header-action--shop',
            'url' => home_url('/product-category/thca-flower/'),
            'label' => 'Shop',
            'value' => 'THCA Flower',
        ],
        [
            'class' => 'header-action header-action--cart',
            'url' => hsa_cart_url(),
            'label' => 'Cart',
            'value' => $cart_count > 0 ? sprintf(_n('%d item', '%d items', $cart_count, 'hemp-serp-authority'), $cart_count) : 'View Cart',
            'badge' => $cart_count,
        ],
        [
            'class' => 'header-action header-action--account',
            'url' => hsa_account_url(),
            'label' => 'Account',
            'value' => is_user_logged_in() ? 'Dashboard' : 'Sign In',
        ],
    ];

    foreach ($actions as $action) {
        echo '<a class="' . esc_attr($action['class']) . '" href="' . esc_url($action['url']) . '">';
        echo '<span>' . esc_html($action['label']) . '</span>';
        echo '<strong>' . esc_html($action['value']) . '</strong>';
        if (isset($action['badge']) && $action['badge'] > 0) {
            echo '<em>' . esc_html($action['badge']) . '</em>';
        }
        echo '</a>';
    }
}

function hsa_render_mobile_quick_actions() {
    $cart_count = hsa_woo_cart_count();
    $links = [
        'Shop THCA' => '/product-category/thca-flower/',
        'Hemp Flower' => '/product-category/hemp-flower/',
        'Cart' . ($cart_count ? ' (' . $cart_count . ')' : '') => hsa_cart_url(),
        'My Account' => hsa_account_url(),
    ];

    echo '<div class="mobile-nav__quick">';
    foreach ($links as $label => $url) {
        $href = 0 === strpos($url, 'http') ? $url : home_url($url);
        echo '<a href="' . esc_url($href) . '">' . esc_html($label) . '</a>';
    }
    echo '</div>';
}

function hsa_render_mega_menu() {
    $groups = hsa_navigation_groups();
    $spotlights = [
        [
            'label' => 'Marketplace',
            'title' => 'Shop hemp flower categories',
            'body' => 'Move from buyer intent into product shelves without losing COA, law, and supplier-verification context.',
            'url' => home_url('/product-category/hemp-flower/'),
        ],
        [
            'label' => 'Compliance',
            'title' => 'Check COAs before buying',
            'body' => 'Use the lab-testing guide to compare potency, contaminants, batch IDs, and state restrictions.',
            'url' => home_url('/how-to-read-a-hemp-coa/'),
        ],
        [
            'label' => 'Wholesale',
            'title' => 'Research bulk hemp paths',
            'body' => 'Compare wholesale hemp and THCA sourcing language without fake supplier claims or fake inventory.',
            'url' => home_url('/wholesale-hemp-flower/'),
        ],
    ];

    echo '<details class="site-mega" data-mega-menu>';
    echo '<summary><span>Browse</span><strong>Shop, laws, guides</strong></summary>';
    echo '<div class="site-mega__panel">';
    echo '<div class="site-mega__head">';
    echo '<div><p class="hsa-eyebrow">Research marketplace menu</p><h2>Jump by product, state law, COA trust signal, or wholesale intent.</h2></div>';
    echo '<div class="site-mega__actions">';
    echo '<a class="header-cta" href="' . esc_url(home_url('/product-category/thca-flower/')) . '">Shop THCA</a>';
    echo '<a class="header-chip" href="' . esc_url(hsa_cart_url()) . '">Cart</a>';
    echo '<a class="header-chip" href="' . esc_url(hsa_account_url()) . '">Account</a>';
    echo '</div></div>';

    echo '<div class="site-mega__quick" aria-label="Popular research shortcuts">';
    foreach (hsa_trending_paths() as $label => $path) {
        echo '<a href="' . esc_url(home_url($path)) . '">' . esc_html($label) . '</a>';
    }
    echo '</div>';

    echo '<div class="site-mega__grid">';
    foreach ($groups as $group_label => $links) {
        echo '<section class="site-mega__group"><h3>' . esc_html($group_label) . '</h3>';
        hsa_render_simple_link_list($links, 'site-mega__list');
        echo '</section>';
    }
    echo '</div>';

    echo '<div class="site-mega__spotlights">';
    foreach ($spotlights as $spotlight) {
        echo '<a class="site-mega__spotlight" href="' . esc_url($spotlight['url']) . '">';
        echo '<span>' . esc_html($spotlight['label']) . '</span>';
        echo '<strong>' . esc_html($spotlight['title']) . '</strong>';
        echo '<em>' . esc_html($spotlight['body']) . '</em>';
        echo '</a>';
    }
    echo '</div>';
    echo '</div></details>';
}

function hsa_render_page_rail($context = 'page') {
    $title = 'Research navigator';
    $lede = 'Use these links to keep product research, legality checks, and COA verification close while you read.';

    if ('post' === $context) {
        $title = 'Guide navigator';
        $lede = 'Move from this guide into related buying, law, glossary, and supplier-verification paths.';
    } elseif ('woo' === $context) {
        $title = 'Shop support';
        $lede = 'Use these links before checkout to compare categories, COAs, state restrictions, and account details.';
    }

    echo '<aside class="content-rail" aria-label="' . esc_attr($title) . '">';
    echo '<p class="hsa-eyebrow">' . esc_html($title) . '</p>';
    echo '<h2>Keep the next step clear</h2>';
    echo '<p>' . esc_html($lede) . '</p>';
    hsa_render_simple_link_list([
        'Shop THCA Flower' => '/product-category/thca-flower/',
        'Shop Hemp Flower' => '/product-category/hemp-flower/',
        'How to Read a COA' => '/how-to-read-a-hemp-coa/',
        'Hemp Laws by State' => '/hemp-laws-by-state/',
        'Wholesale Hemp Flower' => '/wholesale-hemp-flower/',
        'Cart' => hsa_cart_url(),
        'My Account' => hsa_account_url(),
    ], 'rail-link-list');
    echo hsa_shortcode('[hse_trust_box compact="yes"]');
    echo '</aside>';
}

function hsa_current_summary($words = 34) {
    $post = get_post();
    if (!($post instanceof WP_Post)) {
        return '';
    }

    if (has_excerpt($post)) {
        return wp_trim_words(get_the_excerpt($post), $words);
    }

    return hsa_loop_excerpt($post, $words);
}

function hsa_render_research_snapshot($context = 'page') {
    $summary = hsa_current_summary(34);
    if (!$summary) {
        $summary = 'Use this page to compare hemp product intent, COA checks, state caveats, and related buyer-safety research without fake local availability claims.';
    }

    $updated = get_the_modified_date('F j, Y');
    $label = 'page' === $context ? 'Research snapshot' : 'Guide snapshot';

    echo '<section class="research-snapshot" aria-label="' . esc_attr($label) . '">';
    echo '<div class="research-snapshot__answer">';
    echo '<p class="hsa-strip-label">' . esc_html($label) . '</p>';
    echo '<h2>Fast answer</h2>';
    echo '<p>' . esc_html($summary) . '</p>';
    echo '</div>';
    echo '<dl class="research-snapshot__facts">';
    echo '<div><dt>Last updated</dt><dd>' . esc_html($updated) . '</dd></div>';
    echo '<div><dt>Use this for</dt><dd>COA checks, state rules, buyer intent</dd></div>';
    echo '<div><dt>Claims policy</dt><dd>No fake stores, fake COAs, or guaranteed legality</dd></div>';
    echo '</dl>';
    echo '</section>';
}

function hsa_render_next_step_runway($label = 'Next research paths', $links = null) {
    $links = $links ?: hsa_seed_menu_pages();
    if (empty($links)) {
        return;
    }

    echo '<section class="research-runway" aria-label="' . esc_attr($label) . '">';
    echo '<div class="research-runway__head">';
    echo '<p class="hsa-strip-label">' . esc_html($label) . '</p>';
    echo '<span>Scrollable internal paths for shoppers, researchers, and crawlers.</span>';
    echo '</div>';
    echo '<div class="research-runway__track">';
    foreach ($links as $link_label => $path) {
        $url = 0 === strpos($path, 'http') ? $path : home_url($path);
        echo '<a href="' . esc_url($url) . '"><span>' . esc_html($link_label) . '</span><small>Open path</small></a>';
    }
    echo '</div>';
    echo '</section>';
}

function hsa_render_research_drawer($summary, $description, $shortcode = '[hse_archive_sections]') {
    echo '<details class="archive-research-library site-research-drawer"><summary><span>' . esc_html($summary) . '</span><small>' . esc_html($description) . '</small></summary><div class="archive-research-library__body">';
    echo hsa_shortcode($shortcode);
    echo '</div></details>';
}

function hsa_render_simple_link_list($links, $class = 'hsa-simple-links') {
    if (empty($links)) {
        return;
    }

    echo '<ul class="' . esc_attr($class) . '">';
    foreach ($links as $label => $path) {
        $url = 0 === strpos($path, 'http') ? $path : home_url($path);
        echo '<li><a href="' . esc_url($url) . '">' . esc_html($label) . '</a></li>';
    }
    echo '</ul>';
}

function hsa_post_type_label($post_type = null) {
    $post_type = $post_type ?: get_post_type();
    $object = $post_type ? get_post_type_object($post_type) : null;

    return ($object && !empty($object->labels->singular_name)) ? $object->labels->singular_name : 'Research entry';
}

function hsa_core_cards() {
    return [
        [
            'title' => 'Hemp Flower Discovery',
            'body' => 'Compare hemp flower categories, state pages, buyer guides, and COA-backed shopping questions.',
            'url' => home_url('/hemp-flower-near-me/'),
            'eyebrow' => 'Core vertical',
        ],
        [
            'title' => 'THCA Law + Discovery',
            'body' => 'Research THCA flower with legality caveats, state pages, COA checks, and supplier-verification questions.',
            'url' => home_url('/thca-flower-near-me/'),
            'eyebrow' => 'Higher-risk cluster',
        ],
        [
            'title' => 'CBD + CBG Buyer Guides',
            'body' => 'Use CBD and CBG guides to compare flower, pre-rolls, lab-tested trust signals, and cannabinoid differences.',
            'url' => home_url('/cbd-vs-cbg-vs-thca/'),
            'eyebrow' => 'Launch-safe cluster',
        ],
        [
            'title' => 'Hemp THC Drinks',
            'body' => 'Compare hemp-derived THC drinks, low-dose beverage language, state caveats, and law-linked guidance.',
            'url' => home_url('/hemp-derived-thc-drinks/'),
            'eyebrow' => 'Beverage cluster',
        ],
        [
            'title' => 'Wholesale Hemp Research',
            'body' => 'Review wholesale hemp questions, COA expectations, supplier vetting, and B2B follow-up paths.',
            'url' => home_url('/wholesale-hemp-flower/'),
            'eyebrow' => 'Lead-gen cluster',
        ],
        [
            'title' => 'COA + Law Trust Checks',
            'body' => 'Use COA education, glossary definitions, and state-law research to pressure-test seller claims.',
            'url' => home_url('/how-to-read-a-hemp-coa/'),
            'eyebrow' => 'Trust layer',
        ],
    ];
}

function hsa_spotlight_tracks() {
    return [
        [
            'eyebrow' => 'Discovery shelf',
            'title' => 'Start with flower search intent',
            'body' => 'Open hemp flower, CBD flower, and CBG flower hubs with clear category paths, trust language, and fast next steps.',
            'url' => home_url('/product-category/hemp-flower/'),
            'link_label' => 'Browse flower research',
        ],
        [
            'eyebrow' => 'Law + location',
            'title' => 'Move from near-me to state-aware answers',
            'body' => 'Move from broad near-me searches into Texas, Florida, California, and other state pages with shipping and law caveats.',
            'url' => home_url('/hemp-laws-by-state/'),
            'link_label' => 'Open law research',
        ],
        [
            'eyebrow' => 'Buyer confidence',
            'title' => 'Keep COA and trust language one tap away',
            'body' => 'Keep lab testing, COA reading, supplier verification, and buyer-safety content close to every product category.',
            'url' => home_url('/how-to-read-a-hemp-coa/'),
            'link_label' => 'Read the COA guide',
        ],
        [
            'eyebrow' => 'Lead-gen ready',
            'title' => 'Use wholesale and drinks pages like marketplace rails',
            'body' => 'Give high-intent shoppers and wholesale buyers clear next steps through drinks, THCA, and B2B research paths.',
            'url' => home_url('/wholesale-hemp-flower/'),
            'link_label' => 'Open wholesale path',
        ],
    ];
}

function hsa_shortcode($shortcode) {
    return shortcode_exists(strtok(trim($shortcode, '[]'), ' ')) ? do_shortcode($shortcode) : '';
}

function hsa_link_cloud($label = 'Buyer research paths:', $links = null) {
    $links = $links ?: hsa_seed_menu_pages();

    echo '<section class="seo-strip"><p class="hsa-strip-label">' . esc_html($label) . '</p><div class="hsa-link-cloud">';
    foreach ($links as $link_label => $path) {
        echo '<a href="' . esc_url(home_url($path)) . '">' . esc_html($link_label) . '</a>';
    }
    echo '</div></section>';
}

function hsa_archive_quick_links() {
    $title = function_exists('woocommerce_page_title') ? woocommerce_page_title(false) : '';
    $slug = '';

    if (is_product_category() || is_product_tag()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            $slug = $term->slug;
            $title = $term->name;
        }
    }

    if (false !== strpos($slug, 'thca')) {
        return [
            'THCA Near Me' => '/thca-flower-near-me/',
            'THCA Legal States' => '/thca-flower-legal-states/',
            'COA Guide' => '/how-to-read-a-hemp-coa/',
            'Wholesale THCA' => '/wholesale-thca-flower/',
            'Compare CBD, CBG, THCA' => '/cbd-vs-cbg-vs-thca/',
        ];
    }

    if (false !== strpos($slug, 'accessor') || false !== strpos($slug, 'storage') || false !== strpos($slug, 'rolling')) {
        return [
            'Hemp Accessories' => '/product-category/hemp-accessories/',
            'Flower Storage' => '/product-category/hemp-accessories/hemp-flower-storage/',
            'Rolling Accessories' => '/product-category/hemp-accessories/rolling-accessories/',
            'Hemp Flower' => '/product-category/hemp-flower/',
            'COA Guide' => '/how-to-read-a-hemp-coa/',
        ];
    }

    if (false !== strpos($slug, 'cbd')) {
        return [
            'CBD Flower Near Me' => '/cbd-flower-near-me/',
            'Hemp Flower' => '/hemp-flower-near-me/',
            'COA Guide' => '/how-to-read-a-hemp-coa/',
            'Compare CBD, CBG, THCA' => '/cbd-vs-cbg-vs-thca/',
            'Hemp Laws' => '/hemp-laws-by-state/',
        ];
    }

    return [
        ($title ? $title . ' Guide' : 'Hemp Flower Guide') => '/hemp-flower-near-me/',
        'Shop Hemp Flower' => '/product-category/hemp-flower/',
        'COA Guide' => '/how-to-read-a-hemp-coa/',
        'Hemp Laws' => '/hemp-laws-by-state/',
        'Wholesale Hemp' => '/wholesale-hemp-flower/',
    ];
}

function hsa_archive_link_url($path) {
    if (0 === strpos($path, '#') || 0 === strpos($path, 'http')) {
        return $path;
    }

    return home_url($path);
}

function hsa_archive_context() {
    $title = function_exists('woocommerce_page_title') ? woocommerce_page_title(false) : wp_get_document_title();
    $slug = '';
    $count = 0;

    if (is_product_category() || is_product_tag()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            $title = $term->name;
            $slug = $term->slug;
            $count = (int) $term->count;
        }
    } elseif (is_shop()) {
        $counts = wp_count_posts('product');
        $count = isset($counts->publish) ? (int) $counts->publish : 0;
        $slug = 'shop';
    }

    $mode = 'hemp';
    foreach (['thca', 'cbd', 'cbg', 'drink', 'accessor', 'storage', 'rolling'] as $needle) {
        if (false !== strpos($slug, $needle) || false !== stripos($title, $needle)) {
            $mode = $needle;
            break;
        }
    }

    if (in_array($mode, ['accessor', 'storage', 'rolling'], true)) {
        $mode = 'accessories';
    } elseif ('drink' === $mode) {
        $mode = 'drinks';
    }

    return [
        'title' => $title,
        'slug' => $slug,
        'count' => $count,
        'mode' => $mode,
    ];
}

function hsa_archive_intent_items() {
    $context = hsa_archive_context();
    $listing_body = $context['count'] > 0
        ? sprintf('%d live catalog item%s connected to this archive.', $context['count'], 1 === $context['count'] ? ' is' : 's are')
        : 'Verified listings are pending, so use the research paths first.';

    $items = [
        [
            'label' => 'Catalog shelf',
            'title' => 'Shop current listings',
            'body' => $listing_body . ' Start here before deeper research.',
            'url' => '#archive-products',
            'tone' => 'primary',
        ],
        [
            'label' => 'COA check',
            'title' => 'Read lab docs',
            'body' => 'Use batch IDs, cannabinoid tables, and contaminant screens to pressure-test product claims.',
            'url' => '/how-to-read-a-hemp-coa/',
        ],
        [
            'label' => 'State rules',
            'title' => 'Check law caveats',
            'body' => 'Availability and shipping depend on jurisdiction. This is research guidance, not legal advice.',
            'url' => '/hemp-laws-by-state/',
        ],
        [
            'label' => 'Compare',
            'title' => 'CBD vs CBG vs THCA',
            'body' => 'Compare cannabinoid intent, product formats, and buyer-safety questions before narrowing a category.',
            'url' => '/cbd-vs-cbg-vs-thca/',
        ],
    ];

    if ('thca' === $context['mode']) {
        $items[0]['title'] = 'Shop THCA flower';
        $items[2]['title'] = 'Review THCA legality';
        $items[2]['url'] = '/thca-flower-legal-states/';
        $items[] = [
            'label' => 'Bulk path',
            'title' => 'Wholesale THCA',
            'body' => 'Move into B2B intent, supplier verification, and bulk COA expectations.',
            'url' => '/wholesale-thca-flower/',
        ];
    } elseif ('cbd' === $context['mode']) {
        $items[0]['title'] = 'Shop CBD flower';
        $items[] = [
            'label' => 'Near me',
            'title' => 'CBD flower guidance',
            'body' => 'Use online discovery and state-aware availability notes without fake local-store claims.',
            'url' => '/cbd-flower-near-me/',
        ];
    } elseif ('cbg' === $context['mode']) {
        $items[0]['title'] = 'Shop CBG flower';
        $items[] = [
            'label' => 'Near me',
            'title' => 'CBG flower guidance',
            'body' => 'Compare CBG buyer intent, COA checks, and local-law caveats.',
            'url' => '/cbg-flower-near-me/',
        ];
    } elseif ('drinks' === $context['mode']) {
        $items[0]['title'] = 'Browse hemp drinks';
        $items[] = [
            'label' => 'Drink hub',
            'title' => 'Hemp THC drinks',
            'body' => 'Compare beverage formats, state restrictions, and safe availability language.',
            'url' => '/hemp-derived-thc-drinks/',
        ];
    } elseif ('accessories' === $context['mode']) {
        $items[0]['title'] = 'Shop accessories';
        $items[1]['title'] = 'Protect freshness';
        $items[1]['body'] = 'Use storage, humidity, and handling accessories to keep flower quality easier to manage.';
        $items[1]['url'] = '/product-category/hemp-accessories/hemp-flower-storage/';
        $items[] = [
            'label' => 'Rolling',
            'title' => 'Rolling supplies',
            'body' => 'Browse non-branded rolling accessories that support hemp flower shoppers.',
            'url' => '/product-category/hemp-accessories/rolling-accessories/',
        ];
    } else {
        $items[] = [
            'label' => 'Wholesale',
            'title' => 'Bulk hemp flower',
            'body' => 'Review wholesale hemp questions, COA expectations, and supplier verification signals.',
            'url' => '/wholesale-hemp-flower/',
        ];
    }

    return $items;
}

function hsa_archive_briefing_points() {
    $context = hsa_archive_context();
    $listing = $context['count'] > 0
        ? sprintf('%d catalog listing%s visible', $context['count'], 1 === $context['count'] ? '' : 's')
        : 'No filler listings';

    return [
        $listing,
        'COA review before checkout',
        'State-aware shipping caveats',
        'No fake local inventory claims',
    ];
}

function hsa_render_archive_quick_nav() {
    $links = hsa_archive_quick_links();
    $items = hsa_archive_intent_items();

    if (empty($links) && empty($items)) {
        return;
    }

    echo '<nav class="archive-command-center" aria-label="Priority category paths">';
    echo '<div class="archive-command-center__head">';
    echo '<p class="hsa-strip-label">Search command center</p>';
    echo '<span>Swipe, scan, then jump directly to the product shelf or the right research path.</span>';
    echo '</div>';

    echo '<div class="archive-intent-dock" role="list">';
    foreach ($items as $item) {
        $classes = 'archive-intent-card';
        if (!empty($item['tone'])) {
            $classes .= ' archive-intent-card--' . sanitize_html_class($item['tone']);
        }

        echo '<a class="' . esc_attr($classes) . '" role="listitem" href="' . esc_url(hsa_archive_link_url($item['url'])) . '">';
        echo '<span>' . esc_html($item['label']) . '</span>';
        echo '<strong>' . esc_html($item['title']) . '</strong>';
        echo '<small>' . esc_html($item['body']) . '</small>';
        echo '</a>';
    }
    echo '</div>';

    echo '<div class="archive-fast-links" aria-label="Fast related links">';
    echo '<div class="archive-quick-nav__links">';
    foreach ($links as $label => $path) {
        echo '<a href="' . esc_url(hsa_archive_link_url($path)) . '">' . esc_html($label) . '</a>';
    }
    echo '</div>';
    echo '</div>';
    echo '</nav>';
}

function hsa_trust_row() {
    echo '<div class="trust-row">';
    echo '<span>COA-backed buying guidance</span>';
    echo '<span>State-aware law research</span>';
    echo '<span>Manual partner sourcing only</span>';
    echo '<span>Verified local claims only</span>';
    echo '</div>';
}

function hsa_section_header($eyebrow, $title, $body = '') {
    echo '<div class="hsa-section-header">';
    if ($eyebrow) {
        echo '<p class="hsa-eyebrow">' . esc_html($eyebrow) . '</p>';
    }
    echo '<h2>' . esc_html($title) . '</h2>';
    if ($body) {
        echo '<p>' . esc_html($body) . '</p>';
    }
    echo '</div>';
}

function hsa_render_breadcrumbs($fallback = 'Research Page') {
    echo '<nav class="breadcrumbish" aria-label="Breadcrumbs"><a href="' . esc_url(home_url('/')) . '">Home</a>';

    if (is_tax()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term) {
            echo ' / ' . esc_html($term->name);
        }
    } elseif (is_singular()) {
        global $post;
        if ($post instanceof WP_Post && $post->post_parent) {
            $parent = get_post($post->post_parent);
            if ($parent) {
                echo ' / <a href="' . esc_url(get_permalink($parent)) . '">' . esc_html(get_the_title($parent)) . '</a>';
            }
        } else {
            echo ' / ' . esc_html($fallback);
        }

        echo ' / ' . esc_html(get_the_title());
    } elseif (is_home()) {
        echo ' / Hemp Authority Guides';
    } else {
        echo ' / ' . esc_html(wp_get_document_title());
    }

    echo '</nav>';
}

function hsa_archive_description() {
    if (is_tax()) {
        $term = get_queried_object();
        if ($term instanceof WP_Term && !empty($term->description)) {
            return $term->description;
        }
    }

    if (is_post_type_archive()) {
        $obj = get_queried_object();
        if ($obj && !empty($obj->description)) {
            return $obj->description;
        }
    }

    if (is_home()) {
        return 'Published authority content, comparisons, law pages, and buyer-safety guides all roll up here once scheduled content goes live.';
    }

    return 'Use this archive to move into related categories, state pages, buyer guides, and COA-backed research paths.';
}

function hsa_loop_excerpt($post = null, $words = 28) {
    $post = $post ?: get_post();
    if (!($post instanceof WP_Post)) {
        return '';
    }

    $source = $post->post_excerpt ? $post->post_excerpt : wp_strip_all_tags($post->post_content);

    return wp_trim_words($source, $words);
}

function hsa_featured_guides($limit = 6) {
    $items = [];
    $query = new WP_Query([
        'post_type' => 'post',
        'post_status' => 'publish',
        'posts_per_page' => $limit,
        'ignore_sticky_posts' => true,
    ]);

    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $items[] = [
                'title' => get_the_title(),
                'url' => get_permalink(),
                'body' => hsa_loop_excerpt(get_post(), 24),
                'eyebrow' => 'Published guide',
            ];
        }
        wp_reset_postdata();

        return $items;
    }

    $fallback_slugs = [
        'how-to-read-a-hemp-coa',
        'cbd-vs-cbg-vs-thca',
        'hemp-laws-by-state',
        'best-thca-flower-brands',
        'best-hemp-thc-drinks',
        'cbn-gummies-for-sleep',
    ];

    foreach ($fallback_slugs as $slug) {
        $page = get_page_by_path($slug, OBJECT, 'page');
        if (!$page) {
            continue;
        }

        $items[] = [
            'title' => get_the_title($page),
            'url' => get_permalink($page),
            'body' => hsa_loop_excerpt($page, 24),
            'eyebrow' => 'Evergreen page',
        ];
    }

    return array_slice($items, 0, $limit);
}

function hsa_glossary_spotlight($limit = 4) {
    return get_posts([
        'post_type' => 'hse_glossary',
        'post_status' => 'publish',
        'numberposts' => $limit,
        'orderby' => 'date',
        'order' => 'DESC',
    ]);
}

function hsa_render_card_grid($items, $class = 'feature-grid') {
    echo '<div class="' . esc_attr($class) . '">';
    foreach ($items as $item) {
        echo '<article class="content-card content-card--mini">';
        if (!empty($item['eyebrow'])) {
            echo '<p class="hsa-eyebrow">' . esc_html($item['eyebrow']) . '</p>';
        }
        echo '<h3><a href="' . esc_url($item['url']) . '">' . esc_html($item['title']) . '</a></h3>';
        echo '<p>' . esc_html($item['body']) . '</p>';
        echo '<a class="text-link" href="' . esc_url($item['url']) . '">Open research path</a>';
        echo '</article>';
    }
    echo '</div>';
}

function hsa_no_products_panel() {
    echo '<section class="content-card content-card--notice">';
    echo '<p class="hsa-eyebrow">Verified listings pending</p>';
    echo '<h2>This category is ready for vetted product listings</h2>';
    echo '<p>Use this page for category research, COA education, state-law navigation, and related buyer guides while verified product details are reviewed.</p>';
    hsa_render_archive_quick_nav();
    echo '<details class="archive-research-library"><summary><span>Open the full research library</span><small>Internal links, FAQs, trust notes, and buyer-safety paths</small></summary><div class="archive-research-library__body">';
    echo hsa_shortcode('[hse_archive_sections]');
    echo '</div></details>';
    echo '</section>';
}

function hsa_taxonomy_intro_panel() {
    if (!is_product_category() && !is_product_tag() && !is_shop()) {
        return;
    }

    $title = function_exists('woocommerce_page_title') ? woocommerce_page_title(false) : wp_get_document_title();
    $context = hsa_archive_context();

    echo '<section class="archive-hero archive-hero--commerce">';
    echo '<div class="archive-hero__grid">';
    echo '<div class="archive-hero__copy">';
    echo '<p class="hsa-eyebrow">Hemp category hub</p>';
    echo '<h1 class="entry-title">' . esc_html($title) . '</h1>';
    echo '<p class="lead-text">' . esc_html(hsa_archive_description()) . '</p>';
    echo '<div class="archive-hero__actions">';
    echo '<a class="btn" href="#archive-products">Jump to listings</a>';
    echo '<a class="btn secondary" href="' . esc_url(home_url('/how-to-read-a-hemp-coa/')) . '">COA checklist</a>';
    echo '</div>';
    echo '</div>';
    echo '<aside class="archive-briefing" aria-label="Category briefing">';
    echo '<p class="hsa-strip-label">Buyer briefing</p>';
    echo '<h2>' . esc_html($context['count'] > 0 ? 'Product shelf is live' : 'Research-first category') . '</h2>';
    echo '<ul>';
    foreach (hsa_archive_briefing_points() as $point) {
        echo '<li>' . esc_html($point) . '</li>';
    }
    echo '</ul>';
    echo '<p>Use the catalog first, then expand into legal, COA, wholesale, and glossary paths only when helpful.</p>';
    echo '</aside>';
    echo '</div>';
    hsa_render_archive_quick_nav();
    echo '</section>';
}
add_action('woocommerce_before_shop_loop', 'hsa_taxonomy_intro_panel', 5);

function hsa_taxonomy_after_loop() {
    if (!is_product_category() && !is_product_tag() && !is_shop()) {
        return;
    }

    echo '<section class="archive-research-panel">';
    echo '<p class="hsa-eyebrow">Continue the research</p>';
    echo '<h2>Research support, without burying the catalog</h2>';
    echo '<p>Use these supporting resources after the product grid to compare COAs, state rules, related guides, and wholesale paths.</p>';
    echo '<div class="archive-research-panel__grid">';
    echo '<div class="archive-research-panel__column">';
    echo hsa_shortcode('[hse_trust_box compact="yes"]');
    echo hsa_shortcode('[hse_cta]');
    echo '</div>';
    echo '<div class="archive-research-panel__column">';
    echo hsa_shortcode('[hse_related_posts]');
    echo '</div>';
    echo '</div>';
    echo hsa_shortcode('[hse_internal_links]');
    echo hsa_shortcode('[hse_faq]');
    echo '</section>';
}
add_action('woocommerce_after_shop_loop', 'hsa_taxonomy_after_loop', 15);

function hsa_woo_toolbar_open() {
    if (!is_product_category() && !is_product_tag() && !is_shop()) {
        return;
    }

    echo '<div class="hsa-woo-toolbar">';
}
add_action('woocommerce_before_shop_loop', 'hsa_woo_toolbar_open', 18);

function hsa_woo_toolbar_close() {
    if (!is_product_category() && !is_product_tag() && !is_shop()) {
        return;
    }

    echo '</div>';
}
add_action('woocommerce_before_shop_loop', 'hsa_woo_toolbar_close', 35);

function hsa_product_card_badge() {
    echo '<div class="hsa-product-card__badge">COA + state checks recommended</div>';
}
add_action('woocommerce_after_shop_loop_item_title', 'hsa_product_card_badge', 12);

function hsa_product_card_links() {
    echo '<div class="hsa-product-card__links"><a href="' . esc_url(home_url('/how-to-read-a-hemp-coa/')) . '">COA guide</a><a href="' . esc_url(home_url('/hemp-laws-by-state/')) . '">State laws</a></div>';
}
add_action('woocommerce_after_shop_loop_item', 'hsa_product_card_links', 12);

function hsa_replace_no_products_found() {
    remove_action('woocommerce_no_products_found', 'wc_no_products_found');
    add_action('woocommerce_no_products_found', 'hsa_no_products_panel');
}
add_action('wp', 'hsa_replace_no_products_found');

function hsa_product_summary_decision_strip() {
    $law_path = has_term('thca-flower', 'product_cat') || has_term('thca-flower-tag', 'product_tag')
        ? '/thca-flower-legal-states/'
        : '/hemp-laws-by-state/';

    $items = [
        [
            'label' => 'COA',
            'title' => 'Read lab checklist',
            'url' => '/how-to-read-a-hemp-coa/',
        ],
        [
            'label' => 'Law',
            'title' => 'Check state rules',
            'url' => $law_path,
        ],
        [
            'label' => 'Bulk',
            'title' => 'Wholesale path',
            'url' => '/wholesale-thca-flower/',
        ],
    ];

    echo '<section class="product-decision-strip" aria-label="Product trust shortcuts">';
    foreach ($items as $item) {
        echo '<a href="' . esc_url(home_url($item['url'])) . '">';
        echo '<span>' . esc_html($item['label']) . '</span>';
        echo '<strong>' . esc_html($item['title']) . '</strong>';
        echo '</a>';
    }
    echo '</section>';
}
add_action('woocommerce_single_product_summary', 'hsa_product_summary_decision_strip', 32);

function hsa_product_research_panel() {
    echo '<section class="product-seo-panel">';
    echo '<p class="hsa-eyebrow">Post-description trust checks</p>';
    echo '<h2>Verify the product before relying on product claims</h2>';
    echo '<p>After the product description, use this compliance snapshot to review COA status, state restrictions, category context, and supplier notes.</p>';
    echo hsa_shortcode('[hse_product_compliance]');
    echo '<details class="archive-research-library archive-research-library--product"><summary><span>Open product research links</span><small>Related categories, guides, state pages, and glossary terms</small></summary><div class="archive-research-library__body">';
    echo hsa_shortcode('[hse_internal_links]');
    echo '</div></details>';
    echo '</section>';
}
add_action('woocommerce_after_single_product_summary', 'hsa_product_research_panel', 11);

function hsa_related_category_panel() {
    echo '<section class="product-seo-panel">';
    echo '<p class="hsa-eyebrow">Category support</p>';
    echo '<h2>Continue researching this hemp category</h2>';
    echo '<p>Use related categories, tags, state pages, COA education, and wholesale research to keep buyers moving through the right cluster.</p>';
    echo hsa_shortcode('[hse_category_grid limit="6"]');
    echo '<details class="archive-research-library archive-research-library--product"><summary><span>Open supporting research library</span><small>Full internal-link graph, FAQs, and CTA paths</small></summary><div class="archive-research-library__body">';
    echo hsa_shortcode('[hse_archive_sections]');
    echo '</div></details>';
    echo '</section>';
}
add_action('woocommerce_after_single_product_summary', 'hsa_related_category_panel', 12);

/* ==========================================================================
   v0.4 â€” BHFNM Marketplace cross-linking
   The education hub is the SEO authority; the marketplace is the commerce
   layer. These helpers route intent-matched visitors into /marketplace.
   ========================================================================== */

/**
 * Map WooCommerce category / page context to the matching marketplace category.
 */
function hsa_marketplace_target() {
    $map = [
        'hemp-flower'      => '/marketplace/categories/hemp-flower',
        'thca-flower'      => '/marketplace/categories/thca-flower',
        'cbd-flower'       => '/marketplace/categories/cbd-flower',
        'cbg-flower'       => '/marketplace/categories/cbg-flower',
        'hemp-pre-rolls'   => '/marketplace/categories/pre-rolls',
        'hemp-drinks'      => '/marketplace/categories/thc-drinks',
        'hemp-gummies'     => '/marketplace/categories/gummies',
        'hemp-accessories' => '/marketplace/categories/accessories',
    ];

    if (function_exists('is_product_category')) {
        foreach ($map as $slug => $path) {
            if (is_product_category($slug)) {
                return home_url($path);
            }
        }
    }
    if (is_page() || is_single()) {
        $wp_slug = get_post_field('post_name', get_queried_object_id());
        foreach ($map as $slug => $path) {
            if ($wp_slug && strpos($wp_slug, $slug) !== false) {
                return home_url($path);
            }
        }
        if ($wp_slug && strpos($wp_slug, 'wholesale') !== false) {
            return home_url('/marketplace/categories/wholesale');
        }
    }
    return HSA_MARKETPLACE_URL;
}

/**
 * Marketplace CTA band â€” rendered above the footer on public pages.
 * Deep-links into the matching marketplace category where one exists.
 */
function hsa_render_marketplace_band() {
    if (is_admin() || is_cart() || is_checkout() || is_account_page()) {
        return;
    }
    $target = hsa_marketplace_target();
    ?>
    <div class="wrap">
        <aside class="hsa-marketplace-band" aria-label="BHFNM Marketplace">
            <div class="hsa-marketplace-band__copy">
                <p class="hsa-eyebrow">BHFNM Marketplace</p>
                <h2>Buy from identity-verified sellers</h2>
                <p>Every marketplace listing carries an admin-verified, batch-linked COA, ships with tracked labels, and checks out with Bitcoin or Lightning.</p>
            </div>
            <div class="hsa-marketplace-band__actions">
                <a class="header-cta--marketplace" href="<?php echo esc_url($target); ?>">Shop the Marketplace</a>
                <a class="hsa-marketplace-band__secondary" href="<?php echo esc_url(home_url('/marketplace/vendors/apply')); ?>">Apply to sell</a>
            </div>
        </aside>
    </div>
    <?php
}

/** Safe fallbacks when WooCommerce conditionals are unavailable. */
if (!function_exists('is_cart')) { function is_cart() { return false; } }
if (!function_exists('is_checkout')) { function is_checkout() { return false; } }
if (!function_exists('is_account_page')) { function is_account_page() { return false; } }

/* ==========================================================================
   v0.4.1 — light default + dark mode toggle (shared with the marketplace:
   localStorage key "bhfnm-theme"; dark loads assets/dark.css on top).
   ========================================================================== */

function hsa_theme_mode_head() {
    $dark_css = esc_url(get_template_directory_uri() . '/assets/dark.css') . '?ver=' . HSA_VERSION;
    ?>
<script>
(function () {
    var DARK_HREF = <?php echo wp_json_encode($dark_css); ?>;
    function setDark(on) {
        var existing = document.getElementById('hsa-dark-css');
        if (on) {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (!existing) {
                var l = document.createElement('link');
                l.id = 'hsa-dark-css';
                l.rel = 'stylesheet';
                l.href = DARK_HREF;
                document.head.appendChild(l);
            }
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            if (existing) { existing.parentNode.removeChild(existing); }
        }
    }
    window.hsaSetDark = setDark;
    window.hsaToggleTheme = function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        setDark(!dark);
        try { localStorage.setItem('bhfnm-theme', dark ? 'light' : 'dark'); } catch (e) {}
    };
    try {
        if (localStorage.getItem('bhfnm-theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            // Blocking write so dark paints first — no light flash.
            document.write('<link rel="stylesheet" id="hsa-dark-css" href="' + DARK_HREF + '">');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    } catch (e) {}
}());
</script>
    <?php
}
add_action('wp_head', 'hsa_theme_mode_head', 0);

function hsa_render_theme_toggle() {
    ?>
    <button type="button" class="hsa-theme-toggle" onclick="hsaToggleTheme()" aria-label="Toggle dark mode" title="Toggle dark mode">
        <span class="hsa-theme-toggle__moon" aria-hidden="true">&#9789;</span>
        <span class="hsa-theme-toggle__sun" aria-hidden="true">&#9728;</span>
    </button>
    <?php
}
