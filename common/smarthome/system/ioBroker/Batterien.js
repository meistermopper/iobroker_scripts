
//@liv-in-sky Januar 2020 31.1-9:51
//https://forum.iobroker.net/topic/28789/script-f%C3%BCrtabelle-der-batterie-zust%C3%A4nde

 

//HIER WIRD PFAD UND FILENAME DEFINIERT

const path = "/htmlakku.html";                   //FIlenamen definieren
const home ='vis.0'                                 //wo soll das file im iobroker-file-system liegen ? (oder z.b auch iqontrol.meta)
let   braucheEinFile=false;                          // bei true wird ein file geschrieben
let   braucheEinVISWidget=true;                     // bei true wird ein html-tabelle in einen dp geschrieben - siehe nächste zeile
let dpVIS="0_userdata.0.Tabellen.akku"         //WICHTIG wenn braucheEinVISWidget auf true gesetzt !!  dp zusätzlich für VIS-HTML-Basic-Widget - zeichenkette(string)
let dpAlarm="0_userdata.0.Tabellen.akkuAlarm";  //WICHTIG datenpunkt erstellen vom typ "number" - bei 0 kein alarm und größer 0 die anzahl der schlechten batterien
let dpAlarmMessage="0_userdata.0.Tabellen.akkuMessage";  //WICHTIG datenpunkt erstellen vom typ "string" Inhalt - alle devices mit lowbat-alarmen
let wantAmessage=true;                                      // dieser message datenpunkt kann hier abgeschalten werden
let htmlColorDeviceUeberschrift="#A0C2A0"             //  Farbe der Geräte Marken 
let HTMLbrandSetting="i"                              // style der geräte marken:  möglich b fett; i kursiv; span normal
var battAlarm=25;                                     //alarm batterie wert
var battAlarmWarning=40;                                     //warnungen batterie wert

 

 // ------------------------    hier einstellen, was man für adapter hat - die nicht gebraucht werden auf false setzen !!!

var tradfri=false;
var hue=true;
var hueExt=false;
var homematic=false;
var homematicIp=true;
var xiaomi=false;                                                // mihome.0
var fritzDect=false;
var netatmo=false;
var homee=false;
var tado=false;
var zigbee=true;
var zwave=false;
var iogo=false;                                                 // iogo - adapter - hat batterie abfrage
var fullyBrowser=true;                                         // fullybrowser - adapter - hat batterie abfrage
var handy1=false;                                              // sind einzelne datenpunkte, 
var handy2=false;

 

//für spezialisten bei devices mit über 3 volt batterien

var bigBattAlarm=3.3; var bigBattWarn=3.6; //WICHTIG bei bigAlarm nicht unter 3.3 gehen !!!!!!!!


var symbolOK="🟢";  // auch möglich: ="🟢 ✅"}      
var symbolKO="❌";     //z.b. auch "<font color=\"red\"><b>X</b>" für ein rotes kreuz oder : ="🔴"
var symbolWARN="⚠️";    // ="🟡"

var filterArray=[]; //hier den ganzenpfad von ungewünschten LOW_BAT werten eingeben - diese werden dann gefiltert

                               // BEISPIEL var filterArray=["hm-rpc.0.LEQ0242145.0.LOWBAT", "hm-rpc.0.LEQ0242152.0.LOWBAT","hm-rpc.1.OEQ0473764.0.LOWBAT"];

let mySchedule=" */5 * * * * ";                       //jede minute  
//---------------------------------------

 
//HIER DIE SPALTEN ANZAHL DEFINIEREN - jede Spalte einen Wert - in diesem Beispiel sind es 3
var htmlFeld1='Device';      var Feld1lAlign="left";                     // überschrift Tabellen Spalte1 und  Ausrichtung left,right or center
var htmlFeld2='Wert';        var Feld2lAlign="center";                      // überschrift Tabellen Spalte2 und  Ausrichtung left,right or center
var htmlFeld3='Status';         var Feld3lAlign="center";                    // überschrift Tabellen Spalte3 und  Ausrichtung left,right or center
//-----------------------------------

//------------------------------hier werden die styles für die tabelle definiert

 
//ÜBERSCHRIFT ÜBER TABELLE
let   htmlUberschrift=false;                           // mit Überschrift über der tabelle
let   htmlSignature=true;                              // anstatt der Überscghrift eine signature: - kleiner - anliegend
const htmlFeldUeber='Batterie Zustand Sensoren';              // Überschrift und Signature
const htmlFarbUber="white";                         // Farbe der Überschrift
const htmlSchriftWeite="normal";                       // bold, normal - Fettschrift für Überschrift
const htmlÜberFontGroesse="18px";                       // schriftgröße überschrift

