// Variable global para almacenar el ejercicio actual
let datosEjercicioActual = null;

// Ejemplo de estructura de datos para pruebas o integración con Firestore
// Cada línea evalúa su longitud de caracteres: si supera los 14 caracteres, reduce el tamaño de fuente automáticamente.
function ejecutarSlerLayout() {
  const render = document.getElementById("render");
  const placeholder = document.getElementById("placeholder");
  if (placeholder) placeholder.classList.add("hidden");
  
  if (render) {
    render.scrollTop = 0;
    render.classList.remove("hidden");
    
    if (datosEjercicioActual && datosEjercicioActual.lineas && Array.isArray(datosEjercicioActual.lineas)) {
      render.innerHTML = datosEjercicioActual.lineas.map((l) => {
        const esPar = l.tipo === "C";
        const cantidadCaracteres = l.texto ? l.texto.length : 0;
        
        // Umbral estricto por cantidad de caracteres para evitar desbordes de pantalla:
        // Si tiene más de 14 caracteres, aplicamos tipografía más compacta.
        let fontSize = "42px";
        if (cantidadCaracteres > 22) {
          fontSize = "22px";
        } else if (cantidadCaracteres > 14) {
          fontSize = "30px";
        }

        return `
          <div class="linea-sler-wrapper" style="text-align: ${esPar ? 'right' : 'left'}; width: 100%; margin-bottom: 14px; overflow: hidden;">
            <span class="linea-texto-dinamico" style="display: inline-block; color: ${esPar ? '#1e40af' : '#0f172a'}; font-family: monospace; font-weight: bold; white-space: nowrap; font-size: ${fontSize};">
              ${l.texto}
            </span>
          </div>
        `;
      }).join("");
    }
  }
}

// Simulación de carga inicial para verificar el funcionamiento
document.addEventListener("DOMContentLoaded", () => {
  // Datos de prueba correspondientes al Ejercicio 78 o 49 con frases largas
  datosEjercicioActual = {
    nivel: 4,
    ejercicio: 78,
    lineas: [
      { tipo: "M", texto: "EL SOL ENCIENDE" },
      { tipo: "C", texto: "LA SALA" },
      { tipo: "M", texto: "VENTANA LA POR" },
      { tipo: "C", texto: "ENTRA LUZ LA" }
    ]
  };
  
  ejecutarSlerLayout();
});
