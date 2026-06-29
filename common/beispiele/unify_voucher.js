
 //@liv-in-sky 2020  16.6.-10:42
 

 

//HIER WIRD PFAD UND FILENAME DEFINIERT
const path = "/htmlexample.html";                   //FIlenamen definieren
const home ='vis.0'                                 //wo soll das file im iobroker-file-system liegen ? (oder z.b auch iqontrol.meta)
let   braucheEinFile=false;                          // bei true wird ein file geschrieben
let   braucheEinVISWidget=true;                     // bei true wird ein html-tabelle in einen dp geschrieben - siehe nächste zeile
let dpVIS="0_userdata.0.Tabellen.Unifi-Voucher"         //WICHTIG wenn braucheEinVISWidget auf true gesetzt !!  dp zusätzlich für VIS-HTML-Basic-Widget
let mySchedule=" * * * * * ";                       //jede minute  
//---------------------------------------
 
//HIER DIE SPALTEN ANZAHL DEFINIEREN - jede Spalte einen Wert - in diesem Beispiel sind es 5
var htmlFeld1='CODE';       var Feld1lAlign="left";                     // überschrift Tabellen Spalte1 und  Ausrichtung left,right or center
var htmlFeld2='Erstellt';        var Feld2lAlign="center";                      // überschrift Tabellen Spalte2 und  Ausrichtung left,right or center
var htmlFeld3='Dauer';         var Feld3lAlign="center";                    // überschrift Tabellen Spalte3 und  Ausrichtung left,right or center
var htmlFeld4='QOS';        var Feld4lAlign="center";                    // überschrift Tabellen Spalte4 und  Ausrichtung left,right or center
var htmlFeld5='Quota';        var Feld5lAlign="center";                    // überschrift Tabellen Spalte5 und  Ausrichtung left,right or center
var htmlFeld6='Notiz';        var Feld6lAlign="left";                    // überschrift Tabellen Spalte5 und  Ausrichtung left,right or center
var htmlFeld7='Used';        var Feld7lAlign="center";                    // überschrift Tabellen Spalte5 und  Ausrichtung left,right or center
var htmlFeld8='UpLoad';        var Feld8lAlign="center";                    // überschrift Tabellen Spalte5 und  Ausrichtung left,right or center
var htmlFeld9='DownLoad';        var Feld9lAlign="center";                    // überschrift Tabellen Spalte5 und  Ausrichtung left,right or center
 
 
//-----------------------------------
 
 
 
//hier werden die styles für die tabelle definiert
//ÜBERSCHRIFT ÜBER TABELLE
let   htmlUberschrift=false;                           // mit Überschrift über der tabelle
let   htmlSignature=false;                              // anstatt der Überscghrift eine signature: - kleiner - anliegend
const htmlFeldUeber='Unifi Vouchers';              // Überschrift und Signature
const htmlFarbUber="white";                         // Farbe der Überschrift
const htmlSchriftWeite="normal";                       // bold, normal - Fettschrift für Überschrift
const htmlÜberFontGroesse="18px";                       // schriftgröße überschrift
//MEHRERE TABELLEN NEBENEINANDER
let   mehrfachTabelle=1;                              // bis zu 4 Tabellen werden nebeneinander geschrieben-  verkürzt das Ganze, dafür etwas breiter - MÖGLICH 1,2,3,oder 4 !!!
const trennungsLinie="2";                             //extra trennungslinie bei mehrfachtabellen - evtl auf 0 stellen, wnn htmlRahmenLinien auf none sind
const farbetrennungsLinie="white";
const htmlFarbZweiteTabelle="white";                // Farbe der Überschrift bei jeder 2.ten Tabelle
const htmlFarbTableColorUber="#37f6e5";               // Überschrift in der tabelle - der einzelnen Spalten
//ÜBERSCHRIFT SPALTEN
const UeberSchriftHöhe="35";                          //Überschrift bekommt mehr Raum - darunter und darüber - Zellenhöhe
const LinieUnterUeberschrift="3";                   // Linie nur unter Spaltenüberschrift - 
const farbeLinieUnterUeberschrift="white";
const groesseUeberschrift=16;
const UeberschriftStyle="normal"                     // möglich "bold"
//GANZE TABELLE
let abstandZelle="3";
let farbeUngeradeZeilen="#000000";                     //Farbe für ungerade Zeilenanzahl - Hintergrund der Spaltenüberschrift bleibt bei htmlFarbTableColorGradient1/2
let farbeGeradeZeilen="#151515";                        //Farbe für gerade Zeilenanzahl - Hintergrund der Spaltenüberschrift bleibt bei htmlFarbTableColorGradient1/2
let weite="auto";                                     //Weite der Tabelle
let zentriert=true;                                   //ganze tabelle zentriert
const backgroundAll="#000000";                        //Hintergrund für die ganze Seite - für direkten aufruf oder iqontrol sichtber - keine auswirkung auf vis-widget
const htmlSchriftart="Helvetica";
const htmlSchriftgroesse="14px";
//FELDER UND RAHMEN
let   UeberschriftSpalten=true;                // ein- oder ausblenden der spatlen-überschriften
const htmlFarbFelderschrift="#BDBDBD";                  // SchriftFarbe der Felder
const htmlFarbFelderschrift2="#D8D8D8";                 // SchriftFarbe der Felder für jede 2te Tabelle
const htmlFarbTableColorGradient1="#424242";          //  Gradient - Hintergrund der Tabelle - Verlauffarbe
const htmlFarbTableColorGradient2="#424242";          //  Gradient - Hintergrund der Tabelle - ist dieser Wert gleich Gradient1 gibt es keinen verlauf
const htmlFarbTableBorderColor="grey";             // Farbe des Rahmen - is tdieser gleich den gradienten, sind die rahmen unsichtbar
let htmlRahmenLinien="none";                            // Format für Rahmen: MÖGLICH: "none" oder "all" oder "cols" oder "rows"
const htmlSpalte1Weite="auto";                   //  Weite der ersten beiden  Spalten oder z.b. 115px
 
