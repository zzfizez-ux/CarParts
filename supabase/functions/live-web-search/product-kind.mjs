import {words} from "./vehicle-fitment.mjs";
// Category pages include accessories and repair tools. They are not the requested assembly.
export function requestedProduct(name,term,category=""){
 const query=words(category||term),title=words(name);
 const controller=/steuergerat|steuerung|mechatronik|control unit|inverter/.test(query);
 if(controller && !/steck|dicht|reparatur|werkzeug|socket|connector|seal|repair|tool/.test(query)){
  if(/\b(steckgehause|steckergehause|stecker|steckhulse|anschlussstecker|kabelsatz|leitungssatz|dichtung|dichtungen|dichthulse|dichthulsen|olwanne|olfilter|reparatursatz|reparaturset|werkzeug|werkzeugsatz|steckschlussel|schlussel|demontage|ausbauwerkzeug|t griff|socket|connector|wiring|gasket|seal|repair kit|tool)\b/.test(title))return false;
  if(/\b(reparatur|instandsetzung|reparaturservice|repair service|prufung|diagnose|mieten|verleih)\b/.test(title))return false;
 }
 return true;
}
