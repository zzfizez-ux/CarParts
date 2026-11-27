// New Shopping results may expose a Google product view instead of a merchant URL.
export function googleProductLink(raw,productId){
 try{
  const url=new URL(raw);
  if(url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&["www.google.com","google.com"].includes(url.hostname)){
   const product=/^\/shopping\/product\/(?:r\/)?\d{5,30}\/?$/.test(url.pathname);
   const view=url.pathname==="/search"&&/oshop/.test(url.searchParams.get("ibp")||"");
   if(product||view){url.hash="";return url.href;}
  }
 }catch{ /* A numeric public product ID can still provide the product view. */ }
 return /^\d{5,30}$/.test(String(productId||""))?"https://www.google.com/shopping/product/"+productId:"";
}
