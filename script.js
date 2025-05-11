const elementoTablero = document.getElementById('chessboard');
const elementoJugadorActualTexto = document.getElementById('turn-indicator');
const elementoCapturadasBlancas = document.getElementById('piezas-capturadas-blancas');
const elementoCapturadasNegras = document.getElementById('piezas-capturadas-negras');
const botonNuevoJuego = document.getElementById('boton-nuevo-juego');
const listaHistorialElemento = document.getElementById('Movimientos');
const botonRendirse = document.getElementById('boton-rendirse');

const ROWS = 8;
const COLS = 8;

const PIEZAS = {
    blancas: {
        rey:   { symbol: '♔', tipo: 'rey' },
        dama:  { symbol: '♕', tipo: 'dama' },
        torre: { symbol: '♖', tipo: 'torre' },
        alfil: { symbol: '♗', tipo: 'alfil' },
        caballo:{ symbol: '♘', tipo: 'caballo' },
        peon:  { symbol: '♙', tipo: 'peon' }
    },
    negras: {
        rey:   { symbol: '♚', tipo: 'rey' },
        dama:  { symbol: '♛', tipo: 'dama' },
        torre: { symbol: '♜', tipo: 'torre' },
        alfil: { symbol: '♝', tipo: 'alfil' },
        caballo:{ symbol: '♞', tipo: 'caballo' },
        peon:  { symbol: '♟', tipo: 'peon' }
    }
};

let tablero = [];
let jugadorActual = 'blancas';
let piezaArrastrada = null;
let capturadasPorBlancas = [];
let capturadasPorNegras = [];
let historialMovimientos = [];
let juegoTerminado = false;

/**
 * Configura el tablero con las piezas en sus posiciones iniciales.
 */
function inicializarTablero() {
    tablero = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

    tablero[0][0] = { ...PIEZAS.negras.torre, color: 'negras' };
    tablero[0][1] = { ...PIEZAS.negras.caballo, color: 'negras' };
    tablero[0][2] = { ...PIEZAS.negras.alfil, color: 'negras' };
    tablero[0][3] = { ...PIEZAS.negras.dama, color: 'negras' };
    tablero[0][4] = { ...PIEZAS.negras.rey, color: 'negras' };
    tablero[0][5] = { ...PIEZAS.negras.alfil, color: 'negras' };
    tablero[0][6] = { ...PIEZAS.negras.caballo, color: 'negras' };
    tablero[0][7] = { ...PIEZAS.negras.torre, color: 'negras' };
    for (let c = 0; c < COLS; c++) {
        tablero[1][c] = { ...PIEZAS.negras.peon, color: 'negras' };
    }

    tablero[7][0] = { ...PIEZAS.blancas.torre, color: 'blancas' };
    tablero[7][1] = { ...PIEZAS.blancas.caballo, color: 'blancas' };
    tablero[7][2] = { ...PIEZAS.blancas.alfil, color: 'blancas' };
    tablero[7][3] = { ...PIEZAS.blancas.dama, color: 'blancas' };
    tablero[7][4] = { ...PIEZAS.blancas.rey, color: 'blancas' };
    tablero[7][5] = { ...PIEZAS.blancas.alfil, color: 'blancas' };
    tablero[7][6] = { ...PIEZAS.blancas.caballo, color: 'blancas' };
    tablero[7][7] = { ...PIEZAS.blancas.torre, color: 'blancas' };
    for (let c = 0; c < COLS; c++) {
        tablero[6][c] = { ...PIEZAS.blancas.peon, color: 'blancas' };
    }
}

/**
 * Dibuja el tablero y las piezas en la interfaz de usuario (HTML).
 */
