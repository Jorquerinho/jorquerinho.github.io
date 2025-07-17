const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/ajedrez';

async function conectar() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Conexión a MongoDB exitosa');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
  } finally {
    await mongoose.connection.close();
  }
}

conectar();
