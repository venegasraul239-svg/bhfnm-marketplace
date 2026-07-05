<?php
/**
 * Plugin Name: Hemp Commerce SEO Engine
 * Description: SEO architecture engine for hemp/cannabinoid WooCommerce sites: seeded categories, tags, state pages, internal linking, schema, and product SEO fields. No products are created.
 * Version: 0.4.0
 * Author: OpenAI
 * Text Domain: hemp-commerce-seo-engine
 */

if (!defined('ABSPATH')) {
    exit;
}

define('HSE_VERSION', '0.4.0');
define('HSE_PATH', plugin_dir_path(__FILE__));
define('HSE_URL', plugin_dir_url(__FILE__));

final class HSE_Plugin {
    private const POST_QUEUE_TARGET = 120;
    private const VERIFY_QUEUE_MINIMUM = 100;
    private static $instance = null;

    public static function instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct() {
        add_action('init', [$this, 'register_post_types']);
        add_action('init', [$this, 'register_taxonomies']);
        add_action('init', [$this, 'register_sitemap_rewrites']);
        add_filter('query_vars', [$this, 'query_vars']);
        add_action('template_redirect', [$this, 'handle_custom_sitemaps']);
        add_action('template_redirect', [$this, 'redirect_legacy_product_tag_slugs'], 8);
        add_action('parse_request', [$this, 'redirect_legacy_product_tag_slugs'], 1);
        add_action('admin_menu', [$this, 'admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'admin_assets']);
        add_action('admin_post_hse_run_task', [$this, 'handle_admin_post']);
        add_action('wp_enqueue_scripts', [$this, 'assets']);
        add_action('rest_api_init', [$this, 'register_search_route']);
        add_filter('robots_txt', [$this, 'augment_robots'], 10, 2);
        add_filter('the_content', [$this, 'append_supporting_sections'], 20);

        add_shortcode('hse_internal_links', [$this, 'shortcode_internal_links']);
        add_shortcode('hse_category_grid', [$this, 'shortcode_category_grid']);
        add_shortcode('hse_legal_notice', [$this, 'shortcode_legal_notice']);
        add_shortcode('hse_state_grid', [$this, 'shortcode_state_grid']);
        add_shortcode('hse_related_posts', [$this, 'shortcode_related_posts']);
        add_shortcode('hse_cta', [$this, 'shortcode_cta']);
        add_shortcode('hse_trust_box', [$this, 'shortcode_trust_box']);
        add_shortcode('hse_faq', [$this, 'shortcode_faq']);
        add_shortcode('hse_archive_sections', [$this, 'shortcode_archive_sections']);
        add_shortcode('hse_product_compliance', [$this, 'shortcode_product_compliance']);

        add_action('wp_head', [$this, 'output_meta_tags'], 5);
        add_action('wp_head', [$this, 'maybe_noindex_low_value_tag'], 15);
        add_action('wp_head', [$this, 'output_schema'], 20);

        add_action('woocommerce_product_options_general_product_data', [$this, 'product_fields']);
        add_action('woocommerce_process_product_meta', [$this, 'save_product_fields']);
    }

    public function assets() {
        wp_register_style('hse-plugin', HSE_URL . 'assets/hse.css', [], HSE_VERSION);
        wp_enqueue_style('hse-plugin');
    }

    public function admin_assets($hook) {
        if ($hook !== 'toplevel_page_hse-engine') {
            return;
        }

        wp_register_style('hse-plugin-admin', HSE_URL . 'assets/hse.css', [], HSE_VERSION);
        wp_enqueue_style('hse-plugin-admin');
    }

    public function register_search_route() {
        register_rest_route('hse/v1', '/search', [
            'methods' => 'GET',
            'callback' => [$this, 'search_endpoint'],
            'permission_callback' => '__return_true',
            'args' => [
                'q' => [
                    'sanitize_callback' => 'sanitize_text_field',
                    'default' => '',
                ],
            ],
        ]);
    }

    public function search_endpoint(WP_REST_Request $request) {
        $query = trim((string) $request->get_param('q'));
        if (strlen($query) < 2) {
            return rest_ensure_response([
                'query' => $query,
                'groups' => [],
            ]);
        }

        return rest_ensure_response([
            'query' => $query,
            'groups' => array_values(array_filter([
                $this->search_products($query),
                $this->search_terms($query, 'product_cat', 'Categories'),
                $this->search_terms($query, 'product_tag', 'Tags'),
                $this->search_content($query),
            ], function ($group) {
                return !empty($group['items']);
            })),
        ]);
    }

    private function search_products($query) {
        if (!post_type_exists('product')) {
            return ['label' => 'Products', 'items' => []];
        }

        $posts = get_posts([
            'post_type' => 'product',
            'post_status' => 'publish',
            's' => $query,
            'numberposts' => 4,
        ]);

        $items = [];
        foreach ($posts as $post) {
            $product = function_exists('wc_get_product') ? wc_get_product($post->ID) : null;
            $meta = 'Product';
            if ($product && $product->get_price_html()) {
                $meta = wp_strip_all_tags($product->get_price_html());
            }

            $items[] = [
                'title' => get_the_title($post),
                'url' => get_permalink($post),
                'type' => 'Product',
                'meta' => $meta,
                'excerpt' => $this->search_excerpt($post),
                'image' => get_the_post_thumbnail_url($post, 'thumbnail') ?: '',
            ];
        }

        return ['label' => 'Products', 'items' => $items];
    }

    private function search_terms($query, $taxonomy, $label) {
        if (!taxonomy_exists($taxonomy)) {
            return ['label' => $label, 'items' => []];
        }

        $terms = get_terms([
            'taxonomy' => $taxonomy,
            'hide_empty' => false,
            'search' => $query,
            'number' => 5,
        ]);

        if (is_wp_error($terms)) {
            return ['label' => $label, 'items' => []];
        }

        $items = [];
        foreach ($terms as $term) {
            if ($taxonomy === 'product_tag' && get_term_meta($term->term_id, '_hse_indexable', true) !== 'yes') {
                continue;
            }

            $url = get_term_link($term);
            if (is_wp_error($url)) {
                continue;
            }

            $items[] = [
                'title' => $term->name,
                'url' => $url,
                'type' => $taxonomy === 'product_cat' ? 'Category' : 'Tag',
                'meta' => sprintf('%s archive', $taxonomy === 'product_cat' ? 'WooCommerce category' : 'Curated landing tag'),
                'excerpt' => wp_trim_words(wp_strip_all_tags($term->description), 18),
                'image' => '',
            ];
        }

        return ['label' => $label, 'items' => $items];
    }

    private function search_content($query) {
        $posts = get_posts([
            'post_type' => ['page', 'post', 'hse_state', 'hse_law', 'hse_glossary', 'hse_brand_review', 'hse_supplier'],
            'post_status' => 'publish',
            's' => $query,
            'numberposts' => 8,
        ]);

        $items = [];
        foreach ($posts as $post) {
            $type = get_post_type_object($post->post_type);
            $items[] = [
                'title' => get_the_title($post),
                'url' => get_permalink($post),
                'type' => $type ? $type->labels->singular_name : 'Research page',
                'meta' => get_post_type($post) === 'post' ? get_the_date('', $post) : 'Research content',
                'excerpt' => $this->search_excerpt($post),
                'image' => get_the_post_thumbnail_url($post, 'thumbnail') ?: '',
            ];
        }

        return ['label' => 'Guides and research', 'items' => $items];
    }

    private function search_excerpt($post) {
        $source = $post->post_excerpt ? $post->post_excerpt : $post->post_content;

        return wp_trim_words(wp_strip_all_tags($source), 20);
    }

    public function register_post_types() {
        $types = [
            'hse_state' => [
                'name' => 'State Hemp Pages',
                'singular' => 'State Hemp Page',
                'icon' => 'dashicons-location-alt',
                'slug' => 'state',
            ],
            'hse_nearme' => [
                'name' => 'Near Me Pages',
                'singular' => 'Near Me Page',
                'icon' => 'dashicons-search',
                'slug' => 'near-me',
            ],
            'hse_law' => [
                'name' => 'Hemp Law Pages',
                'singular' => 'Hemp Law Page',
                'icon' => 'dashicons-media-text',
                'slug' => 'law',
            ],
            'hse_supplier' => [
                'name' => 'Supplier Listings',
                'singular' => 'Supplier Listing',
                'icon' => 'dashicons-store',
                'slug' => 'supplier',
            ],
            'hse_brand_review' => [
                'name' => 'Brand Reviews',
                'singular' => 'Brand Review',
                'icon' => 'dashicons-star-filled',
                'slug' => 'brand-review',
            ],
            'hse_glossary' => [
                'name' => 'Hemp Glossary',
                'singular' => 'Glossary Term',
                'icon' => 'dashicons-book',
                'slug' => 'glossary',
            ],
            'hse_seo_brief' => [
                'name' => 'SEO Briefs',
                'singular' => 'SEO Brief',
                'icon' => 'dashicons-clipboard',
                'slug' => 'seo-brief',
            ],
        ];

        foreach ($types as $key => $data) {
            register_post_type($key, [
                'labels' => [
                    'name' => $data['name'],
                    'singular_name' => $data['singular'],
                ],
                'public' => true,
                'show_in_rest' => true,
                'menu_icon' => $data['icon'],
                'supports' => ['title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'page-attributes'],
                'has_archive' => true,
                'rewrite' => ['slug' => $data['slug']],
            ]);
        }
    }

    public function register_taxonomies() {
        $objects = ['post', 'page', 'product', 'hse_state', 'hse_nearme', 'hse_law', 'hse_brand_review', 'hse_supplier', 'hse_glossary', 'hse_seo_brief'];

        register_taxonomy('hse_intent', $objects, [
            'labels' => ['name' => 'SEO Intents', 'singular_name' => 'SEO Intent'],
            'public' => true,
            'hierarchical' => false,
            'show_in_rest' => true,
        ]);

        register_taxonomy('hse_cannabinoid', $objects, [
            'labels' => ['name' => 'Cannabinoids', 'singular_name' => 'Cannabinoid'],
            'public' => true,
            'hierarchical' => false,
            'show_in_rest' => true,
        ]);

        register_taxonomy('hse_format', $objects, [
            'labels' => ['name' => 'Product Formats', 'singular_name' => 'Product Format'],
            'public' => true,
            'hierarchical' => false,
            'show_in_rest' => true,
        ]);
    }

    public function register_sitemap_rewrites() {
        add_rewrite_rule('^wp-sitemap-taxonomies-(product_cat|product_tag)-([0-9]+)\.xml$', 'index.php?hse_sitemap_taxonomy=$matches[1]&hse_sitemap_page=$matches[2]', 'top');
    }

    public function query_vars($vars) {
        $vars[] = 'hse_sitemap_taxonomy';
        $vars[] = 'hse_sitemap_page';

        return $vars;
    }

    public function handle_custom_sitemaps() {
        $taxonomy = get_query_var('hse_sitemap_taxonomy');
        $page = get_query_var('hse_sitemap_page');

        if (!$taxonomy && !empty($_SERVER['REQUEST_URI'])) {
            $request_uri = wp_unslash($_SERVER['REQUEST_URI']);
            if (preg_match('#/wp-sitemap-taxonomies-(product_cat|product_tag)-([0-9]+)\.xml$#', $request_uri, $matches)) {
                $taxonomy = $matches[1];
                $page = $matches[2];
            }
        }

        if (!$taxonomy) {
            return;
        }

        $page = max(1, absint($page));
        $entries = $this->get_taxonomy_sitemap_entries($taxonomy, $page, 2000);
        if (empty($entries)) {
            status_header(404);
            exit;
        }

        status_header(200);
        header('Content-Type: application/xml; charset=UTF-8');

        echo '<?xml version="1.0" encoding="UTF-8"?>';
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach ($entries as $entry) {
            echo '<url>';
            echo '<loc>' . esc_url($entry['loc']) . '</loc>';
            if (!empty($entry['lastmod'])) {
                echo '<lastmod>' . esc_html($entry['lastmod']) . '</lastmod>';
            }
            echo '</url>';
        }
        echo '</urlset>';
        exit;
    }

    public function augment_robots($output, $public) {
        if (!$public) {
            return $output;
        }

        $lines = [
            'Sitemap: ' . home_url('/wp-sitemap-taxonomies-product_cat-1.xml'),
            'Sitemap: ' . home_url('/wp-sitemap-taxonomies-product_tag-1.xml'),
        ];

        foreach ($lines as $line) {
            if (strpos($output, $line) === false) {
                $output .= trim($line) . "\n";
            }
        }

        return $output;
    }

    public function admin_menu() {
        add_menu_page(
            'Hemp SEO Engine',
            'Hemp SEO Engine',
            'manage_options',
            'hse-engine',
            [$this, 'admin_page'],
            'dashicons-chart-area',
            58
        );
    }

    public function admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $woo_active = class_exists('WooCommerce') && taxonomy_exists('product_cat') && taxonomy_exists('product_tag');
        $notice = $this->admin_notice_html();

        if ((isset($_POST['hse_seed']) || isset($_POST['hse_seed_full'])) && check_admin_referer('hse_seed_action')) {
            $report = $this->seed_all();
            $notice = '<div class="notice notice-success"><p><strong>Full SEO architecture repaired.</strong> No products were created. ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif (isset($_POST['hse_seed_core']) && check_admin_referer('hse_seed_core_action')) {
            $report = $this->seed_core_pages();
            $notice = '<div class="notice notice-success"><p><strong>Core SEO pages repaired.</strong> ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif (isset($_POST['hse_seed_states']) && check_admin_referer('hse_seed_states_action')) {
            $report = $this->seed_nested_state_pages();
            $notice = '<div class="notice notice-success"><p><strong>Top 10 state near-me and law pages repaired.</strong> ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif ((isset($_POST['hse_seed_woo']) || isset($_POST['hse_seed_terms'])) && check_admin_referer('hse_seed_woo_action')) {
            $report = $this->seed_terms(true);
            $notice = '<div class="notice notice-success"><p><strong>WooCommerce categories and curated tags repaired.</strong> No products were created. ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif (isset($_POST['hse_posts']) && check_admin_referer('hse_posts_action')) {
            $report = $this->verify_future_posts(self::VERIFY_QUEUE_MINIMUM);
            $notice = '<div class="notice notice-success"><p><strong>Authority post queue verified.</strong> ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif (isset($_POST['hse_links']) && check_admin_referer('hse_links_action')) {
            $report = $this->regenerate_internal_map();
            $notice = '<div class="notice notice-success"><p><strong>Internal link map regenerated.</strong> ' . esc_html($this->report_text($report)) . '</p></div>';
        } elseif (isset($_POST['hse_flush']) && check_admin_referer('hse_flush_action')) {
            flush_rewrite_rules();
            $notice = '<div class="notice notice-success"><p><strong>Permalinks flushed.</strong></p></div>';
        }

        $counts = $this->dashboard_counts();
        echo '<div class="wrap hse-admin-wrap"><h1>Hemp Commerce SEO Engine</h1>';
        echo '<p><strong>No products are created by this plugin.</strong> It builds search-capture pages, curated Woo taxonomies, state hubs, internal links, schema, and a scheduled authority queue.</p>';
        echo $notice;

        if (!$woo_active) {
            echo '<div class="notice notice-error inline"><p><strong>WooCommerce is not active or its product taxonomies are unavailable.</strong> Product categories and product tags cannot be repaired until WooCommerce is installed and active.</p></div>';
        } else {
            echo '<div class="notice notice-success inline"><p><strong>WooCommerce detected.</strong> Product categories and curated product tags can be repaired safely.</p></div>';
        }

        echo '<div class="hse-admin-cards">';
        foreach ($counts as $label => $value) {
            echo '<div class="hse-admin-card"><span>' . esc_html($label) . '</span><strong>' . esc_html((string) $value) . '</strong></div>';
        }
        echo '</div>';

        echo '<div class="hse-admin-actions">';
        $this->render_admin_task_form('seed', 'Seed / Repair Full SEO Architecture', 'button button-primary');
        $this->render_admin_task_form('seed_core', 'Seed / Repair Core SEO Pages', 'button button-secondary');
        $this->render_admin_task_form('seed_states', 'Seed Top 10 State Near-Me + Law Pages', 'button button-secondary');
        $this->render_admin_task_form('seed_woo', 'Seed / Repair Woo Categories + Curated Tags', 'button button-secondary');
        $this->render_admin_task_form('posts', 'Verify / Top Up 100-Day Post Queue', 'button');
        $this->render_admin_task_form('links', 'Regenerate Internal Link Map', 'button');
        $this->render_admin_task_form('flush', 'Flush Permalinks', 'button');
        echo '</div>';

        echo '<h2>Reusable shortcodes</h2>';
        echo '<code>[hse_category_grid]</code> <code>[hse_internal_links]</code> <code>[hse_legal_notice]</code> <code>[hse_state_grid]</code> <code>[hse_related_posts]</code> <code>[hse_cta]</code> <code>[hse_trust_box]</code> <code>[hse_faq]</code> <code>[hse_archive_sections]</code> <code>[hse_product_compliance]</code>';
        echo '</div>';
    }

    public function handle_admin_post() {
        if (!current_user_can('manage_options')) {
            wp_die('You are not allowed to manage this site.');
        }

        $task = isset($_REQUEST['task']) ? sanitize_key(wp_unslash($_REQUEST['task'])) : '';
        if (!$task) {
            wp_safe_redirect(admin_url('admin.php?page=hse-engine&hse_type=error&hse_message=' . rawurlencode('Missing task.')));
            exit;
        }

        check_admin_referer('hse_task_' . $task);

        try {
            $result = $this->run_admin_task($task);
            $type = 'success';
            $message = $result['message'];
            $report = $this->report_text($result['report']);
        } catch (Exception $exception) {
            $type = 'error';
            $message = $exception->getMessage();
            $report = '';
        }

        $redirect = add_query_arg([
            'page' => 'hse-engine',
            'hse_type' => $type,
            'hse_message' => rawurlencode($message),
            'hse_report' => rawurlencode($report),
        ], admin_url('admin.php'));
        wp_safe_redirect($redirect);
        exit;
    }

    private function run_admin_task($task) {
        switch ($task) {
            case 'seed':
                return [
                    'message' => 'Full SEO architecture repaired. No products were created.',
                    'report' => $this->seed_all(),
                ];
            case 'seed_core':
                return [
                    'message' => 'Core SEO pages repaired.',
                    'report' => $this->seed_core_pages(),
                ];
            case 'seed_states':
                return [
                    'message' => 'Top 10 state near-me and law pages repaired.',
                    'report' => $this->seed_nested_state_pages(),
                ];
            case 'seed_woo':
                return [
                    'message' => 'WooCommerce categories and curated tags repaired. No products were created.',
                    'report' => $this->seed_terms(true),
                ];
            case 'posts':
                return [
                    'message' => 'Authority post queue verified.',
                    'report' => $this->verify_future_posts(self::VERIFY_QUEUE_MINIMUM),
                ];
            case 'links':
                return [
                    'message' => 'Internal link map regenerated.',
                    'report' => $this->regenerate_internal_map(),
                ];
            case 'flush':
                flush_rewrite_rules();
                return [
                    'message' => 'Permalinks flushed.',
                    'report' => [],
                ];
        }

        throw new Exception('Unknown admin task.');
    }

    private function render_admin_task_form($task, $label, $button_class) {
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('hse_task_' . $task);
        echo '<input type="hidden" name="action" value="hse_run_task" />';
        echo '<input type="hidden" name="task" value="' . esc_attr($task) . '" />';
        echo '<p><button class="' . esc_attr($button_class) . '">' . esc_html($label) . '</button></p>';
        echo '</form>';
    }

    private function admin_notice_html() {
        if (empty($_GET['hse_type']) || empty($_GET['hse_message'])) {
            return '';
        }

        $type = sanitize_key(wp_unslash($_GET['hse_type']));
        $type = in_array($type, ['success', 'warning', 'error'], true) ? $type : 'success';
        $message = sanitize_text_field(wp_unslash($_GET['hse_message']));
        $report = empty($_GET['hse_report']) ? '' : sanitize_text_field(wp_unslash($_GET['hse_report']));
        $html = '<div class=\"notice notice-' . esc_attr($type) . '\"><p><strong>' . esc_html($message) . '</strong>';
        if ($report) {
            $html .= ' ' . esc_html($report);
        }
        $html .= '</p></div>';

        return $html;
    }

    private function dashboard_counts() {
        $future_posts = wp_count_posts('post');
        $product_posts = post_type_exists('product') ? wp_count_posts('product') : (object) ['publish' => 0, 'draft' => 0, 'future' => 0, 'private' => 0, 'pending' => 0];

        return [
            'Products' => (int) $product_posts->publish + (int) $product_posts->draft + (int) $product_posts->future + (int) $product_posts->private + (int) $product_posts->pending,
            'Future Posts' => (int) $future_posts->future,
            'Product Categories' => taxonomy_exists('product_cat') ? (int) wp_count_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]) : 0,
            'Product Tags' => taxonomy_exists('product_tag') ? (int) wp_count_terms(['taxonomy' => 'product_tag', 'hide_empty' => false]) : 0,
            'Published Pages' => (int) wp_count_posts('page')->publish,
            'Legacy State Pages' => (int) wp_count_posts('hse_state')->publish,
            'Legacy Law Pages' => (int) wp_count_posts('hse_law')->publish,
            'Nested Top 10 Pages' => $this->count_nested_state_pages(),
        ];
    }

