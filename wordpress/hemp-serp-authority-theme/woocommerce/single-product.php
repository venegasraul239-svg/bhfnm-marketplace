<?php defined('ABSPATH') || exit; get_header('shop'); ?>
<main class="content-area content-area--shop">
    <?php while (have_posts()) : the_post(); ?>
        <?php wc_get_template_part('content', 'single-product'); ?>
    <?php endwhile; ?>
</main>
<?php get_footer('shop'); ?>
