<?php get_header(); ?>
<?php $is_woo_flow = function_exists('is_cart') && (is_cart() || is_checkout() || is_account_page()); ?>
<main class="<?php echo esc_attr($is_woo_flow ? 'content-area content-area--shop content-area--commerce' : 'content-area content-area--wide'); ?>">
    <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
        <?php if (!$is_woo_flow) : ?>
            <div class="page-layout">
        <?php endif; ?>

        <article class="content-card content-card--hero-inline <?php echo esc_attr($is_woo_flow ? 'content-card--commerce-page' : ''); ?>">
            <?php hsa_render_breadcrumbs($is_woo_flow ? 'Commerce Page' : 'Research Page'); ?>
            <p class="hsa-eyebrow"><?php echo esc_html($is_woo_flow ? 'Secure commerce area' : 'Hemp research guide'); ?></p>
            <h1 class="entry-title"><?php the_title(); ?></h1>
            <?php if (has_excerpt()) : ?>
                <p class="lead-text"><?php echo esc_html(get_the_excerpt()); ?></p>
            <?php elseif ($is_woo_flow) : ?>
                <p class="lead-text">Review cart, account, and checkout details with COA, shipping, and state-restriction checks close by.</p>
            <?php endif; ?>
            <?php hsa_trust_row(); ?>
            <?php if (!$is_woo_flow) : ?>
                <?php hsa_render_research_snapshot('page'); ?>
            <?php endif; ?>
            <div class="entry-content">
                <?php the_content(); ?>
            </div>
            <?php
            hsa_render_next_step_runway(
                $is_woo_flow ? 'Commerce support paths' : 'Buyer research paths:',
                $is_woo_flow ? [
                    'Shop THCA Flower' => '/product-category/thca-flower/',
                    'Shop Hemp Flower' => '/product-category/hemp-flower/',
                    'COA Guide' => '/how-to-read-a-hemp-coa/',
                    'State Laws' => '/hemp-laws-by-state/',
                    'Wholesale' => '/wholesale-hemp-flower/',
                ] : null
            );
            ?>
        </article>

        <?php if (!$is_woo_flow) : ?>
                <?php hsa_render_page_rail('page'); ?>
            </div>
        <?php endif; ?>
    <?php endwhile; endif; ?>
</main>
<?php get_footer(); ?>
