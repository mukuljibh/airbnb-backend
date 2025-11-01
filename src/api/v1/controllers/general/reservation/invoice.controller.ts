import PDFDocument from 'pdfkit';
import { Billing } from '../../../models/reservation/billing';
import { IReservation } from "../../../models/reservation/types/reservation.model.types"
import { IProperty } from '../../../models/property/types/property.model.types';
import moment from 'moment';
import { NextFunction, Response, Request } from 'express';
import { validateObjectId } from '../../../utils/mongo-helper/mongo.utils';
import { ApiError } from '../../../utils/error-handlers/ApiError';
import { makeFirstLetterUpperCase } from '../../../utils/mutation/mutation.utils';
import getSymbolFromCurrency from 'currency-symbol-map'
import env from '../../../config/env';


export async function fetchInvoice(
   req: Request,
   res: Response,
   next: NextFunction,
) {
   {
      try {
         const reservationId = validateObjectId(req.params.reservationId);

         const billing = await Billing.findOne({ reservationId })
            .populate<{
               reservationId: IReservation & {
                  propertyId: IProperty;
               };
            }>({
               path: "reservationId",
               populate: "propertyId"
            });
         if (!billing) {
            throw new ApiError(404, "No Reservation found for provided reservation id")
         }
         const reservation = billing.reservationId



         const property = reservation.propertyId;


         const billerName = billing?.billingDetails?.name

         const billingAddress = billing?.billingDetails.address;

         // Build address lines conditionally
         const line1 = billingAddress.line1;

         const line2 = billingAddress.line2;

         const line3 = [
            billingAddress.state,
            billingAddress.postal_code,
            billingAddress.country,
         ]
            .filter(Boolean)
            .join(', ');
         // Create a PDF document
         const pageWidth = 750;
         const pageHeight = 841.89;
         const pageMargin = 50;
         const doc = new PDFDocument({
            size: [pageWidth, pageHeight], // Custom size: 700 points width (wider than standard A4), keeping height the same (A4)
            margin: pageMargin, // Margin from page edges
         });

         // doc.pipe(fs.createWriteStream('invoice.pdf'));

         // Set response headers for PDF download
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader(
            'Content-Disposition',
            `attachment; filename=invoice-${reservation.reservationCode}.pdf`,
         );

         // Pipe the PDF document to the response
         doc.pipe(res);
         // Define colors
         const primaryColor = '#f7941d'; // Orange color used in the logo/header
         const textColor = '#333333';
         const lightGray = '#5E6470';
         const green = '#58A146';
         const borderColor = '#e0e0e0';

         // font
         doc.registerFont(
            'Regular',
            './public/assets/fonts/Inter_18pt-Regular.ttf',
         );
         doc.registerFont(
            'Medium',
            './public/assets/fonts/Inter_18pt-Medium.ttf',
         );
         doc.registerFont(
            'MediumItalic',
            './public/assets/fonts/Inter_18pt-MediumItalic.ttf',
         );
         doc.registerFont(
            'semi-bold',
            './public/assets/fonts/Inter_18pt-SemiBold.ttf',
         );
         doc.registerFont('Bold', './public/assets/fonts/Inter_18pt-Bold.ttf');

         doc.fontSize(26)
            .fillColor(primaryColor)
            .text('AirBnb', pageMargin, pageMargin + 20);
         // Business address
         doc.fontSize(10)
            .fillColor(textColor)
            .text('Business address', pageWidth - 200, pageMargin + 20, {
               align: 'right',
            })
            .text(
               'City, State, IN - 000 000',
               pageWidth - 200,
               pageMargin + 35,
               {
                  align: 'right',
               },
            )
            .text('TAX ID 00XXXXX1234X0XX', pageWidth - 200, pageMargin + 50, {
               align: 'right',
            });

         // Draw line after header
         doc.moveTo(pageMargin, pageMargin + 80)
            .lineTo(pageWidth - pageMargin, pageMargin + 80)
            .stroke(borderColor);
         // Clean and conditionally build address lines


         doc.font('Helvetica-Bold')
            .fontSize(14)
            .text(
               makeFirstLetterUpperCase(billing.billingDetails.name),
               pageMargin,
               pageMargin + 109,
            );

         doc.font('Helvetica').fontSize(11);

         let currentY = pageMargin + 128;

         [line1, line2, line3].forEach((line) => {
            if (line) {
               const textHeight = doc.heightOfString(line, {
                  width: 210,
                  align: 'left',
               });

               doc.text(line, pageMargin, currentY, { width: 210 });
               currentY += textHeight + 3;
            }
         });

         // Invoice number and reference
         doc.fontSize(10)
            .font('semi-bold')
            .text(billing.billingCode, 250, pageMargin + 109)
            .fontSize(10)
            .font('Regular')
            .text(moment(reservation.createdAt).format('MMM D, YYYY'), 250, pageMargin + 125);

         // Invoice amount

         doc.fontSize(10)
            .font('Regular')
            .text('Invoice (INR)', pageWidth - 200, pageMargin + 100, {
               align: 'right',
            })
            .fontSize(24)
            .fillColor(primaryColor)
            .font('semi-bold')
            .text(
               `${getSymbolFromCurrency(billing.currencyExchangeRate.targetCurrency)}  ${billing.totalAmountPaid}`,
               pageWidth - 200,
               pageMargin + 120,
               {
                  align: 'right',
               },
            );


         // Subject section
         const propertyAddress = `${property.location.state} ${property.location.city}`
         doc.fillColor(textColor)
            .fontSize(18)
            .font('Bold')
            .text(
               `${billing.hasRefunds ? 'Cancelled' : 'Confirmed'}: ${billing.numberOfNights} Nights in ${makeFirstLetterUpperCase(propertyAddress)}`,
               pageMargin,
               pageMargin + 215,
            );
         doc.fillColor(lightGray)
            .fontSize(10)
            .font('Regular')
            .text(
               `Booked by ${makeFirstLetterUpperCase(billerName)}`,
               pageMargin,
               pageMargin + 240,
            );

         // Line under table headers
         const tableTop = pageMargin + 280;
         doc.moveTo(pageMargin, tableTop - 10)
            .lineTo(pageWidth - pageMargin, tableTop - 10)
            .stroke(borderColor);
         // Table headers
         doc.fontSize(10)
            .fillColor(lightGray)
            .font('Medium')
            .text('Reservation', pageMargin, tableTop, { width: 250 })
            .text('CheckIn - CheckOut', 300, tableTop, {
               width: 150,
               align: 'center',
            })
            .text('Nights', 450, tableTop, {
               width: 50,
               align: 'center',
            })
            .text('RATE', 500, tableTop, { width: 80, align: 'right' })
            .text('AMOUNT', pageWidth - pageMargin - 80, tableTop, {
               width: 80,
               align: 'right',
            });

         // Line under table headers
         doc.moveTo(pageMargin, tableTop + 20)
            .lineTo(pageWidth - pageMargin, tableTop + 20)
            .stroke(borderColor);

         // Table rows - Item 1
         let rowY = tableTop + 40;

         doc.fillColor(textColor)
            .fontSize(10)
            .font('semi-bold')
            .text(reservation.reservationCode, pageMargin, rowY, { width: 250 })
            .fontSize(12);


         const currencyCode = getSymbolFromCurrency(billing.currencyExchangeRate.targetCurrency)

         const checkInDate = moment(reservation.checkInDate).format(
            'MMM D, YYYY',
         )
         const checkOutDate = moment(reservation.checkOutDate).format(
            'MMM D, YYYY',
         )
         doc.font('semi-bold')
            .text(property.title, pageMargin, rowY + 20, {
               width: 250,
               underline: true,
               link: `${env.GUEST_URL}/property-details/${property._id}`,
            })

            .fontSize(10)
            .text(
               `${checkInDate} - ${checkOutDate}`,
               300,
               rowY,
               {
                  width: 150,
                  align: 'center',
               },
            )
            .text(`${billing.numberOfNights}`, 450, rowY, {
               width: 50,
               align: 'center',
            })
            .text(`${currencyCode} ${billing.pricePerNight}`, 500, rowY, {
               width: 80,
               align: 'right',
            })
            .text(
               `${currencyCode} ${billing.totalbasePrice}`,
               pageWidth - pageMargin - 80,
               rowY,
               {
                  width: 80,
                  align: 'right',
               },
            );

         // Line before totals
         // Line Separator
         rowY += 60;
         doc.moveTo(pageMargin, rowY - 10)
            .lineTo(pageWidth - pageMargin, rowY - 10)
            .stroke(borderColor);

         const lengthDiscount = billing?.discountBreakdown?.lengthDiscount || 0
         const promoCodeDiscount = billing?.discountBreakdown?.promoCodeDiscount || 0
         const lengthDiscountPercentage = billing.lengthDiscountPercentage || 0
         const promoAppliedCode = billing?.promoApplied?.promoCode || ''


         // Long Stay Discount
         if (lengthDiscount) {
            doc.fontSize(10)
               .font('MediumItalic')
               .fillColor(green)
               .text(`Long stay discount (${lengthDiscountPercentage}%)`, 400, rowY, {
                  width: 300,
                  align: 'left'
               })
               .text(`- ${currencyCode} ${lengthDiscount}`, pageWidth - pageMargin - 80, rowY, {
                  width: 80,
                  align: 'right'
               });
            rowY += 20;
         }

         // Service Fee
         doc.fillColor(textColor)
            .text('Service fee', 400, rowY, { width: 100, align: 'left' })
            .text(`${currencyCode} ${billing.additionalFees.service}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });
         rowY += 20;

         // Cleaning Fee
         doc.text('Cleaning fee', 400, rowY, { width: 100, align: 'left' })
            .text(`${currencyCode} ${billing.additionalFees.cleaning}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });
         rowY += 20;

         // Subtotal
         doc.fontSize(14)
            .font('Medium')
            .text('Subtotal', 400, rowY, { width: 100, align: 'left' })
            .text(`${currencyCode} ${billing.subTotal}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });
         rowY += 25;

         // Line Separator
         doc.moveTo(pageWidth - pageMargin - 320, rowY)
            .lineTo(pageWidth - pageMargin, rowY)
            .stroke(borderColor);

         // Promo Code Discount
         if (promoAppliedCode) {
            rowY += 20;
            doc.fontSize(10)
               .font('MediumItalic')
               .fillColor(green)
               .text(`Promo code discount (${promoAppliedCode})`, 400, rowY, {
                  width: 300,
                  align: 'left'
               })
               .text(`- ${currencyCode} ${promoCodeDiscount}`, pageWidth - pageMargin - 80, rowY, {
                  width: 80,
                  align: 'right'
               });
         }
         rowY += 40;

         // Tax
         doc.fontSize(10)
            .fillColor(textColor)
            .text(`Tax ${billing.taxPercentage ? `(${billing.taxPercentage}%)` : ''}`, 400, rowY, {
               width: 100,
               align: 'left'
            })
            .text(`${currencyCode} ${billing.additionalFees.tax}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });
         rowY += 20;

         // Platform Fees
         doc.text('Platform fees', 400, rowY, { width: 100, align: 'left' })
            .text(`${currencyCode} ${billing.additionalFees.platformFees}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });
         rowY += 40;

         // Total Paid
         doc.fontSize(14)
            .font('Bold')
            .text('Total Paid', 400, rowY, { width: 100, align: 'left' })
            .text(`${currencyCode} ${billing.totalAmountPaid}`, pageWidth - pageMargin - 80, rowY, {
               width: 80,
               align: 'right'
            });

         // Refund Section
         if (billing.hasRefunds) {
            rowY += 25;
            doc.moveTo(pageWidth - pageMargin - 320, rowY)
               .lineTo(pageWidth - pageMargin, rowY)
               .stroke(borderColor);
            rowY += 10;

            doc.fontSize(10)
               .font('Regular')
               .text('Refund date', 400, rowY, { width: 150, align: 'left' })
               .text(moment(reservation.updatedAt).format('MMM D, YYYY'), pageWidth - pageMargin - 80, rowY, {
                  width: 80,
                  align: 'right'
               });
            rowY += 20;

            doc.fontSize(12)
               .font('MediumItalic')
               .text('Refunded Amount', 400, rowY, { width: 150, align: 'left' })
               .text(`${currencyCode} ${billing.totalRefunded}`, pageWidth - pageMargin - 80, rowY, {
                  width: 80,
                  align: 'right'
               });
         }

         // Cancellation Policy
         doc.fontSize(12)
            .font('semi-bold')
            .text('Cancellation policy', pageMargin, pageHeight - pageMargin - 60)
            .font('Regular')
            .fillColor(lightGray)
            .fontSize(9)
            .text(
               'Cancellations are non-refundable if made within 48 hours of your check-in date, or if your check-in is within 48 hours of the cancellation attempt, whichever comes first.',
               pageMargin,
               pageHeight - pageMargin - 45
            );

         const learnMoreText = 'Learn More';
         const learnMoreX = pageMargin;
         const learnMoreY = pageHeight - pageMargin - 19;
         doc.fillColor(primaryColor)
            .font('semi-bold')
            .text(learnMoreText, learnMoreX, learnMoreY, {
               underline: true,
               link: `${env.GUEST_URL}/policies?type=bookingCancellationPolicy`,
            });


         // Finalize the document
         doc.end();
      } catch (err) {
         console.log(err);
         next(err);
      }
   }
}
