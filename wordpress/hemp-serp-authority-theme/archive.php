<?php get_header(); ?>
<main class="content-area">
    <article class="content-card content-card--hero-inline">
        <?php hsa_render_breadcrumbs('Archive'); ?>
        <p class="hsa-eyebrow">Archive hub</p>
        <h1 class="entry-title"><?php the_archive_title(); ?></h1>
        <p class="lead-text"><?php echo esc_html(hsa_archive_description()); ?></p>
        <?php hsa_trust_row(); ?>
        <?php hsa_render_next_step_runway('Popular buyer paths', hsa_trending_paths()); ?>
        <?php echo hsa_shortcode('[hse_cta]'); ?>
    </article>

    <?php if (have_posts()) : ?>
        <div class="post-list post-list--stack">
            <?php while (have_posts()) : the_post(); ?>
                <article class="content-card content-card--mini">
                    <p class="hsa-eyebrow"><?php echo esc_html(hsa_post_type_label()); ?></p>
                    <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
                    <p><?php echo esc_html(hsa_loop_excerpt(get_post(), 28)); ?></p>
                    <a class="text-link" href="<?php the_permalink(); ?>">Open entry</a>
                </article>
            <?php endwhile; ?>
        </div>
        <?php the_posts_pagination(); ?>
        <?php hsa_render_research_drawer('Open archive research support', 'Full internal links, FAQs, trust notes, and buyer-safety paths stay available after the entries.', '[hse_archive_sections]'); ?>
    <?php else : ?>
        <section class="content-card content-card--notice">
            <p class="hsa-eyebrow">Nothing published yet</p>
            <h2>This section is ready for future research entries</h2>
            <p>Use the links below to keep browsing related categories, state pages, COA guidance, and buyer education.</p>
            <?php echo hsa_shortcode('[hse_archive_sections]'); ?>
        </section>
    <?php endif; ?>
</main>
<?php get_footer(); ?>