function renderizarTablero() {
    elementoTablero.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = r;
            square.dataset.col = c;

            const piece = tablero[r][c];
            if (piece) {
                const piezaDOM = document.createElement('div');
                piezaDOM.classList.add('pieza');
                piezaDOM.textContent = piece.symbol;
                piezaDOM.setAttribute('aria-label', `${piece.color} ${piece.tipo} en ${String.fromCharCode(97+c)}${8-r}`);
                if (piece.color === jugadorActual && !juegoTerminado) {
                    piezaDOM.setAttribute('draggable', true);
                    piezaDOM.addEventListener('dragstart', (evento) => manejarDragStart(evento, r, c));
                }
                square.appendChild(piezaDOM);
            } else {
                square.setAttribute('aria-label', `vacío en ${String.fromCharCode(97+c)}${8-r}`);
            }

            square.addEventListener('dragover', manejarDragOver);
            square.addEventListener('drop', (evento) => manejarDrop(evento, r, c));
            elementoTablero.appendChild(square);
        }
    }
    actualizarTextoJugador();
    renderizarPiezasCapturadas();
    renderizarHistorialMovimientos();
}

/**
 * Actualiza el texto que indica a qué jugador le toca mover.
 */
function actualizarTextoJugador() {
    if (elementoJugadorActualTexto) {
        if (juegoTerminado && !elementoJugadorActualTexto.textContent.includes("gana")) { // Evitar sobreescribir mensaje de victoria
            // No actualizamos si el juego terminó y ya hay un mensaje de victoria
        } else if (!juegoTerminado) {
            elementoJugadorActualTexto.textContent = `Turno: ${jugadorActual.charAt(0).toUpperCase() + jugadorActual.slice(1)}`;
        }
    }
}

/**
 * Muestra las piezas capturadas por cada jugador en la interfaz.
 */
function renderizarPiezasCapturadas() {
    if (elementoCapturadasBlancas) {
        elementoCapturadasBlancas.innerHTML = 'Capturadas por Blancas: ';
        capturadasPorBlancas.forEach(p => {
            const span = document.createElement('span');
            span.textContent = p.symbol;
            elementoCapturadasBlancas.appendChild(span);
        });
    }

    if (elementoCapturadasNegras) {
        elementoCapturadasNegras.innerHTML = 'Capturadas por Negras: ';
        capturadasPorNegras.forEach(p => {
            const span = document.createElement('span');
            span.textContent = p.symbol;
            elementoCapturadasNegras.appendChild(span);
        });
    }
}

/**
 * Maneja el inicio del arrastre de una pieza.
 */
function manejarDragStart(evento, row, col) {
    if (juegoTerminado) return;
    const pieza = tablero[row][col];
    piezaArrastrada = { pieza: pieza, fromRow: row, fromCol: col, elementoDOM: evento.target };
    evento.dataTransfer.setData('text/plain', '');
    evento.target.classList.add('dragging');
}

/**
 * Permite que una casilla sea un destino válido para soltar una pieza.
 */
function manejarDragOver(evento) {
    evento.preventDefault();
}

/**
 * Maneja el evento de soltar una pieza en una casilla.
 */
function manejarDrop(evento, toRow, toCol) {
    evento.preventDefault();
    if (juegoTerminado || !piezaArrastrada) return;

    const { pieza, fromRow, fromCol, elementoDOM } = piezaArrastrada;
    elementoDOM.classList.remove('dragging');

    if (esMovimientoValidoParaPieza(pieza, fromRow, fromCol, toRow, toCol, tablero)) {
        const piezaCapturada = tablero[toRow][toCol];
        if (piezaCapturada) {
            if (piezaCapturada.color === 'blancas') {
                capturadasPorNegras.push(piezaCapturada);
            } else {
                capturadasPorBlancas.push(piezaCapturada);
            }
            console.log(`${pieza.color} ${pieza.tipo} captura ${piezaCapturada.color} ${piezaCapturada.tipo}`);
        }

        registrarMovimiento(pieza, fromRow, fromCol, toRow, toCol, piezaCapturada);

        tablero[toRow][toCol] = pieza;
        tablero[fromRow][fromCol] = null;

        cambiarJugador();
        renderizarTablero();
        guardarEstadoJuego();
    } else {
        console.log("Movimiento inválido con drag & drop.");
    }
    piezaArrastrada = null;
}

