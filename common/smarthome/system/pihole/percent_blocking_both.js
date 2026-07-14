/* eslint-env es2022 */
// --- KONFIGURATION ---
const piholeInstances = [
  {
    blocked: "pi-hole2.0.Data.Summary.QueriesBlocked",
    total: "pi-hole2.0.Data.Summary.QueriesTotal",
    target: "0_userdata.0.Pihole.pihole0.percent_block",
  },
  {
    blocked: "pi-hole2.1.Data.Summary.QueriesBlocked",
    total: "pi-hole2.1.Data.Summary.QueriesTotal",
    target: "0_userdata.0.Pihole.pihole1.percent_block",
  },
];

// --- LOGIK ---
piholeInstances.forEach((inst) => {
  on({ id: inst.blocked, change: "gt" }, (obj) => {
    const blocked = obj.state.val;
    const total = getState(inst.total)?.val;

    if (total > 0) {
      const percentage = Math.round((blocked * 100) / total);
      setState(inst.target, percentage, true);
    } else {
      setState(inst.target, 0, true);
    }
  });
});
