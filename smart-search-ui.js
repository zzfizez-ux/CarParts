import {understandPartQuery,suggestPartQueries} from "./supabase/functions/live-web-search/part-search.mjs?v=48";
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
function chooseButton(item,onChoose,compact){
 const button=node("button","smart-search-choice");button.type="button";
 button.append(node("strong","",item.label));
 if(!compact&&item.description)button.append(node("span","",item.description));
 button.onclick=()=>onChoose(item);return button;
}
export function renderQueryUnderstanding(container,result,onChoose,{onLiteral,compact=false}={}){
 container.replaceChildren();container.hidden=true;
 if(!result)return;
 const choices=result.suggestions||[];
 if(result.status!=="ambiguous"&&result.status!=="corrected"&&!choices.length)return;
 container.hidden=false;container.className="smart-search "+(compact?"smart-search-compact":"smart-search-result");
 if(!compact){
  container.append(node("h3","",result.status==="ambiguous"?"Welches Bauteil meinst du?":"Suchbegriff erkannt"));
  if(result.original)container.append(node("p","smart-search-original",'Deine Eingabe: „'+result.original+'“'));
 }
 if(result.message)container.append(node("p","smart-search-message",result.message));
 if(choices.length){const list=node("div","smart-search-choices");for(const item of choices)list.append(chooseButton(item,onChoose,compact));container.append(list);}
 if(onLiteral&&!compact){const button=node("button","smart-search-literal","Mit meiner ursprünglichen Eingabe suchen");button.type="button";button.onclick=onLiteral;container.append(button);}
}
export function bindPartSearchHints(input,container,onChoose){
 input.setAttribute("aria-describedby",[input.getAttribute("aria-describedby"),container.id].filter(Boolean).join(" "));
 let composing=false;
 const render=()=>{
  if(composing)return;
  const result=understandPartQuery(input.value);const suggestions=suggestPartQueries(input.value);
  renderQueryUnderstanding(container,{...result,status:suggestions.length?result.status:"exact",suggestions,
   message:suggestions.length?(result.status==="ambiguous"?result.message:"Passende Suchbegriffe"):""},onChoose,{compact:true});
 };
 input.addEventListener("input",render);input.addEventListener("compositionstart",()=>{composing=true;});input.addEventListener("compositionend",()=>{composing=false;render();});
 return {clear(){container.replaceChildren();container.hidden=true;},render};
}
