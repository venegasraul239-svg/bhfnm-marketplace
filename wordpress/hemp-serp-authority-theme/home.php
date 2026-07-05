<?php get_header(); ?>
<main class="content-area">
    <article class="content-card content-card--hero-inline">
        <?php hsa_render_breadcrumbs('Authority Guides'); ?>
        <p class="hsa-eyebrow">Blog hub</p>
        <h1 class="entry-title"><?php echo esc_html(get_the_title(get_option('page_for_posts')) ?: 'Hemp Authority Guides'); ?></h1>
        <p class="lead-text"><?php echo esc_html(hsa_archive_description()); ?></p>
        <?php hsa_trust_row(); ?>
        <?php echo hsa_shortcode('[hse_trust_box compact="yes"]'); ?>
        <?php hsa_render_next_step_runway('Authority guide paths', hsa_trending_paths()); ?>
        <?php echo hsa_shortcode('[hse_cta]'); ?>
    </article>

    <?php if (have_posts()) : ?>
        <div class="post-list post-list--stack">
            <?php while (have_posts()) : the_post(); ?>
                <article class="content-card content-card--mini">
                    <p class="hsa-eyebrow">Published guide</p>
                    <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
                    <p><?php echo esc_html(hsa_loop_excerpt(get_post(), 28)); ?></p>
                    <a class="text-link" href="<?php the_permalink(); ?>">Open guide</a>
                </article>
            <?php endwhile; ?>
        </div>
        <?php the_posts_pagination(); ?>
        <?php hsa_render_research_drawer('Open the authority internal-link map', 'Use the full SEO support library after the guide list.', '[hse_internal_links]'); ?>
    <?php else : ?>
        <section class="content-card content-card--notice">
            <p class="hsa-eyebrow">Scheduled queue in place</p>
            <h2>Published authority posts will appear here automatically</h2>
            <p>The queue is already seeded. Until the first scheduled posts publish, this hub still supports internal linking and buyer navigation into evergreen money pages.</p>
            <?php hsa_render_card_grid(hsa_featured_guides(), 'post-list'); ?>
            <?php echo hsa_shortcode('[hse_faq]'); ?>
        </section>
    <?php endif; ?>
</main>
<?php get_footer(); ?>