    private function report_text($report) {
        if (!is_array($report)) {
            return '';
        }

        $parts = [];
        foreach ($report as $key => $value) {
            $parts[] = str_replace('_', ' ', $key) . ': ' . intval($value);
        }

        return implode(' | ', $parts);
    }

    public function product_fields() {
        if (!function_exists('woocommerce_wp_text_input')) {
            return;
        }

        echo '<div class="options_group"><h3 style="padding-left:12px;">Hemp SEO / Compliance Fields</h3>';
        woocommerce_wp_text_input([
            'id' => '_hse_coa_url',
            'label' => 'COA URL',
            'desc_tip' => true,
            'description' => 'Lab report or COA URL.',
        ]);
        woocommerce_wp_text_input(['id' => '_hse_batch_id', 'label' => 'Batch ID']);
        woocommerce_wp_select([
            'id' => '_hse_cannabinoid_type',
            'label' => 'Cannabinoid Type',
            'options' => [
                '' => 'Select',
                'CBD' => 'CBD',
                'CBG' => 'CBG',
                'THCA' => 'THCA',
                'CBN' => 'CBN',
                'Delta-9' => 'Delta-9',
                'Hemp Blend' => 'Hemp Blend',
            ],
        ]);
        woocommerce_wp_select([
            'id' => '_hse_product_format',
            'label' => 'Product Format',
            'options' => [
                '' => 'Select',
                'Flower' => 'Flower',
                'Pre-roll' => 'Pre-roll',
                'Drink' => 'Drink',
                'Gummy' => 'Gummy',
                'Accessory' => 'Accessory',
                'Bulk / Wholesale' => 'Bulk / Wholesale',
            ],
        ]);
        woocommerce_wp_checkbox(['id' => '_hse_lab_tested', 'label' => 'Lab-tested / COA-backed']);
        woocommerce_wp_select([
            'id' => '_hse_verification_status',
            'label' => 'Verification Status',
            'options' => [
                '' => 'Select',
                'verified' => 'COA Verified',
                'pending' => 'Pending Verification',
                'restricted' => 'Restricted / Review Needed',
            ],
        ]);
        woocommerce_wp_textarea_input(['id' => '_hse_shipping_restriction_note', 'label' => 'Shipping Restriction Note']);
        woocommerce_wp_textarea_input(['id' => '_hse_state_restriction_note', 'label' => 'State Restriction Note']);
        woocommerce_wp_checkbox(['id' => '_hse_leadgen_only', 'label' => 'Lead-gen only / no direct checkout recommendation']);
        woocommerce_wp_checkbox(['id' => '_hse_wholesale_eligible', 'label' => 'Wholesale eligible']);
        woocommerce_wp_text_input(['id' => '_hse_partner_vendor_source', 'label' => 'Partner / Vendor Source']);
        woocommerce_wp_textarea_input(['id' => '_hse_availability_note', 'label' => 'Availability Note']);
        echo '</div>';
    }

    public function save_product_fields($post_id) {
        $text_fields = [
            '_hse_coa_url',
            '_hse_batch_id',
            '_hse_cannabinoid_type',
            '_hse_product_format',
            '_hse_verification_status',
            '_hse_partner_vendor_source',
        ];
        $textarea_fields = [
            '_hse_shipping_restriction_note',
            '_hse_state_restriction_note',
            '_hse_availability_note',
        ];
        $checkbox_fields = [
            '_hse_lab_tested',
            '_hse_leadgen_only',
            '_hse_wholesale_eligible',
        ];

        foreach ($text_fields as $field) {
            if (isset($_POST[$field])) {
                update_post_meta($post_id, $field, sanitize_text_field(wp_unslash($_POST[$field])));
            }
        }

        foreach ($textarea_fields as $field) {
            if (isset($_POST[$field])) {
                update_post_meta($post_id, $field, sanitize_textarea_field(wp_unslash($_POST[$field])));
            }
        }

        foreach ($checkbox_fields as $field) {
            update_post_meta($post_id, $field, isset($_POST[$field]) ? 'yes' : 'no');
        }
    }

    public function seed_all() {
        $report = $this->seed_terms();
        $report = array_merge($report, $this->seed_core_pages());
        $report = array_merge($report, $this->seed_nested_state_pages());
        $report = array_merge($report, $this->seed_legacy_state_hubs());
        $report = array_merge($report, $this->seed_glossary());
        $report = array_merge($report, $this->verify_future_posts(self::POST_QUEUE_TARGET));
        $report = array_merge($report, $this->regenerate_internal_map());

        update_option('hse_seeded', time());
        update_option('hse_last_seed_report', $report);
        flush_rewrite_rules(false);

        return $report;
    }

    private function seed_terms($woo_only = false) {
        $report = [
            'product_categories_created' => 0,
            'product_categories_updated' => 0,
            'product_tags_created' => 0,
            'product_tags_updated' => 0,
            'blog_categories_created' => 0,
            'blog_categories_updated' => 0,
            'seo_terms_created' => 0,
        ];

        if (taxonomy_exists('product_cat')) {
            $term_ids = [];
            foreach ($this->product_categories() as $category) {
                $parent_id = 0;
                if (!empty($category['parent'])) {
                    if (isset($term_ids[$category['parent']])) {
                        $parent_id = $term_ids[$category['parent']];
                    } else {
                        $parent = get_term_by('slug', $category['parent'], 'product_cat');
                        $parent_id = $parent && !is_wp_error($parent) ? (int) $parent->term_id : 0;
                    }
                }

                $existing = get_term_by('slug', $category['slug'], 'product_cat');
                $payload = [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'parent' => $parent_id,
                ];

                if (!$existing) {
                    $inserted = wp_insert_term($category['name'], 'product_cat', array_merge($payload, ['slug' => $category['slug']]));
                    if (!is_wp_error($inserted)) {
                        $term_ids[$category['slug']] = (int) $inserted['term_id'];
                        update_term_meta($inserted['term_id'], '_hse_focus_cluster', $category['cluster']);
                        $report['product_categories_created']++;
                    }
                } else {
                    wp_update_term($existing->term_id, 'product_cat', $payload);
                    update_term_meta($existing->term_id, '_hse_focus_cluster', $category['cluster']);
                    $term_ids[$category['slug']] = (int) $existing->term_id;
                    $report['product_categories_updated']++;
                }
            }
        }

        if (taxonomy_exists('product_tag')) {
            foreach ($this->product_tags() as $tag) {
                $existing = get_term_by('slug', $tag['slug'], 'product_tag');
                $payload = [
                    'name' => $tag['name'],
                    'description' => $tag['description'],
                ];

                if (!$existing) {
                    $inserted = wp_insert_term($tag['name'], 'product_tag', array_merge($payload, ['slug' => $tag['slug']]));
                    if (!is_wp_error($inserted)) {
                        update_term_meta($inserted['term_id'], '_hse_indexable', $tag['indexable'] ? 'yes' : 'no');
                        update_term_meta($inserted['term_id'], '_hse_focus_cluster', $tag['cluster']);
                        $report['product_tags_created']++;
                    }
                } else {
                    wp_update_term($existing->term_id, 'product_tag', $payload);
                    update_term_meta($existing->term_id, '_hse_indexable', $tag['indexable'] ? 'yes' : 'no');
                    update_term_meta($existing->term_id, '_hse_focus_cluster', $tag['cluster']);
                    $report['product_tags_updated']++;
                }
            }
        }

        if ($woo_only) {
            update_option('hse_last_woo_seed_report', $report);

            return $report;
        }

        foreach (['near me', 'buy online', 'wholesale', 'legal status', 'COA verified', 'state legality', 'comparison', 'buyer guide', 'supplier verification', 'availability tracking', 'brand review', 'hemp law'] as $term) {
            if (!term_exists($term, 'hse_intent')) {
                wp_insert_term($term, 'hse_intent');
                $report['seo_terms_created']++;
            }
        }

        foreach (['CBD', 'CBG', 'THCA', 'CBN', 'Delta-9', 'Hemp THC', 'Hemp Flower', 'Hemp-Derived THC', 'COA'] as $term) {
            if (!term_exists($term, 'hse_cannabinoid')) {
                wp_insert_term($term, 'hse_cannabinoid');
                $report['seo_terms_created']++;
            }
        }

        foreach (['flower', 'pre-roll', 'drink', 'gummy', 'wholesale', 'accessory', 'law page', 'state page', 'brand review', 'COA guide'] as $term) {
            if (!term_exists($term, 'hse_format')) {
                wp_insert_term($term, 'hse_format');
                $report['seo_terms_created']++;
            }
        }

        foreach ($this->blog_categories() as $name => $slug) {
            $existing = get_category_by_slug($slug);
            if (!$existing) {
                wp_insert_category(['cat_name' => $name, 'category_nicename' => $slug]);
                $report['blog_categories_created']++;
            } else {
                wp_update_term($existing->term_id, 'category', ['name' => $name, 'slug' => $slug]);
                $report['blog_categories_updated']++;
            }
        }

        update_option('hse_last_seed_report', $report);

        return $report;
    }

    private function seed_core_pages() {
        $report = [
            'core_pages_created' => 0,
            'core_pages_updated' => 0,
        ];

        foreach ($this->core_pages() as $slug => $config) {
            $existing = get_page_by_path($slug, OBJECT, 'page');
            $page_id = $this->upsert_post('page', [
                'post_title' => $config['title'],
                'post_name' => $slug,
                'post_status' => 'publish',
                'post_content' => $this->build_core_page_content($slug, $config),
                'post_excerpt' => $config['summary'],
                'comment_status' => 'closed',
                'ping_status' => 'closed',
            ]);

            if ($page_id && get_post_meta($page_id, '_hse_seeded_v3', true) !== 'yes') {
                update_post_meta($page_id, '_hse_seeded_v3', 'yes');
            }

            if ($page_id && $existing) {
                $report['core_pages_updated']++;
            } elseif ($page_id) {
                $report['core_pages_created']++;
            }
        }

        return $report;
    }

