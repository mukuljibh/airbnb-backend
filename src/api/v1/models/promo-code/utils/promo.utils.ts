import Handlebars from 'handlebars';

Handlebars.registerHelper('currency', function (value, symbol = '$') {
    // Make sure value is a number
    const numValue = Number(value) || 0;
    return symbol + numValue.toFixed(2);
});

Handlebars.registerHelper('dateFormat', function (dateStr) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(dateStr));
});

Handlebars.registerHelper('amountComparison', function (discountType) {
    return discountType === "flat";
});


Handlebars.registerHelper('userType', function (eligibleUser) {
    const hasNew = eligibleUser.includes("newUser");
    const hasExisting = eligibleUser.includes("existingUser");

    if (hasNew && hasExisting) {
        return "all";
    } else if (hasNew) {
        return "new";
    } else if (hasExisting) {
        return "existing";
    } else {
        return "unknown";
    }
});

const templateString = `{{#if amount}}
  {{#if (amountComparison discountType)}}
    Enjoy {{currency amount symbol}} limited-time deal on your stay. Valid until {{dateFormat date}}. Minimum spend: {{currency minimumSpend symbol}}. Available for {{userType eligibleUserTypes}} users.
  {{else}}
  Book now and get {{amount}}% off your trip — offer ends {{dateFormat date}}. Minimum spend: {{currency minimumSpend symbol}}. Get up to {{currency maximumDiscount symbol}} off on eligible bookings!
  {{/if}}
{{/if}}`;

const promoCodeTemplate = Handlebars.compile(templateString);

export { promoCodeTemplate };
