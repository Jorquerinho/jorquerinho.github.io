require('dotenv').config(); // Para usar variables de entorno

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos para las partidas

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_super_secreta_12345'; // esto es para probar, cambiar despues!

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/ajedrez') // Conectando a la base de datos
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error en la conexión:', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend'))); // Archivos estáticos

// Middleware para proteger rutas
function verificarToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send('❌ No autorizado');
  }

  try {
    const datos = jwt.verify(token, JWT_SECRET);
    req.usuario = datos; // guardo datos del user para despues
    next();
  } catch {
    return res.status(401).send('❌ Token inválido');
  }
}

// Modelo de usuario
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, unique: true },
  apellido: String,
  email: { type: String, unique: true },
  passwordHash: String,
  fecha_nacimiento: Date,
});
const Usuario = mongoose.model('Usuario', usuarioSchema);

// Subdocumento para Invitaciones
const invitacionSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombreUsuario: { type: String, required: true }, // nombre del invitado
  tipo: { type: String, enum: ['jugador', 'espectador'], required: true },
  estado: { type: String, enum: ['pendiente', 'aceptada', 'rechazada', 'convertida_a_espectador', 'expirada'], default: 'pendiente' },
  fechaInvitacion: { type: Date, default: Date.now }
}, { _id: true }); // id para cada invitacion

// Modelo de Partida
const partidaSchema = new mongoose.Schema({
  identificadorUnico: { type: String, unique: true, required: true, index: true },
  creadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombreCreador: { type: String, required: true }, // nombre del que crea
  jugadorBlancasId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  jugadorNegrasId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  colorCreador: { type: String, enum: ['blancas', 'negras'], required: true }, // color del creador
  estado: { type: String, default: 'esperando_oponente', enum: ['esperando_oponente', 'en_curso', 'finalizada_blancas_ganan', 'finalizada_negras_ganan', 'tablas_por_acuerdo', 'tablas_por_ahogado', 'tablas_por_repeticion', 'tablas_regla_50_mov'] },
  invitaciones: [invitacionSchema],
  espectadoresIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  // Opcional: Si quieres guardar el estado del tablero y movimientos en la BD
  // tableroFEN: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }, // Notación FEN inicial
  // historialMovimientos: [{ type: String }], // Array de movimientos en notación algebraica
  fechaCreacion: { type: Date, default: Date.now },
  fechaUltimoMovimiento: { type: Date, default: Date.now },
});
const Partida = mongoose.model('Partida', partidaSchema);

// Registro
app.post('/register', async (req, res) => {
  const { nombre, apellido, email, password, confirm_password, fecha_nacimiento } = req.body;

  if (password !== confirm_password) {
    return res.status(400).send('❌ Las contraseñas no coinciden');
  }

  const correoExistente = await Usuario.findOne({ email });
  const nombreExistente = await Usuario.findOne({ nombre });

  if (correoExistente || nombreExistente) {
    return res.status(400).send('❌ El correo o nombre ya está en uso');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const nuevoUsuario = new Usuario({ nombre, apellido, email, passwordHash, fecha_nacimiento });

  try {
    await nuevoUsuario.save();
    res.status(201).send('✅ Usuario registrado correctamente');
  } catch (error) {
    console.error(error);
    res.status(500).send('❌ Error al registrar usuario');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const usuario = await Usuario.findOne({ email });
  if (!usuario) {
    return res.status(400).send('❌ Usuario o contraseña incorrectos');
  }

  const esValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!esValida) {
    return res.status(400).send('❌ Usuario o contraseña incorrectos');
  }

  const token = jwt.sign(
    { id: usuario._id, nombre: usuario.nombre },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    // secure: true, // Activa solo con HTTPS
    maxAge: 60 * 60 * 1000, // 1 hora
  });

  res.redirect('/Pagina_principal.html');
});

// Ruta protegida (ejemplo)
app.get('/perfil', verificarToken, (req, res) => {
  res.send(`Bienvenido nuevamente, ${req.usuario.nombre}`);
});

// Ruta para info del usuario logueado
app.get('/usuario-info', verificarToken, (req, res) => {
  res.json({
    nombre: req.usuario.nombre,
    id: req.usuario.id
  });
});

// Logout
app.post('/logout', (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true }); // borra la cookie de sesion
  res.status(200).send('✅ Sesión cerrada correctamente');
});

