"""Bilingual transactional e-mail. With no SMTP host configured, messages go to an in-memory outbox (development and tests)."""
import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

log = logging.getLogger("salam.mail")
OUTBOX: list[EmailMessage] = []

TEMPLATES = {
    "invite": ("دعوة إلى أكاديمية سلام · Invitation to Salam Academy",
               "مرحبًا {name}،\n\nدُعيت إلى أكاديمية سلام بدور «{role}». أنشئ كلمة المرور من الرابط التالي (صالح {hours} ساعة):\n{link}\n\n"
               "Hello {name},\n\nYou have been invited to Salam Academy as “{role}”. Set your password here (valid {hours} hours):\n{link}\n"),
    "reset": ("إعادة تعيين كلمة المرور · Password reset",
              "طُلبت إعادة تعيين كلمة مرور حسابك. الرابط صالح {minutes} دقيقة ولمرة واحدة:\n{link}\nإن لم تطلب ذلك فتجاهل الرسالة؛ كلمة مرورك لم تتغير.\n\n"
              "A password reset was requested for your account. The link works once, for {minutes} minutes:\n{link}\nIf you did not ask for this, ignore this e-mail; your password is unchanged.\n"),
    "verify": ("تأكيد البريد الإلكتروني · Confirm your e-mail",
               "أكّد بريدك الإلكتروني من الرابط التالي:\n{link}\n\nConfirm your e-mail address:\n{link}\n"),
    "password_changed": ("تغيّرت كلمة المرور · Your password was changed",
                         "تغيّرت كلمة مرور حسابك وسُجّل خروجك من الأجهزة الأخرى. إن لم تكن أنت فتواصل مع مسؤول المنصة فورًا.\n\n"
                         "Your password was changed and other devices were signed out. If this was not you, contact the platform admin now.\n"),
    "mfa_changed": ("تغيّر التحقق بخطوتين · Two-step verification changed",
                    "تغيّر إعداد التحقق بخطوتين في حسابك: {state}. إن لم تكن أنت فتواصل مع مسؤول المنصة فورًا.\n\n"
                    "Two-step verification on your account changed: {state}. If this was not you, contact the platform admin now.\n"),
}


def send(to: str, template: str, **ctx) -> None:
    s = get_settings()
    subject, body = TEMPLATES[template]
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
    msg.set_content(body.format(**ctx))
    if not s.smtp_host:
        OUTBOX.append(msg)
        log.info("mail (outbox) to=%s template=%s", to, template)
        return
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            if s.smtp_starttls:
                smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException):
        log.exception("mail delivery failed to=%s template=%s", to, template)
