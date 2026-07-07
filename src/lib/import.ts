// Product import: Shopify + WooCommerce CSV exports → normalized draft rows.
// Source categories/tags/meta never map 1:1 to marketplace taxonomy, so the
// importer returns them raw for an explicit vendor mapping step. Imports are
// ALWAYS drafts — publication still requires COA data + admin review.

export interface ImportedRow {
  sourceHandle: string;
  title: string;
  description: string;
  shortDescription: string;
  sourceCategory: string; // Shopify "Type" / Woo "Categories" — vendor maps this
  tags: string[];
  sku: string;
  variantName: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
  extraVariants: number; // beta flow imports the first variant; report the rest
}

export type ImportFormat = "shopify" | "woocommerce";

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function detectFormat(headers: string[]): ImportFormat | null {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (h.includes("handle") && h.some((x) => x.startsWith("variant sku") || x === "variant price")) return "shopify";
  if (h.includes("regular price") || (h.includes("sku") && h.includes("categories"))) return "woocommerce";
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function toCents(price: string): number {
  const n = parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function col(headers: string[], name: string): number {
  return headers.findIndex((h) => h.trim().toLowerCase() === name);
}

export function normalize(format: ImportFormat, rows: string[][]): ImportedRow[] {
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const body = rows.slice(1);
  const get = (r: string[], name: string) => {
    const i = col(headers, name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };

  if (format === "shopify") {
    // Variant rows share a Handle; first row carries title/body/type/tags/image.
    const byHandle = new Map<string, string[][]>();
    for (const r of body) {
      const handle = get(r, "handle");
      if (!handle) continue;
      const group = byHandle.get(handle) ?? [];
      group.push(r);
      byHandle.set(handle, group);
    }
    return [...byHandle.entries()].map(([handle, group]) => {
      const first = group[0];
      const desc = stripHtml(get(first, "body (html)"));
      const opt = get(first, "option1 value");
      return {
        sourceHandle: handle,
        title: get(first, "title") || handle,
        description: desc,
        shortDescription: desc.split("\n")[0]?.slice(0, 160) ?? "",
        sourceCategory: get(first, "type") || get(first, "product category") || "Uncategorized",
        tags: get(first, "tags").split(",").map((t) => t.trim()).filter(Boolean),
        sku: get(first, "variant sku") || handle,
        variantName: opt && opt.toLowerCase() !== "default title" ? opt : "Default",
        priceCents: toCents(get(first, "variant price")),
        stock: parseInt(get(first, "variant inventory qty") || "0", 10) || 0,
        imageUrl: get(first, "image src"),
        extraVariants: Math.max(0, group.length - 1),
      };
    });
  }

  // WooCommerce: one row per product (simple) or parent+variation rows.
  return body
    .filter((r) => {
      const type = get(r, "type").toLowerCase();
      return type === "" || type === "simple" || type === "variable";
    })
    .map((r) => {
      const desc = stripHtml(get(r, "description"));
      const shortD = stripHtml(get(r, "short description"));
      const name = get(r, "name");
      return {
        sourceHandle: get(r, "sku") || name,
        title: name,
        description: desc,
        shortDescription: (shortD || desc.split("\n")[0] || "").slice(0, 160),
        sourceCategory: (get(r, "categories").split(">").pop() ?? "").split(",")[0].trim() || "Uncategorized",
        tags: get(r, "tags").split(",").map((t) => t.trim()).filter(Boolean),
        sku: get(r, "sku") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
        variantName: "Default",
        priceCents: toCents(get(r, "regular price") || get(r, "sale price")),
        stock: parseInt(get(r, "stock") || "0", 10) || 0,
        imageUrl: (get(r, "images").split(",")[0] ?? "").trim(),
        extraVariants: 0,
      };
    })
    .filter((r) => r.title);
}
