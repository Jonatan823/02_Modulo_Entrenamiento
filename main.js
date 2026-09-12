import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1VUXm-OtZE30X4Ugv06VYUKY7RcneKDg",
  authDomain: "sler-chat-lab.firebaseapp.com",
  databaseURL: "https://sler-chat-lab-default-rtdb.firebaseio.com",
  projectId: "sler-chat-lab",
  storageBucket: "sler-chat-lab.firebasestorage.app",
  messagingSenderId: "594954603335",
  appId: "1:594954603335:web:02f0183659d8c752521a62",
  measurementId: "G-X4Z6HLBF2H"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let ejercicioActivoNum = 1;
let datosEjercicioActual = null;
let estado = "start";
let tiempoInicioMs = 0;
let cronometro = null;
let globalPID = 0;
const MAX_CARACTERES = 100;

// --- CONFIGURACIÓN DE LOGIN PREVIO ---
const PIN_CODIGO_VALIDO = "SLER2026"; // Código maestro de prueba

// --- GESTIÓN DE TIEMPOS Y ACCESOS ---
const ES_MODO_DEV = true; // Cambiar a 'false' para producción (activa candado de 3 días y expiración de 7 días)

function obtenerDiaCurso() {
  let fechaInicio = localStorage.getItem("sler_fecha_inicio");
  if (!fechaInicio) {
    fechaInicio = new Date().getTime();
    localStorage.setItem("sler_fecha_inicio", fechaInicio);
  }
  const diffMs = new Date().getTime() - parseInt(fechaInicio);
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDias + 1;
}

function verificarAcceso(numEj) {
  if (ES_MODO_DEV) return true;

  const diaActual = obtenerDiaCurso();

  // Bloqueo total tras 7 días
  if (diaActual > 7) {
    alert("Tu periodo de acceso de 7 días al curso ha finalizado.");
    return false;
  }

  // Restricciones por día
  if (numEj >= 52 && numEj <= 71 && diaActual < 2) {
    alert("¡Excelente trabajo en el Día 1! Para dar descanso a tu vista, el entrenamiento continúa mañana. Tu acceso al Nivel 3 se activará en 24 horas.");
    return false;
  }

  if (numEj >= 72 && diaActual < 3) {
    alert("¡Sesión del Día 2 completada! Deja reposar la práctica por hoy. En 24 horas podrás acceder a los Niveles 4 y 5.");
    return false;
  }

  return true;
}

