var Sperre = false;
var Sperre_stumm = false;

// --- TEIL 1: Schimpfwortgenerator ---
async function Schimpfwortgenerator() {
    var a_wortliste1 = ["Dumpfe","Staubige","Miefende","Stinkende","Gammlige","Hinkende","Winzige","Popelige","Nasse","Furzende","Rostige","Hohle","Siffige","Miese","Krumme","Klapprige","Trockene","Haarige","Uralte","Grunzende","Schreiende","Meckernde","Nervende","Sabbernde","Triefende","Modrige","Lumpige","Lausige","Sinnlose","Olle","Unnötige","Dampfende","Ledrige","Einarmige","Leere","Lästige","Heulende","Pickelige","Faule","Ranzige","Trübe","Dralle","Blanke","Gierige","Tranige","Wackelnde","Torkelnde","Wüste","Fischige","Beknackte","Modrige","Verkorkste","Heimliche","Löchrige","Brockige","Plumpe","Tattrige","Ratternde","Schmutzige","Liderliche","Dösige","Prollige","Fiese","Dröge","Muffige","Müffelnde","Peinliche","Nörgelnde","Fettige","Zahnlose","Freche","Schäbige","Piefige","Gummige","Labbrige","Patzige","Pelzige","Reudige","Pekige","Mürbe","Harzige","Lahme","Mickrige","Bräsige","Zottelige","Gelbliche","Knorrige","Salzige","Schrille","Dusselige","Windige","Grausige","Grässliche","Grobe","Spackige","Kauzige","Flachsige","Fransige","Motzige","Kahle","Niedrige","Keifende","Nichtige","Dröge","Fade","Weinende","Schäbige","Nörgelnde","Hibbelige","Plockige","Brennende","Dürre","Kochende","Knarzende","Faltige","Schlammige","Bröckelige","Rissige","Verkeimte","Kantige","Geklaute","Quieckende","Faselnde","Beissende","Gehörnte","Vergessene","Bleiche","Zweickende","Frostige","Nackige","Gruselige","Mindere","Hagere","Magere","Schuppige","Belegte","Stänkernde","Bösartige","Rollende","Scheckige","Rubbelnde","Schielende","Tratschige","Mickrige","Groteske","Absurde","Mehlige","Platte","Müde","Totale","Bekloppte","Schaurige","Taube","Betäubte","Behämmerte","Belanglose","Beleidigte","Betrunkene","Bizarre","Diffuse"];
    var a_wortliste2 = ["Stampf","Wabbel","Pups","Schmalz","Schmier","Hack","Zement","Spuck","Stachel","Keller","Laber","Stock","Runzel","Schrumpf","Ekel","Schnodder","Matsch","Wurm","Eiter","Speck","Mist","Klotz","Würg","Lumpen","Schleim","Wurst","Doof","Brat","Schwamm","Kratz","Grotten","Kriech","Gift","Schlabber","Reier","Göbel","Knatter","Kleb","Schmadder","Grind","Labber","Luft","Massen","Schimmel","Mini","Ochsen","Problem","Quassel","Schnaps","Saft","Fummel","Friemel","Zappel","Tropf","Pluntsch","Sumpf","Hecken","Grab","Schwitz","Schnarch","Schleich","Schluff","Flöten","Holz","Kreisch","Dulli","Luschen","Gammel","Altöl","Röchel","Glibber","Lach","Krach","Knick","Quetsch","Quatsch","Quietsch","Knautsch","Tümpel","Teich","Knatter","Sauf","Pipi","Struller","Gräten","Nasen","Pech","Leier","Reier","Blöd","Schorf","Sabbel","Quengel","Bananen","Unsinns","Plunsch","Frust","Lotter","Fummel","Blubber","Wobbel","Vollbart","Lack","Klo","Moder","Knirsch","Zitter","Kalt","Schlürf","Schnief","Klecker","Rumba","Schwurbel","Schrabbel","Schlauch","Schrumpel","Hühner","Schlacker","Brabbel","Krampf","Prügel","Rappel","Zuppel","Plunder","Donner","Riesen","Butter","Wischwasch","Polter","Trampel","Sauer","Hampel","Bitter","Massel","Flitz","Warm","Schling","Plumps","Quäl","Strampel","Schleck","Recycling","Egal","Blech","Horror","Rumpel","Schnuller","Scherz","Nackt","Pampel","Morast","Flach","Angst","Spei","Pumpel","Ausschlag","Qualm","Rambazamba","Klein","Sprudel"];
    var a_wortliste3 = ["suppe","socke","bombe","boulette","schwarte","warze","beule","pest","pflaume","rübe","geige","ratte","krankheit","wunde","oma","knolle","stulle","liese","brut","henne","zwiebel","bude","kiste","braut","leuchte","kröte","nuss","spinne","grube","toilette","krake","pfütze","backe","bratsche","klatsche","nudel","knolle","tüte","nase","made","tonne","krampe","bürste","windel","semmel","haxe","gräfin","schleuder","zierde","krähe","latte","niete","rassel","assel","torte","galle","latsche","schrulle","kanone","blase","pelle","trine","queen","zecke","praline","magt","pracht","fritte","sosse","larve","murmel","hexe","pampe","sirene","drüse","klette","petze","brumme","glatze","qualle","natter","kralle","ziege","grütze","sülze","nulpe","wampe","frikadelle","flunder","trulla","zichte","uschi","kuh","pappe","hupe","tröte","schabe","kanallie","scharte","rille","amsel","alge","lücke","bremse","mücke","bürste","wanne","pocke","plörre","schabracke","wuppe","sichel","tante","reuse","ratsche","pauke","fluppe","matrone","hummel","parade","attrappe","lüge","flosse","funzel","gurke","piepe","göre","kolben","sammlung","primel","omme","lotte","unke","strippe","seife","plötze","wespe","lawine","tablette","krücke","grazie","diva","pulle","nessel","kakerlake","distel","amöbe","fackel","hüfte","ruine","wachtel","seuche","kippe","schippe","gestalt","wolke","mumie","spur","creme","motte"];
    var a_wortliste4 = ["busch","fink","nagel","bammel","klopper","tentakel","brägen","schlumpf","husten","ersatz","haufen","beutel","knödel","rüssel","hintern","eimer","pickel","stumpf","käse","molch","kohl","gnubbel","sack","hansel","puller","alptraum","kasten","kopf","beutel","bewohner","kuchen","freund","nascher","opa","rotz","klumpen","peter","hansel","bengel","kollege","fleck","löffel","lurch","hobel","spaten","pudel","rettich","rinnstein","unfall","lappen","kübel","mops","pfosten","zwerg","pudding","nuckel","putzer","lümmel","baron","mop","besen","feudel","brägen","bolzen","pilz","stiefel","köter","gulli","pfropf","schrank","könig","pott","paddel","rinnstein","zinken","haken","witz","buckel","knecht","fan","schmand","klops","gauner","lulli","graupe","pimpf","kasper","spross","teufel","hammel","bock","schmodder","prügel","spiesser","aal","groschen","geist","rochen","knochen","horst","quark","keks","zausel","iltis","jeck","honk","spargel","nippel","atze","muffel","greis","pinökel","gehilfe","halunke","lauch","thöle","onkel","klecks","schaden","auswurf","herpes","unrat","abklatsch","flegel","glotzer","stöpsel","rest","versuch","kompost","fluch","jogurt","pömpel","stiel","fetzen","duscher","gnom","schluck","schnupfen","infekt","infarkt","geruch","rambo","dackel","schwingel","dieb","fladen","flatschen","fussel","knilch","frosch","wombat","anfall","hohlsaum","bimbam","wodka","duft","kadaver","befall","egel","fänger"];
    var a_wortliste5 = ["sekret","balg","blag","monster","gelöt","imitat","skelett","ding","unding","auge","brot","deo","insekt","bier","mus","ende","futter","gewächs","produkt","geröll","bonbon","furunkel","paket","virus","desaster","stück","fass","zeug","ferkel","ei","gewitter","hormon","experiment","gulasch","schnitzel","fell","theater","schauspiel","baby","spielzeug","gel","donutloch","gelee","gelumpe","zeug","schaf","molekül","gewürz","gespenst","gespinnst","mittel","geschnetz","organ","risotto","vieh","gesäss","gezücht","ekzem","moped","gerümpel","hirn","gefäss","wachstum","moloch","rinnsaal","gemenge","opossum","frettchen","hähnchen","plankton","untier","ungetüm","gebräu","fondue","beispiel","elend","leid","gift","verderben","unglück","drama","trauma","versagen","fiasko","dilemma","debakel","tabu","gerücht","hindernis","dingdong","dingsbums","gewicht","abwasser","abbild","modell","gemälde","brett","geballer","gemächt","toupet","geschwätz","gerippe","pech","leiden","verbrechen","fossil","symptom","biest","wrack","gebäck","unheil","ungemach","objekt","gesicht","konfekt","gebrechen","märchen","gerät","verlust","syndrom","synonym","wasser","tier","follikel","unkraut","ungeziefer","getöse","geschmeiss","gebrodel","gejodel","inferno","gericht","mahl","kamel","gebiss","reptil","verliess","paddel","gebot","lager","gemisch","sausen","angebot","zimmer","möbel","parfüm","podest","ungeheuer","zeichen","versteck","übel","scrotum","eisen","ballett","lego","gesetz","format","buffet","granulat","derivat"];
    
    var i_zufallszahl = Math.floor(Math.random() * a_wortliste1.length);
    var s_schimpfwort = a_wortliste1[i_zufallszahl];
    var i_genus = Math.floor(Math.random() * 3);

    switch (i_genus) {
        case 0: s_schimpfwort += " "; break;
        case 1: s_schimpfwort += "r "; break;
        case 2: s_schimpfwort += "s "; break;
    }
    
    i_zufallszahl = Math.floor(Math.random() * a_wortliste2.length);
    s_schimpfwort += a_wortliste2[i_zufallszahl];
    
    switch (i_genus) {
        case 0: i_zufallszahl = Math.floor(Math.random() * a_wortliste3.length); s_schimpfwort += a_wortliste3[i_zufallszahl]; break;
        case 1: i_zufallszahl = Math.floor(Math.random() * a_wortliste4.length); s_schimpfwort += a_wortliste4[i_zufallszahl]; break;
        case 2: i_zufallszahl = Math.floor(Math.random() * a_wortliste5.length); s_schimpfwort += a_wortliste5[i_zufallszahl]; break;
    }
    return s_schimpfwort;
}

