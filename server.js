require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_super_secreta_12345';

const MONGODB_USER = "Jorquera";
const MONGODB_PASS = "Anandita12";


mongoose.connect(`mongodb://${MONGODB_USER}:${MONGODB_PASS}@localhost:27017/ajedrez?authSource=admin`)
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error en la conexión:', err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'frontend')));

function verificarToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send('No autorizado');
  }

  try {
    const datos = jwt.verify(token, JWT_SECRET);
    req.usuario = datos;
    next();
  } catch {
    return res.status(401).send('Token inválido');
  }
}

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, unique: true },
  apellido: String,
  email: { type: String, unique: true },
  passwordHash: String,
  fecha_nacimiento: Date,
});
const Usuario = mongoose.model('Usuario', usuarioSchema);

const invitacionSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombreUsuario: { type: String, required: true },
  tipo: { type: String, enum: ['jugador', 'espectador'], required: true },
  estado: { type: String, enum: ['pendiente', 'aceptada', 'rechazada', 'convertida_a_espectador', 'expirada'], default: 'pendiente' },
  fechaInvitacion: { type: Date, default: Date.now }
}, { _id: true });

const partidaSchema = new mongoose.Schema({
  identificadorUnico: { type: String, unique: true, required: true, index: true },
  creadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombreCreador: { type: String, required: true },
  jugadorBlancasId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  jugadorNegrasId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  colorCreador: { type: String, enum: ['blancas', 'negras'], required: true },
  estado: { type: String, default: 'esperando_oponente', enum: ['esperando_oponente', 'en_curso', 'finalizada_blancas_ganan', 'finalizada_negras_ganan', 'tablas_por_acuerdo', 'tablas_por_ahogado', 'tablas_por_repeticion', 'tablas_regla_50_mov'] },
  invitaciones: [invitacionSchema],
  espectadoresIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  fechaCreacion: { type: Date, default: Date.now },
  fechaUltimoMovimiento: { type: Date, default: Date.now },
});
const Partida = mongoose.model('Partida', partidaSchema);

app.post('/register', async (req, res) => {
  const { nombre, apellido, email, password, confirm_password, fecha_nacimiento } = req.body;

  if (password !== confirm_password) {
    return res.status(400).send('Las contraseñas no coinciden');
  }

  const correoExistente = await Usuario.findOne({ email });
  const nombreExistente = await Usuario.findOne({ nombre });

  if (correoExistente || nombreExistente) {
    return res.status(400).send('El correo o nombre ya está en uso');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const nuevoUsuario = new Usuario({ nombre, apellido, email, passwordHash, fecha_nacimiento });

  try {
    await nuevoUsuario.save();
    res.status(201).send('Usuario registrado correctamente');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al registrar usuario');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const usuario = await Usuario.findOne({ email });
  if (!usuario) {
    return res.status(400).send('Usuario o contraseña incorrectos');
  }

  const esValida = await bcrypt.compare(password, usuario.passwordHash);
  if (!esValida) {
    return res.status(400).send('Usuario o contraseña incorrectos');
  }

  const token = jwt.sign(
    { id: usuario._id, nombre: usuario.nombre },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000,
  });

  res.redirect('/Pagina_principal.html');
});

app.get('/perfil', verificarToken, (req, res) => {
  res.send(`Bienvenido nuevamente, ${req.usuario.nombre}`);
});

app.get('/usuario-info', verificarToken, (req, res) => {
  res.json({
    nombre: req.usuario.nombre,
    id: req.usuario.id
  });
});

app.post('/logout', (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
  res.status(200).send('Sesión cerrada correctamente');
});

app.post('/partidas/crear', verificarToken, async (req, res) => {
  const { colorElegido } = req.body;
  const creadorId = req.usuario.id;
  const nombreCreador = req.usuario.nombre;

  if (!colorElegido || !['blancas', 'negras'].includes(colorElegido.toLowerCase())) {
    return res.status(400).json({ mensaje: 'Debes elegir un color válido (blancas o negras).' });
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
      mensaje: 'Partida creada exitosamente.',
      partidaId: nuevaPartida.identificadorUnico,
      datosPartida: nuevaPartida
    });
  } catch (error) {
    console.error('Error al crear la partida:', error);
    res.status(500).json({ mensaje: 'Error interno al crear la partida.' });
  }
});

app.post('/partidas/:partidaId/invitar', verificarToken, async (req, res) => {
  const { partidaId } = req.params;
  const { emailUsuarioAInvitar, tipoInvitacion } = req.body;
  const solicitanteId = req.usuario.id;

  if (!emailUsuarioAInvitar || !tipoInvitacion || !['jugador', 'espectador'].includes(tipoInvitacion)) {
    return res.status(400).json({ mensaje: 'Datos de invitación incompletos o inválidos.' });
  }

  try {
    const partida = await Partida.findOne({ identificadorUnico: partidaId });
    if (!partida) return res.status(404).json({ mensaje: 'Partida no encontrada.' });

    if (partida.creadorId.toString() !== solicitanteId.toString()) {
      return res.status(403).json({ mensaje: 'Solo el creador puede enviar invitaciones.' });
    }

    const usuarioAInvitar = await Usuario.findOne({ email: emailUsuarioAInvitar });
    if (!usuarioAInvitar) return res.status(404).json({ mensaje: `Usuario con email ${emailUsuarioAInvitar} no encontrado.` });

    if (usuarioAInvitar._id.toString() === solicitanteId.toString()) {
      return res.status(400).json({ mensaje: 'No puedes invitarte a ti mismo.' });
    }

    const invitacionExistente = partida.invitaciones.find(inv => inv.usuarioId.toString() === usuarioAInvitar._id.toString());
    if (invitacionExistente) {
      return res.status(400).json({ mensaje: `Ya has invitado a ${usuarioAInvitar.nombre} a esta partida.` });
    }

    if (tipoInvitacion === 'jugador' && partida.jugadorBlancasId && partida.jugadorNegrasId) {
        return res.status(400).json({ mensaje: 'La partida ya tiene dos jugadores. Puedes invitarlo como espectador.' });
    }

    partida.invitaciones.push({
      usuarioId: usuarioAInvitar._id,
      nombreUsuario: usuarioAInvitar.nombre,
      tipo: tipoInvitacion,
      estado: 'pendiente'
    });

    await partida.save();
    res.status(200).json({ mensaje: `Invitación enviada a ${usuarioAInvitar.nombre} para ${tipoInvitacion === 'jugador' ? 'jugar' : 'ver'} la partida.` });

  } catch (error) {
    console.error('Error al invitar usuario:', error);
    res.status(500).json({ mensaje: 'Error interno al procesar la invitación.' });
  }
});

