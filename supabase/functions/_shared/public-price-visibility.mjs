// Public price data is opt-in: a missing flag is not permission to disclose a stored price.
export const hasExplicitPublicPricePermission = (item) =>
  item?.metadata?.catalog_public?.show_price === true;

export const filterRowsToPubliclyPricedItems = (items, rows) => {
  const visibleItemIds = new Set(
    (Array.isArray(items) ? items : [])
      .filter(hasExplicitPublicPricePermission)
      .map((item) => String(item?.id ?? ""))
      .filter(Boolean),
  );

  return (Array.isArray(rows) ? rows : []).filter((row) =>
    visibleItemIds.has(String(row?.catalog_item_id ?? ""))
  );
};
