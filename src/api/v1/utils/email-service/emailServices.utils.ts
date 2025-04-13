import fs from 'fs/promises';
import { templates } from './emailServices.constant';
import nodemailer from 'nodemailer';

export async function sendEmail<T extends keyof typeof templates>(
   type: T,
   destination: string,
   replacements: Partial<(typeof templates)[T]['replacement']>,
) {
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
         host: process.env.MAIL_HOST,
         auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
         },
      });
      const info = await transporter.sendMail({
         from: process.env.MAIL_FROM,
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