//MEHRERE TABELLEN NEBENEINANDER

let   mehrfachTabelle=2;                              // bis zu 4 Tabellen werden nebeneinander geschrieben-  verkürzt das Ganze, dafür etwas breiter - MÖGLICH 1,2,3,oder 4 !!!
const trennungsLinie="2";                             //extra trennungslinie bei mehrfachtabellen - evtl auf 0 stellen, wnn htmlRahmenLinien auf none sind
const farbetrennungsLinie="white";
const htmlFarbZweiteTabelle="white";                // Farbe der Überschrift bei jeder 2.ten Tabelle
const htmlFarbTableColorUber="#BDBDBD";               // Überschrift in der tabelle - der einzelnen Spalten

//ÜBERSCHRIFT SPALTEN

const UeberSchriftHöhe="35";                          //Überschrift bekommt mehr Raum - darunter und darüber - Zellenhöhe
const LinieUnterUeberschrift="3";                   // Linie nur unter Spaltenüberschrift - 
const farbeLinieUnterUeberschrift="white";
const groesseUeberschrift=16;
const UeberschriftStyle="normal"                     // möglich "bold"

//GANZE TABELLE

let abstandZelle="1";
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

 

// AB HIER NICHTS  ÄNDERN!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AB HIER NICHTS  ÄNDERN!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AB HIER NICHTS  ÄNDERN!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 

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
const htmlTabUeber1="<tr height=\""+UeberSchriftHöhe+"\"; style=\"color:"+htmlFarbTableColorUber+"; font-size: "+groesseUeberschrift+"px; font-weight: "+UeberschriftStyle+" ;  border-bottom: "+LinieUnterUeberschrift+"px solid "+farbeLinieUnterUeberschrift+" \">";
const htmlTabUeber3="</tr>";
 
 
//NICHTS ÄNDERN - abhängig von den oben definierten _Spalten - in diesem Beispiel sind es 3
 
  	var htmlTabUeber2="<td width="+htmlSpalte1Weite+" align="+Feld1lAlign+">&ensp;"+htmlFeld1+"&ensp;</td><td width="+htmlSpalte1Weite+" align="+Feld2lAlign+">&ensp;"+htmlFeld2+"&ensp;</td><td  align="+Feld3lAlign+">&ensp;"+htmlFeld3+"&ensp;</td>";
var htmlTabUeber2_1="<td width="+htmlSpalte1Weite+" align="+Feld1lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld1+"&ensp;</td><td width="+htmlSpalte1Weite+"  align="+Feld2lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld2+
                  "&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbZweiteTabelle+"\">&ensp;"+htmlFeld3+"&ensp;</td>";
//------------------------------------------------------
 
 
var htmlTabUeber="";
var htmlOut="";
var mix;
var counter;
var AkkuAlarm=[];
var alarmMessage=[];
let AkkuMessageLengthAlt=0;
 var arrDoppelt=[];
//HIER SIND DIE  WERTE, DIE IN DER SCHLEIFE GEFILTERET WER%DEN - Jede spalte einen wert - jeder valx muss in dieser schleife gesetzt werden !!
var val1; var val0; var val2;
 