// Crear nueva partida
app.post('/partidas/crear', verificarToken, async (req, res) => {
  const { colorElegido } = req.body; // color elegido
  const creadorId = req.usuario.id; // id del creador
  const nombreCreador = req.usuario.nombre;

  if (!colorElegido || !['blancas', 'negras'].includes(colorElegido.toLowerCase())) {
    return res.status(400).json({ mensaje: '❌ Debes elegir un color válido (blancas o negras).' });
  }

  const partidaData = {
    nombreCreador: nombreCreador,
    identificadorUnico: uuidv4(),
    creadorId: creadorId,
    colorCreador: colorElegido.toLowerCase(),
    estado: 'esperando_oponente',
    jugadorBlancasId: colorElegido.toLowerCase() === 'blancas' ? creadorId : null,
    jugadorNegrasId: colorElegido.toLowerCase() === 'negras' ? creadorId : null,
  };

  try {
    const nuevaPartida = new Partida(partidaData);
    await nuevaPartida.save();
    res.status(201).json({
      mensaje: '✅ Partida creada exitosamente.',
      partidaId: nuevaPartida.identificadorUnico,
      datosPartida: nuevaPartida
    });
  } catch (error) {
    console.error('Error al crear la partida:', error);
    res.status(500).json({ mensaje: '❌ Error interno al crear la partida.' });
  }
});

// Invitar a un usuario a una partida
app.post('/partidas/:partidaId/invitar', verificarToken, async (req, res) => {
  const { partidaId } = req.params;
  const { emailUsuarioAInvitar, tipoInvitacion } = req.body; // tipo de invitacion
  const solicitanteId = req.usuario.id;

  if (!emailUsuarioAInvitar || !tipoInvitacion || !['jugador', 'espectador'].includes(tipoInvitacion)) {
    return res.status(400).json({ mensaje: '❌ Datos de invitación incompletos o inválidos.' });
  }

  try {
    const partida = await Partida.findOne({ identificadorUnico: partidaId });
    if (!partida) return res.status(404).json({ mensaje: '❌ Partida no encontrada.' });

    if (partida.creadorId.toString() !== solicitanteId.toString()) {
      return res.status(403).json({ mensaje: '❌ Solo el creador puede enviar invitaciones.' });
    }

    const usuarioAInvitar = await Usuario.findOne({ email: emailUsuarioAInvitar });
    if (!usuarioAInvitar) return res.status(404).json({ mensaje: `❌ Usuario con email ${emailUsuarioAInvitar} no encontrado.` });

    if (usuarioAInvitar._id.toString() === solicitanteId.toString()) {
      return res.status(400).json({ mensaje: '❌ No puedes invitarte a ti mismo.' });
    }

    // Verificar si ya existe una invitación para este usuario en esta partida
    const invitacionExistente = partida.invitaciones.find(inv => inv.usuarioId.toString() === usuarioAInvitar._id.toString());
    if (invitacionExistente) {
      return res.status(400).json({ mensaje: `❌ Ya has invitado a ${usuarioAInvitar.nombre} a esta partida.` });
    }

    // Si se invita como jugador y ya hay dos jugadores, no permitir (o convertir a espectador)
    if (tipoInvitacion === 'jugador' && partida.jugadorBlancasId && partida.jugadorNegrasId) { // si ya hay 2, que sea espectador o error
        return res.status(400).json({ mensaje: '❌ La partida ya tiene dos jugadores. Puedes invitarlo como espectador.' });
    }

    partida.invitaciones.push({
      usuarioId: usuarioAInvitar._id,
      nombreUsuario: usuarioAInvitar.nombre,
      tipo: tipoInvitacion,
      estado: 'pendiente'
    });

    await partida.save();
    res.status(200).json({ mensaje: `✅ Invitación enviada a ${usuarioAInvitar.nombre} para ${tipoInvitacion === 'jugador' ? 'jugar' : 'ver'} la partida.` });

  } catch (error) {
    console.error('Error al invitar usuario:', error);
    res.status(500).json({ mensaje: '❌ Error interno al procesar la invitación.' });
  }
});

// Ver mis invitaciones pendientes
app.get('/mis-invitaciones', verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;
  try {
    // buscar mis invitaciones pendientes
    const partidasConInvitaciones = await Partida.find({
      'invitaciones.usuarioId': usuarioId,
      'invitaciones.estado': 'pendiente'
    }).select('identificadorUnico nombreCreador invitaciones.$'); // solo la info necesaria de la invitacion

    const misInvitaciones = partidasConInvitaciones.map(p => {
        const invitacion = p.invitaciones[0]; // solo una invitacion por partida aqui
        return {
            partidaId: p.identificadorUnico,
            nombreCreadorPartida: p.nombreCreador,
            invitacionId: invitacion._id,
            tipo: invitacion.tipo,
            fechaInvitacion: invitacion.fechaInvitacion
        };
    });

    res.status(200).json(misInvitaciones);
  } catch (error) {
    console.error('Error al obtener mis invitaciones:', error);
    res.status(500).json({ mensaje: '❌ Error interno al obtener invitaciones.' });
  }
});

