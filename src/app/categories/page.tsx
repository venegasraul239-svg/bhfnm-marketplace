import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/data";
import { Breadcrumbs } from "@/components/ui";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "All Categories",
  description: "Browse every verified category on BHFNM Marketplace — hemp flower, THCA, edibles, drinks, wholesale, and more.",
  alternates: { canonical: "/marketplace/categories" },
};

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ name: "Marketplace", href: "/" }, { name: "Categories" }]} />
      <h1 className="mt-6 font-display text-3xl font-black text-mist-100 sm:text-4xl">All categories</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.slug} href={`/categories/${c.slug}`} className="card-surface group rounded-card p-6 transition-colors hover:border-jade-500/50">
            <h2 className="font-display text-lg font-bold text-mist-100 group-hover:text-jade-300">{c.name}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-mist-400">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