function writeHTML(){
  AkkuAlarm=[];
 
htmlOut="";
 
counter=-1;
htmlTabUeber="";
switch (mehrfachTabelle) { 
  case 1: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber3;  break;
  case 2: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber3; break;
  case 3: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber2+htmlTabUeber3; break;
  case 4: htmlTabUeber=htmlTabUeber1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber2+htmlTabUeber2_1+htmlTabUeber3; break;
};   
if (!UeberschriftSpalten) {htmlTabUeber=""}
 
 
//--------------------------------------------------------------------------------------------------------------------------------------------------
//---------hier kommt eure schleife rein counter++, tabelleBind() und tabelleFinish() müssen so integriert bleiben !!!------------------------------
//---------alle valx werte müssen von euch bestimmt werden - val0,val1,val2 !!!---------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------
var myColl=[];
var val1help;
 
  
   if (fritzDect){
 
             counter=-1;
            
              for(var i=0;i<mehrfachTabelle;i++ ) {
                val0=""; val1=""; val2="";counter++;tabelleBind();
              }
            //  tabelleMachSchoen() 
               for(var i=0;i<mehrfachTabelle;i++ ) {
                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">FRITZDECT THERMOSTATE</b>";} else{val0=""; }
                   val1=""; val2="";counter++;tabelleBind();
              } 
 counter=-1;
  
 
 
  $('fritzdect.*.*.battery').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!
     if (!filterArray.includes(id)){
         var ida = id.split('.');
        
           counter++; 
             
         //  val0=ida[2]+"."+ida[3];
           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;
           val1help=parseFloat((getState(id).val));
           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 
           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}
           if (getState(id).val==null) {val2="never used"}; //log(id)}; 
           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         
           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;
 
           if (val1help<=battAlarm) AkkuAlarm.push(1);
           if (val1help<=battAlarm)  alarmMessage.push(val0);
      
    
      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden
     
    }  }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  
     
 } //ende fritzdect
 
    if (homee){
        tabelleMachSchoen()
        counter=-1;
    
              // 
                for(var i=0;i<mehrfachTabelle;i++ ) {
                val0=""; val1=""; val2="";counter++;tabelleBind();
              }
               
               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HOMEE DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

  $('homee.0.*.BatteryLevel*').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

     if (!filterArray.includes(id)){

         var ida = id.split('.');

        

           counter++; 

             

         //  val0=ida[2]+"."+ida[3];

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;

           val1help=parseFloat((getState(id).val));

          //    var val2_1;

         //   if (parseInt((new Date().getTime())) - val2_2help < 120000) {val2_1=true} else {val2_1=false;}

 

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

         //  var val2_2help=Date.parse(getState(id.replace("BatteryStatus","LastUpdate")).val); 

         //  if (val2_1) {val2=symbolOK} else{val2=symbolKO}   

                

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

      

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

     

   }  }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

 } //ende fritzdect

 

    if (netatmo){

              tabelleMachSchoen()

                  counter=-1;

              

              for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">NETATMO DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

 

 

  $('netatmo.*.*.*.BatteryStatus').each(function(id, i) {           // netatmo.0.Hinxxxer.Außenmodul-Carport.BatteryStatus

 

 //  if (!filterArray.includes(id)){

 

       

         var ida = id.split('.');

      

           counter++; 

             

         //  val0=ida[2]+"."+ida[3];

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]).common.name ;

           val1help=parseFloat((getState(id).val));

           //   var val2_1;

         //   if (parseInt((new Date().getTime())) - val2_2help < 120000) {val2_1=true} else {val2_1=false;}

 

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

         //  var val2_2help=Date.parse(getState(id.replace("BatteryStatus","LastUpdate")).val); 

         //  if (val2_1) {val2=symbolOK} else{val2=symbolKO}   

                

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

      

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

     

    /* }*/   }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

 } //ende fritzdect

 

  if (xiaomi){

            tabelleMachSchoen()

            counter=-1

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">XIAOMI DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

$('mihome.*.devices.*.percent').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

       // log (id)

        if (!filterArray.includes(id)){

         var ida = id.split('.');

        

         

           counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

         //  val0=ida[3];

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]).common.name ;

          val0=val0.replace(/.battery$/,""); 

         // log(val0+"   "+id);

           val1help=parseFloat((getState(id).val));

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (getState(id).val==null) {val2="never used"}; //log(id)}; 

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

          

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

         

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

  

  }  }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

  

  } //ende xiaomi

 

 if (hue){

              tabelleMachSchoen()

              counter=-1

              for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

              for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HUE DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

     

$('hue.*.*.battery').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

  

   if (!filterArray.includes(id)){

        var ida = id.split('.');

       

        

          counter++; 

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]).common.name ;   val0=val0.replace(/.battery$/,""); val0=val0.replace("Philips_hue.",""); val0=val0.replace(/_/g," ");                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

           val1help=parseFloat((getState(id).val));

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (getState(id).val==null) {val2="never used"}; //log(id)}; 

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

         

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

   

     tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

 

 } }); 

 

  }  //ende hue

 if (hueExt){ 

        tabelleMachSchoen()

            counter=-1

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HUE EXTENDED</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

      

 

 

$('hue-extended.*.*.*.config.battery').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

 

 if (!filterArray.includes(id)){

       var ida = id.split('.');

    

       

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

        

            val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]).common.name ;   val0=val0.replace("Philips_hue.",""); val0=val0.replace(/_/g," ");                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

 

           val1help=parseFloat((getState(id).val));

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (getState(id).val==null) {val2="never used"}; //log(id)}; 

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

 

        

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

 

  }  }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

 

   } //ende hue-extended

 

    if (zigbee){ 

 

             tabelleMachSchoen()

             counter=-1

             for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

             for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">ZIGBEE DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

$('zigbee.*.*.battery').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

      

       if (!filterArray.includes(id)){

       var ida = id.split('.');

      

       

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

        

        

          val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;

         // log(val0+"   "+id);

         val1help=getState(id).val;

         val1help=parseFloat((getState(id).val));

         if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

         if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

         if (getState(id).val==null) {val2="never used"}; //log(id)}; 

         if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

         if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

 

         if (val1help<=battAlarm) AkkuAlarm.push(1);

         if (val1help<=battAlarm)  alarmMessage.push(val0);

  

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

 

 } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

  }

 

 if (tradfri){ 

 

       tabelleMachSchoen()

              counter=-1

  

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">IKEA TRADFRI</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

$('tradfri.*.*.batteryPercentage').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

      

       if (!filterArray.includes(id)){

       var ida = id.split('.');

      

       

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

        

        

          val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;

         // log(val0+"   "+id);

         val1help=getState(id).val;

         val1help=parseFloat((getState(id).val));

         if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

         if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

         if (getState(id).val==null) {val2="never used"}; //log(id)}; 

         if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

         if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

 

         if (val1help<=battAlarm) AkkuAlarm.push(1);

         if (val1help<=battAlarm)  alarmMessage.push(val0);

  

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

 

 } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

  }

 

  if (tado){

      tabelleMachSchoen()

             counter=-1

  

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">TADO DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

 

$('tado.*.*.*.*.*.*.info.batteryState').each(function(id, i) {           // tado.0.337268.Rooms.11.devices.VA3078030592.info.batteryState

     var ida = id.split('.');

      if (!filterArray.includes(id)){

       counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

     //  log(id)

        val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]+"."+ida[4]).common.name                     //getObject(id).common.name ; //ida[2]+"."+ida[3];

                                                                                        //tado.0.337268.Rooms.11

       

        //log(val0+"   "+id);

       val1help=getState(id).val;

       if (val1help=="LOW") {val1=(" <font color=\"red\"> ")+"low bat"} else{val1=(" <font color=\"lightgreen\"> ")+"full bat"} 

       //if (val1help<=battAlarm) {val2="<font color=\"red\"><b>X</b>"} else{val2=symbolOK}

       if (val1help=="LOW") {val2="<font color=\"red\">"+symbolKO} else{val2=symbolOK}   

       //if (val1help) {val2=<font color=\"red\"><b>X</b>} else{val2="✔"}         

       

       if (val1help=="LOW") AkkuAlarm.push(1);

       if (val1help=="LOW")  alarmMessage.push(val0);

 

  tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

      } // ende filterArr

}); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!! 

   }  //ende tado

 

 

