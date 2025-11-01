export const templates = {
   // 🔐 AUTH
   SIGN_UP_OTP: {
      path: 'public/template/auth/signup_otp.html',
      subject: 'Verify Your Email to Get Started',
      replacement: {
         otp: '',
         expiry_time: '15 minutes',
      },
   },
   FORGET_PASSWORD_OTP: {
      path: 'public/template/auth/forget_password.html',
      subject: 'Your OTP for password reset',
      replacement: {
         otp: '',
      },
   },
   UPDATE: {
      path: 'public/contactverification.html',
      subject: 'Verify Your New Contact Information',
      replacement: {
         otp: '',
         new_email: '',
         old_email: '',
      },
   },

   // 👤 ACCOUNT
   WELCOME: {
      path: 'public/template/account/welcome.html',
      subject: 'Let’s Make Travel Better – Welcome Aboard!',
      replacement: {
         name: '',
      },
   },
   AUTO_DELETE_ACCOUNT: {
      path: 'public/template/account/account_deletion_request.html',
      subject: 'Account deletion request',
      replacement: {
         userName: '',
         deletionDate: '',
      },
   },
   DELETE_ACCOUNT_BY_ADMIN: {
      path: 'public/template/account/account_deletion_by_admin.html',
      subject: 'Account deleted',
      replacement: {
         userName: '',
         deletionDate: '',
      },
   },
   ACCOUNT_SUSPENSION: {
      path: 'public/template/account/account_suspension.html',
      subject: 'Account suspended',
      replacement: {
         userName: '',
         date: '',
         reason: '',
      },
   },
   ACCOUNT_UNSUSPENSION: {
      path: 'public/template/account/account_unsuspension.html',
      subject: 'Account unsuspended',
      replacement: {
         userName: '',
         date: '',
      },
   },

   PROPERTY_SUSPENSION: {
      path: 'public/template/properties/property_suspension.html',
      subject: 'Property suspended',
      replacement: {
         userName: '',
         propertyName: '',
         reason: '',
         date: '',
      },
   },
   PROPERTY_UNSUSPENSION: {
      path: 'public/template/properties/property_unsuspension.html',
      subject: 'Property unsuspended',
      replacement: {
         userName: '',
         propertyName: '',
         date: '',
      },
   },


   // 🏡 PROPERTY
   PROPERTY_LISTING_VERIFIED: {
      path: 'public/template/properties/property_verified.html',
      subject: 'Congratulations! Your new Property Has Been Successfully Listed',
      replacement: {
         name: '',
         propertyName: '',
         date: ''
      },
   },

   PROPERTY_REQUIRED_ACTION: {
      path: 'public/template/properties/property_required_action.html',
      subject: 'Notification regarding your property',
      replacement: {
         name: '',
         propertyName: '',
         actionUrl: '',
         reason: '',
         date: ''

      },
   },

   PROPERTY_REJECTED: {
      path: 'public/template/properties/property_rejected.html',
      subject: 'Notification regarding your property',
      replacement: {
         name: '',
         propertyName: '',
         reason: '',
         date: ''
      },
   },




   PROPERTY_DELETED: {
      path: 'public/template/properties/property_deleted.html',
      subject: 'Notification regarding your property',
      replacement: {
         userName: '',
         propertyName: '',
         reason: '',
         deletedBy: '',
      },
   },

   // 📅 RESERVATION
   RESERVATION_CONFIRMATION: {
      path: 'public/template/reservation/reservationConfirmed.html',
      subject: 'Booking Confirmation - AirBnb',
      replacement: {
         propertyName: '',
         thumbnail: '',
         propertyAddress: '',
         checkInTime: '',
         checkOutTime: '',
         concatDates: '',
         confirmedAt: '',
         paymentCard: '',
         hostName: '',
         guestName: '',
         billingCode: '',
         reservationCode: '',
         numberOfGuests: '',
         numberOfNights: '',
         pricePerNight: '',
         cleaningFees: '',
         totalBasePrice: '',
         tax: '',
         discounts: '',
         platformFees: '',
         serviceFees: '',
         totalAmountPaid: '',
         currency: '',
         reservationMessage: '',
         reservationTitle: ''

      },
   },
   RESERVATION_CANCELLATION: {
      path: 'public/template/reservation/reservation_cancellation.html',
      subject: 'Booking Cancellation - AirBnb',
      replacement: {
         concatDates: '',
         propertyName: '',
         thumbnail: '',
         reservationCode: '',
         currency: '',
         guestName: '',
         totalRefunded: '',
         cancelledAt: '',
         propertyAddress: '',
         paymentCard: '',
      },
   },
   RESERVATION_RECIEPTS: {
      path: 'public/template/reservation/receipts.html',
      subject: 'Receipt from - AirBnb',
      replacement: {
         propertyName: '',
         thumbnail: '',
         propertyAddress: '',
         checkInDate: '',
         checkOutDate: '',
         confirmedAt: '',
         paymentCard: '',
         hostName: '',
         billingCode: '',
         reservationCode: '',
         numberOfGuests: '',
         numberOfNights: '',
         pricePerNight: '',
         cleaningFees: '',
         platformFees: '',
         totalBasePrice: '',
         subTotal: '',
         tax: '',
         discounts: '',
         serviceFees: '',
         totalAmountPaid: '',
         currency: '',
      },
   },
   RESERVATION_REVIEW_REQUEST: {
      path: 'public/template/reservation/reviewRequest.html',
      subject: 'How was our service - AirBnb',
      replacement: {
         hostName: '',
      },
   },

   // 💳 REFUNDS
   REFUND_INTIATED: {
      path: 'public/template/reservation/refundIntiated.html',
      subject: 'Refund initiated',
      replacement: {
         thumbnail: '',
         propertyName: '',
         refundAppliedDate: '',
         propertyPlaceType: '',
         formattedDateRange: '',
         hostName: '',
         reservationCode: '',
         refundAmount: '',
         currencySymbol: '',
      },
   },
   REFUND_RECIEVED: {
      path: 'public/template/reservation/refundRecieved.html',
      subject: 'Refund received',
      replacement: {
         thumbnail: '',
         propertyName: '',
         propertyPlaceType: '',
         hostName: '',
         formattedDateRange: '',
         reservationCode: '',
         refundAmount: '',
         currencySymbol: '',
      },
   },

   // ✅ KYC
   KYC_VERIFIED: {
      path: 'public/template/kyc/kyc_approved.html',
      subject: 'KYC verification',
      replacement: {
         hostName: '',
      },
   },

   // 📢 NOTIFICATIONS
   SUBSCRIBE_NEWSLETTER: {
      path: 'public/template/alert/newsletter.html',
      subject: 'Thanks for Subscribing to Our Newsletter!',
      replacement: {
         email: '',
      },
   },
   USER_QUERY_ACK: {
      path: 'public/template/queryRes.html',
      subject: 'We’ve Received Your Message!',
      replacement: {
         name: '',
      },
   },
   ADMIN_NOTIFY: {
      path: 'public/contactverification.html',
      subject: 'New User Query Received',
      replacement: {
         otp: '',
         new_email: '',
         old_email: '',
      },
   },
};
