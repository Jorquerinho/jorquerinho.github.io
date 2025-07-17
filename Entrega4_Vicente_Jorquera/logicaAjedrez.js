const ROWS = 8;
const COLS = 8;

function calcularMovimientosPeon(fromRow, fromCol, colorPieza, boardActual) {
    const posiblesMovimientos = [];
    const direccion = colorPieza === 'blancas' ? -1 : 1;
    const filaInicial = colorPieza === 'blancas' ? 6 : 1;

    const toRowFwd = fromRow + direccion;
    if (toRowFwd >= 0 && toRowFwd < ROWS && !boardActual[toRowFwd][fromCol]) {
        posiblesMovimientos.push([toRowFwd, fromCol]);

        if (fromRow === filaInicial) {
            const toRowDoble = fromRow + 2 * direccion;
            if (toRowDoble >= 0 && toRowDoble < ROWS && !boardActual[toRowDoble][fromCol]) {
                posiblesMovimientos.push([toRowDoble, fromCol]);
            }
        }
    }

    for (const dCol of [-1, 1]) {
        const toRowCap = fromRow + direccion;
        const toColCap = fromCol + dCol;
        if (toRowCap >= 0 && toRowCap < ROWS && toColCap >= 0 && toColCap < COLS) {
            const piezaDestino = boardActual[toRowCap][toColCap];
            if (piezaDestino && piezaDestino.color !== colorPieza) {
                posiblesMovimientos.push([toRowCap, toColCap]);
            }
        }
    }
    return posiblesMovimientos;
}

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

function calcularMovimientosReina(fromRow, fromCol, colorPieza, boardActual) {
    const movimientosTorre = calcularMovimientosTorre(fromRow, fromCol, colorPieza, boardActual);
    const movimientosAlfil = calcularMovimientosAlfil(fromRow, fromCol, colorPieza, boardActual);
    return [...movimientosTorre, ...movimientosAlfil];
}

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

module.exports = {
    esMovimientoValidoParaPieza,
};