    private function seed_nested_state_pages() {
        $report = [
            'nested_state_pages_created' => 0,
            'nested_state_pages_updated' => 0,
        ];

        $clusters = $this->nested_state_clusters();
        foreach ($clusters as $parent_slug => $cluster) {
            $parent = get_page_by_path($parent_slug, OBJECT, 'page');
            if (!$parent) {
                continue;
            }

            foreach ($this->primary_states() as $state_name => $state_slug) {
                $existing = get_page_by_path($parent_slug . '/' . $state_slug, OBJECT, 'page');
                $page_id = $this->upsert_post('page', [
                    'post_title' => sprintf($cluster['title'], $state_name),
                    'post_name' => $state_slug,
                    'post_parent' => $parent->ID,
                    'post_status' => 'publish',
                    'post_excerpt' => sprintf($cluster['summary'], $state_name),
                    'post_content' => $this->build_nested_state_content($parent_slug, $state_name, $state_slug),
                    'comment_status' => 'closed',
                    'ping_status' => 'closed',
                    'meta_input' => [
                        '_hse_state_name' => $state_name,
                        '_hse_state_slug' => $state_slug,
                        '_hse_state_cluster' => $parent_slug,
                    ],
                ]);

                if ($page_id) {
                    if ($existing) {
                        $report['nested_state_pages_updated']++;
                    } else {
                        $report['nested_state_pages_created']++;
                    }
                }
            }
        }

        return $report;
    }

    private function seed_legacy_state_hubs() {
        $report = [
            'legacy_state_pages_updated' => 0,
            'legacy_law_pages_updated' => 0,
        ];

        foreach ($this->states() as $state_name => $state_slug) {
            $state_slug_value = 'hemp-flower-near-me-' . $state_slug;
            $law_slug_value = 'hemp-laws-' . $state_slug;

            $state_existing = get_page_by_path($state_slug_value, OBJECT, 'hse_state');
            $law_existing = get_page_by_path($law_slug_value, OBJECT, 'hse_law');

            $state_id = $this->upsert_post('hse_state', [
                'post_title' => sprintf('Hemp Flower Near Me in %s', $state_name),
                'post_name' => $state_slug_value,
                'post_status' => 'publish',
                'post_excerpt' => sprintf('Legacy state research hub for %s buyers comparing hemp flower, CBD flower, CBG flower, THCA flower, and hemp-derived THC drinks.', $state_name),
                'post_content' => $this->build_legacy_state_content($state_name, $state_slug),
                'comment_status' => 'closed',
                'ping_status' => 'closed',
                'meta_input' => [
                    '_hse_state_name' => $state_name,
                    '_hse_state_slug' => $state_slug,
                    '_hse_state_cluster' => 'legacy-state',
                ],
            ]);

            $law_id = $this->upsert_post('hse_law', [
                'post_title' => sprintf('Hemp Laws in %s', $state_name),
                'post_name' => $law_slug_value,
                'post_status' => 'publish',
                'post_excerpt' => sprintf('Legacy hemp law research hub for %s covering flower, THCA, hemp-derived THC drinks, CBD, CBG, CBN, shipping, and COA considerations.', $state_name),
                'post_content' => $this->build_legacy_law_content($state_name, $state_slug),
                'comment_status' => 'closed',
                'ping_status' => 'closed',
                'meta_input' => [
                    '_hse_state_name' => $state_name,
                    '_hse_state_slug' => $state_slug,
                    '_hse_state_cluster' => 'legacy-law',
                ],
            ]);

            if ($state_id) {
                $report['legacy_state_pages_updated'] += $state_existing ? 1 : 0;
            }
            if ($law_id) {
                $report['legacy_law_pages_updated'] += $law_existing ? 1 : 0;
            }
        }

        return $report;
    }

    private function seed_glossary() {
        $report = [
            'glossary_terms_created' => 0,
            'glossary_terms_updated' => 0,
        ];

        foreach ($this->glossary_terms() as $term) {
            $existing = get_page_by_path($term['slug'], OBJECT, 'hse_glossary');
            $page_id = $this->upsert_post('hse_glossary', [
                'post_title' => $term['title'],
                'post_name' => $term['slug'],
                'post_status' => 'publish',
                'post_excerpt' => $term['summary'],
                'post_content' => $this->build_glossary_content($term),
                'comment_status' => 'closed',
                'ping_status' => 'closed',
            ]);

            if ($page_id) {
                if ($existing) {
                    $report['glossary_terms_updated']++;
                } else {
                    $report['glossary_terms_created']++;
                }
            }
        }

        return $report;
    }

    private function verify_future_posts($minimum = self::VERIFY_QUEUE_MINIMUM) {
        $target = max(self::POST_QUEUE_TARGET, (int) $minimum);
        $created = $this->seed_authority_posts($target);
        $this->normalize_seeded_posts();

        return [
            'future_posts_created' => $created,
            'future_posts_present' => (int) wp_count_posts('post')->future,
        ];
    }

    public function regenerate_internal_map() {
        $map = [
            'generated_at' => current_time('mysql'),
            'core_pages' => [],
            'nested_state_pages' => [],
            'legacy_state_pages' => [],
            'legacy_law_pages' => [],
            'categories' => [],
            'tags' => [],
            'glossary' => [],
        ];

        foreach (array_keys($this->core_pages()) as $slug) {
            $page = get_page_by_path($slug, OBJECT, 'page');
            if ($page) {
                $map['core_pages'][$slug] = get_permalink($page);
            }
        }

        foreach ($this->nested_state_clusters() as $parent_slug => $cluster) {
            foreach ($this->primary_states() as $state_name => $state_slug) {
                $page = get_page_by_path($parent_slug . '/' . $state_slug, OBJECT, 'page');
                if ($page) {
                    $map['nested_state_pages'][$parent_slug][$state_slug] = get_permalink($page);
                }
            }
        }

        foreach ($this->states() as $state_name => $state_slug) {
            $legacy_state = get_page_by_path('hemp-flower-near-me-' . $state_slug, OBJECT, 'hse_state');
            $legacy_law = get_page_by_path('hemp-laws-' . $state_slug, OBJECT, 'hse_law');

            if ($legacy_state) {
                $map['legacy_state_pages'][$state_slug] = get_permalink($legacy_state);
            }
            if ($legacy_law) {
                $map['legacy_law_pages'][$state_slug] = get_permalink($legacy_law);
            }
        }

        if (taxonomy_exists('product_cat')) {
            $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
            foreach ($terms as $term) {
                $map['categories'][$term->slug] = get_term_link($term);
            }
        }

        if (taxonomy_exists('product_tag')) {
            $terms = get_terms(['taxonomy' => 'product_tag', 'hide_empty' => false]);
            foreach ($terms as $term) {
                if (get_term_meta($term->term_id, '_hse_indexable', true) === 'yes') {
                    $map['tags'][$term->slug] = get_term_link($term);
                }
            }
        }

        $glossary = get_posts([
            'post_type' => 'hse_glossary',
            'post_status' => 'publish',
            'numberposts' => -1,
        ]);
        foreach ($glossary as $post) {
            $map['glossary'][$post->post_name] = get_permalink($post);
        }

        update_option('hse_internal_map', $map);

        return [
            'core_urls_mapped' => count($map['core_pages']),
            'nested_state_urls_mapped' => array_sum(array_map('count', $map['nested_state_pages'])),
            'legacy_state_urls_mapped' => count($map['legacy_state_pages']),
            'legacy_law_urls_mapped' => count($map['legacy_law_pages']),
            'mapped_categories' => count($map['categories']),
            'mapped_tags' => count($map['tags']),
            'mapped_glossary_terms' => count($map['glossary']),
        ];
    }

    private function get_internal_map() {
        $map = get_option('hse_internal_map');
        if (!is_array($map) || empty($map['generated_at'])) {
            $this->regenerate_internal_map();
            $map = get_option('hse_internal_map');
        }

        return is_array($map) ? $map : [];
    }

    private function seed_authority_posts($count = self::POST_QUEUE_TARGET) {
        $topics = $this->post_topics();
        $created = 0;
        $queue_position = 0;

        foreach ($topics as $topic) {
            if ($queue_position >= $count) {
                break;
            }

            $slug = sanitize_title($topic['title']);
            $existing = get_page_by_path($slug, OBJECT, 'post');
            $date = date('Y-m-d H:i:s', strtotime('+' . ($queue_position + 1) . ' days 09:00:00'));
            $category_id = get_cat_ID($topic['cat']);

            if ($existing) {
                wp_update_post([
                    'ID' => $existing->ID,
                    'post_title' => $topic['title'],
                    'post_content' => $this->build_post_content($topic),
                    'post_excerpt' => $this->post_excerpt($topic),
                    'comment_status' => 'closed',
                    'ping_status' => 'closed',
                ]);
                $queue_position++;
                continue;
            }

            $inserted = wp_insert_post([
                'post_title' => $topic['title'],
                'post_name' => $slug,
                'post_content' => $this->build_post_content($topic),
                'post_excerpt' => $this->post_excerpt($topic),
                'post_status' => 'future',
                'post_type' => 'post',
                'post_date' => $date,
                'post_date_gmt' => get_gmt_from_date($date),
                'post_category' => $category_id ? [$category_id] : [],
                'comment_status' => 'closed',
                'ping_status' => 'closed',
                'meta_input' => [
                    '_hse_primary_keyword' => $topic['kw'],
                    '_hse_intent' => $topic['intent'],
                    '_hse_seeded' => 'yes',
                ],
            ]);

            if (!is_wp_error($inserted) && $inserted) {
                $created++;
                $queue_position++;
            }
        }

        return $created;
    }

    private function normalize_seeded_posts() {
        $posts = get_posts([
            'post_type' => 'post',
            'post_status' => ['future', 'publish', 'draft'],
            'meta_key' => '_hse_seeded',
            'meta_value' => 'yes',
            'numberposts' => -1,
        ]);

        foreach ($posts as $post) {
            wp_update_post([
                'ID' => $post->ID,
                'comment_status' => 'closed',
                'ping_status' => 'closed',
            ]);
        }
    }

    private function upsert_post($post_type, $args) {
        $defaults = [
            'post_title' => '',
            'post_name' => '',
            'post_status' => 'publish',
            'post_content' => '',
            'post_excerpt' => '',
            'post_parent' => 0,
            'comment_status' => 'closed',
            'ping_status' => 'closed',
            'meta_input' => [],
        ];
        $args = wp_parse_args($args, $defaults);

        $path = $args['post_name'];
        if (!empty($args['post_parent'])) {
            $parent = get_post($args['post_parent']);
            if ($parent instanceof WP_Post) {
                $path = $parent->post_name . '/' . $args['post_name'];
            }
        }

        $existing = get_page_by_path($path, OBJECT, $post_type);
        $payload = array_merge($args, ['post_type' => $post_type]);

        if ($existing) {
            $payload['ID'] = $existing->ID;
            wp_update_post($payload);
            if (!empty($args['meta_input'])) {
                foreach ($args['meta_input'] as $meta_key => $meta_value) {
                    update_post_meta($existing->ID, $meta_key, $meta_value);
                }
            }

            return $existing->ID;
        }

        $created = wp_insert_post($payload);
        if (!is_wp_error($created) && !empty($args['meta_input'])) {
            foreach ($args['meta_input'] as $meta_key => $meta_value) {
                update_post_meta($created, $meta_key, $meta_value);
            }
        }

        return is_wp_error($created) ? 0 : $created;
    }

    public function shortcode_category_grid($atts = []) {
        $atts = shortcode_atts([
            'focus' => '',
            'limit' => 0,
        ], $atts, 'hse_category_grid');

        $items = [];
        foreach ($this->product_categories() as $category) {
            if ($atts['focus'] && $atts['focus'] !== $category['cluster']) {
                continue;
            }

            $url = taxonomy_exists('product_cat') ? get_term_link($category['slug'], 'product_cat') : home_url('/product-category/' . $category['slug'] . '/');
            if (is_wp_error($url)) {
                $url = home_url('/product-category/' . $category['slug'] . '/');
            }

            $items[] = '<a class="hse-card" href="' . esc_url($url) . '"><strong>' . esc_html($category['name']) . '</strong><span>' . esc_html($category['description']) . '</span></a>';

            if ($atts['limit'] && count($items) >= absint($atts['limit'])) {
                break;
            }
        }

        return '<div class="hse-grid hse-category-grid">' . implode('', $items) . '</div>';
    }

    public function shortcode_state_grid($atts = []) {
        $atts = shortcode_atts([
            'scope' => 'primary',
            'cluster' => 'hemp-laws',
        ], $atts, 'hse_state_grid');

        $states = $atts['scope'] === 'all' ? $this->states() : $this->primary_states();
        $cards = [];

        foreach ($states as $state_name => $state_slug) {
            $url = $this->get_state_cluster_url($atts['cluster'], $state_slug);
            $cards[] = '<a class="hse-card" href="' . esc_url($url) . '"><strong>' . esc_html($state_name) . '</strong><span>' . esc_html($this->state_grid_summary($atts['cluster'])) . '</span></a>';
        }

        return '<div class="hse-grid hse-state-grid">' . implode('', $cards) . '</div>';
    }

    public function shortcode_legal_notice() {
        return '<div class="hse-notice"><strong>Buyer note:</strong> Hemp, THCA, and hemp-derived THC rules vary by jurisdiction and can change. Use these pages for online hemp product discovery, COA-backed comparison, and state-aware research. Check current local law before buying. This site is not legal advice and only supports verified local availability claims.</div>';
    }

    public function shortcode_trust_box($atts = []) {
        $atts = shortcode_atts(['compact' => 'no'], $atts, 'hse_trust_box');
        $points = [
            'COA-backed product research',
            'Verified local availability language',
            'Manual partner sourcing only',
            'State-aware legality language',
        ];

        $items = '';
        foreach ($points as $point) {
            $items .= '<li>' . esc_html($point) . '</li>';
        }

        $class = $atts['compact'] === 'yes' ? ' hse-trust-box--compact' : '';

        return '<section class="hse-trust-box' . esc_attr($class) . '"><h2>Buyer trust signals</h2><ul>' . $items . '</ul></section>';
    }

    public function shortcode_cta($atts = []) {
        $context = $this->get_current_context();
        $link = $this->cta_link($context);
        $title = $context['wholesale'] ? 'Need verified wholesale leads?' : 'Need availability updates or buyer help?';
        $body = $context['wholesale']
            ? 'Use this CTA to request supplier-verification follow-up, COA expectations, or wholesale availability details when vetted partners are added.'
            : 'Use this CTA for availability alerts, partner updates, or safer product-discovery help while the catalog is still being built manually.';
        $button = $context['wholesale'] ? 'Request wholesale follow-up' : 'Get availability updates';

        return '<section class="hse-cta"><div><p class="hse-eyebrow">Lead-safe CTA</p><h2>' . esc_html($title) . '</h2><p>' . esc_html($body) . '</p></div><a class="hse-cta__button" href="' . esc_url($link['url']) . '">' . esc_html($button) . '</a><p class="hse-cta__note">' . esc_html($link['note']) . '</p></section>';
    }

