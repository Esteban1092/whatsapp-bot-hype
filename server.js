// HYPE DROP MX — Bot de WhatsApp Business (Twilio + Supabase)
//
// Credenciales SOLO por variables de entorno. Nunca escribas claves
// reales en este archivo ni en ningún otro del repo:
//   TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET,
//   TWILIO_AUTH_TOKEN (opcional, solo para validar la firma del webhook),
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
//
// Flujos (menú numerado, respuestas cortas, en español):
//   1 Catálogo · 2 Cómo pedir · 3 Estado de mi pedido
//   4 Horarios y envíos · 5 Hablar con una persona · 0 Menú

const express = require('express');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BUSINESS = 'hype-drop-mx';

// ---------- Supabase (opcional: el bot responde aunque no esté configurado) ----------
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('[supabase] cliente listo');
} else {
  console.log('[supabase] sin configurar (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Los mensajes no se guardan.');
}

async function getOrCreateConversation(phone) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone', phone)
    .eq('business', BUSINESS)
    .maybeSingle();
  if (error) { console.error('[supabase] conversaciones select:', error.message); return null; }
  if (data) return data.id;
  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ phone, business: BUSINESS, status: 'nuevo' })
    .select('id')
    .single();
  if (insertError) { console.error('[supabase] conversaciones insert:', insertError.message); return null; }
  return created.id;
}

async function saveMessage(conversationId, direction, body) {
  if (!supabase || !conversationId) return;
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, direction, body });
  if (error) console.error('[supabase] mensajes insert:', error.message);
}

async function setConversationStatus(conversationId, status) {
  if (!supabase || !conversationId) return;
  const { error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId);
  if (error) console.error('[supabase] conversaciones update:', error.message);
}

async function saveLead(phone, name, interest) {
  if (!supabase) return;
  const { error } = await supabase
    .from('leads')
    .insert({ phone, name: name || null, interest, status: 'pendiente' });
  if (error) console.error('[supabase] leads insert:', error.message);
}

// ---------- Textos del bot ----------
const MENU = `Hola, somos HYPE DROP MX. ¿En qué te ayudamos?

1. Catálogo
2. Cómo pedir
3. Estado de mi pedido
4. Horarios y envíos
5. Hablar con una persona

Responde con el número.`;

const CATALOGO = `Esto es lo que manejamos:

- Gorras
- Perfumes
- Ropa
- Accesorios

Precios entre $200 y $2,000 MXN según el producto.
Escríbenos qué te interesa y te confirmamos disponibilidad y precio exacto.

0. Volver al menú`;

const COMO_PEDIR = `Pedir es así:

1. Nos dices qué producto quieres.
2. Te lo apartamos.
3. Sin pago por adelantado.

Para apartar, escríbenos el producto y tu nombre. Una persona te confirma el apartado.

0. Volver al menú`;

const ESTADO_PEDIDO = `Para revisar tu pedido, escríbenos tu nombre y, si lo tienes, la referencia de tu pedido. Una persona lo revisa y te contesta.

0. Volver al menú`;

const HORARIOS_ENVIOS = `Sobre horarios y envíos:

Te confirmamos el horario de atención y el costo y tiempo de envío según tu zona. Escríbenos tu ciudad y con gusto te decimos.

0. Volver al menú`;

const HUMANO = `Claro. Ya le avisamos a una persona de HYPE DROP MX. Te contesta lo antes posible por aquí mismo. Gracias por escribirnos.`;

function replyFor(text) {
  const t = (text || '').trim().toLowerCase();
  if (t === '0' || t === 'menu' || t === 'menú' || t === 'hola' || t === 'buenas' || t === 'buenos dias' || t === 'buenos días' || t === '') {
    return { body: MENU, status: 'menu' };
  }
  if (t === '1' || t.includes('catalogo') || t.includes('catálogo')) {
    return { body: CATALOGO, status: 'menu' };
  }
  if (t === '2' || t.includes('pedir') || t.includes('comprar') || t.includes('apartar')) {
    return { body: COMO_PEDIR, status: 'menu' };
  }
  if (t === '3' || t.includes('estado') || t.includes('pedido') || t.includes('seguimiento')) {
    return { body: ESTADO_PEDIDO, status: 'pendiente_humano', interest: 'estado_pedido' };
  }
  if (t === '4' || t.includes('horario') || t.includes('envio') || t.includes('envío')) {
    return { body: HORARIOS_ENVIOS, status: 'menu' };
  }
  if (t === '5' || t.includes('humano') || t.includes('persona') || t.includes('asesor')) {
    return { body: HUMANO, status: 'pendiente_humano', interest: 'hablar_con_persona' };
  }
  return { body: `No entendí ese mensaje. Te dejo el menú:\n\n${MENU}`, status: 'menu' };
}

// ---------- Rutas ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', business: BUSINESS });
});

app.post('/webhook/whatsapp', async (req, res) => {
  const from = req.body.From || ''; // whatsapp:+521...
  const body = req.body.Body || '';
  const phone = from.replace('whatsapp:', '').trim();
  console.log(`[webhook] de ${phone}: ${body}`);

  // Validar firma de Twilio cuando hay token configurado.
  if (process.env.TWILIO_AUTH_TOKEN) {
    const signature = req.headers['x-twilio-signature'] || '';
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);
    if (!valid) {
      console.log('[webhook] firma inválida, se rechaza');
      return res.status(403).send('Firma no válida');
    }
  }

  const answer = replyFor(body);

  // Guardar en Supabase: conversación, mensaje entrante y saliente.
  const conversationId = await getOrCreateConversation(phone);
  await saveMessage(conversationId, 'in', body);
  await saveMessage(conversationId, 'out', answer.body);
  await setConversationStatus(conversationId, answer.status);
  if (answer.status === 'pendiente_humano') {
    await saveLead(phone, null, answer.interest || 'general');
  }

  // Responder por TwiML.
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(answer.body);
  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(PORT, () => {
  console.log(`[hype-bot] escuchando en puerto ${PORT}`);
  console.log('[hype-bot] webhook: POST /webhook/whatsapp · salud: GET /health');
});
