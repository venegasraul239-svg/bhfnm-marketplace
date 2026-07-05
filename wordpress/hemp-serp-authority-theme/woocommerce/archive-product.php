<?php defined('ABSPATH') || exit; get_header('shop'); ?>
<main class="content-area content-area--shop">
    <?php if (woocommerce_product_loop()) : ?>
        <?php do_action('woocommerce_before_shop_loop'); ?>
        <?php $hsa_loop_total = (int) wc_get_loop_prop('total'); ?>
        <section id="archive-products" class="archive-product-stage" aria-label="<?php esc_attr_e('Product listings', 'hemp-serp-authority'); ?>">
            <div class="archive-product-stage__header">
                <div>
                    <p class="hsa-eyebrow"><?php esc_html_e('Catalog shelf', 'hemp-serp-authority'); ?></p>
                    <h2><?php echo esc_html($hsa_loop_total ? sprintf(_n('%d available listing', '%d available listings', $hsa_loop_total, 'hemp-serp-authority'), $hsa_loop_total) : __('Verified listings pending', 'hemp-serp-authority')); ?></h2>
                    <p><?php esc_html_e('Browse current products first. Use COA, law, and guide links as supporting research instead of wading through giant internal-link lists.', 'hemp-serp-authority'); ?></p>
                </div>
                <a class="archive-product-stage__guide" href="<?php echo esc_url(home_url('/how-to-read-a-hemp-coa/')); ?>"><?php esc_html_e('COA checklist', 'hemp-serp-authority'); ?></a>
            </div>
            <?php woocommerce_product_loop_start(); ?>
            <?php if ($hsa_loop_total) : ?>
                <?php while (have_posts()) : the_post(); ?>
                    <?php do_action('woocommerce_shop_loop'); ?>
                    <?php wc_get_template_part('content', 'product'); ?>
                <?php endwhile; ?>
            <?php endif; ?>
            <?php woocommerce_product_loop_end(); ?>
        </section>
        <?php do_action('woocommerce_after_shop_loop'); ?>
    <?php else : ?>
        <?php do_action('woocommerce_no_products_found'); ?>
    <?php endif; ?>
</main>
<?php get_footer('shop'); ?>
