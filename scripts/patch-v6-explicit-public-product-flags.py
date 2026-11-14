#!/usr/bin/env python3
"""Require explicit public availability and price-display consent for V6 catalog cards."""
from __future__ import annotations

import sys
from pathlib import Path

SOURCE = Path("src/services/publicCatalogDirectory.ts")
TEST = Path("src/services/publicCatalogDirectory.test.mjs")

OLD_GUARD = "if (!itemId || publicMetadata.is_available === false || publicMetadata.show_price === false) return [];"
NEW_GUARD = "if (!itemId || publicMetadata.is_available !== true || publicMetadata.show_price !== true) return [];"

OLD_ITEM = "      { id: 'item-3', item_type: 'PRODUCT', name_ar: 'منتج غير متاح', metadata: { catalog_public: { is_available: false, show_price: true } } },"
NEW_ITEM = OLD_ITEM + """
      { id: 'item-4', item_type: 'PRODUCT', name_ar: 'منتج بدون موافقة عرض السعر', metadata: { catalog_public: { is_available: true } } },
      { id: 'item-5', item_type: 'PRODUCT', name_ar: 'منتج بدون موافقة الإتاحة', metadata: { catalog_public: { show_price: true } } },"""

OLD_PRICE = "      { catalog_item_id: 'item-3', branch_id: 'branch-1', unit_price: 10, currency: 'EGP' },"
NEW_PRICE = OLD_PRICE + """
      { catalog_item_id: 'item-4', branch_id: 'branch-1', unit_price: 20, currency: 'EGP' },
      { catalog_item_id: 'item-5', branch_id: 'branch-1', unit_price: 30, currency: 'EGP' },"""

OLD_ASSERTION = "  assert.equal(result.products.length, 1);"
NEW_ASSERTION = OLD_ASSERTION + "\n  assert.deepEqual(result.products.map((product) => product.id), ['item-1'], 'Only items with explicit availability and price-display consent may enter the public catalog');"

def replace_once(source: str, old: str, new: str, label: str) -> tuple[str, bool]:
    old_count, new_count = source.count(old), source.count(new)
    if new_count == 1:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(f"{label}: expected one source anchor; old={old_count}; new={new_count}")
    updated = source.replace(old, new, 1)
    if updated.count(new) != 1:
        raise ValueError(f"{label}: replacement verification failed")
    return updated, True

def patch_text_file(path: Path, replacements: list[tuple[str, str, str]]) -> bool:
    if not path.is_file():
        raise SystemExit(f"V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS_FILE_MISSING={path}")
    source = path.read_text(encoding="utf-8")
    changed = False
    for old, new, label in replacements:
        source, did_change = replace_once(source, old, new, label)
        changed = changed or did_change
    if changed:
        path.write_text(source, encoding="utf-8")
    return changed

def has_explicit_public_price_guard(edge: str, helper: str) -> bool:
    availability_is_explicit = "is_available === true" in edge
    inline_price_guard = "item.metadata?.catalog_public?.show_price !== true" in edge
    shared_import = any(
        "filterRowsToPubliclyPricedItems" in line
        and "../_shared/public-price-visibility.mjs" in line
        for line in edge.splitlines()
    )
    shared_helper_guard = (
        shared_import
        and (
            "filterRowsToPubliclyPricedItems(items, p || [])" in edge
            or "prices = filterRowsToPubliclyPricedItems(items, [" in edge
        )
        and "metadata?.catalog_public?.show_price === true" in helper
        and "getExplicitlyPublicComparePrice({ metadata: { catalog_public: rawPublic } })" in edge
        and "if (!hasExplicitPublicPricePermission(item)) return null;" in helper
    )
    return availability_is_explicit and (inline_price_guard or shared_helper_guard)


