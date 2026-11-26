import {test} from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {renderSearchGuide} from "../search-guide-ui.js";

function setup(){
 const {document}=parseHTML('<html><body><section id="guide" hidden></section></body></html>');
 globalThis.document=document;
 globalThis.Option=function(label,value){const option=document.createElement("option");option.textContent=label;option.value=value;return option;};
 // Linkedom intentionally omits these standard browser form APIs.
 const selectProto=document.createElement("select").constructor.prototype;
 selectProto.add=function(option){this.append(option);};
 Object.defineProperty(selectProto,"value",{configurable:true,get(){return this.querySelector("option[selected]")?.value||"";},set(value){for(const option of this.querySelectorAll("option")){if(option.value===value)option.setAttribute("selected","");else option.removeAttribute("selected");}}});
 const container=document.getElementById("guide");
 return {document,container,form(){const form=container.querySelector("form");Object.defineProperty(form,"elements",{value:{namedItem:name=>form.querySelector('[name="'+name+'"]')}});return form;}};
}
const questions=[{key:"oe_number",label:"OE-Nummer <script>test</script>",help:"Nummer am Altteil",max_length:40,options:[]},{key:"equipment_code",label:"PR-Code",help:"Code vom Fahrzeug",max_length:3,options:[]}];

test("the real form submits refined values and never marks a part confirmed by itself",async()=>{
 const ui=setup();let submitted;
 renderSearchGuide(ui.container,{status:"needs_details",questions},{axle:"front"},async values=>{submitted=values;});
 assert.equal(ui.container.hidden,false);
 assert.equal(ui.container.querySelector("script"),null);
 assert.equal(ui.container.querySelector('input[name="oe_number"]').getAttribute("aria-describedby"),"search-guide-oe_number-help");
 const form=ui.form();form.elements.namedItem("oe_number").value="5Q0 615 301";form.elements.namedItem("equipment_code").value="1ZE";
 await form.onsubmit({preventDefault(){}});
 assert.deepEqual(submitted,{axle:"front",oe_number:"5Q0 615 301",equipment_code:"1ZE"});
 assert.ok(!ui.container.textContent.includes("Passform bestätigt"));
});

test("unchanged or rejected answers remain editable and do not repeat a paid search",async()=>{
 const ui=setup();let requests=0;
 renderSearchGuide(ui.container,{status:"needs_details",questions},{},async()=>{requests++;throw new Error("Ungültiger PR-Code");});
 const form=ui.form();await form.onsubmit({preventDefault(){}});
 assert.equal(requests,0);assert.ok(form.querySelector('[role="status"]').textContent.includes("Ergänze"));
 form.elements.namedItem("equipment_code").value="BAD!";
 await form.onsubmit({preventDefault(){}});
 assert.equal(requests,1);assert.equal(form.querySelector('button[type="submit"]').disabled,false);
 assert.equal(form.querySelector('[role="status"]').textContent,"Ungültiger PR-Code");
});

test("engine choices, skip research and a resolved form behave correctly",()=>{
 const ui=setup();let skipped=0;
 renderSearchGuide(ui.container,{status:"needs_details",questions:[{key:"engine",label:"Motor",help:"Wähle exakt",options:[{value:"CRBC",label:"2.0 TDI CRBC"}]}]},{engine:"CRBC"},()=>{}, {onSkip:()=>skipped++});
 assert.equal(ui.container.querySelector("select").value,"CRBC");
 assert.equal(ui.container.querySelectorAll("option").length,2);
 ui.container.querySelector(".search-guide-skip:not(.search-guide-reset)").onclick();assert.equal(skipped,1);
 renderSearchGuide(ui.container,{status:"reference_match",message:"Referenz und Anwendung abgeglichen",questions:[]},{},()=>{});
 assert.equal(ui.container.querySelector("form"),null);
 assert.ok(ui.container.textContent.includes("Referenz und Anwendung abgeglichen"));
 renderSearchGuide(ui.container,null,{},()=>{});assert.equal(ui.container.hidden,true);
});


test("technical references stay in a closed optional section and existing answers can be reset",async()=>{
 const ui=setup();let next;
 renderSearchGuide(ui.container,{status:"application_found",message:"Keine Teilenummer nötig",questions:questions.map(q=>({...q,optional:true}))},{oe_number:"123456"},async value=>{next=value;});
 const advanced=ui.container.querySelector("details");
 assert.equal(advanced.hasAttribute("open"),false);
 assert.ok(advanced.querySelector('input[name="oe_number"]'));
 assert.ok(advanced.querySelector('button[type="submit"]'));
 assert.ok(!ui.container.querySelector('input[name="oe_number"]').hasAttribute("required"));
 await ui.container.querySelector(".search-guide-reset").onclick();assert.deepEqual(next,{});
});
