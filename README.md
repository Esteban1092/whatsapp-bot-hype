# whatsapp-bot-hype

Bot de WhatsApp Business para **HYPE DROP MX** (streetwear: gorras, perfumes,
ropa y accesorios). Contesta solo por WhatsApp con un menú numerado, guarda
las conversaciones en Supabase y deriva a una persona cuando hace falta.

Hecho con código propio en Node.js + Express. Sin n8n.

## Qué hace

- Recibe mensajes de WhatsApp por el webhook de Twilio (`POST /webhook/whatsapp`)
  y responde en español, corto e informal pero profesional, como HYPE DROP MX.
- Menú numerado:
  1. **Catálogo** — gorras, perfumes, ropa y accesorios (precios entre $200 y
     $2,000 MXN según el producto; nunca inventa stock ni precios exactos).
  2. **Cómo pedir** — apartado por DM, sin pago por adelantado. El bot toma el
     producto y el nombre y lo deja como apartado pendiente de confirmación
     por una persona.
  3. **Estado de mi pedido** — pide nombre y referencia y lo deriva a una persona.
  4. **Horarios y envíos** — no inventa horarios ni costos: pide la ciudad y
     lo confirma una persona.
  5. **Hablar con una persona** — guarda el mensaje como lead pendiente.
  0. **Volver al menú**.
- Guarda cada conversación y cada mensaje (entrante y saliente) en Supabase y
  marca como pendientes las conversaciones que necesitan a un humano.
- `GET /health` para saber si el servidor está vivo.

## Reglas del negocio

- Solo HYPE DROP MX. Nada de marca ni precios de webs.
- Nunca promete "te lo aparto" sin que una persona confirme el apartado.
- No se usa para mandar mensajes en frío a gente que nunca dio su permiso:
  Meta lo marca como spam y puede banear el número.

## Instalación local

```bash
npm install
cp .env.example .env   # llena TUS valores, nunca subas el .env a GitHub
npm start
```

El servidor escucha en el puerto `PORT` (por defecto 3000).

## Supabase

1. Crea un proyecto **nuevo** en Supabase (no uses el de Lux Rides).
2. Abre el SQL Editor, pega el contenido de `supabase/schema.sql` y dale a Run.
   Crea las tablas `conversations`, `messages` y `leads`.
3. En Project Settings > API copia la URL del proyecto y la
   `service_role` key y ponlas en el `.env` como `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY`.

Si Supabase no está configurado, el bot sigue respondiendo, solo no guarda nada.

## Despliegue (Render, plan gratis)

1. Sube este repo a GitHub.
2. En [Render](https://render.com) crea un **Web Service** desde el repo:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free.
3. En **Environment** agrega estas variables (sin comillas, sin espacios):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `TWILIO_AUTH_TOKEN` (opcional, solo para validar la firma del webhook)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Render te da una URL como `https://whatsapp-bot-hype.onrender.com`.
   Comprueba que `https://whatsapp-bot-hype.onrender.com/health` responde
   `{"status":"ok"}`.
   (En Railway es igual: nuevo proyecto desde el repo, mismas variables,
   Start Command `npm start`.)

## Conectar el webhook en Twilio

1. En el panel de Twilio ve a **Messaging > Try it out > Send a WhatsApp
   message** (o a tu número de WhatsApp Business cuando lo tengas).
2. En **Sandbox Settings** (cuenta Trial) o en la configuración del número,
   pon como webhook de mensajes entrantes:

   `https://<tu-dominio>/webhook/whatsapp`

   Método: `HTTP POST`.
3. Guarda. Desde ahí Twilio manda cada mensaje que llegue al número al bot.

Si pusiste `TWILIO_AUTH_TOKEN`, el bot valida la firma
`X-Twilio-Signature` de cada petición y rechaza las que no vengan de Twilio.

## Probar con el Sandbox de WhatsApp (cuenta Trial)

En Trial solo puedes escribir a números que se hayan unido al sandbox:

1. Desde el celular al que quieras escribir, manda por WhatsApp al número
   del sandbox de Twilio (por defecto `+1 415 523 8886`) el mensaje
   `join <código>` con el código que te muestra el panel de Twilio.
2. Ya unido, escríbele cualquier cosa al número del sandbox y el bot
   responde con el menú.

Para escribir a cualquier número sin que se una antes, la cuenta de Twilio
tiene que estar en plan de pago y el número registrado como remitente de
WhatsApp Business con plantillas aprobadas por Meta.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Cuenta de Twilio (empieza con `AC`) |
| `TWILIO_API_KEY_SID` | API Key de Twilio (empieza con `SK`) |
| `TWILIO_API_KEY_SECRET` | Secreto de la API Key (se muestra una sola vez al crearla) |
| `TWILIO_AUTH_TOKEN` | Opcional. Valida la firma del webhook |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role` de Supabase |
| `PORT` | Puerto del servidor |

Ninguna clave va en el código. Todo sale de variables de entorno.
