function publicHttps(raw) {
  try {
    const url=new URL(raw);
    return url.protocol==="https:" && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

// Only products joined to a reviewed manufacturer article can enter this table.
export function offerObservations(products) {
  const found=new Map();
  for (const p of products) {
    const url=publicHttps(p.url), image=publicHttps(p.image);
    if (p.evidence!=="manufacturer" || !Number.isSafeInteger(p.part_id) || p.part_id<=0 ||
        !url || !image || !Number.isFinite(p.price) || p.price<=0 || !/^[A-Z]{3}$/.test(p.currency) ||
        typeof p.merchant!=="string" || !p.merchant.trim() || !Number.isFinite(Date.parse(p.observed_at))) continue;
    const row={part_id:p.part_id,merchant_name:p.merchant,product_url:url,source_url:url,
      price_amount:p.price,currency:p.currency,observed_at:p.observed_at,image_url:image};
    const key=JSON.stringify([row.part_id,row.merchant_name,row.product_url]);
    const prior=found.get(key);
    if (!prior || Date.parse(row.observed_at)>=Date.parse(prior.observed_at)) found.set(key,row);
  }
  return [...found.values()].slice(0,20);
}
