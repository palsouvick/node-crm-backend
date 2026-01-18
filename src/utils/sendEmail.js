const nodemailer = require("nodemailer");

/* ================= SMTP TRANSPORT ================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ================= SEND EMAIL ================= */
const sendEmail = async ({ to, subject, html }) => {
  const info = await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });

  console.log("SMTP response:", info.response);
};

/* ================= GENERATE OTP ================= */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/* ================= SEND OTP EMAIL ================= */
const sendOtpEmail = async ({ to, otp }) => {
  const html = `
    <div style="font-family: Arial; font-size: 14px">
      <p>Your password reset OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP will expire in <b>10 minutes</b>.</p>
      <p>If you didn’t request this, please ignore.</p>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Password Reset OTP",
    html,
  });
};

/* ================= EXPORT ALL ================= */
module.exports = {
  sendEmail,
  generateOtp,
  sendOtpEmail,
};
