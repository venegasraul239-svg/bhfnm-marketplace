<?php if (!defined('ABSPATH')) { exit; } ?>
<?php $nav_groups = hsa_navigation_groups(); ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<span id="top" class="screen-reader-text">Top</span>

<header class="site-header site-header--app">
    <div class="wrap appbar">
        <a class="appbar__brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="<?php echo esc_attr(get_bloginfo('name')); ?>">
            <span class="appbar__mark">B</span>
            <span class="appbar__brandcopy">
                <strong><?php bloginfo('name'); ?></strong>
                <small>COA-first hemp discovery</small>
            </span>
        </a>

        <nav class="appbar__nav" aria-label="Primary">
            <a href="<?php echo esc_url(home_url('/product-category/hemp-flower/')); ?>">Hemp Flower</a>
            <a href="<?php echo esc_url(home_url('/product-category/thca-flower/')); ?>">THCA</a>
            <a href="<?php echo esc_url(home_url('/product-category/cbd-flower/')); ?>">CBD</a>
            <a href="<?php echo esc_url(home_url('/hemp-laws-by-state/')); ?>">State Laws</a>
            <a href="<?php echo esc_url(home_url('/how-to-read-a-hemp-coa/')); ?>">COA Guide</a>
            <a href="<?php echo esc_url(home_url('/wholesale-hemp-flower/')); ?>">Wholesale</a>
        </nav>

        <form class="site-search site-search--app" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>" data-hsa-search>
            <label class="screen-reader-text" for="hsa-site-search">Search hemp products, categories, tags, and guides</label>
            <div class="site-search__bar">
                <input id="hsa-site-search" type="search" name="s" autocomplete="off" placeholder="Search flower, THCA, state laws…" data-hsa-search-input>
                <button type="submit" aria-label="Search site">Search</button>
            </div>
            <div class="site-search__panel" data-hsa-search-panel hidden>
                <div class="site-search__status" data-hsa-search-status>Start typing to preview products, categories, tags, and guides.</div>
                <div class="site-search__results" data-hsa-search-results></div>
            </div>
        </form>

        <div class="appbar__actions">
            <a class="header-cta--marketplace" href="<?php echo esc_url(home_url('/marketplace')); ?>">Shop the Marketplace</a>
            <?php hsa_render_theme_toggle(); ?>
            <a class="appbar__icon" href="<?php echo esc_url(hsa_account_url()); ?>" aria-label="Account" title="Account">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </a>
            <a class="appbar__icon" href="<?php echo esc_url(hsa_cart_url()); ?>" aria-label="Cart" title="Cart">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </a>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav-panel" data-nav-toggle>
                <span></span><span></span><span></span>
                <span class="screen-reader-text">Open navigation</span>
            </button>
        </div>
    </div>

    <div class="site-trustbar">
        <div class="wrap site-trustbar__inner">
            <span>✓ COA-first research</span>
            <span>✓ State-aware guidance</span>
            <span>✓ Verified partner pathways</span>
            <span class="site-trustbar__btc">₿ Bitcoin checkout on the marketplace</span>
            <a class="site-trustbar__link" href="<?php echo esc_url(home_url('/marketplace')); ?>">Browse verified listings →</a>
        </div>
    </div>
</header>

<div class="mobile-nav" id="mobile-nav-panel" hidden>
    <button class="mobile-nav__backdrop" type="button" aria-label="Close navigation" data-nav-close></button>
    <div class="mobile-nav__sheet">
        <div class="mobile-nav__top">
            <div>
                <p class="hsa-eyebrow">Browse menu</p>
                <strong><?php bloginfo('name'); ?></strong>
            </div>
            <button class="mobile-nav__close" type="button" data-nav-close>Close</button>
        </div>

        <?php hsa_render_mobile_quick_actions(); ?>

        <div class="mobile-nav__groups">
            <?php foreach ($nav_groups as $group_label => $links) : ?>
                <section class="mobile-nav__group">
                    <h2><?php echo esc_html($group_label); ?></h2>
                    <?php hsa_render_simple_link_list($links, 'mobile-nav__list'); ?>
                </section>
            <?php endforeach; ?>
        </div>

        <div class="mobile-nav__footer">
            <a class="header-cta--marketplace" href="<?php echo esc_url(home_url('/marketplace')); ?>">Shop the Marketplace</a>
            <a class="header-cta" href="<?php echo esc_url(home_url('/hemp-laws-by-state/')); ?>">Open state law hub</a>
        </div>
    </div>
</div>
