import fs from 'fs/promises';
import { templates } from './emailServices.constant';
import nodemailer from 'nodemailer';
import env from '../../config/env';
import { logger } from '../../config/logger/logger';

export async function sendEmail<T extends keyof typeof templates>(
   type: T,
   destination: string,
   replacements: Partial<(typeof templates)[T]['replacement']>,
) {
   if (!env.ENABLE_EMAIL) {
      logger.debug('Email sending skipped: ENABLE_EMAIL is false', { module: 'sendEmailUtility' });
      return
   }
   const path = templates[type]['path'];
   const prevReplacement = templates[type]['replacement'];
   let htmlDoc = await fs.readFile(path, 'utf-8');

   const updatedReplacement = { ...prevReplacement, ...replacements };

   Object.keys(updatedReplacement).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlDoc = htmlDoc.replace(regex, updatedReplacement[key]);
   });
   try {
      const transporter = nodemailer.createTransport({
         port: 2525,
         host: env.MAIL_HOST,
         // auth: {
         //    user: env.MAIL_USER,
         //    pass: env.MAIL_PASS,
         // },
         auth: {
            user: "apikey",
            pass: process.env.SENDGRID_API_KEY,
         },
      });
      const info = await transporter.sendMail({
         from: env.MAIL_FROM,
         to: destination,
         subject: templates[type]['subject'],
         html: htmlDoc,
      });
      return info;
   } catch (error) {
      console.error('Error encountered while sending email:', error);
      return { error: true, message: error.message };
   }
}