if (homematic){

    tabelleMachSchoen()

             counter=-1

    

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HOMEMATIC DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

 

  

     arrDoppelt=[];

$('hm-rpc.*.*.*.BATTERY_STATE').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

  

  if (!filterArray.includes(id)){

     var ida = id.split('.');

 

     var arrFilt=[];

 

         $(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]+".*").each(function(id, i) {   // kontrolliere ob OPERATING_VOLTAGE vorhanden

             var idc = id.split('.');

          arrFilt.push(idc[4])

          });

       arrDoppelt.push(ida[0]+"."+ida[1]+"."+ida[2]);

       counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

 

    if (arrFilt.includes("BATTERY_STATE")) {

                val0=getObject(id).common.name ; 

                var ida = val0.split('.');

                val0=ida[0].replace(/:.+/g,"");

                val1help=getState(id).val;

                var  val1helper=getState(id.replace("LOW_BAT","BATTERY_STATUS")).val;     

                //bigBatterien 

                //log (val1helper.toFixed(1))

                if (val1helper>3.2){

                       if (val1helper<=bigBattAlarm) {val2=symbolKO} else if (val1helper<=bigBattWarn && val1helper>bigBattAlarm) 

                          {val2=symbolWARN} else{val2=symbolOK};

                       if (val1helper<=bigBattAlarm) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=bigBattWarn && val1helper>bigBattAlarm) 

                          {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+(val1helper.toFixed(1))+" V"};

                       if (val1helper<bigBattAlarm) AkkuAlarm.push(1);

                       if (val1helper<=bigBattAlarm)  alarmMessage.push(val0);

                    }

 

                else {

                      if (val1helper<=1.5){

                         if (val1helper<1.1) {val2=symbolKO} else if (val1helper<=1.2 && val1helper>=1.1) 

                         {val2=symbolWARN} else{val2=symbolOK};

                         if (val1helper<1.1) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=1.2 && val1helper>=1.1) 

                            {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+val1helper.toFixed(1)+" V"};

                         if (val1helper<1.1) AkkuAlarm.push(1);

                         if (val1helper<1.1)  alarmMessage.push(val0)

 

                      } else {        

                         if (val1helper<2.2) {val2=symbolKO} else if (val1helper<=2.5 && val1helper>=2.2) 

                         {val2=symbolWARN} else{val2=symbolOK};

                         if (val1helper<2.2) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=2.5 && val1helper>=2.2) 

                            {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+val1helper.toFixed(1)+" V"};

                         if (val1helper<2.2) AkkuAlarm.push(1);

                         if (val1helper<2.2)  alarmMessage.push(val0);}}

 

      } else {

                                                   

               val0=getObject(id).common.name ; 

               var ida = val0.split('.');

               val0=ida[0].replace(/:.+/g,"");

               val1help=getState(id).val;

               if (val1help) {val1=(" <font color=\"red\"> ")+"low bat"} else{val1=(" <font color=\"lightgreen\"> ")+"full bat"} 

               if (val1help) {val2=symbolKO} else{val2=symbolOK}         

               if (val1help) AkkuAlarm.push(1);

               if (val1help)  alarmMessage.push(val0);

 

      }

 

  tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

  }

});

