<?php if (!defined('ABSPATH')) { exit; } ?>
<?php $footer_groups = hsa_footer_navigation_groups(); ?>
<footer class="site-footer">
    <a class="footer-back-top" href="#top">Back to top</a>
    <div class="wrap footer-shell">
        <section class="footer-hero">
            <div class="footer-hero__copy">
                <p class="hsa-eyebrow">Hemp research marketplace</p>
                <h2>Browse by product type, state law, COA trust signals, and wholesale intent.</h2>
                <p>Use these paths to compare hemp flower, THCA, CBD, CBG, hemp-derived THC drinks, CBN sleep products, and supplier verification topics with clear availability caveats.</p>
            </div>
            <div class="footer-hero__actions">
                <a class="header-cta" href="<?php echo esc_url(home_url('/product-category/thca-flower/')); ?>">Shop THCA flower</a>
                <a class="header-chip footer-hero__chip" href="<?php echo esc_url(hsa_cart_url()); ?>">View cart</a>
                <a class="header-chip footer-hero__chip" href="<?php echo esc_url(home_url('/hemp-laws-by-state/')); ?>">Check state laws</a>
            </div>
        </section>

        <div class="footer-grid footer-grid--rich">
            <section class="footer-card footer-card--brand">
                <p class="hsa-eyebrow">Buy Hemp Flower Near Me</p>
                <strong><?php bloginfo('name'); ?></strong>
                <p>A search-first hemp discovery site for category research, COA education, state-aware buying guidance, and verified partner pathways as the catalog grows.</p>
                <div class="footer-pills">
                    <a href="<?php echo esc_url(home_url('/product-category/hemp-flower/')); ?>">Flower archive</a>
                    <a href="<?php echo esc_url(home_url('/product-tag/coa-verified/')); ?>">COA verified</a>
                    <a href="<?php echo esc_url(home_url('/hemp-authority-guides/')); ?>">Guides</a>
                </div>
            </section>

            <?php foreach ($footer_groups as $group_label => $links) : ?>
                <section class="footer-card">
                    <p class="hsa-eyebrow"><?php echo esc_html($group_label); ?></p>
                    <?php hsa_render_simple_link_list($links, 'footer-link-list'); ?>
                </section>
            <?php endforeach; ?>
        </div>

        <div class="footer-market">
            <section>
                <h2>Need a faster path?</h2>
                <p>Start with COA-backed research, then narrow by product format, cannabinoid, state rules, or wholesale supplier questions.</p>
            </section>
            <div class="footer-market__links">
                <?php foreach (hsa_trending_paths() as $label => $path) : ?>
                    <a href="<?php echo esc_url(home_url($path)); ?>"><?php echo esc_html($label); ?></a>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="footer-bottom">
            <p>State rules can change. This site provides hemp product discovery, supplier research, COA education, and state-aware buying guidance. It is not legal advice and does not claim physical store inventory unless a verified supplier is added.</p>
            <div class="footer-bottom__links">
                <a href="<?php echo esc_url(hsa_account_url()); ?>">Account</a>
                <a href="<?php echo esc_url(hsa_cart_url()); ?>">Cart</a>
                <a href="<?php echo esc_url(home_url('/cbd-vs-cbg-vs-thca/')); ?>">Compare cannabinoids</a>
                <a href="<?php echo esc_url(home_url('/how-to-read-a-hemp-coa/')); ?>">COA guide</a>
                <a href="<?php echo esc_url(home_url('/wholesale-hemp-flower/')); ?>">Wholesale</a>
            </div>
        </div>
    </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