// HIER NICHTS  ÄNDERN
 
let borderHelpBottum;
let borderHelpRight;
let htmlcenterHelp;
let htmlcenterHelp2;
 
if(htmlRahmenLinien=="rows") {borderHelpBottum=1;borderHelpRight=0;}
if(htmlRahmenLinien=="cols") {borderHelpBottum=0;borderHelpRight=1;}
if(htmlRahmenLinien=="none") {borderHelpBottum=0;borderHelpRight=0;}
if(htmlRahmenLinien=="all")  {borderHelpBottum=1;borderHelpRight=1;}
zentriert ? htmlcenterHelp="auto" : htmlcenterHelp="left";
zentriert ? htmlcenterHelp2="center" : htmlcenterHelp2="left";
 
 
const htmlZentriert='<center>'
const htmlStart=    "<!DOCTYPE html><html lang=\"de\"><head><title>Vorlage</title><meta http-equiv=\"content-type\" content=\"text/html; charset=utf-8\">"+
                   "<style> * {  margin: 0;} body {background-color: "+backgroundAll+"; margin: 0 auto;  }"+
                   " p {padding-top: 10px; padding-bottom: 10px; text-align: "+htmlcenterHelp2+"}"+
                  // " div { margin: 0 auto;  margin-left: auto; margin-right: auto;}"+
                   " td { padding:"+abstandZelle+"px; border:0px solid "+htmlFarbTableBorderColor+";  border-right:"+borderHelpRight+"px solid "+htmlFarbTableBorderColor+";border-bottom:"+borderHelpBottum+"px solid "+htmlFarbTableBorderColor+";}"+ 
                   " table { width: "+weite+";  margin: 0 "+htmlcenterHelp+"; border:1px solid "+htmlFarbTableBorderColor+"; border-spacing=\""+abstandZelle+"0px\" ; }"+   // margin macht center
                   "td:nth-child(1) {width: "+htmlSpalte1Weite+"}"+"td:nth-child(2) {width:"+htmlSpalte1Weite+"}"+
                   " </style></head><body> <div>";
//const htmlUeber=    "<p style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-weight: bold\">"+htmlFeldUeber+"</p>";                    
const htmlTabStyle= "<table bordercolor=\""+htmlFarbTableBorderColor+"\" border=\"2px\" cellspacing=\""+abstandZelle+"\" cellpadding=\""+abstandZelle+"\" width=\""+weite+"\" rules=\""+htmlRahmenLinien+"\" style=\"color:"+htmlFarbFelderschrift+";  font-size:"+htmlSchriftgroesse+
                      "; font-family:"+htmlSchriftart+";background-image: linear-gradient(42deg,"+htmlFarbTableColorGradient2+","+htmlFarbTableColorGradient1+");\">";
