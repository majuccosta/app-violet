/* VIOLET — Botão de emergência (RQ001)
   Segurar 3 s → pega localização → envia alerta → grava áudio (se permitido). */
document.addEventListener("DOMContentLoaded", () => {
  const { api, toast, openSheet, closeSheet } = window.Violet;
  const sos = document.getElementById("sos");
  const orb = document.getElementById("orb");
  const label = document.getElementById("sos-label");
  const icone = document.getElementById("sos-icone");
  const numero = document.getElementById("sos-count");
  const HOLD_MS = 3000;
  // Alerta silencioso (Configurações): sem vibração ao segurar e ao acionar
  const silencioso = !!(window.Violet.disp && window.Violet.disp.get("alerta_silencioso", false));
  let holdTimer, countdown, alerta, cronometro, recorder, stream, segurando = false, inicioToque = 0;

  /* ---------- Segurar para acionar: o botão pulsa e conta 3, 2, 1 ---------- */
  const mostrarNumero = (n) => {
    numero.hidden = false;
    numero.textContent = n;
    numero.style.animation = "none"; void numero.offsetWidth; numero.style.animation = ""; // repete o "pop"
    if (!silencioso && navigator.vibrate) navigator.vibrate(60);
  };
  const start = (e) => {
    e.preventDefault();
    if (segurando || alerta) return;
    segurando = true;
    inicioToque = Date.now();
    orb.classList.remove("is-early");
    orb.classList.add("is-holding");
    icone.hidden = true;
    label.textContent = "Acionando";
    let restante = 3;
    mostrarNumero(restante);
    countdown = setInterval(() => { restante -= 1; if (restante > 0) mostrarNumero(restante); }, 1000);
    holdTimer = setTimeout(acionar, HOLD_MS);
  };
  const stop = () => {
    if (!segurando) return;
    segurando = false;
    clearTimeout(holdTimer); clearInterval(countdown);
    if (alerta) return;
    orb.classList.remove("is-holding");
    numero.hidden = true;
    icone.hidden = false;
    // Soltou cedo: balança e lembra de segurar
    if (Date.now() - inicioToque < HOLD_MS) {
      void orb.offsetWidth;
      orb.classList.add("is-early");
      label.textContent = "Segure 3 s";
      setTimeout(() => { if (!segurando) label.textContent = "Segure"; }, 1800);
    }
  };
  sos.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => sos.addEventListener(ev, stop));
  // Teclado: segurar Enter/Espaço também funciona
  sos.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(e); });
  sos.addEventListener("keyup", stop);

  /* ---------- Acionamento ---------- */
  async function acionar() {
    clearInterval(countdown);
    segurando = false;
    alerta = alerta || { pendente: true };
    if (!silencioso && navigator.vibrate) navigator.vibrate([120, 60, 120]);
    document.getElementById("estado-pronto").hidden = true;
    document.getElementById("estado-ativo").hidden = false;
    document.querySelector('meta[name="theme-color"]').content = "#2a0b3d";
    iniciarCronometro();

    const pos = await localizacao();
    marcar("localizacao", pos ? "enviada" : "indisponível", !pos);

    try {
      alerta = await api.acionarEmergencia({ lat: pos?.lat ?? null, lng: pos?.lng ?? null });
      marcar("contatos", `${alerta.contatos_notificados} notificados`);
      marcar("ligue180", alerta.ligue180 ? "acionada" : "indisponível", !alerta.ligue180);
    } catch (err) {
      marcar("contatos", "falhou", true);
      toast("Não conseguimos enviar o alerta. Ligue 190.");
    }
    gravarAudio();
  }

  function marcar(item, texto, falhou = false) {
    const el = document.querySelector(`[data-item="${item}"] .state`);
    el.textContent = texto;
    el.classList.remove("is-pending");
    el.style.color = falhou ? "#ffb3bf" : "";
  }

  function localizacao() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function gravarAudio() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      const partes = [];
      recorder.ondataavailable = (e) => partes.push(e.data);
      recorder.onstop = () => {
        const audio = new Blob(partes, { type: recorder.mimeType });
        // TODO (integração): enviar `audio` para /api/emergencia/alertas/{id}/midias/
        console.info("[Violet] áudio gravado:", Math.round(audio.size / 1024), "KB");
      };
      recorder.start();
      document.getElementById("rec").hidden = false;
    } catch { /* usuária não permitiu o microfone */ }
  }

  function iniciarCronometro() {
    const inicio = Date.now();
    const el = document.getElementById("cronometro");
    cronometro = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }, 1000);
  }

  document.getElementById("captura").addEventListener("change", (e) => {
    if (e.target.files[0]) toast("Arquivo anexado ao alerta.");
  });

  /* ---------- Encerrar ---------- */
  document.getElementById("btn-encerrar").addEventListener("click", () => openSheet("sheet-encerrar"));
  document.getElementById("confirmar-encerrar").addEventListener("click", async () => {
    clearInterval(cronometro);
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    if (alerta) await api.cancelarEmergencia(alerta.id);
    closeSheet("sheet-encerrar");
    toast("Alerta encerrado. Seus contatos foram avisados.");
    setTimeout(() => (location.href = "home.html"), 1200);
  });
});
