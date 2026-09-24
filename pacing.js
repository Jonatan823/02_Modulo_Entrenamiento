// pacing.js - Control de tiempos, límites y secuencia pedagógica por sesión
export const PacingControl = {
    obtenerEstado: function() {
        let inicio = localStorage.getItem('sler_pacing_inicio');
        if (!inicio) {
            inicio = Date.now();
            localStorage.setItem('sler_pacing_inicio', inicio);
        }
        
        const msegTranscurridos = Date.now() - parseInt(inicio);
        const diasTranscurridos = msegTranscurridos / (1000 * 60 * 60 * 24);
        
        return {
            inicio: parseInt(inicio),
            dias: diasTranscurridos
        };
    },

    obtenerProgresoSesion: function() {
        let progreso = sessionStorage.getItem('sler_progreso_sesion');
        if (!progreso) {
            const estadoInicial = { ejercicioMaximo: 1 };
            sessionStorage.setItem('sler_progreso_sesion', JSON.stringify(estadoInicial));
            return estadoInicial;
        }
        return JSON.parse(progreso);
    },

    actualizarProgresoSesion: function(numEj) {
        let progreso = this.obtenerProgresoSesion();
        if (numEj > progreso.ejercicioMaximo) {
            progreso.ejercicioMaximo = numEj;
            sessionStorage.setItem('sler_progreso_sesion', JSON.stringify(progreso));
        }
    },

    validarAcceso: function(tandaObjetivo, numEjercicioObjetivo = 1) {
        const esAdmin = localStorage.getItem('sler_modo_admin') === 'true' || 
                        (typeof window !== 'undefined' && window.usuarioEsAdmin === true) ||
                        (typeof window !== 'undefined' && window.usuarioPremium === true);

        if (!esAdmin && numEjercicioObjetivo > 1) {
            const progreso = this.obtenerProgresoSesion();
            if (numEjercicioObjetivo > progreso.ejercicioMaximo + 1) {
                return { 
                    permitido: false, 
                    mensaje: "Acceso denegado. Debes completar los ejercicios anteriores de forma estrictamente secuencial." 
                };
            }
        }

        const estado = this.obtenerEstado();
        const dias = estado.dias;

        if (dias > 7) {
            if (esAdmin) {
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "Ha finalizado el plazo máximo de 7 días para completar el itinerario." 
            };
        }

        if (dias < 1 && tandaObjetivo > 5) {
            if (esAdmin) {
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "Has alcanzado el límite diario (50%). La Tanda " + tandaObjetivo + " estará disponible mañana." 
            };
        }

        if (tandaObjetivo === 10 && dias < 2) {
            if (esAdmin) {
                return { permitido: true };
            }
            return { 
                permitido: false, 
                mensaje: "La tanda final requiere un mínimo de 3 días de asimilación acumulada." 
            };
        }

        return { permitido: true };
    }
};