app.get('/mis-invitaciones', verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;
  try {
    const partidasConInvitaciones = await Partida.find({
      'invitaciones.usuarioId': usuarioId,
      'invitaciones.estado': 'pendiente'
    }).select('identificadorUnico nombreCreador invitaciones.$');

    const misInvitaciones = partidasConInvitaciones.map(p => {
        const invitacion = p.invitaciones[0];
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
    res.status(500).json({ mensaje: 'Error interno al obtener invitaciones.' });
  }
});

app.post('/partidas/:partidaId/invitaciones/:invitacionId/aceptar', verificarToken, async (req, res) => {
  const { partidaId: identificadorPartida, invitacionId } = req.params;
  const aceptanteId = req.usuario.id;

  try {
    const partida = await Partida.findOne({ identificadorUnico: identificadorPartida });
    if (!partida) return res.status(404).json({ mensaje: 'Partida no encontrada.' });

    const invitacion = partida.invitaciones.id(invitacionId);
    if (!invitacion || invitacion.usuarioId.toString() !== aceptanteId.toString() || invitacion.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Invitación no válida o ya procesada.' });
    }

    if (invitacion.tipo === 'jugador') {
      if (partida.jugadorBlancasId && partida.jugadorNegrasId) {
        invitacion.tipo = 'espectador';
        invitacion.estado = 'convertida_a_espectador';
        if (!partida.espectadoresIds.includes(aceptanteId)) {
            partida.espectadoresIds.push(aceptanteId);
        }
        await partida.save();
        return res.status(200).json({ mensaje: 'ℹOtro jugador ya se unió. Ahora eres espectador.' });
      }

      if (partida.colorCreador === 'blancas') {
        partida.jugadorNegrasId = aceptanteId;
      } else {
        partida.jugadorBlancasId = aceptanteId;
      }
      partida.estado = 'en_curso';
      invitacion.estado = 'aceptada';

      partida.invitaciones.forEach(inv => {
        if (inv.tipo === 'jugador' && inv.estado === 'pendiente' && inv._id.toString() !== invitacionId) {
          inv.estado = 'convertida_a_espectador';
        }
      });

    } else {
      invitacion.estado = 'aceptada';
      if (!partida.espectadoresIds.includes(aceptanteId)) {
        partida.espectadoresIds.push(aceptanteId);
      }
    }
    await partida.save();
    res.status(200).json({ mensaje: `Invitación aceptada. Ahora eres ${invitacion.tipo === 'jugador' && partida.estado === 'en_curso' ? 'jugador' : 'espectador'}.` });
  } catch (error) {
    console.error('Error al aceptar invitación:', error);
    res.status(500).json({ mensaje: 'Error interno al aceptar la invitación.' });
  }
});

app.post('/partidas/:partidaId/invitaciones/:invitacionId/rechazar', verificarToken, async (req, res) => {
  const { partidaId: identificadorPartida, invitacionId } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const partida = await Partida.findOne({ identificadorUnico: identificadorPartida });
    if (!partida) return res.status(404).json({ mensaje: 'Partida no encontrada.' });

    const invitacion = partida.invitaciones.id(invitacionId);
    if (!invitacion || invitacion.usuarioId.toString() !== usuarioId.toString() || invitacion.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Invitación no válida o ya procesada.' });
    }

    invitacion.estado = 'rechazada';
    await partida.save();
    res.status(200).json({ mensaje: 'Invitación rechazada.' });
  } catch (error) {
    console.error('Error al rechazar invitación:', error);
    res.status(500).json({ mensaje: 'Error interno al rechazar la invitación.' });
  }
});

app.get('/mis-partidas-creadas', verificarToken, async (req, res) => {
  const creadorId = req.usuario.id;
  try {
    const partidas = await Partida.find({ creadorId: creadorId }).sort({ fechaCreacion: -1 });
    res.status(200).json(partidas);
  } catch (error) {
    console.error('Error al obtener las partidas creadas:', error);
    res.status(500).json({ mensaje: 'Error interno al obtener tus partidas.' });
  }
});

app.delete('/partidas/:partidaId', verificarToken, async (req, res) => {
  const { partidaId } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const partida = await Partida.findOne({ identificadorUnico: partidaId });

    if (!partida) {
      return res.status(404).json({ mensaje: 'Partida no encontrada.' });
    }

    if (partida.creadorId.toString() !== usuarioId.toString()) {
      return res.status(403).json({ mensaje: 'No tienes permiso para eliminar esta partida.' });
    }

    await Partida.deleteOne({ identificadorUnico: partidaId });
    res.status(200).json({ mensaje: 'Partida eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la partida:', error);
    res.status(500).json({ mensaje: 'Error interno al eliminar la partida.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
