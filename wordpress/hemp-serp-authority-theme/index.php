<?php get_header(); ?>
<main class="content-area">
    <?php if (have_posts()) : ?>
        <div class="post-list post-list--stack">
            <?php while (have_posts()) : the_post(); ?>
                <article class="content-card content-card--mini">
                    <p class="hsa-eyebrow">Research post</p>
                    <h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
                    <p><?php echo esc_html(hsa_loop_excerpt(get_post(), 30)); ?></p>
                    <a class="text-link" href="<?php the_permalink(); ?>">Read guide</a>
                </article>
            <?php endwhile; ?>
        </div>
        <?php the_posts_pagination(); ?>
    <?php else : ?>
        <section class="content-card content-card--notice">
            <p class="hsa-eyebrow">No published posts yet</p>
            <h1 class="entry-title">The content pipeline is still warming up</h1>
            <p>The site already has evergreen pages, law hubs, glossary terms, categories, and a scheduled authority queue. Published posts will start filling this area as the schedule progresses.</p>
            <?php hsa_render_next_step_runway('Evergreen paths', hsa_trending_paths()); ?>
            <?php hsa_render_research_drawer('Open full internal-link support', 'The full link graph stays available without dominating the empty-state message.', '[hse_internal_links]'); ?>
        </section>
    <?php endif; ?>
</main>
<?php get_footer(); ?>