export async function cargarEjercicio(numEj) {
  const targetEj = parseInt(numEj);

  if (!verificarAcceso(targetEj)) {
    if (typeof window.seleccionarEjercicioGlobal === "function") {
      window.seleccionarEjercicioGlobal(ejercicioActivoNum);
    }
    return;
  }

  ejercicioActivoNum = targetEj;
  globalPID++;
  resetEstadoUI();
  actualizarEncabezadoUI(`Cargando Ej. ${ejercicioActivoNum}...`);

  try {
    const docRef = doc(db, "ejercicios", `ej_${ejercicioActivoNum}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      datosEjercicioActual = docSnap.data();
      prepararVistaEjercicio();
    } else {
      actualizarEncabezadoUI(`Ej. ${ejercicioActivoNum} (No encontrado)`);
    }
  } catch (error) {
    console.error("Error al obtener ejercicio:", error);
    actualizarEncabezadoUI("Error de conexión");
  }
}

function prepararVistaEjercicio() {
  const display = document.getElementById("display-sler");
  const render = document.getElementById("render");
  const placeholder = document.getElementById("placeholder");
  const selectEj = document.getElementById("select-ejercicio-global");

  if (selectEj) selectEj.value = ejercicioActivoNum;
  actualizarEncabezadoUI(`NIVEL ${datosEjercicioActual?.nivel || (ejercicioActivoNum === 88 ? "5 (TOP)" : 1)} / EJERCICIO ${ejercicioActivoNum}`);

  if (datosEjercicioActual && datosEjercicioActual.tipo_flujo === "taquistoscopio") {
    if (render) render.classList.add("hidden");
    if (placeholder) placeholder.classList.add("hidden");
    if (display) {
      display.classList.remove("hidden");
      display.style.color = "#0f172a";
      display.innerText = `EJ. ${ejercicioActivoNum}`;
    }
  } else {
    if (display) display.classList.add("hidden");
    if (render) render.classList.add("hidden");
    if (placeholder) {
      placeholder.classList.remove("hidden");
      placeholder.innerText = `EJ. ${ejercicioActivoNum} LISTO`;
    }
  }
}

export async function manejarDisparo() {
  const btn = document.getElementById("btn");

  if (estado === "start") {
    estado = "stop";
    if (btn) {
      btn.innerText = "DETENER";
      btn.className = "bg-red-500 hover:bg-red-600 text-white font-black text-2xl py-3 px-16 rounded-lg shadow-xl uppercase tracking-wider transition transform active:scale-95 border-2 border-red-300";
    }
    iniciarCronometro();

    // Si los datos llegaron, ejecutamos el flujo correspondiente sin bloquear el inicio visual
    if (datosEjercicioActual) {
      if (datosEjercicioActual.tipo_flujo === "taquistoscopio") {
        await ejecutarTaquistoscopio();
      } else {
        ejecutarSlerLayout();
      }
    }
  } else {
    sonarCampanaFin();
    if (typeof window.registrarMarcaEnTabla === "function") window.registrarMarcaEnTabla();
    resetEstadoUI();

    LanzarNotificacionTanda(ejercicioActivoNum);

    if (ejercicioActivoNum < 88) {
      const siguienteEj = ejercicioActivoNum + 1;
      if (verificarAcceso(siguienteEj)) {
        if (typeof window.seleccionarEjercicioGlobal === "function") {
          window.seleccionarEjercicioGlobal(siguienteEj);
        } else {
          cargarEjercicio(siguienteEj);
        }
      }
    } else {
      if (typeof window.mostrarPantallaFinal === "function") window.mostrarPantallaFinal();
    }
  }
}

function sonarCampanaFin() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);

  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}

function LanzarNotificacionTanda(numEj) {
  const tandasDeFestejo = [11, 21, 31, 41, 51, 52, 71, 87, 88];

  if (tandasDeFestejo.includes(numEj)) {
    tocarFanfarriaFestejo();
  }

  setTimeout(() => {
    switch (numEj) {
      case 11:
        alert("¡Primera tanda completada!\n\nHas superado la fase introductoria silábica. Las siguientes tandas pasarán a lecturas con palabras completas para acelerar tu agilidad visual.");
        break;
      case 21:
        alert("¡Nivel 1 Superado!\n\nTus ojos han completado la fase de adaptación básica. Entrando al Nivel 2: Barrido dinámico.");
        break;
      case 31:
      case 41:
        alert("Tanda completada.\n\nRecuerda leer el texto en voz alta antes de presionar el botón DETENER.");
        break;
      case 51:
        alert("¡Felicitaciones!\n\nHas completado el Nivel Elemental (50% del programa). Tu velocidad de lectura ha subido un escalón.");
        break;
      case 52:
        alert("¡Aquí empieza lo bueno!\n\nAhora vamos en serio: entras a la lectura bidireccional real. Presta máxima atención y deja que el flujo continuo entrene tu mirada.");
        break;
      case 71:
      case 87:
        alert("Entrando en fase de alta densidad.\n\nAbsorción de texto completo en flujo recíproco.");
        break;
      case 88:
        alert("¡Entrenamiento Completado!\n\nHas alcanzado el máximo rendimiento del programa SLER. Recuerda que tendrás acceso abierto a la plataforma durante los próximos 7 días.");
        break;
    }
  }, 300);
}

function tocarFanfarriaFestejo() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const notas = [
    { freq: 523.25, dur: 0.15 }, // Do
    { freq: 523.25, dur: 0.10 }, // Do
    { freq: 659.25, dur: 0.10 }, // Mi
    { freq: 783.99, dur: 0.40 }  // Sol (Chan-chara-raaan!)
  ];

  let tiempoInicio = ctx.currentTime;

  notas.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.freq, tiempoInicio);

    gain.gain.setValueAtTime(0.3, tiempoInicio);
    gain.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(tiempoInicio);
    osc.stop(tiempoInicio + n.dur);

    tiempoInicio += n.dur + 0.02;
  });
}

async function ejecutarTaquistoscopio() {
  if (!datosEjercicioActual) return;
  const display = document.getElementById("display-sler");
  let currentPID = globalPID;
  let vel = datosEjercicioActual.velocidad_ms || 2200;

  if (Array.isArray(datosEjercicioActual.s)) {
    for (let silaba of datosEjercicioActual.s) {
      if (currentPID !== globalPID || estado === "start") return;

      if (silaba.length > 15) {
        display.className = "text-3xl font-extrabold tracking-wide whitespace-nowrap text-center";
      } else {
        display.className = "text-6xl font-extrabold tracking-widest whitespace-nowrap text-center";
      }

      display.innerText = silaba.toUpperCase();
      await new Promise((r) => setTimeout(r, vel));
    }
  }

  if (currentPID === globalPID && estado !== "start") {
    const palabraFinal = (datosEjercicioActual.f || datosEjercicioActual.p || "").toUpperCase();
    const lineas = palabraFinal.split("\n");
    const cantidadLineas = lineas.length;

    let sizeClass = "text-3xl";
    if (cantidadLineas >= 8) sizeClass = "text-sm leading-tight";
    else if (cantidadLineas >= 6) sizeClass = "text-base leading-snug";
    else if (cantidadLineas >= 4) sizeClass = "text-lg leading-normal";
    else if (cantidadLineas >= 2) sizeClass = "text-2xl leading-relaxed";

    const htmlLineas = lineas.map((linea, index) => {
      const esPar = index % 2 === 1;
      const color = esPar ? "#dc2626" : "#1e40af";
      return `<div style="color: ${color};">${linea}</div>`;
    }).join("");

    display.className = `${sizeClass} font-bold whitespace-pre-line text-center w-full flex flex-col items-center justify-center`;
    display.innerHTML = htmlLineas;
  }
}

function ejecutarSlerLayout() {
  const render = document.getElementById("render");
  const placeholder = document.getElementById("placeholder");
  if (placeholder) placeholder.classList.add("hidden");

  if (render) {
    render.scrollTop = 0;
    render.classList.remove("hidden");

    if (datosEjercicioActual && datosEjercicioActual.lineas && Array.isArray(datosEjercicioActual.lineas)) {
      const totalLineas = datosEjercicioActual.lineas.length;
      let fontSize = "1.1rem";
      let lineHeight = "1.6";

      if (totalLineas > 15) {
        fontSize = "0.85rem";
        lineHeight = "1.25";
      } else if (totalLineas > 10) {
        fontSize = "0.95rem";
        lineHeight = "1.35";
      }

      render.innerHTML = datosEjercicioActual.lineas.map(l => {
        const esPar = l.tipo === "C";
        const textAlign = esPar ? "right" : "left";
        const color = esPar ? "#1e40af" : "#0f172a";

        return `<div class="linea ${esPar ? 'par' : 'impar'}" style="text-align:${textAlign}; color:${color}; font-family: monospace; font-weight: bold; font-size: ${fontSize}; line-height: ${lineHeight};">${l.texto}</div>`;
      }).join("");
    } 
    else if (datosEjercicioActual && datosEjercicioActual.texto) {
      render.innerHTML = procesarTextoSLER(datosEjercicioActual.texto);
    }
  }
}

function dividirPalabra(palabra, espacio) {
  if (palabra.length < 4 || espacio < 3) return null;
  let corte = Math.min(espacio - 1, palabra.length - 2);
  if (corte < 2) return null;
  return { parte: palabra.substring(0, corte) + "-", resto: palabra.substring(corte) };
}

function invertirConComas(linea) {
  let palabras = linea.split(" ");
  palabras = palabras.map(p => {
    if (p.endsWith(",")) return "," + p.slice(0, -1);
    return p;
  });
  return palabras.reverse().join(" ");
}

function procesarTextoSLER(texto) {
  let palabras = texto.trim().split(/\s+/);
  let salida = "";
  let par = false;

  while (palabras.length > 0) {
    let linea = "";
    while (palabras.length > 0 && (linea.length + palabras[0].length + 1) <= MAX_CARACTERES) {
      linea += (linea ? " " : "") + palabras.shift();
    }
    if (palabras.length > 0) {
      let espacio = MAX_CARACTERES - linea.length;
      let division = dividirPalabra(palabras[0], espacio);
      if (division) {
        linea += (linea ? " " : "") + division.parte;
        palabras[0] = division.resto;
      }
    }
    if (par) {
      let invertida = invertirConComas(linea);
      salida += `<div class="linea par" style="text-align:right;color:#1e40af;">${invertida}</div>`;
    } else {
      salida += `<div class="linea impar" style="text-align:left;">${linea}</div>`;
    }
    par = !par;
  }
  return salida;
}

function iniciarCronometro() {
  tiempoInicioMs = Date.now();
  const reloj = document.getElementById("reloj");
  if (reloj) reloj.innerText = "00:00:01";

  if (cronometro) clearInterval(cronometro);

  cronometro = setInterval(() => {
    const segundosTranscurridos = Math.floor((Date.now() - tiempoInicioMs) / 1000);
    let s = segundosTranscurridos % 60;
    let m = Math.floor(segundosTranscurridos / 60);
    if (reloj) {
      reloj.innerText = `00:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
  }, 200);
}

