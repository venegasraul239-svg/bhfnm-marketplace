<?php get_header(); ?>
<main class="content-area content-area--wide">
    <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
        <div class="page-layout">
            <article class="content-card content-card--hero-inline">
                <?php hsa_render_breadcrumbs('Authority Guide'); ?>
                <p class="hsa-eyebrow"><?php echo esc_html(hsa_post_type_label()); ?></p>
                <h1 class="entry-title"><?php the_title(); ?></h1>
                <?php if (has_excerpt()) : ?>
                    <p class="lead-text"><?php echo esc_html(get_the_excerpt()); ?></p>
                <?php endif; ?>
                <?php hsa_trust_row(); ?>
                <?php hsa_render_research_snapshot('post'); ?>
                <div class="entry-content">
                    <?php the_content(); ?>
                </div>
                <?php echo hsa_shortcode('[hse_related_posts]'); ?>
            </article>
            <?php hsa_render_page_rail('post'); ?>
        </div>
    <?php endwhile; endif; ?>
</main>
<?php get_footer(); ?>
