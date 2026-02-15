let timeout2;

// Trigger auf Präsenzmelder
on({id: 'alias.0.kueche.bwm.PRESENCE_DETECTION_STATE', change: "ne"}, function (obj) {
    if (timeout2) clearTimeout(timeout2);
    
    // Kurze Verzögerung wie im Blockly (50ms)
    timeout2 = setTimeout(async function () {
        const bewegung = obj.state.val;
        const helligkeit = getState('alias.0.kueche.bwm.ILLUMINATION').val;
        const automatikAktiv = getState('0_userdata.0.Licht.Küche.Bewegungsautomatik').val;
        
        // Zeitprüfung: 22:00 bis 05:00 Uhr
        const jetzt = new Date();
        const stunde = jetzt.getHours();
        const istNacht = (stunde >= 22 || stunde < 5);

        if (automatikAktiv && helligkeit < 12 && bewegung) {
            // --- LICHT EINSCHALTEN ---
            if (istNacht) {
                // Nacht-Modus
                setState('alias.0.kueche.kuechenlampe.command', JSON.stringify({
                    "on": true,
                    "bri": 150,
                    "transitiontime": 10
                }));
            } else {
                // Tag-Modus: Sonoff an und Hue verzögert (um IoT-Adapter zu entlasten)
                setState('alias.0.kueche.licht.spots.POWER', true);
                
                setTimeout(function() {
                    setState('alias.0.kueche.kuechenlampe.command', JSON.stringify({
                        "on": true,
                        "bri": 254,
                        "transitiontime": 10
                    }));
                }, 300); // 300ms Versatz
            }
        } else if (automatikAktiv && !bewegung) {
            // --- LICHT AUSSCHALTEN ---
            setState('alias.0.kueche.licht.spots.POWER', false);
            
            setTimeout(function() {
                setState('alias.0.kueche.kuechenlampe.command', JSON.stringify({
                    "on": false,
                    "transitiontime": 10
                }));
            }, 300);
        }
    }, 50);
});