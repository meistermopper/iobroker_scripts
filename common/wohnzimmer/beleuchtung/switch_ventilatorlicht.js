on({id: "0_userdata.0.Licht.Wohnzimmer.Ventilatorlicht", change: "ne"}, async function (obj) {
    // Wir erzwingen ein true/false. 
    // Falls der Wert null/undefined ist, wird er automatisch zu 'false'.
    const targetState = !!(obj.state ? obj.state.val : false);
    
    setState("tuya.0.bfc93beea92189ab17oopt.9", targetState);
    
    // Kleiner Debug-Log (optional)
    console.log(`Ventilatorlicht synchronisiert: ${targetState}`);
});