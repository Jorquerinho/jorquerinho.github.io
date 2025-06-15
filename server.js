require('dotenv').config(); // Para usar variables de entorno

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_super_secreta_12345'; // Cambiar en producción

// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/ajedrez')
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
    req.usuario = datos; // Guardamos info del usuario para usarla en otras rutas
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

// ** NUEVA RUTA para enviar info del usuario autenticado **
app.get('/usuario-info', verificarToken, (req, res) => {
  res.json({
    nombre: req.usuario.nombre,
    id: req.usuario.id
  });
});

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