const htmlTabUeber1="<tr height=\""+UeberSchriftHöhe+"\" style=\"color:"+htmlFarbTableColorUber+"; font-size: "+groesseUeberschrift+"px; font-weight: "+UeberschriftStyle+" ;  border-bottom: "+LinieUnterUeberschrift+"px solid "+farbeLinieUnterUeberschrift+" \">";
const htmlTabUeber3="</tr>";
 
 
//NICHTS ÄNDERN - abhängig von den oben definierten _Spalten - in diesem Beispiel sind es 5
 
 
var htmlTabUeber2="<td width="+htmlSpalte1Weite+" align="+Feld1lAlign+">&ensp;"+htmlFeld1+"&ensp;</td><td width="+htmlSpalte1Weite+" align="+Feld2lAlign+">&ensp;"+htmlFeld2+"&ensp;</td><td  align="+Feld3lAlign+">&ensp;"+htmlFeld3+"&ensp;</td><td align="+Feld4lAlign+
                  ">&ensp;"+htmlFeld4+"&ensp;</td><td  align="+Feld5lAlign+">&ensp;"+htmlFeld5+"&ensp;</td><td  align="+Feld6lAlign+">&ensp;"+htmlFeld6+"&ensp;</td><td  align="+Feld7lAlign+">&ensp;"+htmlFeld7+"&ensp;</td><td  align="+Feld8lAlign+">&ensp;"+htmlFeld8+
                  "&ensp;</td><td  align="+Feld9lAlign+">&ensp;"+htmlFeld9+"&ensp;</td>";
var htmlTabUeber2_1="<td width="+htmlSpalte1Weite+" align="+Feld1lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld1+"&ensp;</td><td width="+htmlSpalte1Weite+" align="+Feld2lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld3+
                   "&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld3+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld4+
                   "&ensp;</td><td align="+Feld5lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld5+"&ensp;</td><td align="+Feld6lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld6+"&ensp;</td><td align="+Feld7lAlign+
                   " style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld7+"&ensp;</td><td align="+Feld8lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld8+"&ensp;</td><td  align="+Feld9lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld9+"&ensp;</td>";
                       //------------------------------------------------------
 
 
 