// --- TEIL 2: Dynamische Google-Ansage Funktion ---
async function googleWatchdogAnnounce(text, vol) {
    // Sucht alle Chromecast PlayerStates
    const players = $(`chromecast.0.*.status.playerState`);
    
    players.each(async function(id) {
        const base = id.split('.status.')[0]; // Extrahiert z.B. chromecast.0.küche
        const isPlaying = (getState(id).val === 'playing');
        
        let oldVol, oldUrl;
        if (isPlaying) {
            oldVol = getState(base + '.player.volume').val;
            oldUrl = getState(base + '.player.url2play').val;
        }

        // Sprachausgabe über SayIt
        sendTo("sayit", "say", { text: text, volume: vol });

        // Wiederaufnahme nur, wenn es vorher lief
        if (isPlaying) {
            setStateDelayed(base + '.player.url2play', oldUrl, 6000, false);
            setStateDelayed(base + '.player.volume', oldVol, 6500, false);
        }
    });
}

// --- TEIL 3: Trigger Postkasten ---
on({ id: 'alias.0.draussen.postkasten.STATE', change: 'ne' }, async (obj) => {
    if (!obj.state || !obj.state.val) return;
    if (getState('0_userdata.0.Haushalt.Briefkasten').val) return;

    const schimpf = await Schimpfwortgenerator(); //hinzugefügt, damit das Schimpfwort auch geschrieben wird
    const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;
    const msg = '📫 Es war gerade jemand am Postkasten, ' + schimpf; //+ schimpf hinzugefügt

    // A: Lautstarke Ansage (Tagsüber)
    if (!Sperre && compareTime('08:00', '20:00', 'between', null)) {
        Sperre = true;
        //const schimpf = await Schimpfwortgenerator(); => auskommentiert, wegen Zeile 64
        const vollerText = 'Es war gerade jemand am Postkasten. ' + schimpf;
        
        console.warn('Post da - Lautstarke Ansage');
        await googleWatchdogAnnounce(vollerText, 40);

        // Benachrichtigungen
        sendTo('telegram.0', 'send', { text: msg });
        exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=1"`);

        setTimeout(() => { Sperre = false; }, 60000);
    } 
    // B: Stumme Benachrichtigung (Nachts oder während Sperre)
    else if (!Sperre_stumm) {
        Sperre_stumm = true;
        console.log('Post da - Nur Text/Benachrichtigung');
        
        sendTo('telegram.0', 'send', { text: msg });
        exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${msg}" -F "priority=5"`);
        
        setState('0_userdata.0.Haushalt.Briefkasten', true);
        setTimeout(() => { Sperre_stumm = false; }, 60000);
    }
});

// Meldung Scharfschaltung
on({ id: '0_userdata.0.Haushalt.Briefkasten', change: 'lt' }, async (obj) => {
    const gotifyToken = getState('0_userdata.0.gotifytoken.iobroker').val;
    const msgScharf = '+++📫 Der Briefkasten wurde wieder scharf geschaltet. +++';
    
    sendTo('telegram.0', 'send', { text: msgScharf });
    exec(`curl "https://mygotify.meistermopper.de/message?token=${gotifyToken}" -F "title=ioBroker" -F "message=${msgScharf}" -F "priority=1"`);
});