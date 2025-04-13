import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Billing } from '../../../../models/reservation/billing';
import { Reservation } from '../../../../models/reservation/reservation';
import { IUser } from '../../../../models/user/types/user.model.types';
import { IProperty } from '../../../../models/property/types/property.model.types';
import moment from 'moment';
import { NextFunction, Response, Request } from 'express';
import { validateObjectId } from '../../../../utils/mongo-helper/mongo.utils';
import { Transaction } from '../../../../models/reservation/transaction';
import axios from 'axios';
import sharp from 'sharp';
export async function fetchInvoice(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   {
      try {
         const reservationId = validateObjectId(req.params.reservationId);
         const reservation = await Reservation.findById(
            reservationId,
         ).populate<{ hostId: IUser; userId: IUser; propertyId: IProperty }>(
            'hostId userId propertyId',
         );

         const billing = await Billing.findOne({ reservationId });
         const transaction = await Transaction.findOne(
            { billingId: billing._id },
            null,
            { sort: { createdAt: -1 } },
         );
         const guest = reservation.userId as IUser;
         const host = reservation.hostId as IUser;
         const property = reservation.propertyId;
         const response = await axios.get(property.thumbnail, {
            responseType: 'arraybuffer', // Important to get raw binary
         });
         const imageBuffer = await sharp(response.data)
            .toFormat('jpeg')
            .toBuffer();

         const data = {
            receiptId: reservation.reservationCode,
            receiptDate: moment(reservation.createdAt).format(
               'ddd, MMM D, YYYY',
            ),
            nights: billing.numberOfNights,
            checkIn: moment(reservation.checkInDate).format('ddd, MMM D, YYYY'),
            checkOut: moment(reservation.checkOutDate).format(
               'ddd, MMM D, YYYY',
            ),

            propertyType: property.propertyPlaceType,
            beds: property.details.beds,
            guests: reservation.numberOfGuests,
            host: `${host.firstName} ${host.lastName}`,
            confirmationCode: 'HKP5280DHY',
            itineraryUrl: 'https://airbnb.com/itinerary',
            listingUrl: 'https://airbnb.com/listing',
            travelerName: `${guest.firstName} ${guest.lastName}`,
            cancellationPolicy:
               'Cancel before 4:00 PM on Jan 22 for a partial refund. After that, this reservation is non-refundable.',
            nightlyRate: billing.pricePerNight,
            totalNights: billing.totalbasePrice,
            discountBreakDown: {
               lengthDiscount: billing?.discountBreakdown?.lengthDiscount || 0,
               promoCodeDiscount:
                  billing?.discountBreakdown?.promoCodeDiscount || 0,
            },
            promoApplied: billing?.promoApplied?.promoCode || '',
            serviceFee: Object.values(billing.additionalFees).reduce(
               (acc, item) => acc + item,
               0,
            ),

            taxes: billing.additionalFees.tax,
            total: billing.totalPrice,
            paymentAmount: billing.totalPrice,
            refundDate: moment(transaction.createdAt).format(
               'ddd, MMM D, YYYY',
            ),
            totalAmountPaidAfterRefund:
               billing.totalAmountPaid - billing?.totalRefunded || 0,
            totalRefunded: billing.totalRefunded,
            paymentMethod: 'VISA',
            cardLastFour: '9196',
            paymentDate: 'January 14, 2023 · 5:51:11 PM EST',
         };
         // Create a PDF document
         const pageWidth = 750;
         const pageHeight = 841.89;
         const pageMargin = 50;
         const doc = new PDFDocument({
            size: [pageWidth, pageHeight], // Custom size: 700 points width (wider than standard A4), keeping height the same (A4)
            margin: pageMargin, // Margin from page edges
         });
         const fontPath = './public/assets/DejaVuSans.ttf';

         doc.pipe(fs.createWriteStream('invoice.pdf'));

         // Set response headers for PDF download
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader(
            'Content-Disposition',
            `attachment; filename=invoice-${data.receiptId}.pdf`,
         );

         // Pipe the PDF document to the response
         doc.pipe(res);
         doc.font('Helvetica').fontSize(10).text('GST : 27AAPFU0939F1ZV');
         doc.moveDown(1); // Moves down by 1 line (you can adjust this value as needed)

         doc.font('Helvetica-Bold')
            .fontSize(18)
            .text('Your receipt from MaxAirGo');
         doc.moveDown(1); // Moves down by 1 line (you can adjust this value as needed)

         const imageWidth = 50; // Image width
         const imageX = pageWidth - pageMargin - imageWidth; // 50 is the margin from the right edge

         // Set the Y position for the image (same as the text position for alignment)
         const imageY = 50; // Adjust this as needed

         // Add the image aligned to the right
         doc.image('./public/assets/MaxAirGo.jpeg', imageX, imageY, {
            width: imageWidth, // Set the width of the image
         });

         doc.font('Helvetica') // Use regular font
            .fontSize(8)
            .fillColor('#808080') // Medium gray color
            .text(`Receipt ID: ${data.receiptId} · ${data.receiptDate}`);

         doc.moveDown(2);
         const rectWidth = 320;
         const rectheight = 300;
         const rectMargin = 15;

         // First rectangle
         const firstRectX = doc.x;
         const firstRectY = doc.y;
         doc.strokeColor('#7a7a7a');

         doc.rect(
            firstRectX,
            firstRectY,
            rectWidth - rectMargin,
            rectheight,
         ).stroke();

         const rectPadding = 20;
         const recVerLineSpace = 20;
         // Save position after drawing the first rectangle
         const textX1 = firstRectX + rectPadding; // Add a bit of padding inside the rectangle
         const textY1 = firstRectY + rectPadding; // Add a bit of padding inside the rectangle

         // Save position for text in second rectangle

         // Now add text to the first rectangle
         const contentArray = [
            {
               font: 'Helvetica-Bold',
               fontSize: 12,
               fillColor: '#333333',
               text: `${data.nights} Nights in`,
               xaxis: textX1,
               yaxis: textY1,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica',
               fontSize: 14,
               fillColor: '#666666',
               text: `${data.checkIn} -> ${data.checkOut}`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica',
               fontSize: 14,
               fillColor: '#666666',
               text: `${data.propertyType} · ${data.guests} beds · ${data.guests} guests`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 2,
               width: rectWidth - rectMargin - rectPadding,
            },

            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#666666',
               text: `Hosted by ${data.host}`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 3,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#666666',
               text: `Confirmation code: ${data.confirmationCode}`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 4,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#1a8faa',
               text: `Go to itinerary · Go to listing`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 5,
               width: rectWidth - rectMargin - rectPadding,
               underline: true,
            },

            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#666666',
               text: `Traveler: ${data.travelerName}`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 6,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica-Bold',
               fontSize: 14,
               fillColor: '#333333',
               text: `Cancellation policy`,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 7.2,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               isImage: true,
               path: imageBuffer,
               xaxis:
                  textX1 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`image goes here`),
               yaxis: textY1 + 35,
               width: imageWidth,
            },
            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#666666',
               text: data.cancellationPolicy,
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 8.5,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: 'Helvetica',
               fontSize: 11,
               fillColor: '#666666',
               text: "Cutoff times are based on the listing's local time",
               xaxis: textX1,
               yaxis: textY1 + recVerLineSpace * 11,
               width: rectWidth - rectMargin - rectPadding,
            },
         ];
         contentArray.forEach((item) => {
            if (item.isImage) {
               // Render image
               doc.image(item.path, item.xaxis, item.yaxis, {
                  width: item.width, // Set the width of the image
               });
            } else {
               // Render text
               doc.fontSize(12)
                  .font(item.font || 'Helvetica') // fallback font
                  .fillColor(item.fillColor || 'black') // fallback color
                  .text(item.text, item.xaxis, item.yaxis, {
                     width: item.width,
                  });
            }
         });

         // Second rectangle
         const secondRectX = firstRectX + rectWidth + rectMargin;
         const secondRectY = firstRectY;
         doc.rect(
            secondRectX,
            secondRectY,
            rectWidth - rectMargin,
            rectheight,
         ).stroke();
         const textX2 = secondRectX + rectPadding; // Add a bit of padding inside the rectangle
         const textY2 = secondRectY + rectPadding; // Add a bit of padding inside the rectangle
         const priceBreakdownArray = [
            {
               font: 'Helvetica',
               fontSize: 15,
               fillColor: '#666666',
               text: 'Price breakdown',
               xaxis: textX2,
               yaxis: textY2,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#555555',
               text: `₹${data.nightlyRate} x ${data.nights} nights`,
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 1.5,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: `₹${data.totalNights.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`₹${data.totalNights.toFixed(2)}`),
               yaxis: textY2 + recVerLineSpace * 1.5,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: 'Service fee',
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 3,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: `₹${data.serviceFee.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`₹${data.serviceFee.toFixed(2)}`),
               yaxis: textY2 + recVerLineSpace * 3,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: 'Occupancy taxes and fees',
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 4,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: `₹${data.taxes.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`₹${data.taxes.toFixed(2)}`),
               yaxis: textY2 + recVerLineSpace * 4,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#2e7d32',
               text: 'Long stay discount',
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 5,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#2e7d32',
               text: `- ₹${data.discountBreakDown.lengthDiscount.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(
                     `- ₹${data.discountBreakDown.lengthDiscount.toFixed(2)}`,
                  ),
               yaxis: textY2 + recVerLineSpace * 5,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#2e7d32',
               text: `Promo code discount (${data.promoApplied})`,
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 6,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#2e7d32',
               text: `- ₹${data.discountBreakDown.promoCodeDiscount.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(
                     `- ₹${data.discountBreakDown.promoCodeDiscount.toFixed(2)}`,
                  ),
               yaxis: textY2 + recVerLineSpace * 6,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: 'Total (INR)',
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 8,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#666666',
               text: `₹${data.total.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`₹${data.total.toFixed(2)}`),
               yaxis: textY2 + recVerLineSpace * 8,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#333333',
               text: 'Amount paid (INR)',
               xaxis: textX2,
               yaxis: textY2 + recVerLineSpace * 9,
               width: rectWidth - rectMargin - rectPadding,
            },
            {
               font: fontPath,
               fontSize: 10,
               fillColor: '#333333',
               text: `₹${data.total.toFixed(2)}`,
               xaxis:
                  textX2 +
                  rectWidth -
                  rectMargin -
                  rectPadding * 2 -
                  doc.widthOfString(`₹${data.total.toFixed(2)}`),
               yaxis: textY2 + recVerLineSpace * 9,
               width: rectWidth - rectMargin - rectPadding,
            },
         ];
         priceBreakdownArray.forEach((item) => {
            doc.fontSize(item.fontSize)
               .font(item.font)
               .fillColor(item.fillColor)
               .text(item.text, item.xaxis, item.yaxis, {
                  width: item.width,
               });
         });
         if (billing.hasRefunds) {
            const thirdRectX = firstRectX + rectWidth + rectMargin;
            const thirdRectY = firstRectY + rectheight + 15;
            doc.rect(
               thirdRectX,
               thirdRectY,
               rectWidth - rectMargin,
               150,
            ).stroke();
            const textX3 = thirdRectX + rectPadding; // Add a bit of padding inside the rectangle
            const textY3 = thirdRectY + rectPadding; // Add a bit of padding inside the rectangle

            const refundSummaryArray = [
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `Refund issued`,
                  xaxis: textX3,
                  yaxis: textY3,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `₹${data.totalRefunded}`,
                  xaxis:
                     textX3 +
                     rectWidth -
                     rectMargin -
                     rectPadding * 2 -
                     doc.widthOfString(`₹${data.totalRefunded}`),
                  yaxis: textY3,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `Refund reason`,
                  xaxis: textX3,
                  yaxis: textY3 + recVerLineSpace,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `cancellation`,
                  xaxis:
                     textX3 +
                     rectWidth -
                     rectMargin -
                     rectPadding * 2 -
                     doc.widthOfString(`cancellation`),
                  yaxis: textY3 + recVerLineSpace,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `Refund date`,
                  xaxis: textX3,
                  yaxis: textY3 + recVerLineSpace * 2,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: data.refundDate,
                  xaxis:
                     textX3 +
                     rectWidth -
                     rectMargin -
                     rectPadding * 2 -
                     doc.widthOfString(data.refundDate),
                  yaxis: textY3 + recVerLineSpace * 2,
                  width: rectWidth - rectMargin - rectPadding,
               },

               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: 'Non-refundable amount',
                  xaxis: textX3,
                  yaxis: textY3 + recVerLineSpace * 3,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#555555',
                  text: `₹0`,
                  xaxis:
                     textX3 +
                     rectWidth -
                     rectMargin -
                     rectPadding * 2 -
                     doc.widthOfString(`₹0`),
                  yaxis: textY3 + recVerLineSpace * 3,
                  width: rectWidth - rectMargin - rectPadding,
               },

               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#333333',
                  text: 'Net paid after refund:',
                  xaxis: textX3,
                  yaxis: textY3 + recVerLineSpace * 4,
                  width: rectWidth - rectMargin - rectPadding,
               },
               {
                  font: fontPath,
                  fontSize: 10,
                  fillColor: '#333333',

                  text: `₹${data.totalAmountPaidAfterRefund}`,
                  xaxis:
                     textX3 +
                     rectWidth -
                     rectMargin -
                     rectPadding * 2 -
                     doc.widthOfString(`₹${data.totalAmountPaidAfterRefund}`),
                  yaxis: textY3 + recVerLineSpace * 4,
                  width: rectWidth - rectMargin - rectPadding,
               },
            ];

            refundSummaryArray.forEach((item) => {
               doc.fontSize(10)
                  .font(item.font)
                  .fillColor(item.fillColor)
                  .text(item.text, item.xaxis, item.yaxis, {
                     width: item.width,
                  });
            });
         }

         const footerY = 660;
         const footerArray = [
            {
               fontSize: 9,
               text: 'Mexxiss Payments, Inc.',
               xaxis: firstRectX,
               yaxis: footerY,
            },
            {
               fontSize: 8,
               text: 'MaxAirGo Payments is a limited payment collection agent of your Host. It means that upon your payment of the Total Price to MaxAirGo Payments, your payment obligation to your',
               xaxis: firstRectX,
               yaxis: footerY + 15,
               width: pageWidth - pageMargin,
            },
            {
               fontSize: 8,
               text: "Host is satisfied. Refund requests will be processed in accordance with: (i) the Host's cancellation policy (available on the Listing); or (ii) Rebooking and Refund Policy Terms,",
               xaxis: firstRectX,
               yaxis: footerY + 35,
               width: pageWidth - pageMargin,
            },
            {
               fontSize: 8,
               text: 'available at www.MaxAirGo.com/terms. Questions or complaints: contact MaxAirGo Payments, Inc. at +1 (844) 234-2500.',
               xaxis: firstRectX,
               yaxis: footerY + 55,
               width: pageWidth - pageMargin,
            },
            {
               fontSize: 9,
               text: 'Payment processed by:',
               xaxis: firstRectX,
               yaxis: footerY + 75,
               width: pageWidth - pageMargin,
            },
            {
               fontSize: 8,
               text: 'Mexxiss Payments, Inc.',
               xaxis: firstRectX,
               yaxis: footerY + 85,
               width: pageWidth - pageMargin,
            },
            {
               fontSize: 8,
               text: '888 Brannan Street, San Francisco, CA 94103',
               xaxis: firstRectX,
               yaxis: footerY + 95,
               width: pageWidth - pageMargin,
            },
         ];

         footerArray.forEach((item) => {
            doc.fontSize(item.fontSize).text(
               item.text,
               item.xaxis,
               item.yaxis,
               { width: item.width },
            );
         });

         doc.end();
      } catch (err) {
         next(err);
      }
   }
}
