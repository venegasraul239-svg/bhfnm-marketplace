<?php if (!defined('ABSPATH')) { exit; } ?>
<?php
$primary_links = hsa_seed_menu_pages();
$trending_links = hsa_trending_paths();
$nav_groups = hsa_navigation_groups();
?>
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
<div class="site-topbar">
    <div class="wrap site-topbar__inner">
        <div class="site-topbar__message">
            <span class="site-topbar__badge">COA-first hemp discovery</span>
            <p>State-aware hemp flower, THCA, CBD, CBG, drinks, law, and wholesale research.</p>
        </div>
        <div class="site-topbar__utility">
            <a href="<?php echo esc_url(home_url('/hemp-laws-by-state/')); ?>">State laws</a>
            <a href="<?php echo esc_url(home_url('/how-to-read-a-hemp-coa/')); ?>">COA guide</a>
            <a href="<?php echo esc_url(home_url('/wholesale-hemp-flower/')); ?>">Wholesale</a>
            <a href="<?php echo esc_url(home_url('/product-category/hemp-accessories/')); ?>">Accessories</a>
            <a href="<?php echo esc_url(hsa_cart_url()); ?>">Cart</a>
            <a href="<?php echo esc_url(hsa_account_url()); ?>">Account</a>
        </div>
    </div>
</div>

<header class="site-header">
    <div class="wrap header-inner">
        <div class="brand-block">
            <a class="brand-mark" href="<?php echo esc_url(home_url('/')); ?>" aria-label="<?php echo esc_attr(get_bloginfo('name')); ?>">
                <span>B</span>
            </a>
            <div class="brand-copy">
                <a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a>
                <p class="tagline">Find hemp categories, state guides, lab-testing help, and wholesale paths.</p>
            </div>
        </div>

        <form class="site-search" role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>" data-hsa-search>
            <label class="screen-reader-text" for="hsa-site-search">Search hemp products, categories, tags, and guides</label>
            <div class="site-search__bar">
                <span class="site-search__scope">All</span>
                <input id="hsa-site-search" type="search" name="s" autocomplete="off" placeholder="Search flower, THCA, COA, state laws, wholesale..." data-hsa-search-input>
                <button type="submit" aria-label="Search site">
                    <span aria-hidden="true">Search</span>
                </button>
            </div>
            <div class="site-search__panel" data-hsa-search-panel hidden>
                <div class="site-search__status" data-hsa-search-status>Start typing to preview products, categories, tags, and guides.</div>
                <div class="site-search__results" data-hsa-search-results></div>
            </div>
        </form>

        <div class="header-actions">
            <?php hsa_render_header_actions(); ?>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav-panel" data-nav-toggle>
                <span></span>
                <span></span>
                <span></span>
                <span class="screen-reader-text">Open navigation</span>
            </button>
        </div>
    </div>

    <div class="site-subnav">
        <div class="wrap site-subnav__inner">
            <?php hsa_render_mega_menu(); ?>
            <div class="site-subnav__links" aria-label="Popular hemp paths">
                <?php foreach ($trending_links as $label => $path) : ?>
                    <a href="<?php echo esc_url(home_url($path)); ?>"><?php echo esc_html($label); ?></a>
                <?php endforeach; ?>
            </div>
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

        <div class="mobile-nav__lede">
            <p>Explore hemp flower, THCA, CBD, CBG, hemp drinks, COA guidance, state laws, and wholesale research.</p>
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
            <a class="header-cta" href="<?php echo esc_url(home_url('/hemp-laws-by-state/')); ?>">Open state law hub</a>
        </div>
    </div>
</div>