// Aceptar una invitación
app.post('/partidas/:partidaId/invitaciones/:invitacionId/aceptar', verificarToken, async (req, res) => {
  const { partidaId: identificadorPartida, invitacionId } = req.params;
  const aceptanteId = req.usuario.id;

  try {
    const partida = await Partida.findOne({ identificadorUnico: identificadorPartida });
    if (!partida) return res.status(404).json({ mensaje: '❌ Partida no encontrada.' });

    const invitacion = partida.invitaciones.id(invitacionId);
    if (!invitacion || invitacion.usuarioId.toString() !== aceptanteId.toString() || invitacion.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: '❌ Invitación no válida o ya procesada.' });
    }

    if (invitacion.tipo === 'jugador') {
      if (partida.jugadorBlancasId && partida.jugadorNegrasId) { // si ya se unio otro
        invitacion.tipo = 'espectador'; // ahora es espectador
        invitacion.estado = 'convertida_a_espectador';
        if (!partida.espectadoresIds.includes(aceptanteId)) {
            partida.espectadoresIds.push(aceptanteId);
        }
        await partida.save();
        return res.status(200).json({ mensaje: 'ℹ️ Otro jugador ya se unió. Ahora eres espectador.' });
      }

      // darle el otro color
      if (partida.colorCreador === 'blancas') {
        partida.jugadorNegrasId = aceptanteId;
      } else {
        partida.jugadorBlancasId = aceptanteId;
      }
      partida.estado = 'en_curso';
      invitacion.estado = 'aceptada';

      // otras invitaciones para jugar ahora son para ver
      partida.invitaciones.forEach(inv => {
        if (inv.tipo === 'jugador' && inv.estado === 'pendiente' && inv._id.toString() !== invitacionId) {
          inv.estado = 'convertida_a_espectador';
          // si se convierten, que sean espectadores
          // if (!partida.espectadoresIds.includes(inv.usuarioId)) partida.espectadoresIds.push(inv.usuarioId); // opcional
        }
      });

    } else { // tipo 'espectador'
      invitacion.estado = 'aceptada';
      if (!partida.espectadoresIds.includes(aceptanteId)) {
        partida.espectadoresIds.push(aceptanteId);
      }
    }
    await partida.save();
    res.status(200).json({ mensaje: `✅ Invitación aceptada. Ahora eres ${invitacion.tipo === 'jugador' && partida.estado === 'en_curso' ? 'jugador' : 'espectador'}.` });
  } catch (error) {
    console.error('Error al aceptar invitación:', error);
    res.status(500).json({ mensaje: '❌ Error interno al aceptar la invitación.' });
  }
});

// Rechazar una invitación
app.post('/partidas/:partidaId/invitaciones/:invitacionId/rechazar', verificarToken, async (req, res) => {
  const { partidaId: identificadorPartida, invitacionId } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const partida = await Partida.findOne({ identificadorUnico: identificadorPartida });
    if (!partida) return res.status(404).json({ mensaje: '❌ Partida no encontrada.' });

    const invitacion = partida.invitaciones.id(invitacionId);
    if (!invitacion || invitacion.usuarioId.toString() !== usuarioId.toString() || invitacion.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: '❌ Invitación no válida o ya procesada.' });
    }

    invitacion.estado = 'rechazada';
    await partida.save();
    res.status(200).json({ mensaje: '🗑️ Invitación rechazada.' });
  } catch (error) {
    console.error('Error al rechazar invitación:', error);
    res.status(500).json({ mensaje: '❌ Error interno al rechazar la invitación.' });
  }
});

// Obtener las partidas creadas por el usuario
app.get('/mis-partidas-creadas', verificarToken, async (req, res) => {
  const creadorId = req.usuario.id;
  try { // Traer las partidas que yo creé
    const partidas = await Partida.find({ creadorId: creadorId }).sort({ fechaCreacion: -1 });
    res.status(200).json(partidas);
  } catch (error) {
    console.error('Error al obtener las partidas creadas:', error);
    res.status(500).json({ mensaje: '❌ Error interno al obtener tus partidas.' });
  }
});

// Eliminar una partida (solo si el usuario es el creador)
app.delete('/partidas/:partidaId', verificarToken, async (req, res) => {
  const { partidaId } = req.params;
  const usuarioId = req.usuario.id;

  try { // Para borrar una partida
    const partida = await Partida.findOne({ identificadorUnico: partidaId });

    if (!partida) {
      return res.status(404).json({ mensaje: '❌ Partida no encontrada.' });
    }

    if (partida.creadorId.toString() !== usuarioId.toString()) {
      return res.status(403).json({ mensaje: '❌ No tienes permiso para eliminar esta partida.' });
    }

    await Partida.deleteOne({ identificadorUnico: partidaId });
    res.status(200).json({ mensaje: '🗑️ Partida eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la partida:', error);
    res.status(500).json({ mensaje: '❌ Error interno al eliminar la partida.' });
  }
});

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