//log(arrDoppelt.toString())

$('hm-rpc.*.*.0.LOWBAT').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

     var ida = id.split('.');

   //  log(id)

     //log(arrDoppelt.toString())

  //    if (!filterArray.includes(id) && !arrDoppelt.includes(ida[0]+"."+ida[1]+"."+ida[2]+".*.BATTERY_STATE") ) {

              if (!filterArray.includes(id) && !arrDoppelt.includes(ida[0]+"."+ida[1]+"."+ida[2]) ) {                          

       

          

       counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

     //  log(id)

        val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name                     //getObject(id).common.name ; //ida[2]+"."+ida[3];

        var ida = val0.split('.');

        val0=ida[0].replace(/:.+/g,"");

        //log(val0+"   "+id);

       val1help=getState(id).val;

       if (val1help) {val1=(" <font color=\"red\"> ")+"low bat"} else{val1=(" <font color=\"lightgreen\"> ")+"full bat"} 

       //if (val1help<=battAlarm) {val2="<font color=\"red\"><b>X</b>"} else{val2=symbolOK}

       if (val1help) {val2="<font color=\"red\">"+symbolKO} else{val2=symbolOK}   

       //if (val1help) {val2=<font color=\"red\"><b>X</b>} else{val2="✔"}         

       

       if (val1help) AkkuAlarm.push(1);

       if (val1help)  alarmMessage.push(val0);

 

 

  tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

      } // log(id)// ende filterArr

}); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

 

 

 //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

  

   } //ende hm

 

 if (homematicIp ){ 

     tabelleMachSchoen()

                counter=-1

    

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HOMEMATIC IP</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

 

$('hm-rpc.*.*.0.LOW_BAT').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

 

  if (!filterArray.includes(id)){

       var ida = id.split('.');

 

       var arrFilt=[];

 

           $(ida[0]+"."+ida[1]+"."+ida[2]+"."+ida[3]+".*").each(function(id, i) {   // kontrolliere ob OPERATING_VOLTAGE vorhanden

               var idc = id.split('.');

            arrFilt.push(idc[4])

            });

       // log(arrFilt.toString());

 

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

 

      if (arrFilt.includes("OPERATING_VOLTAGE")) {

                //  val0=getObject(id).common.name ; 

                  val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ; 

                  var ida = val0.split('.');

                  val0=ida[0].replace(/:.+/g,"");

                  val1help=getState(id).val;

                  var  val1helper=getState(id.replace("LOW_BAT","OPERATING_VOLTAGE")).val;     

                  //bigBatterien 

                  //log (val1helper.toFixed(1))

                  if (val1helper>3.2){

                         if (val1helper<=bigBattAlarm) {val2=symbolKO} else if (val1helper<=bigBattWarn && val1helper>bigBattAlarm) 

                            {val2=symbolWARN} else{val2=symbolOK};

                         if (val1helper<=bigBattAlarm) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=bigBattWarn && val1helper>bigBattAlarm) 

                            {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+(val1helper.toFixed(1))+" V"};

                         if (val1helper<bigBattAlarm) AkkuAlarm.push(1);

                         if (val1helper<2.2) alarmMessage.push(val0);

                      }

   

                  else { 

                        if (val1helper<=1.5){

                         if (val1helper<1.1) {val2=symbolKO} else if (val1helper<=1.2 && val1helper>=1.1) 

                         {val2=symbolWARN} else{val2=symbolOK};

                         if (val1helper<1.1) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=1.2 && val1helper>=1.1) 

                            {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+val1helper.toFixed(1)+" V"};

                         if (val1helper<1.1) AkkuAlarm.push(1);

                         if (val1helper<1.1)  alarmMessage.push(val0)

 

                      } else {          

                        if (val1helper<2.2) {val2=symbolKO} else if (val1helper<=2.5 && val1helper>=2.2) 

                           {val2=symbolWARN} else{val2=symbolOK};

                        if (val1helper<2.2) {val1=(" <font color=\"red\"> ")+val1helper.toFixed(1)+" V"} else if (val1helper<=2.5 && val1helper>=2.2) 

                           {val1=(" <font color=\"yellow\"> ")+val1helper.toFixed(1)+" V"} else{val1=(" <font color=\"lightgreen\"> ")+val1helper.toFixed(1)+" V"};

                        if (val1helper<2.2) {AkkuAlarm.push(1);}

                        if (val1helper<2.2) alarmMessage.push(val0);

                        }}

 

        } else {

                                                     

                 val0=getObject(id).common.name ; 

                 var ida = val0.split('.');

                 val0=ida[0].replace(/:.+/g,"");

                 val1help=getState(id).val;

                 if (val1help) {val1=(" <font color=\"red\"> ")+"low bat"} else{val1=(" <font color=\"lightgreen\"> ")+"full bat"} 

                 if (val1help) {val2=symbolKO} else{val2=symbolOK}         

                 if (val1help) AkkuAlarm.push(1);

 

        }

 

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

   

 } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

    

  }  //ende hm-ip

 

      if (zwave){

          tabelleMachSchoen()

                  counter=-1

    

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">ZWAVE DEVICES</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

   

 

  $('zwave.*.*.BATTERY.Battery_Level*').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

     if (!filterArray.includes(id)){

         var ida = id.split('.');

        

           counter++; 

             

         //  val0=ida[2]+"."+ida[3];

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;

           val1help=parseFloat((getState(id).val));

          //    var val2_1;

         //   if (parseInt((new Date().getTime())) - val2_2help < 120000) {val2_1=true} else {val2_1=false;}

 

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

         //  var val2_2help=Date.parse(getState(id.replace("BatteryStatus","LastUpdate")).val); 

         //  if (val2_1) {val2=symbolOK} else{val2=symbolKO}   

                

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

      

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

     

   } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

 } //ende fritzdect

 

  if (fullyBrowser){

      tabelleMachSchoen()

              counter=-1

    

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

             

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">FULLYBROWSER</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

 

$('fullybrowser.*.*.Info.batteryLevel').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

 if (!filterArray.includes(id)){

         var ida = id.split('.');

        

         

           counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

 

           val0=getState(id.replace("batteryLevel","deviceName")).val;

           val1help=parseFloat((getState(id).val));

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (getState(id).val==null) {val2="never used"}; //log(id)}; 

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

          

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

  

  }  }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

  

  } //ende fullybrowser

 

 

  if (iogo){

            tabelleMachSchoen()

              counter=-1

    

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

               

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">>HANDY über IOGO</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

 

 

$('iogo.*.*.battery.level').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

 if (!filterArray.includes(id)){

         var ida = id.split('.');

        

         

           counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

        //   val0=ida[3];

           val0=getObject(ida[0]+"."+ida[1]+"."+ida[2]).common.name ;

         // log(val0+"   "+id);

           val1help=parseFloat((getState(id).val));

           if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

           if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

           if (getState(id).val==null) {val2="never used"}; //log(id)}; 

           if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

           if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

          

           if (val1help<=battAlarm) AkkuAlarm.push(1);

           if (val1help<=battAlarm)  alarmMessage.push(val0);

         

    

      tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

  

 } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!

  

  } //ende iogo

 

 

   if (handy1){  

       tabelleMachSchoen()

                 counter=-1

   

              // 

                for(var i=0;i<mehrfachTabelle;i++ ) {

                val0=""; val1=""; val2="";counter++;tabelleBind();

              }

                tabelleMachSchoen()

               for(var i=0;i<mehrfachTabelle;i++ ) {

                  if(i==0){val0="<font color=\""+htmlColorDeviceUeberschrift+"\"><"+HTMLbrandSetting+">HANDYs</b>";} else{val0=""; }

                   val1=""; val2="";counter++;tabelleBind();

              } 

     

 

        $('controll-own.0.HANDY.*batt*').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

         if (!filterArray.includes(id)){

       var ida = id.split('.');

       

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

         val0=ida[3];

        // log(val0+"   "+id);

         val1help=parseFloat((getState(id).val));

         if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

         if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

         if (getState(id).val==null) {val2="never used"}; //log(id)}; 

         if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

         if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

 

         if (val1help<=battAlarm) AkkuAlarm.push(1);

         if (val1help<=battAlarm)  alarmMessage.push(val0);

    

  

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

        

         } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

 

   } //ende handy1

 

 

 

   if (handy2){ 

            $('controll-own.0.HANDY.*Batt*').each(function(id, i) {           // hier eigene schleife definieren und den wert counter++ nicht vergessen  !!!

             if (!filterArray.includes(id)){

       var ida = id.split('.');

       

         counter++;                                       // SEHR WICHTIG - MUSS IN JEDER SCHLEIFE INTEGRIERT SEIN

         val0=ida[3];

        // log(val0+"   "+id);

         val1help=parseFloat((getState(id).val));

         if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()+" %"}

         if (val1help<=battAlarm) {val1=(" <font color=\"red\"> ")+val1help.toString()+" %"} else{val1=(" <font color=\"lightgreen\"> ")+val1help.toString()+" %"} 

         if (val1help>battAlarm && val1help<=battAlarmWarning) {val1=(" <font color=\"yellow\"> ")+val1help.toString()}

         if (getState(id).val==null) {val2="never used"}; //log(id)}; 

         if (val1help<=battAlarm) {val2=symbolKO} else{val2=symbolOK}         

         if (val1help>battAlarm && val1help<=battAlarmWarning) val2=symbolWARN;

        

 

  

    tabelleBind(); //HIER NICHTS ÄNDERN : HIER WERDEN DIE DATEN DER SCHLEIFE ZUSAMMENGESETZT  - diese function muss als letztes in der eigenen schleife aufgerufen werden

   

             } }); //Schleifen Ende - je nach schleifenart muss hier etwas geändert werden !!!!!!!!!  

   } //ende handy2