var htmlOut="";
var mix;
var counter;
var val1; var val2; var val0; var val3; var val4; var val5; var val6; var val7;var val8; 
var htmlTabUeber="";
function writeHTML(){
 
 
 
htmlOut="";
 
counter=-1;
htmlTabUeber="";
switch (mehrfachTabelle) { 
   case 1: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber3;  break;
   case 2: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber3; break;
   case 3: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2+htmlTabUeber2+htmlTabUeber3; break;
   case 4: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber3; break;
}; 
if (!UeberschriftSpalten) {htmlTabUeber=""}  
 
//--------------------------------------------------------------------------------------------------------------------------------------------------
//---------hier kommt eure schleife rein counter++, tabelleBind() und tabelleFinish() müssen so integriert bleiben !!!------------------------------
//---------alle valx werte müssen von euch bestimmt werden - val0,val1,val2,val3,val4!!!------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------
 
 
$('unifi.0.default.vouchers.*.code').each(function(id, i) {           // hier eigene schleife definieren
        var ida = id.split('.');
      
          counter++; 
          let val2help;                                      // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN
          val0=getState(id)?.val;
          val1=getState(id.replace("code","create_time"))?.val;
          val2help=getState(id.replace("code","duration"))?.val*60;
          val3=getState(id.replace("code","qos_overwrite"))?.val;
          val4=getState(id.replace("code","quota"))?.val;
          val5=getState(id.replace("code","note"))?.val;
          val6=getState(id.replace("code","used"))?.val;
 
 
         val2=Math.floor( ((val2help)/60/60/24) )+"d "+ Math.floor(((val2help)/60/60) % 24) +"h "+ Math.floor( ((val2help)/60) % 60 )+" m" ;
 
        //  if (getState(id)?.val==null) {val4="never used"}; //log(id)}; 
     
          if (val6==0) {val6="❌"} else{val6="🔵"} 
 
          val7=""; val8=""; 
          if (existsState(id.replace("code","qos_rate_max_down"))) { val7=getState(id.replace("code","qos_rate_max_down"))?.val + " kbps";} 
          if (existsState(id.replace("code","qos_rate_max_up"))) {  val8=getState(id.replace("code","qos_rate_max_up"))?.val  + " kbps";}
           
 
     tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden
    
   }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!
 
//-------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------Ende der schleife------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------------------
 
      tabelleFinish(); // AB HIER NICHTS ÄNDERN - tabelle fertigstellen
     
} // function ende
 
//MAIN:
 
schedule(mySchedule,  function () {
 writeHTML();
 if (braucheEinFile) {writeFile(home, path ,htmlOut, function (error) { /* log('file written');*/  });}
}); 
 writeHTML();
 
   				 function tabelleBind(){
     //HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT - hat man oben 5 Felder definiert, braucht man hier 5 Werte
   
       switch (mehrfachTabelle) {  
        case 1: if(counter%2==0)  {  htmlOut=htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td></tr>"; break;} else
                                  {  htmlOut=htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td></tr>"; break;}
        case 2: if(counter%4==0){
                if(counter%2==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                              else {htmlOut = htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td></tr>";} break;
        }else{
                if(counter%2==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                              else {htmlOut = htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td></tr>";} break; }                  
        
        
        case 3: if(counter%2==0)   {
                if(counter%3==0 )  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                              else { if(counter%3==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"; color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td>";} 
                                               else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td></tr>";}
                                         } break; }else{
                if(counter%3==0 )  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                              else { if(counter%3==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"; color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td>";} 
                                               else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td></tr>";}
                                         } break;}
 
       
       
        case 4:   if(counter%8==0)   {
               if(counter%4==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                                  else {if(counter%4==1 )  { htmlOut = htmlOut+"<td  align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\>&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td>";} 
                                               else    {if(counter%4==3)  { htmlOut= htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td></tr>";} 
                                                                 else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td>&ensp;"+val1+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>";}}
                                         } break;}else{
               if(counter%4==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld5lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>"; } 
                                  else {if(counter%4==1 )  { htmlOut = htmlOut+"<td  align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td>";} 
                                               else    {if(counter%4==3)  { htmlOut= htmlOut+"<td align="+Feld1lAlign+"  style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td><td  align="+Feld4lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val3+"&ensp;</td><td align="+Feld5lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val7+"&ensp;</td><td align="+Feld9lAlign+"style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val8+"&ensp;</td></tr>";} 
                                                                 else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+" >&ensp;"+val0+"&ensp;</td><td>&ensp;"+val1+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val2+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val3+"&ensp;</td><td align="+Feld4lAlign+">&ensp;"+val4+"&ensp;</td><td align="+Feld6lAlign+">&ensp;"+val5+"&ensp;</td><td align="+Feld7lAlign+">&ensp;"+val6+"&ensp;</td><td align="+Feld8lAlign+">&ensp;"+val7+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld9lAlign+">&ensp;"+val8+"&ensp;</td>";}}
                                         } break;  }                        
 
     } //switch ende
 
 
 
}
 
function tabelleFinish() {
 
      // tabelle fertigstellen
      switch (mehrfachTabelle) {  
       case 1:    break;
 
       case 2:    
                 if(counter%2==0)  htmlOut = htmlOut.replace(/<\/td>$/, '</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>');  
                
                  break;
 
       case 3:   if(counter%3==2)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");
                 if(counter%3==1)  htmlOut = htmlOut.replace(/<\/td>$/, '</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>');         
                 if(counter%3==0)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");
               
                  break;
       case 4:   if(counter%4==3)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");
                 if(counter%4==2)  htmlOut = htmlOut.replace(/<\/td>$/, '</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>');  
                 if(counter%4==1)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");    
                 if(counter%4==0)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>"); 
                 break; }
     
                    var htmlUeber=    "<p style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: "+htmlÜberFontGroesse+"; font-weight:"+htmlSchriftWeite+ "\">"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</p>"; 
       var htmlUnter= "<div  style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: 70%; text-align: right;\" >"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</div>"
        
        if (!htmlSignature) htmlUnter="";
          //Ausgabe über VIS html widget - tabelle in datenpunkt schreiben - html tabelle ohne html header und body
           var htmlOutVIS="";
         //  htmlUberschrift ? htmlOutVIS=htmlUeber+htmlTabStyle+htmlTabUeber+htmlOut+"</table>" : htmlOutVIS=htmlTabStyle+htmlTabUeber+htmlOut+"</table>";
            if (htmlUberschrift) 
                { zentriert ? htmlOutVIS=htmlZentriert+htmlUeber+htmlTabStyle+htmlTabUeber+htmlOut+"</table>"+htmlUnter : htmlOutVIS=htmlUeber+htmlTabStyle+htmlTabUeber+htmlOut+"</table>"+htmlUnter ;
 
              } else {
               zentriert ?  htmlOutVIS=htmlZentriert+htmlTabStyle+htmlTabUeber+htmlOut+"</table>"+htmlUnter :  htmlOutVIS=htmlTabStyle+htmlTabUeber+htmlOut+"</table>"+htmlUnter;
 
                 }
 
// log("bin raus aus tabelleBind");
           if (braucheEinVISWidget) setState(dpVIS, htmlOutVIS );
 
 var htmlUnter= "<div  style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: 80%;  text-align: center; \" >"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</div>"
 
 if (!htmlSignature) htmlUnter="";
 var htmlEnd="</table>"+htmlUnter+"</div></body>";
 //mit oder ohne überschrift - zentriert oder links
htmlUberschrift ? htmlOut=htmlStart+htmlUeber+htmlTabStyle+htmlTabUeber+htmlOut+htmlEnd : htmlOut=htmlStart+htmlTabStyle+htmlTabUeber+htmlOut+htmlEnd;
 //log(htmlOut);
 
 
 
}
 
 
 