/**
 * Calcula todos los movimientos válidos para un peón desde una posición dada.
 */
function calcularMovimientosPeon(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const direccion = colorPieza === 'blancas' ? -1 : 1;
    const filaInicial = colorPieza === 'blancas' ? 6 : 1;

    let toRowFwd = fromRow + direccion;
    if (toRowFwd >= 0 && toRowFwd < ROWS && !boardActual[toRowFwd][fromCol]) {
        posiblesMovimientos.push([toRowFwd, fromCol]);

        if (fromRow === filaInicial) {
            let toRowDoble = fromRow + 2 * direccion;
            if (toRowDoble >= 0 && toRowDoble < ROWS && !boardActual[toRowDoble][fromCol]) {
                posiblesMovimientos.push([toRowDoble, fromCol]);
            }
        }
    }

    for (let dCol of [-1, 1]) {
        let toRowCap = fromRow + direccion;
        let toColCap = fromCol + dCol;
        if (toRowCap >= 0 && toRowCap < ROWS && toColCap >= 0 && toColCap < COLS) {
            const piezaDestino = boardActual[toRowCap][toColCap];
            if (piezaDestino && piezaDestino.color !== colorPieza) {
                posiblesMovimientos.push([toRowCap, toColCap]);
            }
        }
    }
    return posiblesMovimientos;
}

/**
 * Calcula todos los movimientos válidos para una torre desde una posición dada.
 */
function calcularMovimientosTorre(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const direcciones = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
    ];

    for (const dir of direcciones) {
        for (let i = 1; i < ROWS; i++) {
            const toRow = fromRow + dir.dr * i;
            const toCol = fromCol + dir.dc * i;

            if (toRow < 0 || toRow >= ROWS || toCol < 0 || toCol >= COLS) break;

            const piezaDestino = boardActual[toRow][toCol];
            if (piezaDestino) {
                if (piezaDestino.color !== colorPieza) posiblesMovimientos.push([toRow, toCol]);
                break;
            }
            posiblesMovimientos.push([toRow, toCol]);
        }
    }
    return posiblesMovimientos;
}

/**
 * Calcula todos los movimientos válidos para un caballo desde una posición dada.
 */
function calcularMovimientosCaballo(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const movimientosCaballo = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const mov of movimientosCaballo) {
        const toRow = fromRow + mov[0];
        const toCol = fromCol + mov[1];

        if (toRow >= 0 && toRow < ROWS && toCol >= 0 && toCol < COLS) {
            const piezaDestino = boardActual[toRow][toCol];
            if (!piezaDestino || piezaDestino.color !== colorPieza) {
                posiblesMovimientos.push([toRow, toCol]);
            }
        }
    }
    return posiblesMovimientos;
}

/**
 * Calcula todos los movimientos válidos para un alfil desde una posición dada.
 */
function calcularMovimientosAlfil(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const direcciones = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },  { dr: 1, dc: 1 }
    ];

    for (const dir of direcciones) {
        for (let i = 1; i < ROWS; i++) {
            const toRow = fromRow + dir.dr * i;
            const toCol = fromCol + dir.dc * i;

            if (toRow < 0 || toRow >= ROWS || toCol < 0 || toCol >= COLS) break;

            const piezaDestino = boardActual[toRow][toCol];
            if (piezaDestino) {
                if (piezaDestino.color !== colorPieza) posiblesMovimientos.push([toRow, toCol]);
                break;
            }
            posiblesMovimientos.push([toRow, toCol]);
        }
    }
    return posiblesMovimientos;
}

/**
 * Calcula todos los movimientos válidos para una reina (combinando torre y alfil).
 */
function calcularMovimientosReina(fromRow, fromCol, colorPieza, boardActual) {
    const movimientosTorre = calcularMovimientosTorre(fromRow, fromCol, colorPieza, boardActual);
    const movimientosAlfil = calcularMovimientosAlfil(fromRow, fromCol, colorPieza, boardActual);
    return [...movimientosTorre, ...movimientosAlfil];
}

