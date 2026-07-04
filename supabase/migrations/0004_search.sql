-- 0004_search.sql — Postgres-native marketplace search (no external engine).
-- Weighted full-text vector + trigram fuzziness, ranked with a verified-COA
-- boost per the search architecture (compliance quality outranks relevance).

create extension if not exists pg_trgm;

-- Weighted document: title (A) > short description / subtype / batch (B) > body (C)
alter table products add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(subtype, '') || ' ' || coalesce(batch_number, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index if not exists products_search_vector_gin
  on products using gin (search_vector);
create index if not exists products_title_trgm
  on products using gin (title gin_trgm_ops);

-- Ranked search over LIVE products only. SECURITY INVOKER (default): the
-- caller's RLS applies, so anon can never surface unapproved listings.
-- rank = FTS relevance ×2 + trigram similarity (typo tolerance)
--        + 0.5 verified-COA boost + 0.15 in-stock boost
create or replace function search_products(q text, max_results int default 40)
returns table (id uuid, rank real)
language sql stable as $$
  with query as (
    select websearch_to_tsquery('english', q) as tsq
  )
  select
    p.id,
    (
      coalesce(ts_rank(p.search_vector, query.tsq), 0) * 2
      + similarity(p.title, q)
      + case when exists (
          select 1 from compliance_records c
          where c.product_id = p.id and c.status = 'verified'
        ) then 0.5 else 0 end
      + case when exists (
          select 1 from product_variants v
          where v.product_id = p.id and v.stock > 0
        ) then 0.15 else 0 end
    )::real as rank
  from products p, query
  where p.status = 'live'
    and (
      p.search_vector @@ query.tsq
      or p.title % q
      or p.title ilike '%' || q || '%'
      or p.batch_number ilike '%' || q || '%'
    )
  order by rank desc
  limit max_results;
$$;

grant execute on function search_products(text, int) to anon, authenticated;
