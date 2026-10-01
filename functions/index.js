const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");

if (!admin.apps.length) {
  admin.initializeApp();
}

const mpToken = defineSecret("MP_ACCESS_TOKEN");
const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");
const adminEmailSecret = defineSecret("ADMIN_EMAIL");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function generarPin() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pin = "";
  for (let i = 0; i < 8; i++) {
    pin += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return pin;
}

app.get("/", (req, res) => {
  return res.status(200).send("OK - Webhook activo");
});

app.post("/", async (req, res) => {
  try {
    const paymentData = req.body;
    console.log("Webhook recibido:", JSON.stringify(paymentData));

    const topic = req.query.topic || paymentData.type || paymentData.action;
    const paymentId = req.query['data.id'] || paymentData.data?.id || paymentData.id;

    if (topic && topic.includes("payment") && paymentId) {
      // Los secretos se resuelven aquí dentro, al recibir la petición
      const accessToken = mpToken.value();

      if (accessToken) {
        const mpResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const paymentInfo = mpResponse.data;

        if (paymentInfo.status === "approved") {
          const emailComprador = paymentInfo.payer?.email || paymentData.payer?.email;
          const nuevoPin = generarPin();

          if (emailComprador) {
            const db = admin.firestore();
            const querySnapshot = await db.collection("usuarios").where("email", "==", emailComprador).get();

            if (!querySnapshot.empty) {
              const docId = querySnapshot.docs[0].id;
              await db.collection("usuarios").doc(docId).update({
                pin: nuevoPin,
                pagoAprobado: true,
                paymentId: paymentId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              await db.collection("usuarios").add({
                email: emailComprador,
                pin: nuevoPin,
                pagoAprobado: true,
                paymentId: paymentId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }

            const userVal = emailUser.value();
            const passVal = emailPass.value();
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: { user: userVal, pass: passVal }
            });

            await transporter.sendMail({
              from: '"SLER-App" <' + userVal + '>',
              to: emailComprador,
              subject: 'Tu Código PIN - Acceso Nivel Pro',
              text: `¡Hola! Gracias por tu compra. Tu código PIN único para activar el Nivel Pro es: ${nuevoPin}`
            });

            const destinoAdmin = adminEmailSecret.value() || userVal;
            await transporter.sendMail({
              from: '"Sistema SLER" <' + userVal + '>',
              to: destinoAdmin,
              subject: 'Nueva venta de Nivel Pro registrada',
              text: `Se ha aprobado un pago (ID: ${paymentId}). Comprador: ${emailComprador}. PIN generado: ${nuevoPin}`
            });
          }
        }
      }
    }

    return res.status(200).send("Webhook procesado correctamente");
  } catch (error) {
    console.error("Error en webhook:", error.message);
    return res.status(500).send("Error interno del servidor");
  }
});

exports.webhookPago = onRequest(
  { 
    secrets: [mpToken, emailUser, emailPass, adminEmailSecret],
    region: "us-central1"
  },
  app
);