/**
 * Calcula todos los movimientos válidos para un rey desde una posición dada.
 */
function calcularMovimientosRey(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const deltas = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (const delta of deltas) {
        const toRow = fromRow + delta[0];
        const toCol = fromCol + delta[1];

        if (toRow >= 0 && toRow < ROWS && toCol >= 0 && toCol < COLS) {
            const piezaDestino = boardActual[toRow][toCol];
            if (!piezaDestino || piezaDestino.color !== colorPieza) {
                posiblesMovimientos.push([toRow, toCol]);
            }
        }
    }

    return posiblesMovimientos;
}

/**
 * Cambia el turno al siguiente jugador.
 */

function cambiarJugador() {
    jugadorActual = jugadorActual === 'blancas' ? 'negras' : 'blancas';
}

/**
 * Verifica si un movimiento de una pieza a una casilla es válido según las reglas.
 */
function esMovimientoValidoParaPieza(pieza, fromRow, fromCol, toRow, toCol, boardActual) {
    const piezaDestino = boardActual[toRow][toCol];

    if (piezaDestino && piezaDestino.color === pieza.color) {
        return false;
    }

    let movimientosCalculados = [];
    switch (pieza.tipo) {
        case 'peon':
            movimientosCalculados = calcularMovimientosPeon(fromRow, fromCol, pieza.color, boardActual);
            break;
        case 'torre':
            movimientosCalculados = calcularMovimientosTorre(fromRow, fromCol, pieza.color, boardActual);
            break;
        case 'caballo':
            movimientosCalculados = calcularMovimientosCaballo(fromRow, fromCol, pieza.color, boardActual);
            break;
        case 'alfil':
            movimientosCalculados = calcularMovimientosAlfil(fromRow, fromCol, pieza.color, boardActual);
            break;
        case 'dama':
            movimientosCalculados = calcularMovimientosReina(fromRow, fromCol, pieza.color, boardActual);
            break;
        case 'rey':
            movimientosCalculados = calcularMovimientosRey(fromRow, fromCol, pieza.color, boardActual);
            break;
        default:
            return false;
    }

    for (const mov of movimientosCalculados) {
        if (mov[0] === toRow && mov[1] === toCol) {
            return true;
        }
    }
    return false;
}

/**
 * Convierte un movimiento a notación algebraica estándar.
 */
function convertirANotacionAlgebraica(pieza, fromCol, toRow, toCol, esCaptura) {
    const mapPiezaToLetra = {
        'peon': '', 'torre': 'T', 'caballo': 'C', 'alfil': 'A', 'dama': 'D', 'rey': 'R'
    }; 
    let letraPieza = mapPiezaToLetra[pieza.tipo];
    let columnaOrigen = String.fromCharCode(97 + fromCol);
    let columnaDestino = String.fromCharCode(97 + toCol);
    let filaDestino = 8 - toRow;
    let capturaSimbolo = esCaptura ? 'x' : '';

    if (pieza.tipo === 'peon') {
        return esCaptura ? `${columnaOrigen}${capturaSimbolo}${columnaDestino}${filaDestino}` : `${columnaDestino}${filaDestino}`;
    }
    return `${letraPieza}${columnaOrigen}${capturaSimbolo}${columnaDestino}${filaDestino}`;
}

/**
 * Añade un movimiento al historial de la partida.
 */
function registrarMovimiento(pieza, fromRow, fromCol, toRow, toCol, piezaCapturada) {
    const notacion = convertirANotacionAlgebraica(pieza, fromCol, toRow, toCol, !!piezaCapturada);
    historialMovimientos.push({
        jugador: jugadorActual,
        movimiento: notacion,
        numero: Math.floor(historialMovimientos.length / 2) + 1
    });
}

/**
 * Muestra el historial de movimientos en la interfaz.
 */