def self_test() -> None:
    patched, changed = replace_once("prefix " + OLD_GUARD + " suffix", OLD_GUARD, NEW_GUARD, "guard")
    assert changed and NEW_GUARD in patched
    repeated, changed_again = replace_once(patched, OLD_GUARD, NEW_GUARD, "guard")
    assert not changed_again and repeated == patched
    fixture = OLD_ITEM + "\n" + OLD_PRICE + "\n" + OLD_ASSERTION
    for old, new, label in [
        (OLD_ITEM, NEW_ITEM, "missing-price-consent fixture"),
        (OLD_PRICE, NEW_PRICE, "missing-availability-consent fixture"),
        (OLD_ASSERTION, NEW_ASSERTION, "explicit-consent assertion"),
    ]:
        fixture, did_change = replace_once(fixture, old, new, label)
        assert did_change
    assert "item-4" in fixture and "item-5" in fixture and "Only items with explicit" in fixture
    shared_edge = 'import { filterRowsToPubliclyPricedItems, getExplicitlyPublicComparePrice } from "../_shared/public-price-visibility.mjs";\\nitems = rows.filter((i) => i.metadata?.catalog_public?.is_available === true);\\nprices = filterRowsToPubliclyPricedItems(items, p || []);\\ncompare_price = getExplicitlyPublicComparePrice({ metadata: { catalog_public: rawPublic } });'
    shared_helper = "item?.metadata?.catalog_public?.show_price === true\\nif (!hasExplicitPublicPricePermission(item)) return null;"
    assert has_explicit_public_price_guard(shared_edge, shared_helper)
    shared_edge_batched = shared_edge.replace("p || []", "[*global_prices, *branch_prices]")
    assert has_explicit_public_price_guard(shared_edge_batched, shared_helper)
    assert not has_explicit_public_price_guard("items = rows.filter((i) => i.metadata?.catalog_public?.is_available === true); prices = rows.filter((item) => item.metadata?.catalog_public?.show_price === false);", "")
    assert not has_explicit_public_price_guard('import { filterRowsToPubliclyPricedItems } from "../_shared/public-price-visibility.mjs";\\nitems = rows.filter((i) => i.metadata?.catalog_public?.is_available === true); prices = filterRowsToPubliclyPricedItems(items, p || []);', "metadata?.catalog_public?.show_price === true")
    for old, new, label in [
        (OLD_ITEM, NEW_ITEM, "missing-price-consent fixture"),
        (OLD_PRICE, NEW_PRICE, "missing-availability-consent fixture"),
        (OLD_ASSERTION, NEW_ASSERTION, "explicit-consent assertion"),
    ]:
        fixture, did_change = replace_once(fixture, old, new, label)
        assert not did_change
    print("V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS_SELF_TEST=PASS")

def verify_server_contract(repo_root: Path) -> None:
    edge_path = repo_root / "supabase/functions/public-catalog-directory/index.ts"
    if not edge_path.is_file():
        raise SystemExit("V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS_EDGE_FUNCTION_MISSING")
    edge = edge_path.read_text(encoding="utf-8")
    helper_path = repo_root / "supabase/functions/_shared/public-price-visibility.mjs"
    helper = helper_path.read_text(encoding="utf-8") if helper_path.is_file() else ""
    if not has_explicit_public_price_guard(edge, helper):
        raise SystemExit("V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS_EDGE_CONTRACT_MISSING=explicit availability and strict show_price=true guard")
    print("V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS_EDGE_CONTRACT=PASS")


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-explicit-public-product-flags.py <extracted-v6-root>")
    root = Path(sys.argv[1]).resolve()
    source_changed = patch_text_file(root / SOURCE, [(OLD_GUARD, NEW_GUARD, "explicit public consent guard")])
    test_changed = patch_text_file(root / TEST, [
        (OLD_ITEM, NEW_ITEM, "missing-price-consent fixture"),
        (OLD_PRICE, NEW_PRICE, "missing-availability-consent fixture"),
        (OLD_ASSERTION, NEW_ASSERTION, "explicit-consent assertion"),
    ])
    print(f"V6_EXPLICIT_PUBLIC_PRODUCT_FLAGS=PASS source_changed={int(source_changed)} test_changed={int(test_changed)}")
    verify_server_contract(root.parents[2])

if __name__ == "__main__":
    main()
