export const templates = {
   SIGN_UP_OTP: {
      path: 'public/template/signupOtp.html',
      subject: 'Verify Your Email to Get Started',
      replacement: {
         otp: '',
      },
   },

   FORGET_PASSWORD_OTP: {
      path: 'public/template/forgotPassword.html',
      subject: 'Your OTP for password reset',
      replacement: {
         otp: '',
      },
   },
   WELCOME: {
      path: 'public/template/welcome.html',
      subject: 'Let’s Make Travel Better – Welcome Aboard!',
      replacement: {
         name: '',
      },
   },
   PROPERTY_LISTING: {
      path: 'public/template/propertyListed.html',
      subject: 'Congratulations! Your Property Has Been Successfully Listed',
      replacement: {
         name: '',
         propertyTitle: '',
      },
   },
   RESERVATION_CONFIRMATION: {
      path: 'public/template/bookingConfirmed.html',
      subject: 'Booking Confirmation - AirBnb',
      replacement: {
         thumbnail: '',
         propertyName: '',
         propertyAddress: '',
         reservationCode: '',
         guestName: '',
         guestEmail: '',
         checkInDate: '',
         checkOutDate: '',
         nights: '',
      },
   },
   RESERVATION_CANCELLATION: {
      path: 'public/template/bookingCanceled.html',
      subject: 'Your Reservation Has Been Canceled – Airbnb',

      replacement: {
         thumbnail: '',
         propertyName: '',
         propertyAddress: '',
         reservationCode: '',
         guestName: '',
         guestEmail: '',
         checkInDate: '',
         checkOutDate: '',
         cancellationReason: 'As Per Guest request',
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
};