function renderizarHistorialMovimientos() {
    if (listaHistorialElemento) { 
        listaHistorialElemento.innerHTML = '';
        let numeroMovimientoActual = 0;
        let liActual = null;

        historialMovimientos.forEach(mov => {
            if (mov.numero !== numeroMovimientoActual) {
                if (liActual) listaHistorialElemento.appendChild(liActual);
                liActual = document.createElement('li');
                numeroMovimientoActual = mov.numero;
                liActual.textContent = `${numeroMovimientoActual}. `;
            }
            liActual.textContent += `${mov.movimiento} `;
        });
        if (liActual) listaHistorialElemento.appendChild(liActual);
        listaHistorialElemento.scrollTop = listaHistorialElemento.scrollHeight;
    }
}

/**
 * Maneja la acción de rendirse de un jugador.
 */
function manejarRendicion() {
    if (juegoTerminado) {
        alert("El juego ya ha terminado. Inicia una nueva partida.");
        return;
    }

    const jugadorQueSeRinde = jugadorActual;
    const ganador = jugadorQueSeRinde === 'blancas' ? 'Negras' : 'Blancas';

    alert(`${jugadorQueSeRinde.charAt(0).toUpperCase() + jugadorQueSeRinde.slice(1)} se ha rendido. ¡${ganador} gana!`);

    juegoTerminado = true;

    if (elementoJugadorActualTexto) {
        elementoJugadorActualTexto.textContent = `¡${ganador} gana por rendición!`;
    }

    // Deshabilitar piezas y botones (excepto nuevo juego)
    renderizarTablero(); // Volver a renderizar para quitar 'draggable'
    if (botonRendirse) botonRendirse.disabled = true;
}

/**
 * Reinicia el juego a su estado inicial.
 */
function iniciarNuevoJuego() {
    inicializarTablero();
    jugadorActual = 'blancas';
    piezaArrastrada = null;
    capturadasPorBlancas = [];
    capturadasPorNegras = [];
    juegoTerminado = false;
    historialMovimientos = [];
    renderizarTablero();
    localStorage.removeItem('estadoJuegoAjedrez');
    console.log("Nuevo juego iniciado.");
}

/**
 * Guarda el estado actual del juego en localStorage.
 */
function guardarEstadoJuego() {
    const estado = {
        tablero: tablero,
        jugadorActual: jugadorActual,
        capturadasPorBlancas: capturadasPorBlancas,
        capturadasPorNegras: capturadasPorNegras,
        historialMovimientos: historialMovimientos
    };
    localStorage.setItem('estadoJuegoAjedrez', JSON.stringify(estado));
}

/**
 * Carga el estado del juego desde localStorage, si existe.
 */
function cargarEstadoJuego() {
    const estadoGuardado = localStorage.getItem('estadoJuegoAjedrez');
    if (estadoGuardado) {
        try {
            const estado = JSON.parse(estadoGuardado);
            tablero = estado.tablero;
            jugadorActual = estado.jugadorActual;
            capturadasPorBlancas = estado.capturadasPorBlancas || [];
            capturadasPorNegras = estado.capturadasPorNegras || [];
            historialMovimientos = estado.historialMovimientos || [];
            console.log("Estado del juego cargado desde localStorage.");
            return true;
        } catch (e) {
            console.error("Error al cargar el estado del juego:", e);
            localStorage.removeItem('estadoJuegoAjedrez');
            return false;
        }
    }
    return false;
}

if (botonNuevoJuego) {
    botonNuevoJuego.addEventListener('click', iniciarNuevoJuego);
}

if (botonRendirse) {
    botonRendirse.addEventListener('click', manejarRendicion);
}

document.addEventListener('DOMContentLoaded', () => {

    if (!cargarEstadoJuego()) {
        inicializarTablero();
    }
    if (juegoTerminado && botonRendirse) botonRendirse.disabled = true; // Si se carga un juego terminado
    renderizarTablero();
});
