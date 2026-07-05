<?php get_header(); ?>
<?php $nav_groups = hsa_navigation_groups(); ?>
<main class="hsa-home">
    <section class="hero">
        <div class="wrap hero-grid">
            <div>
                <p class="hsa-eyebrow">Hemp discovery and buyer research</p>
                <h1>Find hemp flower, THCA, CBD, CBG, THC drinks, wholesale options, and state law guidance.</h1>
                <p class="lead-text">Compare hemp categories, cannabinoid guides, COA checklists, state pages, and wholesale research before choosing where to buy or what to ask a supplier.</p>
                <div class="hero-chip-row">
                    <a href="<?php echo esc_url(home_url('/product-category/hemp-flower/')); ?>">Browse flower</a>
                    <a href="<?php echo esc_url(home_url('/product-tag/coa-verified/')); ?>">COA verified picks</a>
                    <a href="<?php echo esc_url(home_url('/hemp-laws/texas/')); ?>">Texas hemp laws</a>
                    <a href="<?php echo esc_url(home_url('/wholesale-thca-flower/')); ?>">Wholesale THCA</a>
                </div>
                <div class="hero-actions">
                    <a class="btn" href="<?php echo esc_url(home_url('/hemp-flower-near-me/')); ?>">Browse hemp flower</a>
                    <a class="btn secondary" href="<?php echo esc_url(home_url('/thca-flower-near-me/')); ?>">Explore THCA guidance</a>
                </div>
                <?php hsa_trust_row(); ?>
            </div>
            <aside class="hero-panel">
                <p class="hsa-eyebrow">What to compare</p>
                <h2>Categories, laws, COAs, and supplier questions in one place.</h2>
                <ul>
                    <li>Hemp flower, CBD flower, CBG flower, THCA, drinks, and CBN sleep categories.</li>
                    <li>State-aware pages for shipping, legality, and near-me search guidance.</li>
                    <li>COA, glossary, and buyer-safety content written for quick answers.</li>
                    <li>Wholesale and supplier-verification pathways for serious buyers.</li>
                </ul>
                <?php echo hsa_shortcode('[hse_cta]'); ?>
            </aside>
        </div>
    </section>

    <section class="section">
        <div class="wrap">
            <?php hsa_section_header('Core paths', 'Start with the product or question you came here to answer', 'Move from broad hemp discovery into specific category, law, COA, comparison, and wholesale pages.'); ?>
            <?php hsa_render_card_grid(hsa_core_cards()); ?>
        </div>
    </section>

    <section class="section section--shelf">
        <div class="wrap">
            <?php hsa_section_header('Featured shelves', 'Browse the highest-intent hemp research paths', 'Use these quick shelves to compare flower, law, COA, and wholesale topics without digging through menus.'); ?>
            <div class="spotlight-grid">
                <?php foreach (hsa_spotlight_tracks() as $item) : ?>
                    <article class="spotlight-card">
                        <p class="hsa-eyebrow"><?php echo esc_html($item['eyebrow']); ?></p>
                        <h3><a href="<?php echo esc_url($item['url']); ?>"><?php echo esc_html($item['title']); ?></a></h3>
                        <p><?php echo esc_html($item['body']); ?></p>
                        <a class="spotlight-card__link" href="<?php echo esc_url($item['url']); ?>"><?php echo esc_html($item['link_label']); ?></a>
                    </article>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="section section--soft">
        <div class="wrap">
            <?php hsa_section_header('Browse by need', 'Jump into discovery, comparison, law, or wholesale research', 'Choose the path that matches what you are trying to compare right now.'); ?>
            <div class="browse-grid">
                <?php foreach ($nav_groups as $group_label => $links) : ?>
                    <section class="content-card content-card--nav">
                        <p class="hsa-eyebrow"><?php echo esc_html($group_label); ?></p>
                        <?php hsa_render_simple_link_list($links, 'browse-link-list'); ?>
                    </section>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="section section--tinted">
        <div class="wrap split-layout">
            <div class="content-card">
                <?php hsa_section_header('State guides', 'Start with the most searched hemp states', 'Use state pages for availability caveats, law research, COA reminders, and near-me search guidance.'); ?>
                <?php echo hsa_shortcode('[hse_state_grid scope="primary" cluster="hemp-flower-near-me"]'); ?>
            </div>
            <div class="content-card">
                <?php hsa_section_header('Trust checks', 'Keep COA, law, and buyer-safety details close', 'Use these support links before trusting a product page, brand claim, or wholesale offer.'); ?>
                <?php echo hsa_shortcode('[hse_trust_box]'); ?>
                <?php hsa_render_next_step_runway('Trust shortcuts', [
                    'COA Guide' => '/how-to-read-a-hemp-coa/',
                    'State Laws' => '/hemp-laws-by-state/',
                    'THCA Legal States' => '/thca-flower-legal-states/',
                    'CBD vs CBG vs THCA' => '/cbd-vs-cbg-vs-thca/',
                    'Wholesale Hemp' => '/wholesale-hemp-flower/',
                ]); ?>
            </div>
        </div>
    </section>

    <section class="section">
        <div class="wrap">
            <?php hsa_section_header('Authority guides', 'Read the evergreen guides buyers keep coming back to', 'These pages explain COAs, cannabinoid differences, law questions, sleep products, and drink comparisons.'); ?>
            <?php hsa_render_card_grid(hsa_featured_guides(), 'post-list'); ?>
        </div>
    </section>

    <section class="section section--dark">
        <div class="wrap split-layout">
            <div class="content-card content-card--dark">
                <?php hsa_section_header('Glossary spotlight', 'Clear definitions for confusing hemp terms', 'Use glossary pages to understand COAs, cannabinoids, product formats, and legal language.'); ?>
                <div class="mini-stack">
                    <?php foreach (hsa_glossary_spotlight() as $term) : ?>
                        <article class="mini-entry">
                            <h3><a href="<?php echo esc_url(get_permalink($term)); ?>"><?php echo esc_html(get_the_title($term)); ?></a></h3>
                            <p><?php echo esc_html(hsa_loop_excerpt($term, 18)); ?></p>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="content-card">
                <?php hsa_section_header('Buyer pathway', 'Use the site to narrow your next question', 'Compare safer product categories, higher-caution research topics, and supplier questions with COA and law context visible.'); ?>
                <div class="checklist">
                    <div><strong>Start here:</strong> CBD flower, CBG flower, CBN sleep, accessories, and storage guides.</div>
                    <div><strong>Use extra caution:</strong> THCA flower, THCA wholesale, hemp-derived THC drinks, and THCA pre-rolls.</div>
                    <div><strong>Always check:</strong> COA, legality, shipping caveats, and supplier-verification language.</div>
                </div>
                <?php echo hsa_shortcode('[hse_cta]'); ?>
            </div>
        </div>
    </section>
</main>
<?php get_footer(); ?>