function resetEstadoUI() {
  if (cronometro) clearInterval(cronometro);
  cronometro = null;
  tiempoInicioMs = 0;
  estado = "start";
  const reloj = document.getElementById("reloj");
  const btn = document.getElementById("btn");
  if (reloj) reloj.innerText = "00:00:00";
  if (btn) {
    btn.innerText = "START";
    btn.className = "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-2xl py-3 px-16 rounded-lg shadow-xl uppercase tracking-wider transition transform active:scale-95 border-2 border-emerald-300";
  }
}

function actualizarEncabezadoUI(texto) {
  const label = document.getElementById("label-nivel");
  if (label) label.innerText = texto;
}

// --- FUNCIONES DE CONTROL DE ACCESO Y LOGIN ---

window.validarAccesoPin = function() {
  const emailInput = document.getElementById("login-email")?.value.trim();
  const pinInput = document.getElementById("login-pin")?.value.trim();

  if (!emailInput || !pinInput) {
    alert("Por favor completa tu correo y el código de acceso.");
    return;
  }

  if (pinInput === PIN_CODIGO_VALIDO) {
    localStorage.setItem("sler_usuario_validado", "true");
    localStorage.setItem("sler_usuario_email", emailInput);
    
    if (!localStorage.getItem("sler_fecha_inicio")) {
      localStorage.setItem("sler_fecha_inicio", new Date().getTime());
    }

    ocultarPantallaLogin();
    cargarEjercicio(1);
  } else {
    alert("Código de acceso incorrecto. Verifique el mail recibido.");
  }
};

function verificarSesionPrevia() {
  const accesoConcedido = localStorage.getItem("sler_acceso_concedido");
  const estaValidado = localStorage.getItem("sler_usuario_validado");

  if (accesoConcedido === "true" || estaValidado === "true") {
    ocultarPantallaLogin();
    if (!localStorage.getItem("sler_fecha_inicio")) {
      localStorage.setItem("sler_fecha_inicio", new Date().getTime());
    }
    cargarEjercicio(1);
  }
}

function ocultarPantallaLogin() {
  const loginModal = document.getElementById("pantalla-login");
  if (loginModal) loginModal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  verificarSesionPrevia();
});
