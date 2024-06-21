const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const { crearUsuario, iniciarSesion, obtenerContactos, buscarNuevoContacto, agregarContactoNuevo, actualizarIpUsuario, obtenerIPUsuario } = require('./bdConnections');
const { obtenerNombreDocumentos, enviarArchivo } = require('./gestorArchivos')
const multer = require('multer');
const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');
const forge = require('node-forge');

const clave = fs.readFileSync('./certificados/key.pem')
const cert = fs.readFileSync('./certificados/cert.pem')
const ca = fs.readFileSync('./certificados/CACertificado.pem')

//const clave = fs.readFileSync('./certificados/fraudulento_key.pem')
//const cert = fs.readFileSync('./certificados/fraudulento.crt')

const options = {
  key: clave,
  cert: cert,
  ca: ca,
  requestCert: true,
  rejectUnauthorized: true,
  secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1 
}

const app = express();

const clients = new Map();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`multer: ${req.body.datos}`)
    const datos = JSON.parse(req.body.datos)
    const id1 = datos.usuario._id;
    const id2 = datos.contacto._id;
    const destino = fs.existsSync(`./uploads/${id1}_${id2}`) ? `./uploads/${id1}_${id2}` : `./uploads/${id2}_${id1}`
    cb(null, destino)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
})

const upload = multer({ storage })

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
  const ipv4Regex = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;
  const match = ipv4Regex.exec(req.connection.remoteAddress);
  const ipv4 = req._peername
  if (match) {
    req.ipv4 = match[1].toString();
  } else {
    req.ipv4 = null;
  }
  next();
});

app.get('/', (req, res) => {
  console.log("Conecta bien")
  res.status(200).send("Cremita")
})

app.post('/crearUsuario', (req, res) => {
  const ip = req.socket._peername.address
  crearUsuario(req.body, ip, res)
})

app.post('/iniciarSesion', (req, res) => {
  iniciarSesion(req.body, res)
})

app.post('/obtenerContactos', (req, res) => {
  obtenerContactos(req.body, res)
})

app.post('/buscarContactoNuevo', (req, res) => {
  buscarNuevoContacto(req.body, res)
})

app.post('/recuperarDocumentos', (req, res) => {
  obtenerNombreDocumentos(req.body, res)
})

app.post('/actualizarIP', (req, res) => {
  const ip = req.socket._peername.address
  actualizarIpUsuario(req.body, ip, res)
})

const server = https.createServer(options, app).listen(9999, '192.168.190.165', () => {
  console.log("Todo bien")
}); 

const wss = new WebSocket.Server({ server })

class customWebSocket extends EventEmitter{
  constructor(ws){
    super();
    this.ws = ws;
  }

  enviarCertificado(data){
    this.emit('enviarCertificado', data)
  }
}

wss.on('connection', function connection(ws, req) {
  console.log('Cliente WebSocket conectado');

  const wsCustom = new customWebSocket(ws);
  var clientIP = req.socket.remoteAddress;

  clients.set(clientIP, ws)

  wsCustom.on('enviarCertificado', (data) =>{
    console.log('Certificado enviado');
    const certObject = forge.pki.certificateFromPem(cert);
    const publicKey = forge.pki.publicKeyToPem(certObject.publicKey);
    const mensaje = JSON.stringify({event: 'enviarCertificado', pk: publicKey})
    ws.send(mensaje)
  });

  ws.on('message', (message) => {
    if(message.toString() === 'enviarCertificado'){
      console.log("a")
      wsCustom.enviarCertificado(cert)
    }else{
      console.log("b")
      ws.send(mensaje)
    }
  });

  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
    clients.delete(clientIP);
    
  });
});

function firmarNotificación(mensaje){
  const sign = crypto.createSign('SHA256');
  sign.update(mensaje);
  sign.end();

  const signature = sign.sign(clave, 'base64');
  return signature;
}

function sendMessageToClient(clientIP, message) {
  const client = clients.get(clientIP);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message), (error) => {
      if (error) {
        console.error('Error al enviar el mensaje:', error);
      } else {
        console.log(`Mensaje enviado al cliente ${clientIP}: ${JSON.stringify(message)}`);
      }
    });
  } else {
    console.log(`No se pudo enviar el mensaje al cliente ${clientIP}: Cliente no válido o WebSocket no está abierto`);
  }
}

app.post('/agregarContactoNuevo', (req, res) => {
  obtenerIPUsuario(req.body.contacto._id)
    .then((ip) => {
      console.log(`La IP obtenida es: ${ip}`);
      const mensaje = `${req.body.usuario.nombre} te acaba de agregar` 
      const hash = firmarNotificación(mensaje);
      const firma = {
        hash: `${hash}`,
        mensaje: `${mensaje}`,
        opcion: 1
      }
      sendMessageToClient(ip, firma);
      agregarContactoNuevo(req.body, res);
    })
    .catch((error) => {
      console.error('Error al obtener la IP del usuario:', error);
    });
});

app.post('/subirDocumento', upload.single('file'), function (req, res, next) {
  const datos = JSON.parse(req.body.datos)
  obtenerIPUsuario(datos.contacto._id)
    .then((ip) => {
      console.log(`La IP obtenida es: ${ip}`);
      const mensaje = `${datos.usuario.nombre} te ha enviado ${req.file.originalname}`
      const hash = firmarNotificación(mensaje)
      const firma = {
        hash: `${hash}`,
        mensaje: `${mensaje}`,
        opcion: 2
      }
      sendMessageToClient(ip, firma)
    })
    .catch((error) => {
      console.error('Error al obtener la IP del usuario:', error);
    });
  res.status(200).send('Archivo recibido correctamente.');
})

app.post('/descargarDocumento/:nombre', (req, res) => {
  obtenerIPUsuario(req.body.contacto._id)
    .then((ip) => {
      console.log(`La IP obtenida es: ${ip}`);
      console.log(req.body)
      mensaje = `${req.body.usuario.nombre} se acaba de descargar ${req.params.nombre}`
      hash = firmarNotificación(mensaje)
      firma = {
        hash: `${hash}`,
        mensaje: `${mensaje}`,
        opcion: 3
      }
      sendMessageToClient(ip, firma)
      enviarArchivo(req.body, req.params.nombre, res)
    })
    .catch((error) => {
      console.error('Error al obtener la IP del usuario:', error);
    });
})

