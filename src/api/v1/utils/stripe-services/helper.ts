import Stripe from 'stripe';

function getFriendlyMessage(requirement) {
   const messageMap = {
      // Identity verification
      'individual.verification.document':
         'Identity verification document is required',
      'individual.verification.additional_document':
         'Additional identity verification document is needed',
      'individual.id_number':
         'Personal ID number (e.g., SSN, SIN, ITIN) is required',
      'individual.dob.day': 'Date of birth (day) information is incomplete',
      'individual.dob.month': 'Date of birth (month) information is incomplete',
      'individual.dob.year': 'Date of birth  (year)  information is incomplete',
      'individual.first_name': 'First name must be provided',
      'individual.last_name': 'Last name must be provided',
      'individual.email': 'Email address is required',
      'individual.phone': 'Phone number is required',

      // Address information
      'individual.address.line1': 'Street address is required',
      'individual.address.city': 'City is required',
      'individual.address.state': 'State/Province is required',
      'individual.address.postal_code': 'Postal/ZIP code is required',
      'individual.address.country': 'Country is required',

      // Business information
      'business_profile.url': 'Business website URL is required',
      'business_profile.mcc':
         'Business category (MCC code) needs to be selected',
      'business_profile.product_description':
         'Description of your products or services is needed',
      business_type: 'Business type information is missing',
      'company.name': 'Company name is required',
      'company.tax_id': 'Company tax ID (EIN, VAT, etc.) is required',
      'company.address.line1': 'Company street address is required',
      'company.address.city': 'Company city is required',
      'company.address.state': 'Company state/province is required',
      'company.address.postal_code': 'Company postal/ZIP code is required',
      'company.address.country': 'Company country is required',
      'company.directors_provided':
         'Information about company directors needs to be provided',
      'company.owners_provided':
         'Information about company owners needs to be provided',
      'company.verification.document':
         'Company verification document is required',

      // Banking information
      external_account: 'Bank account information is needed for payouts',
      account_token: 'Account verification token is missing',

      // Terms and agreements
      'tos_acceptance.date': 'Terms of service need to be accepted',
      'tos_acceptance.ip':
         'Terms of service need to be accepted from a valid IP address',

      // Representative information
      'representative.first_name': 'Representative first name is required',
      'representative.last_name': 'Representative last name is required',
      'representative.email': 'Representative email address is required',
      'representative.dob.day':
         'Representative date of birth information is incomplete',
      'representative.dob.month':
         'Representative date of birth information is incomplete',
      'representative.dob.year':
         'Representative date of birth information is incomplete',
      'representative.address.line1':
         'Representative street address is required',
      'representative.address.city': 'Representative city is required',
      'representative.address.state':
         'Representative state/province is required',
      'representative.address.postal_code':
         'Representative postal/ZIP code is required',
      'representative.address.country': 'Representative country is required',
      'representative.id_number': 'Representative ID number is required',
      'representative.phone': 'Representative phone number is required',
      'representative.verification.document':
         'Representative verification document is required',
      'representative.verification.additional_document':
         'Additional representative verification document is needed',

      // Financial information
      'relationship.director': 'Director relationship information is missing',
      'relationship.executive': 'Executive relationship information is missing',
      'relationship.owner': 'Owner relationship information is missing',
      'relationship.title': 'Job title information is missing',
      'relationship.percent_ownership':
         'Percentage of ownership information is missing',

      // Other common requirements
      person_token: 'Person verification token is missing',
      'capabilities.transfers': 'Transfer capability approval is pending',
      'capabilities.card_payments':
         'Card payment capability approval is pending',
      'finance.exports.loss_reserves_understanding':
         'Acknowledgment of loss reserves requirements is needed',
      'settings.payouts.schedule':
         'Payout schedule settings need to be configured',
   };

   return (
      messageMap[requirement] || `Additional information needed: ${requirement}`
   );
}

export function generateVerificationStatus(account: Stripe.Account) {
   const { requirements } = account;

   if (
      !account.details_submitted ||
      !account.charges_enabled ||
      !account.payouts_enabled
   ) {
      return {
         status: 'pending',
         reason:
            'Your account setup is incomplete. Please complete all required steps in your Stripe dashboard.',
      };
   }

   if (requirements.currently_due.length === 0) {
      return {
         status: 'verified',
         reason: undefined,
      };
   }

   // Prioritize currently_due requirements
   if (requirements.currently_due.length > 0) {
      const currentlyDueMessages = requirements.currently_due.map((req) =>
         getFriendlyMessage(req),
      );
      return {
         status: 'pending',
         reason: 'Action required: ' + currentlyDueMessages.join('. '),
         details: {
            urgent: currentlyDueMessages,
            eventual: requirements.eventually_due.map((req) =>
               getFriendlyMessage(req),
            ),
         },
      };
   }

   // Handle eventually_due requirements
   return {
      status: 'pending',
      reason:
         'Additional information will be required soon: ' +
         requirements.eventually_due
            .map((req) => getFriendlyMessage(req))
            .join('. '),
      details: {
         urgent: [],
         eventual: requirements.eventually_due.map((req) =>
            getFriendlyMessage(req),
         ),
      },
   };
}
