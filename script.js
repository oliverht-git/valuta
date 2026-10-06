const form = document.querySelector('#change-form');
const result = document.querySelector('#result');
const currencySelect = document.querySelector('#currency-select');
const targetCurrencySelect = document.querySelector('#target-currency-select');
const costInput = document.querySelector('#cost');
const paidInput = document.querySelector('#paid');

const currencies = {
    SEK: {
        locale: 'sv-SE',
        decimals: 0,
        denominations: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 20
    },
    EUR: {
        locale: 'de-DE',
        decimals: 2,
        denominations: [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 500
    },
    GBP: {
        locale: 'en-GB',
        decimals: 2,
        denominations: [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 500
    },
    USD: {
        locale: 'en-US',
        decimals: 2,
        denominations: [10000, 5000, 2000, 1000, 500, 200, 100, 25, 10, 5, 1],
        noteMin: 100
    }
};

function getCurrency() {
    return currencies[currencySelect.value];
}

function formatAmount(minorUnits, currencyCode = currencySelect.value) {
    const { locale, decimals } = currencies[currencyCode];
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(minorUnits / (10 ** decimals));
}

function updateCurrencyFields() {
    const { decimals } = getCurrency();
    const step = decimals === 0 ? '1' : '0.01';
    const example = decimals === 0 ? 'Skriv kostnad' : 'Skriv belopp';
    const currencyCode = currencySelect.value;

    for (const input of [costInput, paidInput]) {
        input.step = step;
        input.placeholder = example;
    }

    document.querySelectorAll('.source-currency-label, #source-currency-label').forEach((label) => {
        label.textContent = currencyCode;
    });
}

function toMinorUnits(input, decimals) {
    const value = Number(input.value);
    const multiplier = 10 ** decimals;

    if (input.value === '' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * multiplier))) {
        return null;
    }

    const roundedValue = Math.round(value * multiplier);
    if (Math.abs(value * multiplier - roundedValue) > 0.000001) {
        return null;
    }

    return roundedValue;
}

async function getExchangeRate(sourceCurrency, targetCurrency) {
    if (sourceCurrency === targetCurrency) {
        return 1;
    }

    const response = await fetch(`https://open.er-api.com/v6/latest/${sourceCurrency}`);
    if (!response.ok) {
        throw new Error('Exchange rate request failed');
    }

    const data = await response.json();
    const rate = data.rates?.[targetCurrency];
    if (data.result !== 'success' || !Number.isFinite(rate)) {
        throw new Error('Exchange rate unavailable');
    }

    return rate;
}

function createBreakdown(amount, currencyCode) {
    const { denominations, noteMin } = currencies[currencyCode];
    let remaining = amount;

    return denominations
        .map((value) => {
            const count = Math.floor(remaining / value);
            remaining %= value;
            return { value, count };
        })
        .filter(({ count }) => count > 0)
        .map(({ value, count }) => {
            const unit = value >= noteMin ? 'sedel' : 'mynt';
            const unitLabel = count === 1 ? unit : (unit === 'sedel' ? 'sedlar' : 'mynt');
            return `<li><span>${formatAmount(value, currencyCode)} ${unitLabel}</span><strong>${count} st</strong></li>`;
        })
        .join('');
}

currencySelect.addEventListener('change', updateCurrencyFields);
updateCurrencyFields();

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const sourceCurrency = currencySelect.value;
    const targetCurrency = targetCurrencySelect.value;
    const { decimals } = getCurrency();
    const cost = toMinorUnits(costInput, decimals);
    const paid = toMinorUnits(paidInput, decimals);

    result.hidden = false;

    if (cost === null || paid === null) {
        const precisionMessage = decimals === 0 ? 'heltal' : 'belopp med högst två decimaler';
        result.innerHTML = `<p class="message error">Ange kostnad och betalning som ${precisionMessage} på 0 eller mer.</p>`;
        return;
    }

    if (paid < cost) {
        result.innerHTML = `<p class="message error">Betalningen räcker inte. Det saknas <strong>${formatAmount(cost - paid)}</strong>.</p>`;
        return;
    }

    const sourceChange = paid - cost;
    if (sourceChange === 0) {
        result.innerHTML = '<h2>Jämna pengar</h2><p class="message">Ingen växel ska lämnas tillbaka.</p>';
        return;
    }

    result.hidden = false;
    result.innerHTML = '<p class="message">Hämtar växelkurs …</p>';

    try {
        const rate = await getExchangeRate(sourceCurrency, targetCurrency);
        const sourceAmount = sourceChange / (10 ** decimals);
        const targetDecimals = currencies[targetCurrency].decimals;
        const targetAmount = Math.round(sourceAmount * rate * (10 ** targetDecimals));
        const breakdown = createBreakdown(targetAmount, targetCurrency);
        const rateText = new Intl.NumberFormat(currencies[targetCurrency].locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        }).format(rate);
        const conversionDetails = sourceCurrency === targetCurrency
            ? ''
            : `<p class="conversion-detail">${formatAmount(sourceChange, sourceCurrency)} · 1 ${sourceCurrency} = ${rateText} ${targetCurrency}</p>`;

        result.innerHTML = `<h2>Växel att lämna tillbaka i ${targetCurrency}</h2><p class="result-total">${formatAmount(targetAmount, targetCurrency)}</p>${conversionDetails}<ul class="denominations">${breakdown}</ul>`;
    } catch {
        result.innerHTML = '<p class="message error">Det gick inte att hämta växelkursen. Kontrollera internetanslutningen och försök igen.</p>';
    }
});