//-------------------------------------------------------------------------------------------------------------------------------------------------

//--------------------------------------------------Ende der schleife------------------------------------------------------------------------------

//-------------------------------------------------------------------------------------------------------------------------------------------------

 

     tabelleFinish(); // AB HIER NICHTS ÄNDERN - tabelle fertigstellen

 

     if (AkkuAlarm.length >=1 ) {setState(dpAlarm,AkkuAlarm.length)} else {setState(dpAlarm,AkkuAlarm.length)}

    // log("BATTERIE Alarm     : "+AkkuAlarm.length.toString());

    if (AkkuMessageLengthAlt < AkkuAlarm.length && wantAmessage) {setState(dpAlarmMessage,alarmMessage.toString()); AkkuMessageLengthAlt=AkkuAlarm.length}

    alarmMessage=[];

        

} // function ende

 

//MAIN:

 

schedule(mySchedule,  function () { 

writeHTML();

if (braucheEinFile) {writeFile(home, path ,htmlOut, function (error) { /* log('file written');*/  });}

}); 

writeHTML();  

if (braucheEinFile) {writeFile(home, path ,htmlOut, function (error) { /* log('file written');*/  });}                                 //     <tdalign style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         

 

  function tabelleBind(){

    //  counter=counter+mehrfachTabelle;

        switch (mehrfachTabelle) { 

 

          case 1: if(counter%2==0)         {  htmlOut=htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td></tr>"; break;}else    

                                           {  htmlOut=htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td></tr>"; break;}

          case 2: if(counter%4==0){

                     if(counter%2==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         ";\" align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } 

                                else {htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td></tr>";} break;

                       }else{

                                 if(counter%2==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         ";\"align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } 

                                else {htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td></tr>";} break;}

                                     

          case 3:if(counter%2==0)   {

                     if(counter%3==0 )  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         ";\"align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } 

                                else { if(counter%3==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         "; \"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td>";} 

                                                 else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td></tr>";}

                                           } break;}else{

                     if(counter%3==0 )  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         ";\"align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } 

                                else { if(counter%3==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+

                                                         ";\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td>";} 

                                                 else    {htmlOut = htmlOut+"<td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td></tr>";}

                                           } break;}                                          

 

 

          case 4:  // counter=counter+8;

                    if(counter%8==0)   {

                    if(counter%4==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeGeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td  style=\" border-right: "+trennungsLinie+"px solid "+ farbetrennungsLinie+";\" align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } // teil1

                                    else {if(counter%4==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td>";} //teil 2

                                                 else    {if(counter%4==3)  { htmlOut= htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td></tr>";} //teil 4

                                                                   else    {htmlOut = htmlOut = htmlOut+"<td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\"  align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>";}} //teil 3

                                           } break;}else{

                    if(counter%4==0)  {htmlOut = htmlOut+"<tr bgcolor=\""+farbeUngeradeZeilen+"\"><td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td  style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\" align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>"; } //teil 1

                                    else {if(counter%4==1 )  { htmlOut = htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td  align="+Feld3lAlign+" style=\"border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td>";} // teil 2

                                                 else    {if(counter%4==3)  { htmlOut= htmlOut+"<td align="+Feld1lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val0+"&ensp;</td><td  align="+Feld2lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val1+"&ensp;</td><td align="+Feld3lAlign+" style=\"color:"+htmlFarbFelderschrift2+"\">&ensp;"+val2+"&ensp;</td></tr>";} // teil 4

                                                                   else    {htmlOut = htmlOut = htmlOut+"<td align="+Feld1lAlign+">&ensp;"+val0+"&ensp;</td><td align="+Feld2lAlign+">&ensp;"+val1+"&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+";\"align="+Feld3lAlign+">&ensp;"+val2+"&ensp;</td>";}} //teil 3

                                           } break;}                                    

         } //switch ende

 

 }

 

function tabelleMachSchoen() {

 

switch (mehrfachTabelle) {  

        case 1:    break;

 

        case 2:    

                   if(counter%2==0)  htmlOut = htmlOut.replace(/<\/td>$/, '</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>');

                 

                   break;

 

        case 3:   if(counter%3==2)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");

                  if(counter%3==1)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");        

                  if(counter%3==0)      htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td  style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");

                

                   break;

        case 4:   if(counter%4==3)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");

                  if(counter%4==2)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");

                  if(counter%4==1)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");    

                  if(counter%4==0)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");      

                  break; }

}

 

 

 

function tabelleFinish() {

 

switch (mehrfachTabelle) {  

        case 1:    break;

 

        case 2:    

                   if(counter%2==0)  htmlOut = htmlOut.replace(/<\/td>$/, '</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>');

                 

                   break;

 

        case 3:   if(counter%3==1)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");

                  if(counter%3==2)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");        

                  if(counter%3==0)      htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td  style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");

                

                   break;

        case 4:   if(counter%4==3)  htmlOut = htmlOut.replace(/<\/td>$/, "</td></tr>");

                  if(counter%4==2)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");

                  if(counter%4==1)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");    

                  if(counter%4==0)  htmlOut = htmlOut.replace(/<\/td>$/, "</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td style=\" border-right: "+trennungsLinie+"px solid "+farbetrennungsLinie+"\">&ensp;</td><td>&ensp;</td><td>&ensp;</td><td>&ensp;</td></tr>");      

                  break; }

    

        var htmlUeber=    "<p style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: "+htmlÜberFontGroesse+"; font-weight:"+htmlSchriftWeite+ "\">"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</p>"; 

      var htmlUnter= "<div  style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: 70%; text-align: right;\" >"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</div>";

       

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

          //console.log dpVIS;

 

var htmlUnter= "<div  style=\"color:"+htmlFarbUber+"; font-family:"+htmlSchriftart+"; font-size: 80%;  text-align: center; \" >"+htmlFeldUeber+"&ensp;&ensp;Last Update: "+formatDate(getDateObject((parseFloat((new Date().getTime())))), "SS:mm:ss");+"</div>"

var htmlEnd="</table>"+htmlUnter+"</div></body>";

if (!htmlSignature) htmlUnter="";

 

//mit oder ohne überschrift - zentriert oder links

htmlUberschrift ? htmlOut=htmlStart+htmlUeber+htmlTabStyle+htmlTabUeber+htmlOut+htmlEnd : htmlOut=htmlStart+htmlTabStyle+htmlTabUeber+htmlOut+htmlEnd;

//log(htmlOut);

 

 

}

 

 

 