    public function shortcode_faq() {
        $questions = $this->faq_items($this->get_current_context());
        if (empty($questions)) {
            return '';
        }

        $output = '<section class="hse-faq"><h2>FAQ</h2>';
        foreach ($questions as $faq) {
            $output .= '<div class="hse-faq__item"><h3>' . esc_html($faq['question']) . '</h3><p>' . esc_html($faq['answer']) . '</p></div>';
        }
        $output .= '</section>';

        return $output;
    }

    public function shortcode_internal_links() {
        $sections = $this->related_link_sections($this->get_current_context());
        if (empty($sections)) {
            return '';
        }

        $output = '<section class="hse-link-collection hse-link-collection--drawer" aria-label="Related hemp research links">';
        $output .= '<details><summary><span>Related research paths</span><small>Open the full internal-link map for categories, guides, state pages, and glossary terms.</small></summary>';
        $output .= '<div class="hse-link-collection__grid">';
        foreach ($sections as $section) {
            if (empty($section['links'])) {
                continue;
            }

            $output .= '<div class="hse-link-group"><h3>' . esc_html($section['title']) . '</h3><div class="hse-link-pills">';
            foreach ($section['links'] as $link) {
                $output .= '<a href="' . esc_url($link['url']) . '">' . esc_html($link['label']) . '</a>';
            }
            $output .= '</div></div>';
        }
        $output .= '</div></details></section>';

        return $output;
    }

    public function shortcode_archive_sections() {
        $output = $this->shortcode_trust_box(['compact' => 'yes']);
        $output .= $this->shortcode_internal_links();
        $output .= $this->shortcode_faq();
        $output .= $this->shortcode_cta();

        return $output;
    }

    public function shortcode_product_compliance() {
        if (!is_singular('product')) {
            return '';
        }

        $post_id = get_the_ID();
        if (!$post_id) {
            return '';
        }

        $rows = [];
        $meta_map = [
            'COA URL' => '_hse_coa_url',
            'Batch ID' => '_hse_batch_id',
            'Cannabinoid Type' => '_hse_cannabinoid_type',
            'Product Format' => '_hse_product_format',
            'Verification Status' => '_hse_verification_status',
            'Partner / Vendor Source' => '_hse_partner_vendor_source',
            'Availability Note' => '_hse_availability_note',
            'Shipping Restriction Note' => '_hse_shipping_restriction_note',
            'State Restriction Note' => '_hse_state_restriction_note',
        ];

        foreach ($meta_map as $label => $key) {
            $value = get_post_meta($post_id, $key, true);
            if (!$value) {
                continue;
            }

            if ($key === '_hse_coa_url') {
                $value = '<a href="' . esc_url($value) . '" rel="nofollow">View COA</a>';
            } else {
                $value = esc_html($value);
            }

            $rows[] = '<li><strong>' . esc_html($label) . ':</strong> ' . $value . '</li>';
        }

        $lab_tested = get_post_meta($post_id, '_hse_lab_tested', true) === 'yes' ? 'Yes' : 'No';
        $leadgen_only = get_post_meta($post_id, '_hse_leadgen_only', true) === 'yes' ? 'Yes' : 'No';
        $wholesale = get_post_meta($post_id, '_hse_wholesale_eligible', true) === 'yes' ? 'Yes' : 'No';

        $rows[] = '<li><strong>Lab-tested:</strong> ' . esc_html($lab_tested) . '</li>';
        $rows[] = '<li><strong>Lead-gen only:</strong> ' . esc_html($leadgen_only) . '</li>';
        $rows[] = '<li><strong>Wholesale eligible:</strong> ' . esc_html($wholesale) . '</li>';

        return '<section class="hse-product-compliance"><h2>COA and compliance snapshot</h2><ul>' . implode('', $rows) . '</ul>' . $this->shortcode_legal_notice() . '</section>';
    }

    public function shortcode_related_posts() {
        $query = new WP_Query([
            'post_type' => 'post',
            'posts_per_page' => 6,
            'post_status' => 'publish',
            'ignore_sticky_posts' => true,
        ]);

        if ($query->have_posts()) {
            $output = '<section class="hse-related-posts"><h2>More hemp authority guides</h2><ul>';
            while ($query->have_posts()) {
                $query->the_post();
                $output .= '<li><a href="' . esc_url(get_permalink()) . '">' . esc_html(get_the_title()) . '</a></li>';
            }
            wp_reset_postdata();

            return $output . '</ul></section>';
        }

        $fallback = [];
        foreach (['how-to-read-a-hemp-coa', 'cbd-vs-cbg-vs-thca', 'hemp-laws-by-state', 'best-thca-flower-brands', 'best-hemp-thc-drinks', 'cbn-gummies-for-sleep'] as $slug) {
            $page = get_page_by_path($slug, OBJECT, 'page');
            if ($page) {
                $fallback[] = [
                    'label' => get_the_title($page),
                    'url' => get_permalink($page),
                ];
            }
        }

        if (empty($fallback)) {
            return '';
        }

        $output = '<section class="hse-related-posts"><h2>More hemp authority guides</h2><ul>';
        foreach ($fallback as $link) {
            $output .= '<li><a href="' . esc_url($link['url']) . '">' . esc_html($link['label']) . '</a></li>';
        }

        return $output . '</ul></section>';
    }

    public function append_supporting_sections($content) {
        if (is_admin() || !is_singular()) {
            return $content;
        }

        $post_type = get_post_type();
        if (!in_array($post_type, ['post', 'page', 'hse_state', 'hse_law', 'hse_glossary', 'hse_brand_review', 'hse_supplier', 'hse_seo_brief'], true)) {
            return $content;
        }

        if (!has_shortcode($content, 'hse_internal_links')) {
            $content .= do_shortcode("\n\n[hse_internal_links]");
        }
        if (!has_shortcode($content, 'hse_faq')) {
            $content .= do_shortcode("\n\n[hse_faq]");
        }
        if (!has_shortcode($content, 'hse_cta')) {
            $content .= do_shortcode("\n\n[hse_cta]");
        }
        if (!has_shortcode($content, 'hse_related_posts')) {
            $content .= do_shortcode("\n\n[hse_related_posts]");
        }

        return $content;
    }

    public function maybe_noindex_low_value_tag() {
        if (!is_tax('product_tag')) {
            return;
        }

        $term = get_queried_object();
        if (!($term instanceof WP_Term)) {
            return;
        }

        if (get_term_meta($term->term_id, '_hse_indexable', true) === 'yes') {
            return;
        }

        echo '<meta name="robots" content="noindex,follow" />' . "\n";
    }

    public function redirect_legacy_product_tag_slugs() {
        if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        if (empty($_SERVER['REQUEST_URI']) || !taxonomy_exists('product_tag')) {
            return;
        }

        $path = trim((string) parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH), '/');
        if (!preg_match('#^product-tag/([^/]+)/?$#', $path, $matches)) {
            return;
        }

        $requested_slug = sanitize_title($matches[1]);
        if (!$requested_slug) {
            return;
        }

        $aliases = [
            'thca-flower' => 'thca-flower-tag',
            'cbd-flower' => 'cbd-flower-tag',
            'cbg-flower' => 'cbg-flower-tag',
            'hemp-flower' => 'hemp-flower-tag',
            'hemp-pre-rolls' => 'hemp-pre-rolls-tag',
            'thca-pre-rolls' => 'thca-pre-rolls-tag',
            'hemp-derived-thc-drinks' => 'hemp-derived-thc-drinks-tag',
            'legal-hemp-products' => 'legal-hemp-products-tag',
        ];

        if (empty($aliases[$requested_slug])) {
            if (get_term_by('slug', $requested_slug, 'product_tag')) {
                return;
            }

            return;
        }

        $target = get_term_by('slug', $aliases[$requested_slug], 'product_tag');
        if (!($target instanceof WP_Term)) {
            return;
        }

        $target_url = get_term_link($target, 'product_tag');
        if (is_wp_error($target_url)) {
            return;
        }

        wp_safe_redirect($target_url, 301);
        exit;
    }

    public function output_meta_tags() {
        if (is_admin() || is_feed() || is_search() || is_404()) {
            return;
        }

        $title = wp_get_document_title();
        $description = $this->meta_description();
        $url = $this->canonical_url();
        $type = is_singular('product') ? 'product' : (is_singular(['post', 'hse_state', 'hse_law', 'hse_brand_review', 'hse_supplier']) ? 'article' : 'website');
        $image = $this->meta_image();

        if ($description) {
            echo '<meta name="description" content="' . esc_attr($description) . '" />' . "\n";
        }

        // Woo taxonomy archives were missing canonical tags in live checks; singular/home are handled by WordPress.
        if ((is_tax('product_cat') || is_tax('product_tag')) && $url) {
            echo '<link rel="canonical" href="' . esc_url($url) . '" />' . "\n";
        }

        echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '" />' . "\n";
        echo '<meta property="og:type" content="' . esc_attr($type) . '" />' . "\n";
        echo '<meta property="og:title" content="' . esc_attr($title) . '" />' . "\n";
        if ($description) {
            echo '<meta property="og:description" content="' . esc_attr($description) . '" />' . "\n";
        }
        if ($url) {
            echo '<meta property="og:url" content="' . esc_url($url) . '" />' . "\n";
        }
        if ($image) {
            echo '<meta property="og:image" content="' . esc_url($image) . '" />' . "\n";
        }

        echo '<meta name="twitter:card" content="' . esc_attr($image ? 'summary_large_image' : 'summary') . '" />' . "\n";
        echo '<meta name="twitter:title" content="' . esc_attr($title) . '" />' . "\n";
        if ($description) {
            echo '<meta name="twitter:description" content="' . esc_attr($description) . '" />' . "\n";
        }
        if ($image) {
            echo '<meta name="twitter:image" content="' . esc_url($image) . '" />' . "\n";
        }
    }

    private function meta_description() {
        if (is_singular()) {
            $post = get_post();
            if ($post) {
                $text = has_excerpt($post) ? get_the_excerpt($post) : wp_strip_all_tags(strip_shortcodes($post->post_content));
                return $this->clean_meta_description($text);
            }
        }

        if (is_tax() || is_category() || is_tag()) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $text = term_description($term);
                if (!$text) {
                    $text = sprintf(
                        'Research %s with COA checks, state-aware caveats, product discovery paths, and wholesale buyer guidance.',
                        $term->name
                    );
                }

                return $this->clean_meta_description($text);
            }
        }

        if (is_home()) {
            return 'Hemp authority guides for COA checks, state laws, wholesale hemp research, THCA flower, CBD flower, CBG flower, and buyer-safety education.';
        }

        if (is_front_page()) {
            return 'SEO-first hemp product discovery, research guides, COA education, state-law context, wholesale hemp paths, and curated WooCommerce product categories.';
        }

        return $this->clean_meta_description(get_bloginfo('description'));
    }

    private function clean_meta_description($text) {
        $text = html_entity_decode(wp_strip_all_tags((string) $text), ENT_QUOTES, get_bloginfo('charset'));
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);

        if ($text === '') {
            return '';
        }

        return wp_trim_words($text, 28, '');
    }

    private function canonical_url() {
        if (is_singular()) {
            return get_permalink();
        }

        if (is_tax() || is_category() || is_tag()) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $url = get_term_link($term);
                return is_wp_error($url) ? '' : $url;
            }
        }

        if (is_home()) {
            $posts_page = (int) get_option('page_for_posts');
            return $posts_page ? get_permalink($posts_page) : home_url('/');
        }

        return home_url('/');
    }

    private function meta_image() {
        if (is_singular() && has_post_thumbnail()) {
            return get_the_post_thumbnail_url(null, 'large');
        }

        if (is_tax('product_cat')) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $thumbnail_id = get_term_meta($term->term_id, 'thumbnail_id', true);
                if ($thumbnail_id) {
                    return wp_get_attachment_image_url((int) $thumbnail_id, 'large');
                }
            }
        }

        return '';
    }

    public function output_schema() {
        $schemas = [];
        $schemas[] = $this->organization_schema();
        $schemas[] = $this->website_schema();

        if (is_singular()) {
            $schemas[] = $this->breadcrumb_schema();
            $schemas[] = $this->singular_schema();

            $faq = $this->faq_schema($this->get_current_context());
            if ($faq) {
                $schemas[] = $faq;
            }
        } elseif (is_home() || is_archive() || is_tax()) {
            $schemas[] = $this->breadcrumb_schema();
            $schemas[] = $this->collection_schema();
        }

        $schemas = array_filter($schemas);
        foreach ($schemas as $schema) {
            echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\n";
        }
    }

    private function organization_schema() {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => get_bloginfo('name'),
            'url' => home_url('/'),
        ];
    }

    private function website_schema() {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => get_bloginfo('name'),
            'url' => home_url('/'),
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => home_url('/?s={search_term_string}'),
                'query-input' => 'required name=search_term_string',
            ],
        ];
    }

    private function singular_schema() {
        global $post;
        if (!$post) {
            return [];
        }

        $post_type = get_post_type($post);
        $base = [
            '@context' => 'https://schema.org',
            'headline' => wp_strip_all_tags(get_the_title($post)),
            'dateModified' => get_the_modified_date('c', $post),
            'datePublished' => get_the_date('c', $post),
            'mainEntityOfPage' => get_permalink($post),
        ];

        if ($post_type === 'hse_glossary') {
            return array_merge($base, [
                '@type' => 'DefinedTerm',
                'name' => wp_strip_all_tags(get_the_title($post)),
                'description' => wp_strip_all_tags(get_the_excerpt($post) ?: $post->post_content),
                'url' => get_permalink($post),
            ]);
        }

        if ($post_type === 'product') {
            return array_merge($base, [
                '@type' => 'Product',
                'name' => wp_strip_all_tags(get_the_title($post)),
                'description' => wp_strip_all_tags(get_the_excerpt($post) ?: $post->post_content),
                'url' => get_permalink($post),
            ]);
        }

        $type = in_array($post_type, ['post', 'hse_state', 'hse_law', 'hse_brand_review', 'hse_supplier'], true) ? 'Article' : 'WebPage';

        return array_merge($base, [
            '@type' => $type,
            'publisher' => [
                '@type' => 'Organization',
                'name' => get_bloginfo('name'),
                'url' => home_url('/'),
            ],
        ]);
    }

    private function collection_schema() {
        $title = wp_get_document_title();
        $url = $this->current_url();
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'CollectionPage',
            'name' => wp_strip_all_tags($title),
            'description' => $this->meta_description(),
            'url' => $url,
        ];

        $item_list = $this->collection_item_list_schema($title);
        if ($item_list) {
            $schema['mainEntity'] = $item_list;
        }

        return $schema;
    }

    private function collection_item_list_schema($title) {
        $posts = [];

        if (is_tax()) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $post_type = in_array($term->taxonomy, ['product_cat', 'product_tag'], true) ? 'product' : 'any';
                $posts = get_posts([
                    'post_type' => $post_type,
                    'post_status' => 'publish',
                    'numberposts' => 12,
                    'tax_query' => [
                        [
                            'taxonomy' => $term->taxonomy,
                            'field' => 'term_id',
                            'terms' => $term->term_id,
                        ],
                    ],
                ]);
            }
        } elseif (is_home()) {
            $posts = get_posts([
                'post_type' => 'post',
                'post_status' => 'publish',
                'numberposts' => 12,
            ]);
        } elseif (is_post_type_archive()) {
            $object = get_queried_object();
            $post_type = $object && !empty($object->name) ? $object->name : 'post';
            $posts = get_posts([
                'post_type' => $post_type,
                'post_status' => 'publish',
                'numberposts' => 12,
            ]);
        }

        if (empty($posts)) {
            return [];
        }

        $items = [];
        $position = 1;

        foreach ($posts as $post) {
            $item = [
                '@type' => 'ListItem',
                'position' => $position++,
                'url' => get_permalink($post),
                'name' => wp_strip_all_tags(get_the_title($post)),
            ];

            if ('product' === get_post_type($post)) {
                $item['item'] = [
                    '@type' => 'Product',
                    'name' => wp_strip_all_tags(get_the_title($post)),
                    'url' => get_permalink($post),
                ];

                if (has_post_thumbnail($post)) {
                    $item['item']['image'] = get_the_post_thumbnail_url($post, 'large');
                }
            }

            $items[] = $item;
        }

        return [
            '@type' => 'ItemList',
            'name' => wp_strip_all_tags($title),
            'numberOfItems' => count($items),
            'itemListElement' => $items,
        ];
    }

    private function breadcrumb_schema() {
        $items = [];
        $position = 1;

        $items[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => get_bloginfo('name'),
            'item' => home_url('/'),
        ];

        if (is_singular()) {
            global $post;
            if (!$post) {
                return [];
            }

            if ($post->post_parent) {
                $parent = get_post($post->post_parent);
                if ($parent) {
                    $items[] = [
                        '@type' => 'ListItem',
                        'position' => $position++,
                        'name' => wp_strip_all_tags(get_the_title($parent)),
                        'item' => get_permalink($parent),
                    ];
                }
            }

            $items[] = [
                '@type' => 'ListItem',
                'position' => $position,
                'name' => wp_strip_all_tags(get_the_title($post)),
                'item' => get_permalink($post),
            ];
        } elseif (is_tax()) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $items[] = [
                    '@type' => 'ListItem',
                    'position' => $position,
                    'name' => wp_strip_all_tags($term->name),
                    'item' => get_term_link($term),
                ];
            }
        } elseif (is_home() || is_archive()) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $position,
                'name' => wp_strip_all_tags(wp_get_document_title()),
                'item' => $this->current_url(),
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $items,
        ];
    }

    private function faq_schema($context) {
        $questions = $this->faq_items($context);
        if (empty($questions)) {
            return [];
        }

        $entities = [];
        foreach ($questions as $faq) {
            $entities[] = [
                '@type' => 'Question',
                'name' => $faq['question'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $faq['answer'],
                ],
            ];
        }

        return [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $entities,
        ];
    }

    private function current_url() {
        global $wp;

        return home_url(add_query_arg([], $wp->request ? trailingslashit($wp->request) : ''));
    }

    private function get_current_context() {
        $context = [
            'type' => '',
            'slug' => '',
            'title' => '',
            'clusters' => [],
            'state_slug' => '',
            'state_name' => '',
            'wholesale' => false,
        ];

        if (is_tax()) {
            $term = get_queried_object();
            if ($term instanceof WP_Term) {
                $context['type'] = 'term';
                $context['slug'] = $term->slug;
                $context['title'] = $term->name;
                $context['clusters'] = $this->detect_clusters($term->slug . ' ' . $term->name . ' ' . $term->description);
                $context['wholesale'] = in_array('wholesale', $context['clusters'], true);
            }

            return $context;
        }

        if (!is_singular()) {
            return $context;
        }

        global $post;
        if (!$post) {
            return $context;
        }

        $context['type'] = get_post_type($post);
        $context['slug'] = $post->post_name;
        $context['title'] = get_the_title($post);
        $content_context = trim(
            $post->post_name . ' ' .
            get_the_title($post) . ' ' .
            wp_strip_all_tags($post->post_excerpt) . ' ' .
            wp_trim_words(wp_strip_all_tags($post->post_content), 90, '')
        );
        $context['clusters'] = $this->detect_clusters($content_context);
        $context['wholesale'] = in_array('wholesale', $context['clusters'], true);

        $state_slug = get_post_meta($post->ID, '_hse_state_slug', true);
        if ($state_slug) {
            $context['state_slug'] = $state_slug;
            $context['state_name'] = $this->state_name_from_slug($state_slug);
        } elseif ($post->post_parent) {
            $candidate = $post->post_name;
            $all_states = array_flip($this->states());
            if (isset($all_states[$candidate])) {
                $context['state_slug'] = $candidate;
                $context['state_name'] = $all_states[$candidate];
            }
        }

        return $context;
    }

    private function detect_clusters($haystack) {
        $haystack = strtolower((string) $haystack);
        $clusters = [];
        $map = [
            'thca' => ['thca'],
            'cbd' => ['cbd'],
            'cbg' => ['cbg'],
            'cbn' => ['cbn', 'sleep'],
            'drinks' => ['drink', 'delta-9', 'seltzer', 'beverage'],
            'wholesale' => ['wholesale', 'bulk', 'private-label', 'white-label'],
            'law' => ['law', 'legal', 'jurisdiction'],
            'coa' => ['coa', 'lab-tested', 'lab tested', 'certificate'],
            'pre-rolls' => ['pre-roll', 'pre roll'],
            'flower' => ['flower', 'hemp'],
        ];

        foreach ($map as $cluster => $needles) {
            foreach ($needles as $needle) {
                if (strpos($haystack, $needle) !== false) {
                    $clusters[] = $cluster;
                    break;
                }
            }
        }

        if (empty($clusters)) {
            $clusters[] = 'flower';
        }

        return array_values(array_unique($clusters));
    }

    private function related_link_sections($context) {
        $map = $this->get_internal_map();
        $sections = [];
        $clusters = $context['clusters'];

        $category_links = [];
        foreach ($this->product_categories() as $category) {
            if (!in_array($category['cluster'], $clusters, true) && !in_array('flower', $clusters, true)) {
                continue;
            }
            if (isset($map['categories'][$category['slug']])) {
                $category_links[] = ['label' => $category['name'], 'url' => $map['categories'][$category['slug']]];
            }
        }
        if (!empty($category_links)) {
            $sections[] = ['title' => 'Related hemp categories', 'links' => $this->dedupe_links($category_links)];
        }

        $guide_links = [];
        foreach ($this->core_pages() as $slug => $page) {
            if ($slug === 'home' || $slug === 'hemp-authority-guides' || !isset($map['core_pages'][$slug])) {
                continue;
            }
            if ($slug === $context['slug']) {
                continue;
            }

            if (!$this->page_matches_clusters($page['clusters'], $clusters)) {
                continue;
            }

            $guide_links[] = ['label' => $page['title'], 'url' => $map['core_pages'][$slug]];
        }
        if (!empty($guide_links)) {
            $sections[] = ['title' => 'Related guides', 'links' => $this->dedupe_links($guide_links)];
        }

        $legality_links = [];
        if ($context['state_slug']) {
            $legality_links[] = [
                'label' => sprintf('%s hemp law guide', $context['state_name']),
                'url' => $this->get_state_cluster_url('hemp-laws', $context['state_slug']),
            ];
        }

        foreach (['hemp-laws-by-state', 'hemp-laws', 'thca-flower-legal-states'] as $slug) {
            if (!isset($map['core_pages'][$slug]) || $slug === $context['slug']) {
                continue;
            }

            $page = $this->core_pages()[$slug];
            if ($slug === 'hemp-laws-by-state' || $slug === 'hemp-laws' || $this->page_matches_clusters($page['clusters'], array_merge($clusters, ['law']))) {
                $legality_links[] = ['label' => $page['title'], 'url' => $map['core_pages'][$slug]];
            }
        }

        if (!empty($legality_links)) {
            $sections[] = ['title' => 'Related legality pages', 'links' => $this->dedupe_links($legality_links)];
        }

        $tag_links = [];
        foreach ($this->product_tags() as $tag) {
            if (!$tag['indexable']) {
                continue;
            }
            if (!in_array($tag['cluster'], $clusters, true) && !in_array('flower', $clusters, true)) {
                continue;
            }
            if (isset($map['tags'][$tag['slug']])) {
                $tag_links[] = ['label' => $tag['name'], 'url' => $map['tags'][$tag['slug']]];
            }
        }
        if (!empty($tag_links)) {
            $sections[] = ['title' => 'Related product tags', 'links' => $this->dedupe_links($tag_links)];
        }

        $state_links = [];
        if ($context['state_slug']) {
            foreach (array_keys($this->nested_state_clusters()) as $parent_slug) {
                $url = $this->get_state_cluster_url($parent_slug, $context['state_slug']);
                $label = sprintf('%s in %s', $this->state_cluster_label($parent_slug), $context['state_name']);
                $state_links[] = ['label' => $label, 'url' => $url];
            }
        } else {
            $default_cluster = in_array('law', $clusters, true) ? 'hemp-laws' : $this->default_state_cluster_for_context($clusters);
            foreach ($this->primary_states() as $state_name => $state_slug) {
                $state_links[] = [
                    'label' => sprintf('%s in %s', $this->state_cluster_label($default_cluster), $state_name),
                    'url' => $this->get_state_cluster_url($default_cluster, $state_slug),
                ];
            }
        }
        if (!empty($state_links)) {
            $sections[] = ['title' => 'Related state pages', 'links' => $this->dedupe_links($state_links)];
        }

        $wholesale_links = [];
        foreach (['wholesale-hemp-flower', 'wholesale-thca-flower'] as $slug) {
            if (isset($map['core_pages'][$slug])) {
                $wholesale_links[] = ['label' => $this->core_pages()[$slug]['title'], 'url' => $map['core_pages'][$slug]];
            }
        }
        if (!empty($wholesale_links)) {
            $sections[] = ['title' => 'Wholesale research', 'links' => $this->dedupe_links($wholesale_links)];
        }

        $glossary_links = [];
        foreach ($this->glossary_terms() as $term) {
            if (!$this->page_matches_clusters($term['clusters'], $clusters)) {
                continue;
            }
            if (isset($map['glossary'][$term['slug']])) {
                $glossary_links[] = ['label' => $term['title'], 'url' => $map['glossary'][$term['slug']]];
            }
        }
        if (!empty($glossary_links)) {
            $sections[] = ['title' => 'Glossary terms', 'links' => $this->dedupe_links($glossary_links)];
        }

        return $sections;
    }

    private function faq_items($context) {
        $topic = $context['title'] ? wp_strip_all_tags($context['title']) : 'these hemp products';
        $state_phrase = $context['state_name'] ? ' in ' . $context['state_name'] : '';

        $items = [
            [
                'question' => 'Does "' . $topic . '" mean local pickup or online ordering?',
                'answer' => 'On this site, "' . strtolower($topic) . '" is search guidance for online hemp product discovery, shipping research, and brand comparison. It does not claim a physical store or local inventory unless a real supplier is added later.',
            ],
            [
                'question' => 'What should I check on a hemp COA before buying' . $state_phrase . '?',
                'answer' => 'Start with cannabinoid percentages, delta-9 THC, total THC notes, batch identifiers, contaminant screening, and lab source details. If a seller cannot connect the listed product to a recent COA, treat that as a caution signal.',
            ],
            [
                'question' => 'Are hemp, THCA, and hemp-derived THC rules the same in every state?',
                'answer' => 'No. State rules can change and enforcement can differ by product type, formulation, and shipping route. Use the law pages here as plain-English research summaries, then check current local rules before buying.',
            ],
        ];

        if ($context['wholesale']) {
            $items[] = [
                'question' => 'What makes a wholesale hemp supplier worth verifying?',
                'answer' => 'Look for repeatable COAs, clear batch tracking, responsiveness on restrictions, realistic lead times, and honest documentation around shipping caveats. Avoid vendors who cannot connect inventory claims to current testing.',
            ];
        } else {
            $items[] = [
                'question' => 'Why are some pages live before products are listed?',
                'answer' => 'Some pages are research hubs because availability depends on vetted suppliers, product documentation, and jurisdiction. Use category, COA, and law links to compare options before buying.',
            ];
        }

        return $items;
    }

    private function cta_link($context) {
        $contact_page = get_page_by_path('contact', OBJECT, 'page');
        if ($contact_page) {
            return [
                'url' => get_permalink($contact_page),
                'note' => 'If a contact page is configured later, this CTA will stay pointed at it instead of exposing a raw inbox by default.',
            ];
        }

        $subject = $context['wholesale'] ? 'Wholesale Hemp Inquiry' : 'Availability Alert Request';

        return [
            'url' => 'mailto:' . antispambot(get_option('admin_email')) . '?subject=' . rawurlencode($subject),
            'note' => 'Lead capture is using a simple email fallback until a form tool is installed.',
        ];
    }

    private function get_state_cluster_url($cluster_slug, $state_slug) {
        $map = $this->get_internal_map();
        if (!empty($map['nested_state_pages'][$cluster_slug][$state_slug])) {
            return $map['nested_state_pages'][$cluster_slug][$state_slug];
        }

        if ($cluster_slug === 'hemp-laws' && !empty($map['legacy_law_pages'][$state_slug])) {
            return $map['legacy_law_pages'][$state_slug];
        }

        if (!empty($map['legacy_state_pages'][$state_slug])) {
            return $map['legacy_state_pages'][$state_slug];
        }

        return home_url('/' . trim($cluster_slug, '/') . '/' . $state_slug . '/');
    }

    private function state_grid_summary($cluster_slug) {
        if ($cluster_slug === 'hemp-laws') {
            return 'State-by-state hemp law, shipping, and buyer caution research.';
        }

        return 'State-aware buyer guidance, COA checks, search intent, and shipping caveats.';
    }

    private function count_nested_state_pages() {
        $count = 0;
        foreach (array_keys($this->nested_state_clusters()) as $parent_slug) {
            foreach ($this->primary_states() as $state_name => $state_slug) {
                if (get_page_by_path($parent_slug . '/' . $state_slug, OBJECT, 'page')) {
                    $count++;
                }
            }
        }

        return $count;
    }

    private function page_matches_clusters($page_clusters, $context_clusters) {
        foreach ($page_clusters as $cluster) {
            if (in_array($cluster, $context_clusters, true)) {
                return true;
            }
        }

        return empty($page_clusters);
    }

    private function default_state_cluster_for_context($clusters) {
        if (in_array('thca', $clusters, true)) {
            return 'thca-flower-near-me';
        }
        if (in_array('cbd', $clusters, true)) {
            return 'cbd-flower-near-me';
        }
        if (in_array('cbg', $clusters, true)) {
            return 'cbg-flower-near-me';
        }
        if (in_array('drinks', $clusters, true)) {
            return 'thc-drinks-near-me';
        }

        return 'hemp-flower-near-me';
    }

    private function state_cluster_label($cluster_slug) {
        $clusters = $this->nested_state_clusters();

        return $clusters[$cluster_slug]['label'] ?? 'State guide';
    }

    private function dedupe_links($links) {
        $seen = [];
        $unique = [];
        foreach ($links as $link) {
            if (empty($link['url']) || isset($seen[$link['url']])) {
                continue;
            }
            $seen[$link['url']] = true;
            $unique[] = $link;
        }

        return $unique;
    }

    private function get_taxonomy_sitemap_entries($taxonomy, $page, $per_page) {
        if (!taxonomy_exists($taxonomy)) {
            return [];
        }

        $args = [
            'taxonomy' => $taxonomy,
            'hide_empty' => false,
            'number' => $per_page,
            'offset' => ($page - 1) * $per_page,
            'orderby' => 'name',
            'order' => 'ASC',
        ];

        $terms = get_terms($args);
        if ($taxonomy === 'product_tag') {
            $terms = array_filter($terms, function ($term) {
                return get_term_meta($term->term_id, '_hse_indexable', true) === 'yes';
            });
        }

        $entries = [];
        foreach ($terms as $term) {
            $url = get_term_link($term);
            if (is_wp_error($url)) {
                continue;
            }

            $entries[] = [
                'loc' => $url,
                'lastmod' => gmdate('c', current_time('timestamp')),
            ];
        }

        return $entries;
    }

    private function build_core_page_content($slug, $config) {
        $html = '<p class="hse-direct-answer"><strong>Direct answer:</strong> ' . esc_html($config['answer']) . '</p>';
        $html .= '<p>' . esc_html($config['summary']) . '</p>';
        $html .= '<section class="hse-content-section"><h2>What this page helps you compare</h2><p>' . esc_html($config['compare']) . '</p></section>';
        $html .= '<section class="hse-content-section"><h2>How to use this research hub</h2><ul>';
        foreach ($config['bullets'] as $bullet) {
            $html .= '<li>' . esc_html($bullet) . '</li>';
        }
        $html .= '</ul></section>';

        if ($slug === 'hemp-laws-by-state' || $slug === 'hemp-laws') {
            $html .= do_shortcode('[hse_state_grid scope="primary" cluster="hemp-laws"]');
        } elseif ($slug === 'home') {
            $html .= '<p>Use the homepage to browse product categories, state guides, COA help, and wholesale research from one starting point.</p>';
        } elseif ($slug === 'hemp-authority-guides') {
            $html .= '<p>This page acts as the blog hub for published authority content and comparison guides.</p>';
        } else {
            $focus = !empty($config['grid_focus']) ? ' focus="' . esc_attr($config['grid_focus']) . '"' : '';
            $html .= do_shortcode('[hse_category_grid' . $focus . ' limit="6"]');
        }

        $html .= do_shortcode('[hse_trust_box]');
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_legal_notice]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function build_nested_state_content($parent_slug, $state_name, $state_slug) {
        $cluster = $this->nested_state_clusters()[$parent_slug];
        $searched = implode(', ', $cluster['searches']);
        $coa_checks = [
            'Batch-matched COA or lab report',
            'Cannabinoid percentages and delta-9 THC notes',
            'Contaminant screening, including solvents or heavy metals where relevant',
            'Shipping restriction language that matches the seller policy',
        ];

        $html = '<p class="hse-direct-answer"><strong>Direct answer:</strong> ' . esc_html(sprintf($cluster['answer'], $state_name)) . '</p>';
        $html .= '<p class="hse-last-updated">Last updated: ' . esc_html(current_time('F j, Y')) . '</p>';
        $html .= '<section class="hse-content-section"><h2>' . esc_html($state_name) . ' snapshot</h2><p>' . esc_html(sprintf($cluster['summary'], $state_name)) . '</p></section>';
        $html .= '<section class="hse-content-section"><h2>What buyers search for in ' . esc_html($state_name) . '</h2><p>' . esc_html($searched) . '.</p></section>';
        $html .= '<section class="hse-content-section"><h2>Availability and shipping caveat</h2><p>Availability depends on jurisdiction, carrier policy, and how the seller handles state restrictions. Treat this page as state-aware online buying guidance, not a promise of local pickup or a physical storefront in ' . esc_html($state_name) . '.</p></section>';
        $html .= '<section class="hse-content-section"><h2>COA checklist</h2><ul>';
        foreach ($coa_checks as $item) {
            $html .= '<li>' . esc_html($item) . '</li>';
        }
        $html .= '</ul></section>';
        $html .= do_shortcode('[hse_trust_box compact="yes"]');
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_legal_notice]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function build_legacy_state_content($state_name, $state_slug) {
        $html = '<p class="hse-direct-answer"><strong>Direct answer:</strong> This state guide helps buyers compare hemp flower, CBD, CBG, THCA, drinks, COA checks, and availability questions in ' . esc_html($state_name) . '.</p>';
        $html .= '<p class="hse-last-updated">Last updated: ' . esc_html(current_time('F j, Y')) . '</p>';
        $html .= '<section class="hse-content-section"><h2>' . esc_html($state_name) . ' hemp research hub</h2><p>Use this page to compare hemp flower, CBD flower, CBG flower, THCA flower, and hemp-derived THC drink searches in ' . esc_html($state_name) . '. Local pickup and store inventory should be verified with a real supplier before relying on it.</p></section>';
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_legal_notice]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function build_legacy_law_content($state_name, $state_slug) {
        $html = '<p class="hse-direct-answer"><strong>Direct answer:</strong> This law page summarizes hemp, THCA, hemp-derived THC drink, shipping, and COA questions buyers often research in ' . esc_html($state_name) . '.</p>';
        $html .= '<p class="hse-last-updated">Last updated: ' . esc_html(current_time('F j, Y')) . '</p>';
        $html .= '<section class="hse-content-section"><h2>Legal research focus</h2><p>Track hemp flower, THCA flower, hemp-derived THC drinks, COA documentation, state restrictions, and shipping caveats in plain English. State rules can change, so use this page as a research starting point and not legal advice.</p></section>';
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_legal_notice]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function build_glossary_content($term) {
        $html = '<p class="hse-direct-answer"><strong>Definition:</strong> ' . esc_html($term['summary']) . '</p>';
        $html .= '<section class="hse-content-section"><h2>Why this term matters for buyers</h2><p>' . esc_html($term['buyer_use']) . '</p></section>';
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function build_post_content($topic) {
        $keyword = esc_html($topic['kw']);
        $title = esc_html($topic['title']);

        $html = '<p class="hse-direct-answer"><strong>Direct answer:</strong> This guide targets buyers searching for ' . $keyword . '. It explains what to compare, what COA or legality questions matter, and where to continue researching on this site.</p>';
        $html .= '<section class="hse-content-section"><h2>Buyer intent</h2><p>People searching for ' . $keyword . ' usually want product availability guidance, legal context, supplier verification, or a simpler way to compare product formats without trusting hype.</p></section>';
        $html .= '<section class="hse-content-section"><h2>What to compare first</h2><ul><li>Cannabinoid profile and product format</li><li>COA freshness and batch matching</li><li>Shipping caveats and state restrictions</li><li>Whether the seller explains compliance clearly</li></ul></section>';
        $html .= '<section class="hse-content-section"><h2>COA and legality notes</h2><p>Check delta-9 THC, total THC, contaminant panels, batch identifiers, and any state-specific shipping note before buying. Availability depends on jurisdiction and current policy changes.</p></section>';
        $html .= do_shortcode('[hse_internal_links]');
        $html .= do_shortcode('[hse_category_grid limit="4"]');
        $html .= do_shortcode('[hse_legal_notice]');
        $html .= do_shortcode('[hse_faq]');
        $html .= do_shortcode('[hse_cta]');

        return $html;
    }

    private function post_excerpt($topic) {
        return 'Authority guide targeting "' . $topic['kw'] . '" with buyer-focused comparison points, COA checks, and internal links to state, category, and guide clusters.';
    }

    private function core_pages() {
        return [
            'home' => [
                'title' => 'Home',
                'summary' => 'Homepage hub for hemp category discovery, state pages, COA guidance, and wholesale research.',
                'answer' => 'The homepage helps visitors browse hemp flower, THCA, CBD, CBG, hemp drinks, COA help, state law pages, and wholesale research from one starting point.',
                'compare' => 'Use the homepage to move into product categories, state guides, buyer education, and supplier-verification topics.',
                'bullets' => [
                    'Start with broad hemp categories and narrow by product type.',
                    'Use state guides to review availability and shipping caveats.',
                    'Check COA and lab-testing resources before trusting product claims.',
                ],
                'clusters' => [],
                'grid_focus' => '',
            ],
            'hemp-authority-guides' => [
                'title' => 'Hemp Authority Guides',
                'summary' => 'Blog hub for buyer guides, comparisons, state content, and compliance research.',
                'answer' => 'This hub is the clean place to list published authority content once scheduled posts begin publishing.',
                'compare' => 'Use it to funnel visitors into buyer guides, comparison pages, state pages, and wholesale research clusters.',
                'bullets' => [
                    'Start with evergreen guides when comparing hemp categories.',
                    'Use state and law links to check availability caveats.',
                    'Use COA pages when product documentation needs a closer look.',
                ],
                'clusters' => [],
                'grid_focus' => '',
            ],
            'hemp-flower-near-me' => [
                'title' => 'Hemp Flower Near Me',
                'summary' => 'Search hub for hemp flower, CBD flower, CBG flower, pre-rolls, COA checks, and state-aware online buying guidance.',
                'answer' => 'Most hemp flower near me searches are really about online buying guidance, COA-backed comparison, and state-aware availability research.',
                'compare' => 'Compare hemp flower formats, category clusters, COA signals, and state pages without assuming a local store exists.',
                'bullets' => [
                    'Use category links to sort by flower type or product format.',
                    'Use state pages to review shipping caveats and law research.',
                    'Check COA and lab-tested language before trusting a seller.',
                ],
                'clusters' => ['flower'],
                'grid_focus' => 'flower',
            ],
            'thca-flower-near-me' => [
                'title' => 'THCA Flower Near Me',
                'summary' => 'Research hub for THCA flower, legality questions, COA education, supplier verification, and state-aware availability guidance.',
                'answer' => 'THCA flower near me searches usually signal a need for legality context, COA review, and safer supplier comparison before any buying decision.',
                'compare' => 'Compare THCA flower pages, state law research, legality guides, and wholesale context before relying on any seller claim.',
                'bullets' => [
                    'Availability depends on jurisdiction and seller policy.',
                    'Use law pages before trusting broad legality claims.',
                    'Prioritize lab-backed documentation and batch matching.',
                ],
                'clusters' => ['thca', 'flower', 'law'],
                'grid_focus' => 'thca',
            ],
            'cbd-flower-near-me' => [
                'title' => 'CBD Flower Near Me',
                'summary' => 'CBD flower hub for online buying guidance, COA checks, pre-roll comparisons, and state-aware availability research.',
                'answer' => 'CBD flower near me searches often mean buyers want trusted online discovery guidance rather than a guaranteed local storefront.',
                'compare' => 'Use this hub to compare CBD flower categories, pre-rolls, COA signals, and state-level research before buying.',
                'bullets' => [
                    'Check indoor versus greenhouse positioning.',
                    'Use COA pages to understand cannabinoid percentages.',
                    'Compare related CBD and CBG category pages before choosing.',
                ],
                'clusters' => ['cbd', 'flower'],
                'grid_focus' => 'cbd',
            ],
            'cbg-flower-near-me' => [
                'title' => 'CBG Flower Near Me',
                'summary' => 'CBG flower hub for category comparison, COA review, shipping caveats, and state-aware search guidance.',
                'answer' => 'CBG flower near me searches are best handled with category comparison, COA checks, and state-aware research before relying on local availability.',
                'compare' => 'Compare CBG flower and pre-roll categories, legality questions, and relevant state or glossary pages.',
                'bullets' => [
                    'Use comparison pages to contrast CBG with CBD and THCA.',
                    'Check batch-specific testing before trusting potency language.',
                    'Use state hubs to keep shipping research grounded.',
                ],
                'clusters' => ['cbg', 'flower'],
                'grid_focus' => 'cbg',
            ],
            'thc-drinks-near-me' => [
                'title' => 'THC Drinks Near Me',
                'summary' => 'State-aware guide hub for hemp-derived THC drinks, delta-9 beverages, seltzers, COA checks, and buyer safety language.',
                'answer' => 'THC drinks near me searches need state-aware hemp beverage guidance, label comparison, and legality caution before relying on availability claims.',
                'compare' => 'Compare drink categories, dosage language, state law pages, and COA guidance before trusting beverage marketing.',
                'bullets' => [
                    'Use state pages before assuming a drink can ship everywhere.',
                    'Look for low-dose guidance and clear labeling.',
                    'Keep alcohol-alternative claims grounded and compliant.',
                ],
                'clusters' => ['drinks', 'law'],
                'grid_focus' => 'drinks',
            ],
            'hemp-derived-thc-drinks' => [
                'title' => 'Hemp-Derived THC Drinks',
                'summary' => 'Guide page for hemp-derived THC drinks, delta-9 beverages, seltzers, and state-aware product-discovery language.',
                'answer' => 'Hemp-derived THC drinks require careful label reading, state-aware shipping research, and clearer COA expectations than most casual beverage pages provide.',
                'compare' => 'Use this guide to compare product formats, low-dose positioning, state restrictions, and related drink pages.',
                'bullets' => [
                    'Check drink format and milligram positioning.',
                    'Use law pages for jurisdiction changes and shipping caveats.',
                    'Avoid reckless intoxication language or certainty claims.',
                ],
                'clusters' => ['drinks', 'law'],
                'grid_focus' => 'drinks',
            ],
            'wholesale-thca-flower' => [
                'title' => 'Wholesale THCA Flower',
                'summary' => 'Wholesale THCA flower page focused on supplier verification, COA standards, and state-aware caution language.',
                'answer' => 'Wholesale THCA flower research should begin with supplier verification, current COAs, restriction notes, and realistic fulfillment questions.',
                'compare' => 'Compare batch documentation, supplier responsiveness, lab data, and restriction notes before trusting a wholesale offer.',
                'bullets' => [
                    'Use this page to prepare better supplier questions.',
                    'Prioritize COA-backed batch documentation.',
                    'Keep state and shipping restrictions visible.',
                ],
                'clusters' => ['thca', 'wholesale', 'law'],
                'grid_focus' => 'thca',
            ],
            'wholesale-hemp-flower' => [
                'title' => 'Wholesale Hemp Flower',
                'summary' => 'Wholesale hemp flower hub for CBD, CBG, and compliant supplier verification research.',
                'answer' => 'Wholesale hemp flower research should lead with supplier verification, COA expectations, and clear shipping restrictions before pricing conversations.',
                'compare' => 'Use this hub to compare wholesale flower categories, bulk terms, compliance language, and related buyer-safety pages.',
                'bullets' => [
                    'Use it as a wholesale education and inquiry path.',
                    'Keep compliance and batch quality front and center.',
                    'Link buyers into CBD, CBG, and THCA wholesale pages cleanly.',
                ],
                'clusters' => ['flower', 'wholesale'],
                'grid_focus' => 'flower',
            ],
            'thca-flower-legal-states' => [
                'title' => 'THCA Flower Legal States',
                'summary' => 'Guide page for state-by-state THCA flower legal research, shipping caveats, and no-certainty legality language.',
                'answer' => 'THCA flower legal states content should help buyers track changing rules and seller restrictions, not promise blanket legality.',
                'compare' => 'Use this page to compare law pages, shipping questions, state research, and related THCA guides.',
                'bullets' => [
                    'State rules can change quickly.',
                    'Use seller restriction notes alongside law research.',
                    'Avoid guaranteed legality language.',
                ],
                'clusters' => ['thca', 'law'],
                'grid_focus' => 'thca',
            ],
            'hemp-laws-by-state' => [
                'title' => 'Hemp Laws By State',
                'summary' => 'Hub page for hemp law research by state covering flower, THCA, drinks, shipping, and COA-related buyer caution.',
                'answer' => 'This hub organizes state-by-state hemp law research for flower, THCA, hemp-derived THC drinks, shipping caveats, and buyer safety.',
                'compare' => 'Use it to branch into nested state pages, legacy law pages, and related legality or comparison guides.',
                'bullets' => [
                    'Check current state pages before buying.',
                    'Use law research as a guide, not legal advice.',
                    'Watch for product-type differences across flower, drinks, and wholesale.',
                ],
                'clusters' => ['law'],
                'grid_focus' => '',
            ],
            'hemp-laws' => [
                'title' => 'Hemp Laws',
                'summary' => 'Hub page for hemp law research by state.',
                'answer' => 'This page helps buyers jump into state-specific hemp law, THCA, shipping, drink, and COA research.',
                'compare' => 'Use it to move from broad hemp law questions into state-specific buyer guidance.',
                'bullets' => [
                    'Open state pages before assuming a product can ship.',
                    'Compare product-type differences across flower, drinks, and wholesale.',
                    'Treat law summaries as research, not legal advice.',
                ],
                'clusters' => ['law'],
                'grid_focus' => '',
            ],
            'how-to-read-a-hemp-coa' => [
                'title' => 'How To Read A Hemp COA',
                'summary' => 'Guide page for reading hemp COAs, cannabinoid percentages, contaminant results, and batch identifiers.',
                'answer' => 'A useful hemp COA page should explain cannabinoid percentages, delta-9 THC, total THC, contaminant screening, batch IDs, and how to spot weak documentation quickly.',
                'compare' => 'Use this guide when a product page or supplier claim feels too vague to trust at face value.',
                'bullets' => [
                    'Check batch matching first.',
                    'Look for cannabinoid values and contaminant panels.',
                    'Use it as the trust anchor for category, tag, and state pages.',
                ],
                'clusters' => ['coa'],
                'grid_focus' => '',
            ],
            'best-thca-flower-brands' => [
                'title' => 'Best THCA Flower Brands',
                'summary' => 'Editorial research page for comparing THCA flower brands through verification signals.',
                'answer' => 'Best THCA flower brand content should stay editorial and verification-focused until real supplier details, lab data, and trust signals are available.',
                'compare' => 'Use this page to compare documentation quality, COA clarity, restriction notes, and brand transparency rather than hype copy.',
                'bullets' => [
                    'Keep reviews grounded in verification standards.',
                    'Use documented trust signals instead of unsupported ratings.',
                    'Link into COA, legality, and state pages aggressively.',
                ],
                'clusters' => ['thca', 'coa', 'law'],
                'grid_focus' => 'thca',
            ],
            'best-hemp-thc-drinks' => [
                'title' => 'Best Hemp THC Drinks',
                'summary' => 'Editorial comparison page for hemp-derived THC drinks, low-dose options, and label clarity.',
                'answer' => 'Best hemp THC drink content should help buyers compare label clarity, state restrictions, milligram positioning, and safety language before trusting any beverage claim.',
                'compare' => 'Use this page to compare formats, low-dose positioning, and state-aware beverage guidance.',
                'bullets' => [
                    'Focus on label clarity and jurisdiction caveats.',
                    'Avoid reckless intoxication language.',
                    'Use related drink and law pages to support the comparison.',
                ],
                'clusters' => ['drinks', 'law'],
                'grid_focus' => 'drinks',
            ],
            'cbn-gummies-for-sleep' => [
                'title' => 'CBN Gummies For Sleep',
                'summary' => 'Guide page for CBN sleep products, CBD+CBN comparisons, and compliant buyer-safety language.',
                'answer' => 'CBN gummies for sleep pages should help buyers compare product format, supportive documentation, and melatonin positioning without making medical claims.',
                'compare' => 'Use this page to compare CBN, CBD+CBN, and sleep-product positioning with buyer-safety language intact.',
                'bullets' => [
                    'Avoid medical claims.',
                    'Use buyer guidance and comparison language instead.',
                    'Link into glossary, COA, and comparison pages for support.',
                ],
                'clusters' => ['cbn', 'cbd'],
                'grid_focus' => '',
            ],
            'cbd-vs-cbg-vs-thca' => [
                'title' => 'CBD vs CBG vs THCA',
                'summary' => 'Comparison guide for CBD, CBG, and THCA pages with buyer-intent framing and legality context.',
                'answer' => 'This comparison guide should explain how CBD, CBG, and THCA differ in search intent, legal caution, product format, and COA review needs.',
                'compare' => 'Use it as a bridge page between cannabinoid clusters, state-law pages, and product categories.',
                'bullets' => [
                    'Highlight buyer intent differences, not medical outcomes.',
                    'Tie every comparison back to COA and legality research.',
                    'Link into the main near-me pages and flower categories.',
                ],
                'clusters' => ['cbd', 'cbg', 'thca', 'coa', 'law'],
                'grid_focus' => 'flower',
            ],
        ];
    }

    private function nested_state_clusters() {
        return [
            'hemp-flower-near-me' => [
                'label' => 'Hemp Flower Near Me',
                'title' => 'Hemp Flower Near Me in %s',
                'summary' => 'Plain-English hemp flower research hub for %s covering CBD flower, CBG flower, pre-rolls, shipping caveats, and buyer-safety guidance.',
                'answer' => 'Looking for hemp flower in %s usually means comparing online shipping options, COA-backed product details, and state-aware availability rather than assuming a local storefront.',
                'searches' => ['hemp flower near me', 'CBD flower', 'CBG flower', 'hemp pre-rolls'],
            ],
            'thca-flower-near-me' => [
                'label' => 'THCA Flower Near Me',
                'title' => 'THCA Flower Near Me in %s',
                'summary' => 'State-aware THCA flower buyer page for %s covering COA checks, legality research, and shipping caution language.',
                'answer' => 'THCA flower searches in %s should start with legality caution, COA review, and seller restriction notes before any product decision.',
                'searches' => ['THCA flower near me', 'THCA pre-rolls', 'THCA legal states', 'COA verified THCA'],
            ],
            'cbd-flower-near-me' => [
                'label' => 'CBD Flower Near Me',
                'title' => 'CBD Flower Near Me in %s',
                'summary' => 'CBD flower page for %s focused on online buying guidance, lab-tested comparison, and non-intoxicating hemp product research.',
                'answer' => 'CBD flower searches in %s are best handled through online discovery guidance, COA review, and product-format comparison before relying on local availability claims.',
                'searches' => ['CBD flower near me', 'CBD pre-rolls', 'lab-tested hemp', 'COA verified CBD flower'],
            ],
            'cbg-flower-near-me' => [
                'label' => 'CBG Flower Near Me',
                'title' => 'CBG Flower Near Me in %s',
                'summary' => 'CBG flower page for %s focused on category comparison, COA review, and cleaner state-aware availability guidance.',
                'answer' => 'CBG flower searches in %s usually mean buyers want category comparison, batch testing, and state-aware shipping guidance before ordering online.',
                'searches' => ['CBG flower near me', 'CBG flower', 'CBG pre-rolls', 'CBG vs CBD'],
            ],
            'thc-drinks-near-me' => [
                'label' => 'THC Drinks Near Me',
                'title' => 'THC Drinks Near Me in %s',
                'summary' => 'Hemp-derived THC drink page for %s covering beverage formats, legality caution, and low-dose comparison language.',
                'answer' => 'THC drinks searches in %s should focus on state restrictions, low-dose labeling, and product documentation instead of bold certainty claims.',
                'searches' => ['THC drinks near me', 'delta-9 drinks', 'THC seltzer', 'hemp-derived THC drinks'],
            ],
            'hemp-laws' => [
                'label' => 'Hemp Laws',
                'title' => 'Hemp Laws in %s',
                'summary' => 'Plain-English hemp law page for %s covering flower, THCA, drinks, shipping caveats, and ongoing rule changes.',
                'answer' => 'Hemp law research in %s should stay cautious, because product-specific rules, shipping restrictions, and enforcement can change over time.',
                'searches' => ['hemp laws', 'THCA legality', 'shipping restrictions', 'hemp-derived THC rules'],
            ],
        ];
    }

    private function product_categories() {
        return [
            ['name' => 'Hemp Flower', 'slug' => 'hemp-flower', 'description' => 'Core hemp flower hub for CBD, CBG, THCA, pre-rolls, smalls, trim, and buyer education.', 'parent' => '', 'cluster' => 'flower'],
            ['name' => 'CBD Flower', 'slug' => 'cbd-flower', 'description' => 'CBD-rich hemp flower for buyers researching legal non-intoxicating hemp flower, CBD nugs, smalls, and pre-rolls.', 'parent' => 'hemp-flower', 'cluster' => 'cbd'],
            ['name' => 'CBG Flower', 'slug' => 'cbg-flower', 'description' => 'CBG hemp flower, smalls, pre-rolls, and comparison pages around CBG versus CBD.', 'parent' => 'hemp-flower', 'cluster' => 'cbg'],
            ['name' => 'THCA Flower', 'slug' => 'thca-flower', 'description' => 'THCA flower research, COA education, legality caution, and verified product discovery.', 'parent' => 'hemp-flower', 'cluster' => 'thca'],
            ['name' => 'Hemp Smalls & Trim', 'slug' => 'hemp-smalls-trim', 'description' => 'Budget hemp flower, shake, trim, and value-focused buyer guidance.', 'parent' => 'hemp-flower', 'cluster' => 'flower'],
            ['name' => 'Hemp Pre-Rolls', 'slug' => 'hemp-pre-rolls', 'description' => 'CBD, CBG, THCA, and hemp pre-roll buyer research for beginner and repeat shoppers.', 'parent' => '', 'cluster' => 'pre-rolls'],
            ['name' => 'CBD Pre-Rolls', 'slug' => 'cbd-pre-rolls', 'description' => 'CBD hemp pre-roll packs, sampler packs, and non-intoxicating buyer guides.', 'parent' => 'hemp-pre-rolls', 'cluster' => 'cbd'],
            ['name' => 'CBG Pre-Rolls', 'slug' => 'cbg-pre-rolls', 'description' => 'CBG pre-rolls, daytime hemp pre-rolls, and CBG versus CBD comparison content.', 'parent' => 'hemp-pre-rolls', 'cluster' => 'cbg'],
            ['name' => 'THCA Pre-Rolls', 'slug' => 'thca-pre-rolls', 'description' => 'THCA pre-roll research, legality notes, COA guidance, and verified product discovery.', 'parent' => 'hemp-pre-rolls', 'cluster' => 'thca'],
            ['name' => 'Hemp-Derived THC Drinks', 'slug' => 'hemp-derived-thc-drinks', 'description' => 'Hemp-derived THC drinks, delta-9 beverages, THC seltzers, and state-by-state buyer guides.', 'parent' => '', 'cluster' => 'drinks'],
            ['name' => 'Delta-9 Hemp Drinks', 'slug' => 'delta-9-hemp-drinks', 'description' => 'Low-dose hemp-derived delta-9 drinks, milligram guides, and alcohol-alternative intent.', 'parent' => 'hemp-derived-thc-drinks', 'cluster' => 'drinks'],
            ['name' => 'THC Seltzers', 'slug' => 'thc-seltzers', 'description' => 'THC seltzers, sparkling drink formats, and state-aware beverage buyer guidance.', 'parent' => 'hemp-derived-thc-drinks', 'cluster' => 'drinks'],
            ['name' => 'CBN Sleep Products', 'slug' => 'cbn-sleep-products', 'description' => 'CBN gummies, CBD+CBN sleep products, and compliant buyer guides for nighttime categories.', 'parent' => '', 'cluster' => 'cbn'],
            ['name' => 'Wholesale Hemp Flower', 'slug' => 'wholesale-hemp-flower', 'description' => 'Bulk hemp flower, CBD flower pounds, CBG flower, supplier verification, and wholesale lead generation.', 'parent' => '', 'cluster' => 'wholesale'],
            ['name' => 'Wholesale CBD Flower', 'slug' => 'wholesale-cbd-flower', 'description' => 'Bulk CBD flower, trim, smalls, and B2B buyer intent pages.', 'parent' => 'wholesale-hemp-flower', 'cluster' => 'wholesale'],
            ['name' => 'Wholesale CBG Flower', 'slug' => 'wholesale-cbg-flower', 'description' => 'Bulk CBG flower, pounds, biomass, and supplier verification research.', 'parent' => 'wholesale-hemp-flower', 'cluster' => 'wholesale'],
            ['name' => 'Wholesale THCA Flower', 'slug' => 'wholesale-thca-flower', 'description' => 'Bulk THCA flower, THCA pounds, smalls, trim, and supplier verification content.', 'parent' => 'wholesale-hemp-flower', 'cluster' => 'wholesale'],
            ['name' => 'Hemp Accessories', 'slug' => 'hemp-accessories', 'description' => 'Storage jars, humidity packs, grinders, smell-proof bags, and freshness accessories.', 'parent' => '', 'cluster' => 'flower'],
            ['name' => 'Hemp Storage Kits', 'slug' => 'hemp-storage-kits', 'description' => 'Humidity packs, glass jars, UV jars, and freshness protection tools for hemp flower.', 'parent' => 'hemp-accessories', 'cluster' => 'flower'],
            ['name' => 'COA-Verified Hemp Products', 'slug' => 'coa-verified-hemp-products', 'description' => 'Collections organized around lab reports, batch IDs, contaminant testing, and buyer trust.', 'parent' => '', 'cluster' => 'coa'],
            ['name' => 'Legal Hemp Products', 'slug' => 'legal-hemp-products', 'description' => 'Legal-caution collection pages for compliant hemp product discovery and state-aware shopping research.', 'parent' => '', 'cluster' => 'law'],
        ];
    }

    private function product_tags() {
        return [
            ['name' => 'THCA Flower', 'slug' => 'thca-flower-tag', 'description' => 'Landing tag for THCA flower research, COA review, and related legality pages.', 'cluster' => 'thca', 'indexable' => true],
            ['name' => 'CBD Flower', 'slug' => 'cbd-flower-tag', 'description' => 'Landing tag for CBD flower buyer research, lab-tested comparison, and pre-roll links.', 'cluster' => 'cbd', 'indexable' => true],
            ['name' => 'CBG Flower', 'slug' => 'cbg-flower-tag', 'description' => 'Landing tag for CBG flower research, comparison pages, and state-aware guidance.', 'cluster' => 'cbg', 'indexable' => true],
            ['name' => 'CBDV Flower', 'slug' => 'cbdv-flower', 'description' => 'Landing tag for CBDV hemp flower, minor-cannabinoid flower research, wholesale buyer discovery, and COA-backed comparison paths.', 'cluster' => 'cbd', 'indexable' => true],
            ['name' => 'Hemp Flower', 'slug' => 'hemp-flower-tag', 'description' => 'Landing tag for broad hemp flower discovery and related category or law pages.', 'cluster' => 'flower', 'indexable' => true],
            ['name' => 'Indoor Hemp Flower', 'slug' => 'indoor-hemp-flower', 'description' => 'Tag hub for indoor hemp flower comparison and premium flower buyer guidance.', 'cluster' => 'flower', 'indexable' => true],
            ['name' => 'Greenhouse Hemp Flower', 'slug' => 'greenhouse-hemp-flower', 'description' => 'Tag hub for greenhouse hemp flower and related comparison content.', 'cluster' => 'flower', 'indexable' => true],
            ['name' => 'Hemp Pre-Rolls', 'slug' => 'hemp-pre-rolls-tag', 'description' => 'Landing tag for hemp pre-roll content, category links, and buyer guides.', 'cluster' => 'pre-rolls', 'indexable' => true],
            ['name' => 'THCA Pre-Rolls', 'slug' => 'thca-pre-rolls-tag', 'description' => 'Tag hub for THCA pre-roll research, law pages, and COA guidance.', 'cluster' => 'thca', 'indexable' => true],
            ['name' => 'Hemp-Derived THC Drinks', 'slug' => 'hemp-derived-thc-drinks-tag', 'description' => 'Landing tag for hemp-derived THC drink content and state-aware beverage research.', 'cluster' => 'drinks', 'indexable' => true],
            ['name' => 'Delta-9 Drinks', 'slug' => 'delta-9-drinks', 'description' => 'Tag hub for low-dose delta-9 drinks, beverage comparison, and law pages.', 'cluster' => 'drinks', 'indexable' => true],
            ['name' => 'THC Seltzer', 'slug' => 'thc-seltzer', 'description' => 'Landing tag for THC seltzer pages and drink-related buyer safety content.', 'cluster' => 'drinks', 'indexable' => true],
            ['name' => 'CBN Gummies', 'slug' => 'cbn-gummies', 'description' => 'Tag hub for CBN gummies, sleep products, and compliant buyer guidance.', 'cluster' => 'cbn', 'indexable' => true],
            ['name' => 'CBN Sleep', 'slug' => 'cbn-sleep', 'description' => 'Landing tag for CBN sleep product discovery and comparison content.', 'cluster' => 'cbn', 'indexable' => true],
            ['name' => 'COA Verified', 'slug' => 'coa-verified', 'description' => 'Tag hub for COA-backed products, lab-tested research, and buyer trust pages.', 'cluster' => 'coa', 'indexable' => true],
            ['name' => 'Lab Tested Hemp', 'slug' => 'lab-tested-hemp', 'description' => 'Landing tag for lab-tested hemp research, COA education, and supplier trust content.', 'cluster' => 'coa', 'indexable' => true],
            ['name' => 'Wholesale Hemp', 'slug' => 'wholesale-hemp', 'description' => 'Landing tag for wholesale hemp flower, supplier verification, and B2B research.', 'cluster' => 'wholesale', 'indexable' => true],
            ['name' => 'Wholesale THCA', 'slug' => 'wholesale-thca', 'description' => 'Tag hub for wholesale THCA flower pages, COA requirements, and state caution.', 'cluster' => 'wholesale', 'indexable' => true],
            ['name' => 'Bulk Hemp Flower', 'slug' => 'bulk-hemp-flower', 'description' => 'Landing tag for bulk hemp flower research, supplier vetting, and wholesale links.', 'cluster' => 'wholesale', 'indexable' => true],
            ['name' => 'THCA Pounds', 'slug' => 'thca-pounds', 'description' => 'Tag hub for THCA pounds, wholesale research, and supplier verification content.', 'cluster' => 'wholesale', 'indexable' => true],
            ['name' => 'Hemp Flower Near Me', 'slug' => 'hemp-flower-near-me-tag', 'description' => 'Landing tag for hemp flower near me search guidance and state pages.', 'cluster' => 'flower', 'indexable' => true],
            ['name' => 'THCA Near Me', 'slug' => 'thca-near-me', 'description' => 'Landing tag for THCA near me search guidance and law-linked comparison pages.', 'cluster' => 'thca', 'indexable' => true],
            ['name' => 'CBD Flower Near Me', 'slug' => 'cbd-flower-near-me-tag', 'description' => 'Landing tag for CBD flower near me search capture and related buyer guides.', 'cluster' => 'cbd', 'indexable' => true],
            ['name' => 'CBG Flower Near Me', 'slug' => 'cbg-flower-near-me-tag', 'description' => 'Landing tag for CBG flower near me search capture and comparison pages.', 'cluster' => 'cbg', 'indexable' => true],
            ['name' => 'Legal Hemp Products', 'slug' => 'legal-hemp-products-tag', 'description' => 'Landing tag for legal hemp product research and state-aware buying pages.', 'cluster' => 'law', 'indexable' => true],
        ];
    }

    private function blog_categories() {
        return [
            'Hemp Flower Guides' => 'hemp-flower-guides',
            'THCA Flower Guides' => 'thca-flower-guides',
            'CBD Flower Guides' => 'cbd-flower-guides',
            'CBG Flower Guides' => 'cbg-flower-guides',
            'Hemp THC Drinks' => 'hemp-thc-drinks',
            'CBN Sleep' => 'cbn-sleep',
            'Hemp Laws' => 'hemp-laws',
            'COA & Lab Testing' => 'coa-lab-testing',
            'Wholesale Hemp' => 'wholesale-hemp',
            'Buyer Safety' => 'buyer-safety',
            'Hemp Comparisons' => 'hemp-comparisons',
            'State Guides' => 'state-guides',
        ];
    }

    private function glossary_terms() {
        return [
            ['title' => 'THCA', 'slug' => 'thca', 'summary' => 'THCA is a cannabinoid that buyers often research for legality, COA interpretation, and product comparison.', 'buyer_use' => 'Buyers use THCA pages to compare flower, pre-rolls, law pages, and supplier verification without assuming blanket legality.', 'clusters' => ['thca', 'law']],
            ['title' => 'CBD Flower', 'slug' => 'cbd-flower', 'summary' => 'CBD flower is hemp flower often researched by buyers looking for non-intoxicating product discovery.', 'buyer_use' => 'CBD flower pages help buyers compare categories, pre-rolls, lab-tested products, and state-aware shopping guidance.', 'clusters' => ['cbd', 'flower']],
            ['title' => 'CBG Flower', 'slug' => 'cbg-flower', 'summary' => 'CBG flower is hemp flower rich in cannabigerol and commonly compared with CBD flower.', 'buyer_use' => 'CBG flower content supports comparison research, category discovery, and state-aware product search intent.', 'clusters' => ['cbg', 'flower']],
            ['title' => 'COA', 'slug' => 'coa', 'summary' => 'A Certificate of Analysis is the lab report buyers use to review cannabinoids, batch data, and contaminant testing.', 'buyer_use' => 'COA pages work as the trust anchor for product categories, tags, state pages, and verified product pages.', 'clusters' => ['coa']],
            ['title' => 'Delta-9 Hemp Drinks', 'slug' => 'delta-9-hemp-drinks', 'summary' => 'Hemp-derived delta-9 drinks are beverage products buyers research through state law pages and dosage comparisons.', 'buyer_use' => 'Drink buyers use this term to compare beverage formats, low-dose positioning, and state-aware availability.', 'clusters' => ['drinks', 'law']],
            ['title' => 'CBN', 'slug' => 'cbn', 'summary' => 'CBN is a cannabinoid commonly researched in sleep-product searches and compared with CBD.', 'buyer_use' => 'CBN pages help buyers compare sleep-product language, CBN gummies, and buyer-safety guidance without medical claims.', 'clusters' => ['cbn']],
            ['title' => 'Lab-Tested Hemp', 'slug' => 'lab-tested-hemp', 'summary' => 'Lab-tested hemp refers to products backed by current testing documents that buyers can review before ordering.', 'buyer_use' => 'This term matters when comparing seller transparency, product trust signals, and COA-backed shopping decisions.', 'clusters' => ['coa', 'flower']],
            ['title' => 'Total THC', 'slug' => 'total-thc', 'summary' => 'Total THC is a lab-report concept buyers use when reviewing hemp compliance and seller claims.', 'buyer_use' => 'It matters on COA pages, legality pages, and product-comparison hubs where shipping caveats matter.', 'clusters' => ['coa', 'law']],
        ];
    }

    private function states() {
        return [
            'Alabama' => 'alabama',
            'Alaska' => 'alaska',
            'Arizona' => 'arizona',
            'Arkansas' => 'arkansas',
            'California' => 'california',
            'Colorado' => 'colorado',
            'Connecticut' => 'connecticut',
            'Delaware' => 'delaware',
            'Florida' => 'florida',
            'Georgia' => 'georgia',
            'Hawaii' => 'hawaii',
            'Idaho' => 'idaho',
            'Illinois' => 'illinois',
            'Indiana' => 'indiana',
            'Iowa' => 'iowa',
            'Kansas' => 'kansas',
            'Kentucky' => 'kentucky',
            'Louisiana' => 'louisiana',
            'Maine' => 'maine',
            'Maryland' => 'maryland',
            'Massachusetts' => 'massachusetts',
            'Michigan' => 'michigan',
            'Minnesota' => 'minnesota',
            'Mississippi' => 'mississippi',
            'Missouri' => 'missouri',
            'Montana' => 'montana',
            'Nebraska' => 'nebraska',
            'Nevada' => 'nevada',
            'New Hampshire' => 'new-hampshire',
            'New Jersey' => 'new-jersey',
            'New Mexico' => 'new-mexico',
            'New York' => 'new-york',
            'North Carolina' => 'north-carolina',
            'North Dakota' => 'north-dakota',
            'Ohio' => 'ohio',
            'Oklahoma' => 'oklahoma',
            'Oregon' => 'oregon',
            'Pennsylvania' => 'pennsylvania',
            'Rhode Island' => 'rhode-island',
            'South Carolina' => 'south-carolina',
            'South Dakota' => 'south-dakota',
            'Tennessee' => 'tennessee',
            'Texas' => 'texas',
            'Utah' => 'utah',
            'Vermont' => 'vermont',
            'Virginia' => 'virginia',
            'Washington' => 'washington',
            'West Virginia' => 'west-virginia',
            'Wisconsin' => 'wisconsin',
            'Wyoming' => 'wyoming',
        ];
    }

    private function primary_states() {
        return [
            'Texas' => 'texas',
            'Florida' => 'florida',
            'California' => 'california',
            'New York' => 'new-york',
            'Pennsylvania' => 'pennsylvania',
            'Ohio' => 'ohio',
            'Georgia' => 'georgia',
            'North Carolina' => 'north-carolina',
            'Illinois' => 'illinois',
            'Michigan' => 'michigan',
        ];
    }

    private function post_topics() {
        $base = [
            ['Hemp Flower Near Me: How To Compare Legal Hemp Flower Options', 'hemp flower near me', 'near me', 'Hemp Flower Guides'],
            ['CBD Flower Near Me: Buyer Checklist Before You Order', 'CBD flower near me', 'near me', 'CBD Flower Guides'],
            ['CBG Flower Near Me: What Buyers Should Compare First', 'CBG flower near me', 'near me', 'CBG Flower Guides'],
            ['THCA Flower Near Me: COA, Legality, And Availability Checklist', 'THCA flower near me', 'near me', 'THCA Flower Guides'],
            ['THC Drinks Near Me: Hemp-Derived Beverage Buyer Guide', 'THC drinks near me', 'near me', 'Hemp THC Drinks'],
            ['Wholesale THCA Flower: Bulk Buyer Verification Checklist', 'wholesale THCA flower', 'wholesale', 'Wholesale Hemp'],
            ['Bulk Hemp Flower: Supplier Questions Before You Buy', 'bulk hemp flower', 'wholesale', 'Wholesale Hemp'],
            ['How To Read A Hemp COA Before Buying Flower', 'how to read hemp COA', 'education', 'COA & Lab Testing'],
            ['CBN Gummies For Sleep: What To Compare Before Buying', 'CBN gummies for sleep', 'buyer guide', 'CBN Sleep'],
            ['CBD vs CBG vs THCA: Hemp Buyer Comparison Guide', 'CBD vs CBG vs THCA', 'comparison', 'Hemp Comparisons'],
            ['Best Hemp Flower For Beginners: What Actually Matters', 'best hemp flower for beginners', 'buyer guide', 'Buyer Safety'],
            ['THCA vs CBD Flower: Buyer Intent And COA Differences', 'THCA vs CBD flower', 'comparison', 'Hemp Comparisons'],
            ['Hemp-Derived Delta-9 Drinks: State-Aware Buyer Guide', 'hemp-derived delta 9 drinks', 'buyer guide', 'Hemp THC Drinks'],
            ['Melatonin-Free CBN Sleep Products: Search And Buyer Guide', 'melatonin free CBN gummies', 'buyer guide', 'CBN Sleep'],
            ['Hemp Flower Storage: Jars, Humidity Packs, And Freshness', 'hemp flower storage', 'buyer guide', 'Buyer Safety'],
        ];

        $states = array_keys($this->states());
        $products = [
            ['Hemp Flower', 'hemp flower', 'Hemp Flower Guides'],
            ['CBD Flower', 'CBD flower', 'CBD Flower Guides'],
            ['CBG Flower', 'CBG flower', 'CBG Flower Guides'],
            ['THCA Flower', 'THCA flower', 'THCA Flower Guides'],
            ['THC Drinks', 'THC drinks', 'Hemp THC Drinks'],
        ];

        foreach ($states as $state) {
            foreach ($products as $product) {
                $base[] = [$product[0] . ' Near Me in ' . $state . ': Buyer And Legality Research', $product[1] . ' near me ' . $state, 'state near me', 'State Guides'];
            }
        }

        $longtails = [
            ['Best THCA Flower Brands To Research Before Buying', 'best THCA flower brands', 'buyer guide', 'THCA Flower Guides'],
            ['THCA Legal States: What Buyers Should Track', 'THCA legal states', 'legal status', 'Hemp Laws'],
            ['Can Hemp Flower Ship To My State?', 'hemp flower shipping states', 'legal status', 'Hemp Laws'],
            ['Delta-9 Drinks vs Alcohol: Hemp Beverage Search Guide', 'delta 9 drinks vs alcohol', 'comparison', 'Hemp Comparisons'],
            ['Best Hemp THC Drinks: What To Compare Before Buying', 'best hemp THC drinks', 'buyer guide', 'Hemp THC Drinks'],
            ['CBN vs CBD For Sleep: Product Buyer Comparison', 'CBN vs CBD for sleep', 'comparison', 'Hemp Comparisons'],
            ['CBN vs Melatonin: Sleep Product Buyer Guide', 'CBN vs melatonin', 'comparison', 'Hemp Comparisons'],
            ['CBD Flower vs CBG Flower: Which Category Fits Which Buyer?', 'CBD flower vs CBG flower', 'comparison', 'Hemp Comparisons'],
            ['Indoor Hemp Flower vs Greenhouse Hemp Flower', 'indoor hemp flower vs greenhouse', 'comparison', 'Hemp Comparisons'],
            ['THCA Smalls vs THCA Flower: Bulk Buyer Guide', 'THCA smalls vs flower', 'comparison', 'Hemp Comparisons'],
            ['THCA Trim Wholesale: What Bulk Buyers Should Check', 'THCA trim wholesale', 'wholesale', 'Wholesale Hemp'],
            ['CBD Flower Pounds: Wholesale Buyer Guide', 'CBD flower pounds', 'wholesale', 'Wholesale Hemp'],
            ['COA Verified Hemp Products: What The Label Should Prove', 'COA verified hemp products', 'education', 'COA & Lab Testing'],
            ['Hemp Flower Lab Testing: Red Flags Before You Buy', 'hemp flower lab testing', 'education', 'COA & Lab Testing'],
            ['Smell-Proof Hemp Storage Kits: Buyer Guide', 'smell proof hemp storage', 'buyer guide', 'Buyer Safety'],
        ];

        return array_map(function ($row) {
            return [
                'title' => $row[0],
                'kw' => $row[1],
                'intent' => $row[2],
                'cat' => $row[3],
            ];
        }, array_merge($base, $longtails));
    }

    private function state_name_from_slug($slug) {
        $states = array_flip($this->states());

        return $states[$slug] ?? ucwords(str_replace('-', ' ', $slug));
    }
}

register_activation_hook(__FILE__, function () {
    HSE_Plugin::instance()->register_post_types();
    HSE_Plugin::instance()->register_taxonomies();
    HSE_Plugin::instance()->register_sitemap_rewrites();
    flush_rewrite_rules();
    HSE_Plugin::instance()->regenerate_internal_map();
});

register_deactivation_hook(__FILE__, function () {
    flush_rewrite_rules();
});

HSE_Plugin::instance();
